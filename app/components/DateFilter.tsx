"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { RANGE_OPTIONS, type RangeKey } from "@/lib/dateRange";

export default function DateFilter() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const current      = (searchParams.get("range") ?? "all") as RangeKey;

  function setRange(key: RangeKey) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "all") {
      params.delete("range");
    } else {
      params.set("range", key);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {RANGE_OPTIONS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => setRange(key)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            current === key
              ? "bg-navy text-white"
              : "bg-navy/[0.05] text-navy/50 hover:bg-navy/[0.09] hover:text-navy/70"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
