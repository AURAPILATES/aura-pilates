import Sidebar from "./Sidebar";
import { ShowNavButton } from "./NavVisibility";
import MomenceV2Banner from "./MomenceV2Banner";

/** Chrome de la app: sidebar + contenido. La sidebar se puede ocultar/mostrar (ver
 * NavVisibility): al ocultarse, el contenido pasa a ancho completo (regla .nav-hidden
 * .app-content en globals.css) y aparece una pestañita discreta en el borde izquierdo
 * (ShowNavButton) para volver a mostrarla. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MomenceV2Banner />
      <Sidebar />
      <ShowNavButton />
      <div className="app-content sm:pl-[220px]">{children}</div>
    </>
  );
}
