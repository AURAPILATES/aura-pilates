export default function TableToolbar({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-center gap-2 mb-5 ${className}`}>{children}</div>;
}
