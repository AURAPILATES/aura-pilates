"use server";
import { revalidateTag } from "next/cache";

export async function syncStripe() {
  revalidateTag("stripe");
}
