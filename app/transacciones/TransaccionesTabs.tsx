"use client";

import { useState, useEffect } from "react";
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
  recurringConfirmedIds: Set<string>;
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
  recurringConfirmedIds,
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

  // El estado de la pestaña activa solo se leía de la URL al montar: navegar aquí desde fuera
  // (p. ej. el enlace "revísalo en la pestaña Recurrentes" del drawer de un movimiento) cambiaba
  // la URL pero no la pestaña visible, porque el componente ya estaba montado. Mantenerlo
  // sincronizado con la URL en todo momento arregla eso sin duplicar la lógica de selectTab.
  useEffect(() => {
    setTab(searchParams.get("tab") === "recurrentes" ? "recurrentes" : "movimientos");
  }, [searchParams]);

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

      <div key={tab} className="pt-[26px] tab-fade-in">
        {tab === "movimientos" ? (
          <TransaccionesList
            transactions={transactions}
            allTransactions={allTransactions}
            categories={categories}
            uncategorizedCount={uncategorizedCount}
            recurringPeriods={recurringPeriods}
            recurringConfirmedIds={recurringConfirmedIds}
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
