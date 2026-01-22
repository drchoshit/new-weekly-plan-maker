// src/utils/mentorAssigner.js

export function assignMentorsToStudents({
  students,
  mentorsByDay,
  attendanceByPeriod,
  currentPeriodId,
}) {

  // ===============================
  // 유틸
  // ===============================
  const toMinutes = (t) => {
    if (!t || !t.includes(":")) return NaN;
    const [h, m] = t.split(":").map(s => Number(s.trim()));
    return h * 60 + m;
  };

  const normalizeMentorTime = (time) => {
    if (!time) return null;
    return time
      .replace(/\s*/g, "")
      .replace("-", "~");
  };

  const personalityCompatible = (mentorP, studentP) => {
    if (!mentorP || !studentP) return true;
    return !(mentorP === "극I" && studentP === "극I");
  };

  // ===============================
  // 메인 로직
  // ===============================
  return students.map(student => {
    const {
      id,
      fixedMentor,
      bannedMentor1,
      bannedMentor2,
      personality,
      birthYear,
      math,
      korean,
      explore1,
      explore2,
    } = student;

    // ✅ 핵심: "현재 자동배정 기준 주차"의 출결만 사용
    const studentAttendance =
      attendanceByPeriod?.[currentPeriodId]?.[id] || {};

    // ===============================
    // 고정 멘토
    // ===============================
    if (fixedMentor) {
      return {
        studentId: id,
        first: fixedMentor,
        second: "",
        third: "",
        reasons: {
          first: "고정 멘토",
          second: "",
          third: "",
        },
      };
    }

    const candidates = {};

    // ===============================
    // 요일별 출결 × 멘토 비교
    // ===============================
    for (const day of Object.keys(studentAttendance)) {
      const times = studentAttendance[day];
      if (!times || !times[0] || !times[1]) continue;

      const sStart = toMinutes(times[0]);
      const sEnd   = toMinutes(times[1]);
      if (isNaN(sStart) || isNaN(sEnd)) continue;

      for (const mentor of mentorsByDay[day] || []) {
        if (!mentor?.name) continue;
        if ([bannedMentor1, bannedMentor2].includes(mentor.name)) continue;

        const normTime = normalizeMentorTime(mentor.time);
        if (!normTime || !normTime.includes("~")) continue;

        const [mStartStr, mEndStr] = normTime.split("~");
        const mStart = toMinutes(mStartStr);
        const mEnd   = toMinutes(mEndStr);

        const overlap = Math.min(sEnd, mEnd) - Math.max(sStart, mStart);
        if (overlap < 30) continue;

        // ❗ 조건 불충족 멘토는 후보 생성 자체를 하지 않음
        if (mentor.birthYear && birthYear && mentor.birthYear >= birthYear) continue;
        if (!personalityCompatible(mentor.personality, personality)) continue;

        if (!candidates[mentor.name]) {
          candidates[mentor.name] = {
            name: mentor.name,
            score: 0,
          };
        }

        // ===============================
        // 과목 매칭 점수
        // ===============================
        if (mentor.mathSubject === math) candidates[mentor.name].score++;
        if (mentor.koreanSubject === korean) candidates[mentor.name].score++;
        if ([mentor.explore1, mentor.explore2].includes(explore1))
          candidates[mentor.name].score++;
        if ([mentor.explore1, mentor.explore2].includes(explore2))
          candidates[mentor.name].score++;
      }
    }

    // ===============================
    // 정렬 및 결과
    // ===============================
    const sorted = Object.values(candidates)
      .sort((a, b) => b.score - a.score);

    return {
      studentId: id,
      first: sorted[0]?.name || "배정불가",
      second: sorted[1]?.name || "",
      third: sorted[2]?.name || "",
      reasons: {
        first: sorted[0] ? "출결·시간·조건 충족" : "조건 미충족",
        second: "",
        third: "",
      },
    };
  });
}
