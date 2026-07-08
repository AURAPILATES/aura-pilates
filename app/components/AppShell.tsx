"use client";

import Sidebar from "./Sidebar";
import { useDesignVersion } from "./DesignVersionContext";

/** Conmuta el chrome de la app entre el diseño clásico y el rediseño en prueba. El sidebar
 * es siempre el clásico (Julia prefirió mantenerlo); el rediseño solo afecta al contenido. */
export default function AppShell({ children, hankenClassName }: { children: React.ReactNode; hankenClassName: string }) {
  const { v2 } = useDesignVersion();

  return (
    <>
      <Sidebar />
      <div className={`sm:pl-[220px] ${v2 ? hankenClassName : ""}`}>{children}</div>
    </>
  );
}
