"use client";

import Sidebar from "./Sidebar";
import SidebarV2 from "./SidebarV2";
import { useDesignVersion } from "./DesignVersionContext";

/** Conmuta el chrome de la app (sidebar + ancho de contenido) entre el diseño clásico
 * y el rediseño en prueba, según el toggle guardado en DesignVersionContext. */
export default function AppShell({ children, hankenClassName }: { children: React.ReactNode; hankenClassName: string }) {
  const { v2 } = useDesignVersion();

  if (v2) {
    return (
      <div className={hankenClassName}>
        <SidebarV2 />
        <div className="sm:pl-[262px]">{children}</div>
      </div>
    );
  }

  return (
    <>
      <Sidebar />
      <div className="sm:pl-[220px]">{children}</div>
    </>
  );
}
