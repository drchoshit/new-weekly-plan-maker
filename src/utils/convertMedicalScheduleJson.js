// src/utils/convertMedicalScheduleJson.js

export default function convertMedicalScheduleJson(json) {
  const result = {};
  if (!json) return result;

  const schedules = Array.isArray(json.schedules) ? json.schedules : [];
  if (!schedules.length) return result;

  const students = Array.isArray(json.students) ? json.students : [];
  const idToName = new Map();

  students.forEach(s => {
    if (!s) return;
    const id = s.id != null ? String(s.id) : "";
    const name = s.name != null ? String(s.name) : "";
    if (id && name) {
      idToName.set(id, name);
    }
  });

  const metaWeekStart =
    json?.meta?.weekStartYmd ||
    json?.meta?.weekStart ||
    json?.weekStartYmd ||
    json?.week_start ||
    "";
  const metaWeekRangeText = json?.meta?.weekRangeText || json?.weekRangeText || "";

  const fmt = d =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  const normalizeRangeKey = text => {
    if (!text || typeof text !== "string") return null;
    const key = text.replace(/\s/g, "");
    return key || null;
  };

  const toDate = value => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const parseWeekRangeEnd = (start, rangeText) => {
    if (!start || !rangeText || typeof rangeText !== "string") return null;
    const parts = rangeText.split("~").map(p => p.trim());
    if (parts.length !== 2) return null;

    const [mStr, dStr] = parts[1].split("/");
    const m = Number(mStr);
    const d = Number(dStr);
    if (!m || !d) return null;

    const end = new Date(start.getFullYear(), m - 1, d);
    if (Number.isNaN(end.getTime())) return null;
    if (end < start) {
      end.setFullYear(end.getFullYear() + 1);
    }
    return end;
  };

  const buildWeekKey = (weekStart, rangeText) => {
    const start = toDate(weekStart);
    if (!start) return null;

    const endFromRange = parseWeekRangeEnd(start, rangeText);
    const end = endFromRange ?? new Date(start);

    if (!endFromRange) {
      // Legacy default (Mon~Sat) when no explicit range provided.
      end.setDate(start.getDate() + 5);
    }

    return `${fmt(start)}~${fmt(end)}`;
  };

  const metaRangeKey = normalizeRangeKey(metaWeekRangeText);
  const metaWeekKey = metaRangeKey || buildWeekKey(metaWeekStart, metaWeekRangeText);

  const ensureStudentBucket = (weekKey, studentKey) => {
    if (!result[weekKey]) {
      result[weekKey] = {};
    }
    if (!result[weekKey][studentKey]) {
      result[weekKey][studentKey] = {
        월: [],
        화: [],
        수: [],
        목: [],
        금: [],
        토: [],
        일: [],
      };
    }
  };

  const buildItemText = (start, end, type, description) => {
    const timeText = start && end ? `${start}~${end}` : start || end || "";
    const detail = [type, description]
      .filter(v => v && String(v).trim())
      .join(": ")
      .trim();

    if (!detail) {
      return timeText;
    }

    return `${timeText} (${detail})`;
  };

  schedules.forEach(sc => {
    if (!sc) return;

    const rangeKey = normalizeRangeKey(
      sc.week_range_text || sc.weekRangeText || metaWeekRangeText
    );
    const isoKey = buildWeekKey(
      sc.week_start || sc.weekStart || metaWeekStart,
      sc.week_range_text || sc.weekRangeText || metaWeekRangeText
    );
    const weekKey = rangeKey || isoKey || metaWeekKey;
    if (!weekKey) return;

    const studentIdRaw =
      sc.student_id ?? sc.studentId ?? sc.studentID ?? sc.id ?? "";
    const studentId = studentIdRaw !== "" ? String(studentIdRaw) : "";
    const studentName =
      sc.name ||
      sc.student_name ||
      sc.studentName ||
      (studentId && idToName.get(studentId)) ||
      "";

    const studentKey = studentId || studentName;
    if (!studentKey) return;

    ensureStudentBucket(weekKey, studentKey);

    const day = sc.day;
    if (!day || !result[weekKey][studentKey][day]) return;

    const text = buildItemText(sc.start, sc.end, sc.type, sc.description);

    if (text) {
      result[weekKey][studentKey][day].push(text);
    }
  });

  return result;
}
