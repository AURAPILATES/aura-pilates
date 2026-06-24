const SECTIONS = [
  { id: "caja", label: "Caja y resultado" },
  { id: "gastos", label: "Gastos" },
  { id: "ingresos", label: "Ingresos" },
  { id: "clientes", label: "Clientes" },
  { id: "fiscal", label: "Fiscal y financiación" },
];

export default function SectionNav() {
  return (
    <nav className="sticky top-[45px] z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 bg-app-bg/95 backdrop-blur-sm border-b border-navy/[0.06] mb-8">
      <div className="flex gap-5 overflow-x-auto py-2.5 text-xs font-medium text-navy/50">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="whitespace-nowrap hover:text-primary transition-colors">
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
