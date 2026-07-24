import Sidebar from "./Sidebar";

/** Chrome de la app: sidebar + contenido. La sidebar se puede ocultar/mostrar (ver
 * NavVisibility): al ocultarse, el contenido pasa a ancho completo (regla .nav-hidden
 * .app-content en globals.css) y en la cabecera de cada página aparece un botón "Menú"
 * (ShowNavButton, dentro de MobileNav) para volver a mostrarla. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <div className="app-content sm:pl-[220px]">{children}</div>
    </>
  );
}
