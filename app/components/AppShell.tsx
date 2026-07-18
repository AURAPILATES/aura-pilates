import Sidebar from "./Sidebar";

/** Chrome de la app: sidebar + contenido. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <div className="sm:pl-[220px]">{children}</div>
    </>
  );
}
