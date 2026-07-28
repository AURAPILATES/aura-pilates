// Cliente de la API pública v2 de Momence (https://api.momence.com).
//
// Distinta de la API interna que usa lib/momence.ts (momence.com/_api/... con
// hostId+token). La v2 usa OAuth2:
//   1. POST /api/v2/auth/token  con HTTP Basic (client_id:client_secret) y body
//      grant_type=password + usuario/contraseña de Momence  -> accessToken.
//   2. Todos los /host/* usan  Authorization: Bearer <accessToken>.
//
// Necesita en el entorno:
//   MOMENCE_CLIENT_ID       (de Momence -> Apps & Integrations -> Developer API)
//   MOMENCE_CLIENT_SECRET   (idem)
//   MOMENCE_USERNAME        (email de tu cuenta host de Momence)
//   MOMENCE_PASSWORD        (contraseña de esa cuenta)
//
// Solo GET / lectura: no llamamos a ningún endpoint que modifique datos.

const BASE_V2 = "https://api.momence.com/api/v2";

class MomenceV2HttpError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mismo criterio que lib/momence.ts: reintenta transitorios (red, 429, 5xx),
// no reintenta 4xx (credenciales/permiso inválidos: insistir no los arregla).
async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const retryable = !(e instanceof MomenceV2HttpError) || e.status === 429 || e.status >= 500;
      if (!retryable || i === attempts - 1) break;
      await sleep(1000 * 2 ** i); // 1s, 2s, 4s...
      console.warn(`${label}: intento ${i + 1}/${attempts} falló, reintentando - ${e instanceof Error ? e.message : e}`);
    }
  }
  throw lastError;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Momence v2: falta la variable de entorno ${name}`);
  return v;
}

// ---------------------------------------------------------------------------
// Autenticación
// ---------------------------------------------------------------------------

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

// Guarda el accessToken en memoria del proceso hasta ~1 min antes de expirar.
// (En serverless el cache dura lo que dure la instancia; si se pierde, se pide
// otro token de forma transparente.)
async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;

  const clientId = requireEnv("MOMENCE_CLIENT_ID");
  const clientSecret = requireEnv("MOMENCE_CLIENT_SECRET");
  const username = requireEnv("MOMENCE_USERNAME");
  const password = requireEnv("MOMENCE_PASSWORD");

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({ grant_type: "password", username, password });

  const token = await withRetry(async () => {
    let res: Response;
    try {
      res = await fetch(`${BASE_V2}/auth/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        cache: "no-store",
      });
    } catch (e) {
      throw new Error(`Momence v2 (auth/token): sin conexión - ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new MomenceV2HttpError(`Momence v2 (auth/token): HTTP ${res.status} ${text.slice(0, 200)}`, res.status);
    }
    const json = (await res.json()) as {
      accessToken?: string;
      access_token?: string;
      accessTokenExpiresAt?: string;
    };
    const accessToken = json.accessToken ?? json.access_token;
    if (!accessToken) {
      throw new Error(`Momence v2 (auth/token): respuesta sin accessToken - ${JSON.stringify(json).slice(0, 200)}`);
    }
    const expMs = json.accessTokenExpiresAt ? Date.parse(json.accessTokenExpiresAt) : NaN;
    // Si no viene fecha de expiración válida, asumimos 30 min por prudencia.
    const expiresAt = (Number.isFinite(expMs) ? expMs : Date.now() + 30 * 60_000) - 60_000;
    tokenCache = { token: accessToken, expiresAt };
    return accessToken;
  }, "Momence v2 (auth/token)");

  return token;
}

// ---------------------------------------------------------------------------
// Fetch autenticado
// ---------------------------------------------------------------------------

async function fetchV2<T>(path: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
  return withRetry(() => fetchV2Once<T>(path, params), `Momence v2 (${path})`);
}

async function fetchV2Once<T>(path: string, params: Record<string, string | number | boolean>): Promise<T> {
  const token = await getAccessToken();
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  );
  const query = qs.toString();
  let res: Response;
  try {
    res = await fetch(`${BASE_V2}${path}${query ? `?${query}` : ""}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch (e) {
    throw new Error(`Momence v2 (${path}): sin conexión - ${e instanceof Error ? e.message : String(e)}`);
  }
  // Un 401 puede ser token expirado antes de tiempo: invalidamos el cache para
  // que el reintento pida uno nuevo.
  if (res.status === 401) {
    tokenCache = null;
    const text = await res.text().catch(() => "");
    throw new MomenceV2HttpError(`Momence v2 (${path}): HTTP 401 ${text.slice(0, 200)}`, 401);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new MomenceV2HttpError(`Momence v2 (${path}): HTTP ${res.status} ${text.slice(0, 200)}`, res.status);
  }
  return res.json();
}

type Paginated<T> = {
  payload: T[];
  pagination: { page: number; pageSize: number; totalCount: number };
};

// Recorre todas las páginas de un endpoint paginado de la v2 (page empieza en 0).
async function fetchAllPages<T>(
  path: string,
  params: Record<string, string | number | boolean>,
  pageSize: number,
): Promise<T[]> {
  const first = await fetchV2<Paginated<T>>(path, { ...params, page: 0, pageSize });
  const all = [...first.payload];
  const totalPages = Math.ceil(first.pagination.totalCount / pageSize);
  for (let page = 1; page < totalPages; page++) {
    const next = await fetchV2<Paginated<T>>(path, { ...params, page, pageSize });
    all.push(...next.payload);
  }
  return all;
}

// ---------------------------------------------------------------------------
// Tipos (subconjunto del schema OpenAPI v2 relevante para asistencia por clase)
// ---------------------------------------------------------------------------

export type MomenceV2SessionType =
  | "private" | "special-event" | "special-event-new" | "retreat"
  | "fitness" | "course" | "course-class" | "semester" | "recital";

export type MomenceV2Session = {
  id: number;
  name: string;
  type: MomenceV2SessionType;
  description: string | null;
  // El schema define más campos (startsAt/endsAt/teacher…); se amplían cuando
  // se necesiten. Dejamos passthrough para no perder datos al depurar.
  [key: string]: unknown;
};

export type MomenceV2Teacher = {
  id: number;
  firstName: string;
  lastName: string;
  pictureUrl: string | null;
  email: string | null;
};

export type MomenceV2SessionDetail = {
  id: number;
  name: string;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  bookingCount: number | null;
  waitlistCapacity: number | null;
  waitlistBookingCount: number | null;
  teacher: MomenceV2Teacher | null;
  originalTeacher: MomenceV2Teacher | null;
  additionalTeachers: MomenceV2Teacher[] | null;
};

export type MomenceV2Member = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
  pictureUrl: string | null;
};

export type MomenceV2SessionBooking = {
  id: number;
  member: MomenceV2Member;
  roomSpotId: number | null;
  checkedIn: boolean;
  ticketsBought: number;
  createdAt: string;
  isRecurring: boolean;
  recurringBookingId: number | null;
  cancelledAt: string | null;
};

// ---------------------------------------------------------------------------
// Endpoints (solo lectura)
// ---------------------------------------------------------------------------

// Lista de sesiones en un rango. Fechas en ISO. `types` filtra por tipo.
export async function getSessionsV2(opts: {
  startAfter?: string;
  startBefore?: string;
  endAfter?: string;
  endBefore?: string;
  types?: MomenceV2SessionType[];
  includeCancelled?: boolean;
  pageSize?: number;
} = {}): Promise<MomenceV2Session[]> {
  const { types, pageSize = 200, ...rest } = opts;
  const params: Record<string, string | number | boolean> = { sortBy: "startsAt", sortOrder: "ASC" };
  for (const [k, v] of Object.entries(rest)) if (v !== undefined) params[k] = v as string | boolean;
  if (types?.length) params.types = types.join(",");
  return fetchAllPages<MomenceV2Session>("/host/sessions", params, Math.min(pageSize, 200));
}

// Detalle de una sesión (capacidad, ocupación, profesores).
export function getSessionDetailV2(sessionId: number): Promise<MomenceV2SessionDetail> {
  return fetchV2<MomenceV2SessionDetail>(`/host/sessions/${sessionId}`);
}

// Reservas de una sesión: quién reservó, si hizo check-in, cuántas plazas, si
// canceló. Esto es lo que la API interna nunca expuso.
export function getSessionBookingsV2(
  sessionId: number,
  opts: { includeCancelled?: boolean; pageSize?: number } = {},
): Promise<MomenceV2SessionBooking[]> {
  const { includeCancelled = false, pageSize = 100 } = opts;
  return fetchAllPages<MomenceV2SessionBooking>(
    `/host/sessions/${sessionId}/bookings`,
    { includeCancelled },
    Math.min(pageSize, 100),
  );
}

// ---------------------------------------------------------------------------
// Miembros / suscripciones (equivalente v2 de getCustomers + activeSubscriptions)
// ---------------------------------------------------------------------------

export type MomenceV2HostMember = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
  pictureUrl: string | null;
  firstSeen: string;
  lastSeen: string;
  // visits / customerFields / customerTags existen en el schema; se añaden cuando se usen.
  [key: string]: unknown;
};

export type MomenceV2BoughtMembershipType =
  | "subscription" | "on-demand-subscription" | "package-events" | "package-money" | "patron";

// Suscripción/pack comprado por un miembro. Más rico que el activeSubscriptions
// de la API interna: distingue 5 tipos y separa créditos de eventos vs dinero.
export type MomenceV2BoughtMembership = {
  id: number;
  type: MomenceV2BoughtMembershipType;
  startDate: string | null;
  endDate: string | null;
  isFrozen: boolean;
  eventCreditsLeft: number | null;
  eventCreditsTotal: number | null;
  moneyCreditsLeft: number | null;
  moneyCreditsTotal: number | null;
  membership: { id: number; name: string } | null;
};

// Lista de miembros. `filterPreset: "with-active-membership"` trae solo los que
// tienen una suscripción/pack activo (útil para churn).
export async function getMembersV2(opts: {
  query?: string;
  filterPreset?: "with-active-membership";
  pageSize?: number;
} = {}): Promise<MomenceV2HostMember[]> {
  const { pageSize = 100, ...rest } = opts;
  const params: Record<string, string | number | boolean> = { sortBy: "lastSeenAt", sortOrder: "DESC" };
  for (const [k, v] of Object.entries(rest)) if (v !== undefined) params[k] = v as string;
  // /host/members tope pageSize en 100 (devuelve 400 si se pide más).
  return fetchAllPages<MomenceV2HostMember>("/host/members", params, Math.min(pageSize, 100));
}

// Suscripciones/packs activos de un miembro. `includeFrozen` incluye los congelados.
export function getMemberBoughtMembershipsV2(
  memberId: number,
  opts: { includeFrozen?: boolean; pageSize?: number } = {},
): Promise<MomenceV2BoughtMembership[]> {
  const { includeFrozen = true, pageSize = 100 } = opts;
  return fetchAllPages<MomenceV2BoughtMembership>(
    `/host/members/${memberId}/bought-memberships/active`,
    { includeFrozen },
    Math.min(pageSize, 100),
  );
}

// Health check para el banner de desconexión. Hace una llamada real mínima
// (1 miembro) en vez de solo pedir token: así valida que el token es aceptado
// de verdad (detecta credenciales inválidas, no solo fallo al autenticar).
// Lanza el error real si algo falla; los transitorios ya se reintentan dentro.
export async function checkV2Connection(): Promise<boolean> {
  await fetchV2<{ pagination: unknown }>("/host/members", { page: 0, pageSize: 1 });
  return true;
}
