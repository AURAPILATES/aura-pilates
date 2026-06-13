"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { RANGE_OPTIONS, type RangeKey } from "@/lib/dateRange";

const QUESTIONS = [
  "¿Cuánto aguanta el negocio?",
  "¿Cómo fue este mes?",
  "¿En qué se va el dinero?",
  "¿De dónde vienen los ingresos?",
  "¿Qué debo a Hacienda?",
];

export default function FinanzasSidebar() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const current      = (searchParams.get("range") ?? "all") as RangeKey;

  function setRange(key: RangeKey) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "all") params.delete("range");
    else params.set("range", key);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="space-y-7">
      <div>
        <p className="text-[10px] font-semibold text-navy/30 uppercase tracking-widest mb-2">Período</p>
        <div className="flex flex-col gap-0.5">
          {RANGE_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRange(key)}
              className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                current === key
                  ? "bg-navy text-white font-medium"
                  : "text-navy/50 hover:bg-navy/[0.05] hover:text-navy/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold text-navy/30 uppercase tracking-widest mb-2">Índice</p>
        <nav className="flex flex-col gap-0.5">
          {QUESTIONS.map((q, i) => (
            <a
              key={i}
              href={`#q${i + 1}`}
              className="flex items-start gap-2 px-3 py-2 rounded-lg text-sm text-navy/40 hover:text-navy/70 hover:bg-navy/[0.04] transition-colors group"
            >
              <span className="text-[11px] tabular-nums text-navy/20 group-hover:text-navy/40 mt-px shrink-0">
                {i + 1}
              </span>
              <span className="leading-snug">{q}</span>
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}
