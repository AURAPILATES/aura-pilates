// Navegación anterior/siguiente dentro de un drawer de detalle, sobre la lista visible en la
// pantalla (filtrada/ordenada, sin paginar - así "siguiente" nunca se corta en un borde de
// página). Usado por las listas de Clientes, Transacciones y Contactos.
export function drawerNav<T>(items: T[], currentId: string | number, idOf: (item: T) => string | number) {
  const idx = items.findIndex((i) => idOf(i) === currentId);
  return {
    prev: idx > 0 ? items[idx - 1] : null,
    next: idx >= 0 && idx < items.length - 1 ? items[idx + 1] : null,
  };
}
