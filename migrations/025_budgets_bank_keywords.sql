-- Palabras clave bancarias (opcionales) por fuente de financiación: se comparan directamente
-- con el concepto y "más datos" de cada movimiento, sin pasar por el reconocimiento de
-- contactos (Configuración > Contactos). Útil cuando el banco manda un concepto genérico
-- ("Pago traspasos") + una referencia numérica que el reconocimiento de contactos descarta a
-- propósito por parecer un código variable, aunque en realidad sea un número de cuenta estable
-- (p.ej. un préstamo con varias cuotas). Guardado como texto separado por comas, igual que
-- categories.auto_keywords.
alter table budgets add column if not exists bank_keywords text;
