import { createServerClient } from "./supabase";

// Rendimiento por profesora desde class_sessions_v2 (asistencia real capturada de la API
// v2 de Momence; ver lib/attendanceCaptureV2.ts y migración 027). Distingue ocupación
// RESERVADA (quién reservó) de ocupación REAL (quién apareció, checkedIn), y la tasa de
// no-show. Ver [[project-profesoras-v2]].

export type TeacherStat = {
  teacherId: number | null;
  teacher: string;
  classes: number;
  capacity: number;
  booked: number;             // reservas activas
  checkedIn: number;          // asistencia real
  occupancyReserved: number;  // booked / capacity
  occupancyReal: number;      // checkedIn / capacity
  attendanceRate: number;     // checkedIn / booked (de quien reservó, cuántos vinieron)
  noShowRate: number;         // 1 - attendanceRate
  avgClassSize: number;       // booked / classes
};

export type TeacherStatsV2 = {
  hasData: boolean;
  from: string;
  to: string;
  rows: TeacherStat[];
  totalClasses: number;
  totalCapacity: number;
  totalBooked: number;
  totalCheckedIn: number;
  occupancyReserved: number;
  occupancyReal: number;
  noShowRate: number;
};

type Row = {
  teacher_id: number | null;
  teacher_name: string;
  capacity: number;
  booking_count: number;
  checked_in_count: number;
};

function empty(from: string, to: string): TeacherStatsV2 {
  return {
    hasData: false, from, to, rows: [],
    totalClasses: 0, totalCapacity: 0, totalBooked: 0, totalCheckedIn: 0,
    occupancyReserved: 0, occupancyReal: 0, noShowRate: 0,
  };
}

export async function getTeacherStatsV2(from: string, to: string): Promise<TeacherStatsV2> {
  const db = createServerClient();
  // PostgREST corta en 1000 filas; paginamos con range() para que un período largo (año /
  // todo el histórico) no pierda clases cuando class_sessions_v2 supere ese tamaño.
  const PAGE = 1000;
  const rows: Row[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data } = await db
      .from("class_sessions_v2")
      .select("teacher_id, teacher_name, capacity, booking_count, checked_in_count")
      .eq("is_cancelled", false)
      .gte("starts_at", from + "T00:00:00.000Z")
      .lte("starts_at", to + "T23:59:59.999Z")
      .order("starts_at", { ascending: true })
      .range(offset, offset + PAGE - 1);
    const batch = (data ?? []) as Row[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }

  if (rows.length === 0) return empty(from, to);

  const map = new Map<string, { teacherId: number | null; classes: number; capacity: number; booked: number; checkedIn: number }>();
  for (const r of rows) {
    const acc = map.get(r.teacher_name) ?? { teacherId: r.teacher_id, classes: 0, capacity: 0, booked: 0, checkedIn: 0 };
    acc.classes += 1;
    acc.capacity += r.capacity;
    acc.booked += r.booking_count;
    acc.checkedIn += r.checked_in_count;
    map.set(r.teacher_name, acc);
  }

  const teacherRows: TeacherStat[] = [...map.entries()]
    .map(([teacher, a]) => ({
      teacher,
      teacherId: a.teacherId,
      classes: a.classes,
      capacity: a.capacity,
      booked: a.booked,
      checkedIn: a.checkedIn,
      occupancyReserved: a.capacity > 0 ? a.booked / a.capacity : 0,
      occupancyReal: a.capacity > 0 ? a.checkedIn / a.capacity : 0,
      attendanceRate: a.booked > 0 ? a.checkedIn / a.booked : 0,
      noShowRate: a.booked > 0 ? 1 - a.checkedIn / a.booked : 0,
      avgClassSize: a.classes > 0 ? a.booked / a.classes : 0,
    }))
    .sort((x, y) => y.classes - x.classes || y.occupancyReal - x.occupancyReal);

  const totalClasses = teacherRows.reduce((s, r) => s + r.classes, 0);
  const totalCapacity = teacherRows.reduce((s, r) => s + r.capacity, 0);
  const totalBooked = teacherRows.reduce((s, r) => s + r.booked, 0);
  const totalCheckedIn = teacherRows.reduce((s, r) => s + r.checkedIn, 0);

  return {
    hasData: true,
    from,
    to,
    rows: teacherRows,
    totalClasses,
    totalCapacity,
    totalBooked,
    totalCheckedIn,
    occupancyReserved: totalCapacity > 0 ? totalBooked / totalCapacity : 0,
    occupancyReal: totalCapacity > 0 ? totalCheckedIn / totalCapacity : 0,
    noShowRate: totalBooked > 0 ? 1 - totalCheckedIn / totalBooked : 0,
  };
}
