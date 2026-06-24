export default function SectionHeader({ id, title }: { id: string; title: string }) {
  return (
    <h2 id={id} className="text-xs font-bold text-navy/50 uppercase tracking-widest mb-5 scroll-mt-24">
      {title}
    </h2>
  );
}
