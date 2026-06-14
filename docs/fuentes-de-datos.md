# Fuentes de datos y cómo importar movimientos

## De dónde vienen los datos

### Clientes y pagos — Stripe
Toda la actividad de cobros a clientes se obtiene en tiempo real desde **Stripe**.

- **Qué se usa:** `stripe.charges.list()` — lista de cobros completados
- **Qué se calcula a partir de ahí:**
  - Total de clientes y su historial de pagos
  - Clientes recurrentes: los que han pagado en 2 o más de los últimos 3 meses
  - MRR estimado: media de los últimos 3 meses completos de ingresos Stripe
  - Posibles bajas: clientes que pagaron el mes pasado pero no este mes
  - Ingresos recurrentes vs. pagos únicos en la sección Finanzas
- **Importante:** los clientes pagan a través de **Payment Links** de Stripe (cobros individuales), no mediante Suscripciones de Stripe. Por eso la sección de suscripciones devuelve 0 — no existen; la recurrencia se detecta mirando el patrón de pagos.

---

### Productos y ventas — Momence (CSV)
El desglose de ingresos por tipo de producto (Suscripción, Clase, Paquete) proviene de **Momence**.

- **Qué se usa:** archivo `data/sales.csv` exportado manualmente desde Momence
- **Qué contiene:** columnas de Categoría, Elemento, Fecha de pago, Método de pago, Valor de la venta
- **Qué se calcula:** gráfico de donut por producto en Finanzas → "Por producto"
- **Cómo actualizarlo:** descargar el CSV desde Momence (Informes → Exportar ventas) y reemplazar `data/sales.csv` en el repositorio

> La API de Momence no expone un endpoint de ventas o pedidos, por lo que el CSV es la única fuente disponible.

---

### Transacciones bancarias — CaixaBank (importación CSV)
Los movimientos de la cuenta bancaria se importan manualmente desde **CaixaBank**.

- **Dónde se guardan:** base de datos Supabase, tabla `transactions`
- **Qué se usa:** extracto bancario exportado como CSV desde CaixaBank
- **Qué se calcula:** gastos operativos, gráfico de desglose por categoría, saldo, runway, punto de equilibrio

#### Cómo importar nuevos movimientos

1. Entra en **CaixaBank Online** → Posición Global → selecciona la cuenta de Aura Pilates
2. Ve a **Movimientos** y filtra el rango de fechas que quieras importar
3. Pulsa **Exportar** y descarga el archivo en formato **CSV**
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
Todo lo que se importa (transacciones bancarias, categorías, vacaciones, notas) se almacena en **Supabase**.

- Las transacciones de Stripe y los datos de Momence se leen en tiempo real; no se guardan en Supabase.
- Las transacciones bancarias sí se guardan: una vez importadas, permanecen aunque no vuelvas a subir el CSV.

---

### Vacaciones — archivo local
Los datos de vacaciones se leen del archivo `data/vacaciones.json`. Para modificarlos hay que editar ese archivo directamente.

---

## Resumen rápido

| Sección | Fuente | Se actualiza |
|---|---|---|
| Clientes | Stripe (tiempo real) | Automáticamente |
| Finanzas – ingresos Stripe | Stripe (tiempo real) | Automáticamente |
| Finanzas – por producto | Momence CSV (`data/sales.csv`) | Manual (reemplazar CSV) |
| Finanzas – gastos / saldo | CaixaBank CSV → Supabase | Manual (importar desde la app) |
| Transacciones | CaixaBank CSV → Supabase | Manual (importar desde la app) |
| Horario | Momence (API, tiempo real) | Automáticamente |
| Vacaciones | `data/vacaciones.json` | Manual (editar archivo) |
