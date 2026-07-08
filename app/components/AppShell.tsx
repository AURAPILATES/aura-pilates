import Sidebar from "./Sidebar";

/** Chrome de la app: sidebar clásico + contenido. El toggle de diseño (ver
 * DesignVersionContext) ya no cambia ni el sidebar ni la tipografía — solo el
 * contenido de cada pantalla decide su propio look vía `useDesignVersion()`. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <div className="sm:pl-[220px]">{children}</div>
    </>
  );
}
