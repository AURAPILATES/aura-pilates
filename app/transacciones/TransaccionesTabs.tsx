"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Transaction } from "@/lib/transactions";
import type { Category } from "@/lib/categories";
import SectionTabs from "@/app/components/SectionTabs";
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
      <SectionTabs
        className="mb-7"
        active={tab}
        onChange={selectTab}
        tabs={TABS.map((t) => ({
          ...t,
          badge: t.key === "recurrentes" ? pendingRecurring.length : undefined,
        }))}
      />

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
