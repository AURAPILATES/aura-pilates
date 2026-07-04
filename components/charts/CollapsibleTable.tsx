"use client";

import { useState } from "react";
import { ChevronDown, Table } from "react-feather";

export default function CollapsibleTable({
  label = "Ver tabla",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-5">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
          open
            ? "bg-primary/[0.08] border-primary/20 text-primary"
            : "bg-navy/[0.04] border-navy/10 text-navy/60 hover:bg-navy/[0.07] hover:text-navy"
        }`}
      >
        <Table size={13} />
        {open ? "Ocultar tabla" : label}
        <ChevronDown
          size={12}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="overflow-x-auto mt-3">{children}</div>}
    </div>
  );
}
