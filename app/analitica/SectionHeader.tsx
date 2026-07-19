export default function SectionHeader({ id, title }: { id: string; title: string }) {
  return (
    <h2 id={id} className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-[0.12em] mb-5 scroll-mt-24">
      {title}
    </h2>
  );
}
