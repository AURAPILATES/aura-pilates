import { loadCategories } from "@/lib/categories";
import CategoriasManager from "./CategoriasManager";

export default async function ConfiguracionPage() {
  const categories = await loadCategories();

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <CategoriasManager categories={categories} />
    </main>
  );
}
