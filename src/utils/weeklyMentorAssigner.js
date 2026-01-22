// src/utils/weeklyMentorAssigner.js

const DAYS = ["월", "화", "수", "목", "금", "토"];

// ✅ 기준 요일별 탐색 순서 (다음주로 넘어가지 않음)
const DAY_PRIORITY = {
  월: ["월", "화", "수", "목", "금", "토"],
  화: ["화", "수", "목", "금", "토", "월"],
  수: ["수", "목", "금", "토", "화", "월"],
  목: ["목", "수", "금", "화", "토", "월"],   // 네 예시: 목 안되면 수 → 금 → 화 → 토 → 월
  금: ["금", "목", "토", "수", "화", "월"],   // 네 예시 고정
  토: ["토", "금", "목", "수", "화", "월"],   // 토 기준 예시(원하면 변경 가능)
};


// "HH:MM" -> minutes
const toMinutes = (t) => {
  if (!t || typeof t !== "string" || !t.includes(":")) return NaN;
  const [h, m] = t.split(":").map((x) => Number(String(x).trim()));
  if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
  return h * 60 + m;
};

// 출결 값(배열/문자열)을 무조건 [start,end] 형태로 정규화
const normalizeTimePair = (value) => {
  // 이미 ["08:00","13:00"]
  if (Array.isArray(value)) {
    const a = value.map((v) => (typeof v === "string" ? v.trim() : ""));
    if (!a[0] && !a[1]) return null;
    return [a[0] || "", a[1] || ""];
  }

  // "08:00~13:00" / "08:00 - 13:00" / "08:00-13:00"
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;

    const cleaned = s.replace(/\s+/g, ""); // 공백 제거
    // ~ 또는 - 둘 다 허용
    const parts = cleaned.split("~");
    if (parts.length === 2) return [parts[0], parts[1]];

    const parts2 = cleaned.split("-");
    if (parts2.length === 2) return [parts2[0], parts2[1]];

    return null;
  }

  return null;
};

// 출결이 실제로 있는지 판정
const hasValidAttendance = (attendance, day) => {
  const pair = normalizeTimePair(attendance?.[day]);
  if (!pair) return false;

  const [st, en] = pair;
  if (!st || !en) return false;

  const stMin = toMinutes(st);
  const enMin = toMinutes(en);
  if ([stMin, enMin].some((v) => Number.isNaN(v))) return false;

  return true;
};

// 멘토 근무시간 문자열을 여러 구간으로 파싱
// 예) "13:00~18:00", "13:00 - 18:00", "13:00-18:00", "10:00~12:00,13:00~15:00"
const parseMentorRanges = (timeStr) => {
  if (!timeStr || typeof timeStr !== "string") return [];

  const raw = timeStr
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const ranges = [];

  for (const chunk of raw) {
    const cleaned = chunk.replace(/\s+/g, "");

    let st = null;
    let en = null;

    if (cleaned.includes("~")) {
      const parts = cleaned.split("~");
      if (parts.length === 2) {
        st = parts[0];
        en = parts[1];
      }
    } else if (cleaned.includes("-")) {
      const parts = cleaned.split("-");
      if (parts.length === 2) {
        st = parts[0];
        en = parts[1];
      }
    }

    if (!st || !en) continue;

    const stMin = toMinutes(st);
    let enMin = toMinutes(en);
    if ([stMin, enMin].some((v) => Number.isNaN(v))) continue;

    // 새벽 넘김 보정 (예: 22:00~01:00)
    if (enMin < stMin) enMin += 1440;

    ranges.push({ st, en, stMin, enMin });
  }

  return ranges;
};

// 두 구간이 30분 이상 겹치는지
const isTimeOverlapped = (studentPairRaw, mentorTimeStr) => {
  const studentPair = normalizeTimePair(studentPairRaw);
  if (!studentPair) return false;

  const [sSt, sEn] = studentPair;
  const sStart = toMinutes(sSt);
  let sEnd = toMinutes(sEn);
  if ([sStart, sEnd].some((v) => Number.isNaN(v))) return false;

  // 새벽 넘김 보정
  if (sEnd < sStart) sEnd += 1440;

  const mentorRanges = parseMentorRanges(mentorTimeStr);
  if (mentorRanges.length === 0) return false;

  // 멘토 여러 구간 중 하나라도 30분 겹치면 true
  for (const r of mentorRanges) {
    const overlap = Math.min(sEnd, r.enMin) - Math.max(sStart, r.stMin);
    if (overlap >= 30) return true;
  }

  return false;
};

// 멘토 근무시간 필드가 time이 아닐 수도 있어서 안전하게 꺼내기
const getMentorTime = (m) =>
  m?.time ??
  m?.workTime ??
  m?.workingTime ??
  m?.workingHours ??
  m?.hours ??
  m?.근무시간 ??
  m?.근무 ??
  "";

// 과목 일치 수 계산
const countSubjectMatch = (student, mentor) => {
  let count = 0;
  if (mentor.koreanSubject && mentor.koreanSubject === student.korean) count++;
  if (mentor.mathSubject && mentor.mathSubject === student.math) count++;
  if ([mentor.explore1, mentor.explore2].includes(student.explore1)) count++;
  if ([mentor.explore1, mentor.explore2].includes(student.explore2)) count++;
  return count;
};

// 요일 이동 순서: 0 → -1 → +1 → -2 → +2
const getDayOffsets = () => [0, -1, 1, -2, 2];

// 요일 인덱스 안전 계산
const getDayByOffset = (baseDay, offset) => {
  const baseIdx = DAYS.indexOf(baseDay);
  if (baseIdx === -1) return null;
  const nextIdx = baseIdx + offset;
  if (nextIdx < 0 || nextIdx >= DAYS.length) return null;
  return DAYS[nextIdx];
};

/**
 * 재학생 전용 자동배정
 */
export function weeklyMentorAssigner({
  student,
  attendance,
  mentorsByDay,
  prevRecord, // { mentor, day }
}) {

  // ✅ baseDay 결정
  // 1) 전주 기록(day)이 있으면 그걸 기준으로 유지
  // 2) 없으면, 출결이 실제로 있는 첫 요일을 기준(baseDay)으로 잡아서 자동배정 가능하게 함
  let baseDay = null;

  // 🔒 기준 멘토의 요일이 출결에 맞으면 유지
  if (prevRecord?.day) {
    baseDay = prevRecord.day;
  }

  // 🔁 그 외(auto / initial / latest)는 출결 기준으로 새로 잡음
  if (!baseDay) {
    baseDay = DAYS.find(d => hasValidAttendance(attendance, d)) || null;
  }


  // 출결 자체가 없으면 자동배정 불가
  if (!baseDay) return null;
  const offsets = getDayOffsets();

  // 고정 멘토 처리
  if (student.fixedMentor) {
    const possibleDays = DAYS.filter((d) => {
      const mentors = mentorsByDay?.[d] || [];
      const mentor = mentors.find((m) => m.name === student.fixedMentor);
      if (!mentor) return false;
      return isTimeOverlapped(attendance?.[d], getMentorTime(mentor));
    });

    if (possibleDays.length > 0) {
      return {
        mentor: student.fixedMentor,
        day: possibleDays[0],
        autoRank: 1,
        fromDay: baseDay,
        toDay: possibleDays[0],
        dayDiff: DAYS.indexOf(possibleDays[0]) - DAYS.indexOf(baseDay),
      };
    }

    return {
      mentor: null,
      day: null,
      autoRank: null,
      fromDay: baseDay,
      toDay: null,
      dayDiff: null,
    };
  }

  // 🔥 기준 멘토 유지 조건 (자동배정일 때는 완전 고정 금지)
  if (prevRecord?.mentor && student.assignBase === "fixed") {
    const preferredDay = prevRecord.day;

    if (preferredDay && hasValidAttendance(attendance, preferredDay)) {
      const mentors = mentorsByDay?.[preferredDay] || [];

      const sameMentor = mentors.find(
        (m) =>
          m.name === prevRecord.mentor &&
          isTimeOverlapped(
            attendance[preferredDay],
            getMentorTime(m)
          )
      );

      if (sameMentor) {
        return {
          mentor: sameMentor.name,
          day: preferredDay,
          autoRank: 0,
          fromDay: preferredDay,
          toDay: preferredDay,
          dayDiff: 0,
        };
      }
    }
  }

  // ================================
  // 🔒 최초 멘토 기준: 멘토 완전 고정
  // ================================
  if (student.assignBase === "initial" && prevRecord?.mentor) {
    const fixedMentor = prevRecord.mentor;

    for (const targetDay of DAY_PRIORITY[baseDay] || DAYS) {
      if (!hasValidAttendance(attendance, targetDay)) continue;

      const mentors = mentorsByDay?.[targetDay] || [];
      const mentor = mentors.find(
        m =>
          m.name === fixedMentor &&
          isTimeOverlapped(attendance[targetDay], getMentorTime(m))
      );

      if (mentor) {
        return {
          mentor: fixedMentor,
          day: targetDay,
          autoRank: 1,
          fromDay: baseDay,
          toDay: targetDay,
          dayDiff: DAYS.indexOf(targetDay) - DAYS.indexOf(baseDay),
        };
      }
    }

    // ❌ 요일 어디에도 안 맞으면 미배정
    return {
      mentor: null,
      day: null,
      autoRank: null,
      fromDay: baseDay,
      toDay: null,
      dayDiff: null,
    };
  }


  // 요일 중심 탐색
  // ✅ 요일 중심 탐색 (기준 요일별 우선순위 테이블 사용)
  const searchDays = DAY_PRIORITY[baseDay] || DAYS;

  for (const targetDay of searchDays) {
    // 출결이 있는 요일만
    if (!hasValidAttendance(attendance, targetDay)) continue;

    const studentTime = attendance[targetDay];
    const mentors = mentorsByDay?.[targetDay] || [];
    if (mentors.length === 0) continue;

    // 배제 멘토 제거 + 시간 겹치는 멘토만
    const available = mentors.filter(
      (m) =>
        m?.name &&
        m.name !== student.bannedMentor1 &&
        m.name !== student.bannedMentor2 &&
        isTimeOverlapped(studentTime, getMentorTime(m))
    );

    if (available.length === 0) continue;

    // ✅ 최근 멘토 최우선 (assignBase와 무관하게 적용)
    if (prevRecord?.mentor) {
      const same = available.find(m => m.name === prevRecord.mentor);
      if (same) {
        return {
          mentor: same.name,
          day: targetDay,
          autoRank: 1,
          fromDay: baseDay,
          toDay: targetDay,
          dayDiff: DAYS.indexOf(targetDay) - DAYS.indexOf(baseDay),
        };
      }
    }

    // ✅ 그 외 멘토: 과목 매칭 높은 순(동률이면 먼저 나온 멘토)
    const ranked = available
      .map(m => ({
        mentor: m.name,
        match: countSubjectMatch(student, m),
      }))
      .sort((a, b) => b.match - a.match);

    return {
      mentor: ranked[0].mentor,
      day: targetDay,
      autoRank: 2,
      fromDay: baseDay,
      toDay: targetDay,
      dayDiff: DAYS.indexOf(targetDay) - DAYS.indexOf(baseDay),
    };
  }

  // 완전 실패
  return {
    mentor: null,
    day: null,
    autoRank: null,
    fromDay: baseDay,
    toDay: null,
    dayDiff: null,
  };
}
