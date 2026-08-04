"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Transaction } from "@/lib/transactions";
import type { Category } from "@/lib/categories";
import SectionTabsV2 from "@/app/components/v2/SectionTabsV2";
import HeaderPortal from "@/app/components/HeaderPortal";
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
  allTransactions: Transaction[];
  categories: Category[];
  uncategorizedCount: number;
  recurringPeriods: Record<string, string>;
  recurringExpenses: RecurringExpense[];
  contacts: Contact[];
  pendingRecurring: PendingSeriesRow[];
  confirmedRecurring: ConfirmedExpenseRow[];
  archivedRecurring: RecurringExpense[];
};

export default function TransaccionesTabs({
  transactions,
  allTransactions,
  categories,
  uncategorizedCount,
  recurringPeriods,
  recurringExpenses,
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

  const tabsWithBadge = TABS.map((t) => ({
    ...t,
    badge: t.key === "recurrentes" ? pendingRecurring.length : undefined,
  }));

  return (
    <div>
      <HeaderPortal target="header-tabs">
        <SectionTabsV2 active={tab} onChange={selectTab} tabs={tabsWithBadge} />
      </HeaderPortal>

      <div className="pt-[26px]">
        {tab === "movimientos" ? (
          <TransaccionesList
            transactions={transactions}
            allTransactions={allTransactions}
            categories={categories}
            uncategorizedCount={uncategorizedCount}
            recurringPeriods={recurringPeriods}
            recurringExpenses={recurringExpenses}
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
    </div>
  );
}
