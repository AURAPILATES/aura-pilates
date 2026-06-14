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
    <div className="flex items-center border border-navy/[0.12] rounded-lg bg-white p-1 gap-0.5 flex-wrap text-xs">
      {RANGE_OPTIONS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => setRange(key)}
          className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
            current === key
              ? "bg-navy text-white"
              : "text-navy/50 hover:text-navy"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
