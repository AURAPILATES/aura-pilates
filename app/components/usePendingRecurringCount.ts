"use client";
import { useEffect, useState } from "react";

export function usePendingRecurringCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/recurring-expenses/pending-count", { cache: "no-store" });
        if (!res.ok || !active) return;
        const data = await res.json();
        setCount(data.count ?? 0);
      } catch {
        // silent
      }
    }
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => { active = false; clearInterval(id); };
  }, []);

  return count;
}
