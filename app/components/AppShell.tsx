import Sidebar from "./Sidebar";
import MomenceV2Banner from "./MomenceV2Banner";

/** Chrome de la app: sidebar + contenido. La sidebar se puede colapsar a modo "rail"
 * (solo iconos, ver NavVisibility): el ancho de ambos se controla desde globals.css
 * (.app-sidebar / .app-content, con la variante .nav-rail) para que el colapso no
 * dependa del estado de React y no parpadee al cargar. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MomenceV2Banner />
      <Sidebar />
      <div className="app-content">{children}</div>
    </>
  );
}
