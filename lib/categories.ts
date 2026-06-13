import { createServerClient } from "@/lib/supabase";

export type GroupType = "operational" | "income" | "transfer";

export type Category = {
  id: string;
  value: string;
  label: string;
  emoji: string;
  bg_color: string;
  text_color: string;
  group_type: GroupType;
  auto_keywords: string | null;
  sort_order: number;
  created_at: string;
};

export async function loadCategories(): Promise<Category[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data as Category[];
}
