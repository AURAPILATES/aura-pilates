"use client";

import { useState } from "react";
import { ChevronDown } from "react-feather";

export default function CollapsibleTable({
  label = "Ver datos",
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
        className="flex items-center gap-1 text-xs text-navy/45 hover:text-navy/70 transition-colors"
      >
        <ChevronDown
          size={12}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
        {open ? "Ocultar datos" : label}
      </button>
      {open && <div className="overflow-x-auto mt-3">{children}</div>}
    </div>
  );
}
