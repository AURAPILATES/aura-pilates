export default function QuestionHeader({ num, question }: { num: number; question: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="text-xs font-bold text-primary/50 tabular-nums w-4 shrink-0">{num}</span>
      <h2 className="text-xs font-semibold text-navy/50 uppercase tracking-widest">{question}</h2>
    </div>
  );
}
