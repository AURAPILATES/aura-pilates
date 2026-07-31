import { unstable_cache } from "next/cache";

const BASE_URL = "https://momence.com/_api/primary/api/v1";

class MomenceHttpError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Reintenta fallos transitorios (red, 429, 5xx) con backoff. No reintenta
// errores 4xx (token/host inválido, etc.) porque insistir no los arregla y
// solo retrasa el error real.
async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const retryable = !(e instanceof MomenceHttpError) || e.status === 429 || e.status >= 500;
      if (!retryable || i === attempts - 1) break;
      await sleep(1000 * 2 ** i); // 1s, 2s, 4s...
      console.warn(`${label}: intento ${i + 1}/${attempts} falló, reintentando - ${e instanceof Error ? e.message : e}`);
    }
  }
  throw lastError;
}

// Nunca devuelve [] en caso de error: un fallo silencioso aquí se confunde con
// "no hay datos" y provoca pérdida de histórico en los cron de snapshot.
async function fetchMomence<T>(endpoint: string): Promise<T> {
  return withRetry(() => fetchMomenceOnce<T>(endpoint), `Momence (${endpoint})`);
}

async function fetchMomenceOnce<T>(endpoint: string): Promise<T> {
  const params = new URLSearchParams({
    hostId: process.env.MOMENCE_HOST_ID ?? "",
    token: process.env.MOMENCE_TOKEN ?? "",
  });
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/${endpoint}?${params}`, {
      next: { revalidate: 1800, tags: ["momence"] },
    });
  } catch (e) {
    throw new Error(`Momence (${endpoint}): sin conexión - ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new MomenceHttpError(`Momence (${endpoint}): HTTP ${res.status} ${body.slice(0, 200)}`, res.status);
  }
  return res.json();
}

export type MomenceEvent = {
  id: number;
  title: string;
  description: string;
  type: string;
  link: string;
  dateTime: string;
  image1: string | null;
  image2: string | null;
  duration: number;
  fixedPrice: number;
  online: boolean;
  location: string;
  isCancelled: boolean;
  isDeleted: boolean;
  allowWaitlist: boolean;
  /** Personas en lista de espera. NO viene de la API interna: lo enriquece HorarioLoader desde
   * el detalle de la API v2 (getWaitlistCountsV2) para clases futuras llenas o casi llenas.
   * undefined = no consultado (clase pasada o con hueco de sobra). */
  waitlistCount?: number;
  capacity: number;
  spotsRemaining: number;
  ticketsSold: number;
  published: boolean;
  teacherId: number;
  teacher: string;
  additionalTeachers: string[];
};

export type MomenceTeacher = {
  id: number;
  firstName: string;
  lastName: string;
  bio: string | null;
  profileImage: string | null;
  isDeleted: boolean;
};

export type MomenceMembership = {
  id: number;
  name: string;
  description: string;
  type: "subscription" | "package-events";
  link: string;
  price: number;
  freeTrialExists: boolean;
  isFeatured: boolean;
  isDeleted: boolean;
  isDisabled: boolean;
  isAutoRenewing: boolean;
};

export type MomenceProduct = {
  id: number;
  name: string;
  description: string;
  price: number;
  link: string;
  isDeleted: boolean;
};

export type MomenceVideo = {
  id: number;
  title: string;
  description: string;
  link: string;
  duration: number;
  isDeleted: boolean;
};

export const getEvents = unstable_cache(
  () => fetchMomence<MomenceEvent[]>("Events"),
  ["momence-events"], { revalidate: 1800, tags: ["momence"] },
);
export const getTeachers = unstable_cache(
  () => fetchMomence<MomenceTeacher[]>("Teachers"),
  ["momence-teachers"], { revalidate: 1800, tags: ["momence"] },
);
export const getMemberships = unstable_cache(
  () => fetchMomence<MomenceMembership[]>("Memberships"),
  ["momence-memberships"], { revalidate: 1800, tags: ["momence"] },
);
export const getProducts = unstable_cache(
  () => fetchMomence<MomenceProduct[]>("Products"),
  ["momence-products"], { revalidate: 1800, tags: ["momence"] },
);
export const getVideos = unstable_cache(
  () => fetchMomence<MomenceVideo[]>("Videos"),
  ["momence-videos"], { revalidate: 1800, tags: ["momence"] },
);

export type MomenceActiveSubscription = {
  id: number;
  type: "subscription" | "package-events";
  endDate: string | null;
  createdAt: string;
  moneyLeft: number | null;
  totalMoney: number | null;
  classesLeft: number | null;
  totalClasses: number | null;
  isFreezed: boolean;
  membership: { id: number; name: string };
};

export type MomenceCustomer = {
  email: string;
  firstName: string;
  lastName: string;
  firstSeen: string;
  lastSeen: string;
  memberId: number;
  phoneNumber: string | null;
  activeSubscriptions: MomenceActiveSubscription[];
};

type CustomersPage = {
  payload: MomenceCustomer[];
  pagination: { page: number; pageSize: number; totalCount: number };
};

async function fetchCustomersPage(page: number, pageSize: number): Promise<CustomersPage> {
  return withRetry(() => fetchCustomersPageOnce(page, pageSize), `Momence (Customers p${page})`);
}

async function fetchCustomersPageOnce(page: number, pageSize: number): Promise<CustomersPage> {
  const params = new URLSearchParams({
    hostId: process.env.MOMENCE_HOST_ID ?? "",
    token: process.env.MOMENCE_TOKEN ?? "",
    page: String(page),
    pageSize: String(pageSize),
  });
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/Customers?${params}`, { next: { revalidate: 1800, tags: ["momence"] } });
  } catch (e) {
    throw new Error(`Momence (Customers p${page}): sin conexión - ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new MomenceHttpError(`Momence (Customers p${page}): HTTP ${res.status} ${body.slice(0, 200)}`, res.status);
  }
  return res.json();
}

// Trae todos los clientes paginando (≈368 a fecha de hoy).
// Si falla una página a mitad de la paginación, se propaga el error en vez de
// devolver una lista parcial (que dejaría fuera clientes reales del snapshot).
async function _getCustomers(): Promise<MomenceCustomer[]> {
  const pageSize = 100;
  const first = await fetchCustomersPage(1, pageSize);
  const all = [...first.payload];
  const totalPages = Math.ceil(first.pagination.totalCount / pageSize);
  for (let page = 2; page <= totalPages; page++) {
    const next = await fetchCustomersPage(page, pageSize);
    all.push(...next.payload);
  }
  return all;
}

export const getCustomers = unstable_cache(
  _getCustomers,
  ["momence-customers"],
  { revalidate: 1800, tags: ["momence"] },
);
