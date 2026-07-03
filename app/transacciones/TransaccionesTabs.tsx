"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Transaction } from "@/lib/transactions";
import type { Category } from "@/lib/categories";
import TransaccionesList from "./TransaccionesList";
import RecurrentesList, { type PendingSeriesRow, type ConfirmedExpenseRow } from "./RecurrentesList";
import type { Contact } from "./actions";
import type { RecurringExpense } from "@/lib/recurringExpenses";

type Tab = "movimientos" | "recurrentes";

const TABS: { key: Tab; label: string }[] = [
  { key: "movimientos", label: "Movimientos" },
  { key: "recurrentes", label: "Recurrentes" },
];

type Props = {
  transactions: Transaction[];
  categories: Category[];
  uncategorizedCount: number;
  recurringPeriods: Record<string, string>;
  recurringExpenses: RecurringExpense[];
  allMonthKeys: string[];
  contacts: Contact[];
  pendingRecurring: PendingSeriesRow[];
  confirmedRecurring: ConfirmedExpenseRow[];
  archivedRecurring: RecurringExpense[];
};

export default function TransaccionesTabs({
  transactions,
  categories,
  uncategorizedCount,
  recurringPeriods,
  recurringExpenses,
  allMonthKeys,
  contacts,
  pendingRecurring,
  confirmedRecurring,
  archivedRecurring,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "recurrentes" ? "recurrentes" : "movimientos";
  const [tab, setTab] = useState<Tab>(initialTab);

  function selectTab(next: Tab) {
    setTab(next);
    router.replace(next === "movimientos" ? "/transacciones" : `/transacciones?tab=${next}`, { scroll: false });
  }

  return (
    <div>
      <div className="flex items-center gap-1 border-b border-navy/[0.08] mb-7 pb-1.5">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => selectTab(key)}
            className={`relative text-sm font-medium transition-colors rounded-lg ${
              tab === key
                ? "text-navy bg-white border border-navy/[0.15]"
                : "text-navy/50 hover:text-navy"
            }`}
          >
            <span className="flex items-center gap-1.5 px-3 py-1.5">
              {label}
              {key === "recurrentes" && pendingRecurring.length > 0 && (
                <span className="shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-warning text-white text-[10px] font-bold px-1">
                  {pendingRecurring.length}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {tab === "movimientos" ? (
        <TransaccionesList
          transactions={transactions}
          categories={categories}
          uncategorizedCount={uncategorizedCount}
          recurringPeriods={recurringPeriods}
          recurringExpenses={recurringExpenses}
          allMonthKeys={allMonthKeys}
          contacts={contacts}
        />
      ) : (
        <RecurrentesList
          pending={pendingRecurring}
          confirmed={confirmedRecurring}
          archived={archivedRecurring}
          categories={categories}
          contacts={contacts}
        />
      )}
    </div>
  );
}
