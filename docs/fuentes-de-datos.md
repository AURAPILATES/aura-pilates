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
- **Confirmado por investigación directa en la API (jun 2026):** la cuenta de Stripe tiene **0 Products, 0 Prices y 0 Subscriptions configurados**. Los clientes pagan a través de **Payment Links** (cobros individuales, sin vincular a esos objetos), por lo que Stripe nunca podrá darnos un desglose de ingresos por producto ni un MRR/ARR real — solo importe y fecha del cobro. Cualquier intento de "adivinar" el producto por el importe del cobro es una heurística frágil (descuentos, prorrateos) y se ha descartado en favor de Momence (ver abajo).

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

#### Snapshot diario de suscriptores (para medir bajas y reactivaciones)
Como `Customers` solo da el estado actual, se monta un cron diario que guarda una foto:

- **Cron:** `/api/cron/snapshot-subscribers`, programado en `vercel.json` a las 3:00 AM cada día, protegido con la env var `CRON_SECRET`.
- **Dónde se guarda:** tabla Supabase `subscriber_snapshots` (`date`, `email`, `membership_name`, `subscription_id`, `is_freezed`, `created_at_momence`, `end_date`).
- **Cómo se usará:** comparando el snapshot de un día con el anterior — quien desaparece es una baja, quien reaparece tras ausencia es una reactivación. El histórico empieza a acumularse desde el día que se activó (16 jun 2026), no es retroactivo.

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

- **Tablas:** `transactions` (movimientos bancarios importados), `categories`, `budgets` (financiación/préstamos), `momence_history` (histórico de ocupación de clases), `subscriber_snapshots` (snapshot diario de suscriptores activos)
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
| Bajas / reactivaciones de suscriptores | Supabase `subscriber_snapshots` | Automáticamente (cron diario 3 AM) |
| Vacaciones | `data/vacaciones.json` | Manual (editar archivo) |
