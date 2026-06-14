import { loadCategories } from "@/lib/categories";
import CategoriasManager from "./CategoriasManager";

export default async function ConfiguracionPage() {
  const categories = await loadCategories();

  return (
    <main className="px-6 py-10 max-w-6xl mx-auto">
      <CategoriasManager categories={categories} />
    </main>
  );
}
