// src/utils/convertMedicalScheduleJson.js

export default function convertMedicalScheduleJson(json) {
  const result = {};

  // 1️⃣ schedules 배열 기준으로 처리 (중요)
  const schedules = json.schedules || [];

  schedules.forEach(sc => {
    const weekStart = sc.week_start; // 예: 2026-01-12
    if (!weekStart) return;

    // weekKey 생성 (토요일까지 자동 계산)
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 5);

    const fmt = d =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;

    const weekKey = `${fmt(start)}~${fmt(end)}`;

    // weekKey 초기화
    if (!result[weekKey]) {
      result[weekKey] = {};
    }

    const studentName = sc.name;
    if (!studentName) return;

    // 학생 초기화
    if (!result[weekKey][studentName]) {
      result[weekKey][studentName] = {
        월: [],
        화: [],
        수: [],
        목: [],
        금: [],
        토: [],
        일: []
      };
    }

    // 요일별 일정 추가
    if (result[weekKey][studentName][sc.day]) {
      const text =
        sc.description && sc.description.trim()
          ? `${sc.start}~${sc.end} (${sc.description})`
          : `${sc.start}~${sc.end}`;

      result[weekKey][studentName][sc.day].push(text);
    }
  });

  return result;
}
