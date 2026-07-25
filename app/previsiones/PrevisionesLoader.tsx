import { loadTransactionsCached } from "@/lib/transactions";
import { loadCategoriesCached } from "@/lib/categories";
import { buildStatementData } from "@/lib/previsiones";
import PrevisionesHistorico from "./PrevisionesHistorico";

export default async function PrevisionesLoader() {
  const [txnsAll, categories] = await Promise.all([
    loadTransactionsCached(),
    loadCategoriesCached(),
  ]);

  const statement = buildStatementData(txnsAll, categories);

  return <PrevisionesHistorico statement={statement} />;
}
