// src/utils/convertMedicalScheduleJson.js

export default function convertMedicalScheduleJson(json) {
  const result = {};
  if (!json || typeof json !== "object") return result;

  const DAY_ORDER = ["월", "화", "수", "목", "금", "토", "일"];
  const DAY_SET = new Set(DAY_ORDER);
  const EMPTY_DAY_BUCKET = () => ({
    월: [],
    화: [],
    수: [],
    목: [],
    금: [],
    토: [],
    일: [],
  });

  const normalizeText = value => (value == null ? "" : String(value).trim());
  const normalizeRangeKey = text => {
    const key = normalizeText(text).replace(/\s/g, "");
    return key || null;
  };
  const normalizeTime = value => {
    const raw = normalizeText(value);
    if (!raw) return "";
    const m = raw.match(/(\d{2}:\d{2})(?::\d{2})?$/);
    return m ? m[1] : raw;
  };
  const fmt = d =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  const toDate = value => {
    const raw = normalizeText(value);
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const parseWeekRangeEnd = (start, rangeText) => {
    const normalizedRange = normalizeText(rangeText);
    if (!start || !normalizedRange) return null;
    const parts = normalizedRange.split("~").map(p => p.trim());
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
      // Legacy default (Mon~Sat) when no explicit range is available.
      end.setDate(start.getDate() + 5);
    }

    return `${fmt(start)}~${fmt(end)}`;
  };
  const dayFromDateValue = value => {
    const d = toDate(value);
    if (!d) return "";
    // JS Sunday(0) -> Korean week order "일".
    const idx = d.getDay();
    return DAY_ORDER[(idx + 6) % 7] || "";
  };

  const students = Array.isArray(json.students) ? json.students : [];
  const schedules = Array.isArray(json.schedules) ? json.schedules : [];
  const calendarEvents = Array.isArray(json.calendarEvents) ? json.calendarEvents : [];
  const sourceRows = [...schedules, ...calendarEvents];
  if (!sourceRows.length) return result;

  const idToName = new Map();
  const nameCounts = new Map();
  students.forEach(s => {
    if (!s) return;
    const id = normalizeText(s.id);
    const name = normalizeText(s.name);
    if (id && name) {
      idToName.set(id, name);
    }
    if (name) {
      nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
    }
  });
  const isUniqueName = name => Boolean(name) && nameCounts.get(name) === 1;

  const metaWeekStart =
    json?.meta?.weekStartYmd ||
    json?.meta?.weekStart ||
    json?.weekStartYmd ||
    json?.week_start ||
    "";
  const metaWeekRangeText = json?.meta?.weekRangeText || json?.weekRangeText || "";
  const metaRangeKey = normalizeRangeKey(metaWeekRangeText);
  const metaIsoWeekKey = buildWeekKey(metaWeekStart, metaWeekRangeText);

  const ensureWeekBucket = candidateKeys => {
    const keys = (Array.isArray(candidateKeys) ? candidateKeys : [candidateKeys])
      .map(normalizeRangeKey)
      .filter(Boolean);
    if (!keys.length) return null;

    let weekBucket = null;
    for (const key of keys) {
      if (result[key]) {
        weekBucket = result[key];
        break;
      }
    }
    if (!weekBucket) {
      weekBucket = {};
    }
    keys.forEach(key => {
      result[key] = weekBucket;
    });
    return weekBucket;
  };

  const ensureStudentBucket = (weekBucket, studentKey) => {
    if (!weekBucket || !studentKey) return null;
    if (!weekBucket[studentKey]) {
      weekBucket[studentKey] = EMPTY_DAY_BUCKET();
    }
    return weekBucket[studentKey];
  };

  const buildItemText = (start, end, type, description) => {
    const timeStart = normalizeTime(start);
    const timeEnd = normalizeTime(end);
    const timeText =
      timeStart && timeEnd ? `${timeStart}~${timeEnd}` : timeStart || timeEnd || "";

    const detail = [normalizeText(type), normalizeText(description)]
      .filter(Boolean)
      .join(": ");

    if (!detail) return timeText;
    return `${timeText} (${detail})`;
  };

  // Avoid duplicates when both schedules and calendarEvents contain equivalent rows.
  const seenByStudentDay = new Map();

  sourceRows.forEach(sc => {
    if (!sc) return;

    const rowRangeText = sc.week_range_text || sc.weekRangeText || metaWeekRangeText;
    const rowWeekStart = sc.week_start || sc.weekStart || metaWeekStart;
    const rangeKey = normalizeRangeKey(rowRangeText);
    const isoKey = buildWeekKey(rowWeekStart, rowRangeText);
    const weekBucket = ensureWeekBucket([rangeKey, isoKey, metaRangeKey, metaIsoWeekKey]);
    if (!weekBucket) return;

    const studentId = normalizeText(
      sc.student_id ?? sc.studentId ?? sc.studentID ?? sc.id ?? ""
    );
    const studentName = normalizeText(
      sc.name || sc.student_name || sc.studentName || (studentId && idToName.get(studentId)) || ""
    );
    const canonicalStudentKey = studentId || studentName;
    if (!canonicalStudentKey) return;

    const studentBucket = ensureStudentBucket(weekBucket, canonicalStudentKey);
    if (!studentBucket) return;

    // Add aliases so render logic can match by either id or name.
    const aliasKeys = new Set([studentId, studentName].map(normalizeText).filter(Boolean));
    if (studentName && !isUniqueName(studentName)) {
      // Avoid accidental merge when duplicate names exist.
      aliasKeys.delete(studentName);
    }
    aliasKeys.forEach(aliasKey => {
      if (!aliasKey) return;
      weekBucket[aliasKey] = studentBucket;
    });

    const rawDay = normalizeText(sc.day);
    const day = DAY_SET.has(rawDay) ? rawDay : dayFromDateValue(sc.start);
    if (!DAY_SET.has(day)) return;

    const text = buildItemText(sc.start, sc.end, sc.type, sc.description);
    if (!text) return;

    const dedupeMapKey = `${canonicalStudentKey}|${day}`;
    const sig = [
      normalizeTime(sc.start),
      normalizeTime(sc.end),
      normalizeText(sc.type),
      normalizeText(sc.description),
    ].join("|");

    if (!seenByStudentDay.has(dedupeMapKey)) {
      seenByStudentDay.set(dedupeMapKey, new Set());
    }
    const seen = seenByStudentDay.get(dedupeMapKey);
    if (seen.has(sig)) return;
    seen.add(sig);

    studentBucket[day].push(text);
  });

  // Keep empty buckets for all students so "no schedule" students still render instead of disappearing.
  const allStudentKeys = [];
  students.forEach(s => {
    const id = normalizeText(s?.id);
    const name = normalizeText(s?.name);
    if (id) allStudentKeys.push(id);
    if (isUniqueName(name)) allStudentKeys.push(name);
  });
  const weekBuckets = [...new Set(Object.values(result))];
  weekBuckets.forEach(weekBucket => {
    allStudentKeys.forEach(studentKey => {
      ensureStudentBucket(weekBucket, studentKey);
    });
  });

  return result;
}
