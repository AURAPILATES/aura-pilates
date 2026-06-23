# Fuentes de datos y cómo importar movimientos

## De dónde vienen los datos

### Clientes y pagos — Stripe
Toda la actividad de cobros a clientes se obtiene en tiempo real desde **Stripe**.

- **Qué se usa:** `stripe.charges.list()` — lista de cobros completados
- **Qué se calcula a partir de ahí:**
  - Total de clientes y su historial de pagos
  - Clientes recurrentes: los que han pagado en 2 o más de los últimos 3 meses
  - Posibles bajas: clientes que pagaron el mes pasado pero no este mes
  - Ingresos recurrentes vs. pagos únicos en la sección Finanzas
- **Inferencia de producto por importe (implementado jun 2026):** como Momence no pasa metadatos de producto a Stripe, el dashboard infiere el producto de cada cobro comparando el importe con los precios conocidos de Momence (75 € Bàsic / 140 € Plus / 180 € Pro / 90 € Pack 4 / 170 € Pack 8 / 25 € Pack Benvinguda / 20 € Clase suelta). Pagos con descuento, prorrateo o precio distinto quedan como "Otro". Se trata de una **estimación**, no de datos exactos.
- **Estados de actividad del cliente (implementado jun 2026):** la tabla de clientes clasifica cada cliente en función del tipo de su último pago y los días transcurridos. Cada tipo de producto tiene su propia ventana de validez y un margen de 15 días antes de pasar a "Baja". El estado se evalúa por tipo de pago: las suscripciones se miran separadamente de los packs (una clase suelta extra no resetea el contador de la suscripción).

  | Producto | Válido | "Por vencer" | "Caducado / Sin pagar" | "Baja" |
  |---|---|---|---|---|
  | Suscripción (renueva c/30d) | ≤ 30d | — | 31–45d | > 45d |
  | Pack 4 u 8 clases (válido 90d) | ≤ 76d | 77–90d | 91–105d | > 105d |
  | Pack Benvinguda (válido 15d) | ≤ 15d | — | > 15d | — |
  | Clase suelta | No caduca | — | — | — |

  - **Suscripciones:** "Recurrente" solo se asigna si ha habido pagos de suscripción en ≥ 2 de los últimos 3 meses. El estado es independiente de los pagos de pack que pueda tener.
  - **"Por vencer"** (ámbar): solo para packs, avisa en los últimos 14 días de validez.
  - **"Baja"** (rojo): 15 días después del vencimiento para cualquier tipo — mismo criterio para suscripciones y packs.
  - Cualquier nuevo pago del tipo correspondiente resetea el contador a "Al día".
  - Clase suelta nunca genera ningún estado de alerta.
- **Confirmado por investigación directa en la API (jun 2026):** la cuenta de Stripe tiene **0 Products, 0 Prices y 0 Subscriptions configurados**. Esto es consecuencia de cómo funciona Momence: cuando un alumno compra una suscripción o pack en Momence, Momence genera un **Payment Link puntual en Stripe** (un cobro individual) en lugar de crear una Subscription object de Stripe. Momence gestiona internamente la lógica de renovación y acceso, pero no traspasa esa estructura a Stripe. El resultado es que desde Stripe solo vemos cobros individuales sin ningún metadato de producto, por lo que Stripe nunca podrá darnos un desglose de ingresos por producto ni un MRR/ARR real — solo importe y fecha. Cualquier intento de "adivinar" el producto por el importe del cobro es una heurística frágil (descuentos, prorrateos) y se ha descartado en favor de Momence (ver abajo).

---

### Productos, suscripciones y MRR — Momence (API en vivo)
Momence es la fuente de verdad de **qué productos existen, sus precios, y quién está suscrito a qué ahora mismo**. No depende de CSV.

- **Catálogo de productos** — `GET /Memberships`: nombre, precio y tipo (`subscription` vs `package-events`) de cada producto. Confirmado en jun 2026:
  | Producto | Tipo | Precio |
  |---|---|---|
  | Bàsic | Suscripción | 75 €/mes |
  | Plus | Suscripción | 140 €/mes |
  | Pro | Suscripción | 180 €/mes |
  | Pack Benvinguda | Paquete | 25 € |
  | Clase suelta | Paquete | 20 € |
  | Pack 4 clases | Paquete | 90 € |
  | Pack 8 clases | Paquete | 170 € |
- **Clientes y sus suscripciones activas** — `GET /Customers` (paginado, ~368 clientes): cada cliente trae `activeSubscriptions[]` con el tier exacto (`membership.name`), `createdAt`, `endDate` (si tiene baja programada) e `isFreezed` (pausada).
  - **MRR/ARR real** (Finanzas → Q8): nº de suscriptores activos (no congelados) por tier × precio del tier. Ya no se basa en CSV ni en adivinar por importe de Stripe.
  - **Limitación:** este endpoint solo devuelve el estado **actual**. No expone historial de bajas o reactivaciones pasadas en una sola llamada.
- **No existen** en la API de Momence: `Sales`, `Transactions`, `Payments`, `Orders`, `Bookings` ni `CustomerMemberships` (probado y devuelven 404). Por eso el histórico de ventas por producto (breakeven, conversión del Pack Benvinguda) sigue usando el CSV `data/sales.csv`.
- **Sin datos de asistentes por clase (investigado jun 2026):** la API no expone quién asistió a cada sesión ni con qué membresía reservó. Todos los endpoints probados devuelven 404: `Events/{id}/Registrations`, `/Attendees`, `/Tickets`, `/Bookings`, `/Members`, `/CheckIns`, `EventRegistrations`, `Bookings`, `MemberBookings`, `Customers/{id}/Bookings`, `Customers/{id}/Attendances`, `Customers/{id}/Sessions`. El único dato de ocupación disponible por clase es el agregado `ticketsSold` (número total de plazas ocupadas, sin desglose por tipo de membresía). Para ver asistentes reales hay que entrar al panel de Momence manualmente.

#### Snapshot diario de suscriptores (para medir bajas y reactivaciones)
Como `Customers` solo da el estado actual, se monta un cron diario que guarda una foto:

- **Cron:** `/api/cron/snapshot-subscribers`, programado en `vercel.json` a las 3:00 AM cada día, protegido con la env var `CRON_SECRET`.
- **Dónde se guarda:** tabla Supabase `subscriber_snapshots` (`date`, `email`, `membership_name`, `subscription_id`, `is_freezed`, `created_at_momence`, `end_date`).
- **Cómo se usará:** comparando el snapshot de un día con el anterior — quien desaparece es una baja, quien reaparece tras ausencia es una reactivación. El histórico empieza a acumularse desde el día que se activó (16 jun 2026), no es retroactivo.

---

### Histórico de clases (ocupación, mapa de calor) — Momence `Events` + Supabase

La sección Horario › Análisis (KPIs, mapa de calor, evolución de ocupación) necesita ver clases **pasadas**, pero la API en vivo de Momence no las conserva indefinidamente.

- **Qué se usa:** `GET /Events` vía `lib/momence.ts` (`getEvents()`, cacheado 300s con `unstable_cache`). Este endpoint **no es un histórico completo**: solo devuelve eventos recientes/próximos dentro de una ventana móvil, no todo lo que ha pasado desde siempre.
- **Por eso existe un histórico propio:** cada vez que se carga una página que llama a `getEvents()`, el resultado se vuelca también a la tabla Supabase `momence_history` (`lib/history.ts`: `saveHistoricalEvents` / `loadHistoricalEvents`). Horario combina ambas fuentes: histórico guardado + lo que la API devuelve ahora, deduplicado por `id`.
- **Problema descubierto (jun 2026):** este volcado solo pasaba **cuando alguien visitaba el dashboard**. Si nadie entraba a Horario durante varios días, esos días no quedaban guardados y, al salir de la ventana móvil de la API, esas clases se perdían para siempre — visible como huecos en el mapa de calor y en "Evolución de la ocupación" (tooltips mostrando solo 5-6 clases en días que tuvieron más). No era un fallo de la API de Momence, sino de cobertura: dependía de visitas humanas en el momento justo.
- **Fix implementado:** cron diario `/api/cron/snapshot-events` (`app/api/cron/snapshot-events/route.ts`), programado en `vercel.json` a las 22:00 cada día, protegido con `CRON_SECRET`. Llama a `getEvents()` y `saveHistoricalEvents()` igual que haría una visita al dashboard, así el histórico no depende de que alguien navegue a Horario ese día.
- **Huecos previos al cron:** el histórico hasta el 12 jun 2026 se rellenó a mano con `scripts/seed-history.mjs` (datos transcritos de capturas de pantalla del panel de Momence). Las semanas del 15/06 y 22/06 quedaron con huecos porque el cron aún no existía; pendiente de backfill manual con el mismo patrón en cuanto se disponga de los datos de esos días.

---

### Fiabilidad de la sincronización con Momence (jun 2026)

**Problema detectado:** `lib/momence.ts` devolvía `[]` ante cualquier fallo de red o HTTP, indistinguible de "no hay datos". Esto alimentaba directamente los cron de snapshot (`snapshot-events`, `snapshot-subscribers`), que escriben histórico **permanente** en Supabase. Si Momence fallaba justo durante la ejecución del cron, este respondía `200 OK` con "0 elementos" y ese día se perdía para siempre — sin error visible en ningún sitio, porque la API de Momence no expone retroactivamente el estado de días pasados.

**Capas de protección implementadas:**

1. **Errores explícitos, nunca silenciosos.** `fetchMomence` y `fetchCustomersPage` (`lib/momence.ts`) lanzan un error con el mensaje exacto (status HTTP, cuerpo de la respuesta, o "sin conexión") en vez de devolver `[]`. Esto significa que un fallo real ya no se puede confundir con "no había datos ese día".
2. **Reintentos automáticos dentro de la misma ejecución.** Cada llamada a Momence se reintenta hasta 3 veces con backoff (1s, 2s, 4s) si el fallo es de red, HTTP 429 o 5xx. Los errores 4xx (token/host inválido) no se reintentan porque insistir no los arregla. Cubre caídas puntuales de segundos.
3. **Reintento programado a las pocas horas.** Cada cron tiene una segunda ejecución diaria en `vercel.json` por si la primera falla del todo (Momence caída varios minutos/horas):
   - `snapshot-subscribers`: 3:00 y 6:00
   - `snapshot-events`: 22:00 y 1:00
   Ambas rutas son **idempotentes** (suscriptores hace `upsert`; eventos salta los días ya guardados), así que repetir la llamada cuando ya tuvo éxito no causa duplicados ni efectos secundarios — solo gasta una llamada extra a la API.
4. **Registro de cada ejecución.** Tabla Supabase `sync_runs` (migración `migrations/007_sync_runs.sql`, hay que ejecutarla manualmente en el SQL Editor de Supabase — este repo no tiene runner de migraciones automático). Cada cron, en éxito o fallo, inserta una fila con `source`, `ok`, `items` y `error` (`lib/syncRuns.ts`).
5. **Visibilidad en el dashboard.** `/api/sync-status` combina el ping en vivo a Momence con la última fila de `sync_runs`: si el snapshot nocturno falló, el panel de sincronización (esquina del sidebar) se marca en rojo con el error exacto, aunque la API responda bien horas después cuando entras a la app. El panel hace `fetch` sin caché en cada carga y se refresca cada 5 minutos si dejas la pestaña abierta — no es instantáneo respecto al momento del fallo, pero sí respecto a la última vez que se comprobó.
6. **Páginas de error con mensaje exacto.** `app/error.tsx` y `app/global-error.tsx` (no existían antes) muestran el error real en pantalla si algo falla al cargar una página, en vez de una pantalla genérica de Next.js.

**Pendiente / fuera de alcance:** esto no cubre una caída de Momence de varias horas que coincida con ambos intentos del día (poco probable, pero posible). En ese caso el snapshot de ese día se perdería igual, y solo se sabría por el error en `sync_runs` / el panel rojo — no hay alerta proactiva (email, Slack) todavía.

---

### Productos y ventas históricas — Momence (CSV)
El desglose de ingresos por producto a lo largo del tiempo (breakeven, conversión del pack de bienvenida) usa el export manual, porque la API no tiene un endpoint de ventas/pedidos histórico.

- **Qué se usa:** archivo `data/sales.csv` exportado manualmente desde Momence
- **Qué contiene:** columnas de Categoría, Elemento, Fecha de pago, email del cliente, Método de pago, Valor de la venta
- **Qué se calcula:** gráfico de donut por producto en Finanzas, breakeven desde el inicio, conversión Pack Benvinguda → Suscripción
- **Cómo actualizarlo:** descargar el CSV desde Momence (Informes → Exportar ventas) y reemplazar `data/sales.csv` en el repositorio

---

### Transacciones bancarias — CaixaBank (importación CSV o Excel)
Los movimientos de la cuenta bancaria se importan manualmente desde **CaixaBank**.

- **Dónde se guardan:** base de datos Supabase, tabla `transactions`
- **Qué se usa:** extracto bancario exportado como **CSV, XLS o XLSX** desde CaixaBank (CaixaBank no siempre permite exportar en CSV; el importador acepta también Excel)
- **Qué se calcula:** gastos operativos, gráfico de desglose por categoría, saldo, runway, punto de equilibrio, breakeven desde el inicio

#### Cómo importar nuevos movimientos

1. Entra en **CaixaBank Online** → Posición Global → selecciona la cuenta de Aura Pilates
2. Ve a **Movimientos** y filtra el rango de fechas que quieras importar
3. Pulsa **Exportar** y descarga el archivo (CSV, XLS o XLSX — el que te deje CaixaBank)
4. En el dashboard, ve a **Transacciones**
5. Pulsa el botón **"Importar movimientos"** (esquina superior derecha)
6. Arrastra el CSV o haz clic para seleccionarlo
7. Revisa la previsualización con los primeros movimientos detectados
8. Pulsa **"Importar N movimientos"** para confirmar

#### Deduplicación automática
El sistema compara cada fila nueva con las ya existentes usando una huella de `fecha + importe + concepto`. Si ya existe un movimiento con esos tres valores, se omite. Al final del proceso se indica cuántos se importaron y cuántos se saltaron.

#### Auto-categorización
Al importar, cada movimiento se categoriza automáticamente buscando las **palabras clave** configuradas en cada categoría (ajustables en Configuración → Categorías). Si ninguna coincide, se asigna la categoría "Otros" — puedes cambiarla manualmente en la tabla de Transacciones.

---

### Base de datos — Supabase
Todo lo que necesita persistir entre despliegues se guarda en **Supabase** (el filesystem de Vercel es de solo lectura, así que nada se puede guardar en archivos locales en producción).

- **Tablas:** `transactions` (movimientos bancarios importados), `categories`, `budgets` (financiación/préstamos), `momence_history` (histórico de clases/ocupación, alimentado por visitas al dashboard + cron diario `snapshot-events`), `subscriber_snapshots` (snapshot diario de suscriptores activos)
- Las transacciones de Stripe y el catálogo/clientes de Momence se leen en tiempo real vía API; no se guardan en Supabase salvo `momence_history` y `subscriber_snapshots`, que son históricos que la propia API no expone retroactivamente.
- Las transacciones bancarias, presupuestos y categorías sí se guardan: una vez importados/creados, permanecen aunque no vuelvas a subir nada.

---

### Vacaciones — archivo local
Los datos de vacaciones se leen del archivo `data/vacaciones.json`. Para modificarlos hay que editar ese archivo directamente.

---

## Resumen rápido

| Sección | Fuente | Se actualiza |
|---|---|---|
| Clientes | Stripe (tiempo real) | Automáticamente |
| Finanzas – ingresos Stripe | Stripe (tiempo real) | Automáticamente |
| Finanzas – MRR/ARR por suscripción | Momence `Customers` (tiempo real) | Automáticamente |
| Finanzas – por producto / breakeven / conversión pack | Momence CSV (`data/sales.csv`) | Manual (reemplazar CSV) |
| Finanzas – gastos / saldo | CaixaBank CSV/Excel → Supabase | Manual (importar desde la app) |
| Finanzas – financiación / préstamos | Supabase (tabla `budgets`) | Manual (editar desde la app) |
| Transacciones | CaixaBank CSV/Excel → Supabase | Manual (importar desde la app) |
| Horario | Momence (API, tiempo real) | Automáticamente |
| Horario – alumnos activos por membresía | Momence `Customers` (tiempo real) | Automáticamente |
| Horario – histórico de clases / mapa de calor | Momence `Events` + Supabase `momence_history` | Automáticamente (visitas + cron diario 22h) |
| Bajas / reactivaciones de suscriptores | Supabase `subscriber_snapshots` | Automáticamente (cron diario 3 AM) |
| Vacaciones | `data/vacaciones.json` | Manual (editar archivo) |
