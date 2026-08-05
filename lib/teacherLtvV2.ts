import type { Sale } from "./sales";
import { fetchCheckedInFirstClassRows } from "./firstClassBookingsV2";

// LTV (gasto histórico en Stripe) de quien tuvo su primera clase asistida con cada profesora, o
// según el mes en que entró (su cohorte de entrada) - dos cortes del mismo cálculo: el ingreso
// medio de por vida que deja cada persona nueva, no solo si "convirtió" o no (ver
// lib/teacherConversionV2.ts, que da la tasa pero no el valor económico). Ver [[project-profesoras-v2]].

const MONTH_LABELS: Record<string, string> = {
  "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic",
};

export type LtvRow = {
  key: string;
  label: string;
  firstTimers: number;
  totalLtv: number;
  avgLtv: number;
};

export type TeacherLtvV2 = {
  hasData: boolean;
  byTeacher: LtvRow[];
  byEntryMonth: LtvRow[];
  totalFirstTimers: number;
  overallAvgLtv: number;
  // % de primeras-clases cuyo email se pudo cruzar con alguna venta de Stripe.
  matchedRate: number;
};

export async function getTeacherLtvV2(sales: Sale[]): Promise<TeacherLtvV2> {
  const rows = await fetchCheckedInFirstClassRows();
  if (rows.length === 0) {
    return { hasData: false, byTeacher: [], byEntryMonth: [], totalFirstTimers: 0, overallAvgLtv: 0, matchedRate: 0 };
  }

  const firstByMember = new Map<number, { email: string | null; teacher: string; date: string }>();
  for (const r of rows) {
    if (firstByMember.has(r.member_id)) continue;
    firstByMember.set(r.member_id, {
      email: r.email ? r.email.toLowerCase() : null,
      teacher: r.teacher_name,
      date: r.session_starts_at.slice(0, 10),
    });
  }

  // Gasto de por vida en Stripe por email (todas las ventas, no solo suscripciones/packs).
  const spentByEmail = new Map<string, number>();
  for (const s of sales) {
    if (!s.email) continue;
    const email = s.email.toLowerCase();
    spentByEmail.set(email, (spentByEmail.get(email) ?? 0) + s.amount);
  }

  const byTeacherAcc = new Map<string, { firstTimers: number; totalLtv: number }>();
  const byMonthAcc = new Map<string, { firstTimers: number; totalLtv: number }>();
  let matched = 0;
  let totalLtvAll = 0;

  for (const { email, teacher, date } of firstByMember.values()) {
    const ltv = email ? (spentByEmail.get(email) ?? 0) : 0;
    if (email && spentByEmail.has(email)) matched += 1;
    totalLtvAll += ltv;

    const t = byTeacherAcc.get(teacher) ?? { firstTimers: 0, totalLtv: 0 };
    t.firstTimers += 1;
    t.totalLtv += ltv;
    byTeacherAcc.set(teacher, t);

    const month = date.slice(0, 7);
    const m = byMonthAcc.get(month) ?? { firstTimers: 0, totalLtv: 0 };
    m.firstTimers += 1;
    m.totalLtv += ltv;
    byMonthAcc.set(month, m);
  }

  const totalFirstTimers = firstByMember.size;

  const byTeacher: LtvRow[] = [...byTeacherAcc.entries()]
    .map(([teacher, a]) => ({
      key: teacher,
      label: teacher,
      firstTimers: a.firstTimers,
      totalLtv: a.totalLtv,
      avgLtv: a.firstTimers > 0 ? a.totalLtv / a.firstTimers : 0,
    }))
    .sort((x, y) => y.avgLtv - x.avgLtv);

  const byEntryMonth: LtvRow[] = [...byMonthAcc.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, a]) => {
      const [y, mm] = month.split("-");
      return {
        key: month,
        label: `${MONTH_LABELS[mm] ?? mm} ${y}`,
        firstTimers: a.firstTimers,
        totalLtv: a.totalLtv,
        avgLtv: a.firstTimers > 0 ? a.totalLtv / a.firstTimers : 0,
      };
    });

  return {
    hasData: true,
    byTeacher,
    byEntryMonth,
    totalFirstTimers,
    overallAvgLtv: totalFirstTimers > 0 ? totalLtvAll / totalFirstTimers : 0,
    matchedRate: totalFirstTimers > 0 ? matched / totalFirstTimers : 0,
  };
}
