import { createServerClient } from "./supabase";

export type MomenceChurnEntry = { email: string; tier: string };

export type MomenceChurnResult = {
  refDate: string;
  compareDate: string;
  churned: MomenceChurnEntry[];
  gained: MomenceChurnEntry[];
};

export async function getMomenceChurn(): Promise<MomenceChurnResult | null> {
  const db = createServerClient();

  const { data, error } = await db
    .from("subscriber_snapshots")
    .select("date, email, membership_name")
    .eq("subscription_type", "subscription")
    .eq("is_freezed", false)
    .order("date", { ascending: true });

  if (error || !data || data.length === 0) return null;
  const rows = data;

  const dates = [...new Set(rows.map((r) => r.date))].sort();
  if (dates.length < 2) return null;

  const refDate = dates[0];
  const compareDate = dates[dates.length - 1];

  // Unique email → tier map per date (first entry wins if duplicates)
  function mapForDate(date: string): Map<string, string> {
    const map = new Map<string, string>();
    for (const row of rows) {
      if (row.date !== date) continue;
      const key = row.email.toLowerCase();
      if (!map.has(key)) map.set(key, row.membership_name);
    }
    return map;
  }

  const refMap = mapForDate(refDate);
  const compareMap = mapForDate(compareDate);

  const churned: MomenceChurnEntry[] = [];
  for (const [email, tier] of refMap) {
    if (!compareMap.has(email)) churned.push({ email, tier });
  }

  const gained: MomenceChurnEntry[] = [];
  for (const [email, tier] of compareMap) {
    if (!refMap.has(email)) gained.push({ email, tier });
  }

  return { refDate, compareDate, churned, gained };
}
