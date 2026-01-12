export function assignMentorsToStudents({ students, mentorsByDay }) {
  const toMinutes = (t) => {
    if (!t || !t.includes(":")) return NaN;
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const personalityCompatible = (a, b) => !(a === "극I" && b === "극I");

  return students.map(student => {
    const {
      id,
      name,
      birthYear,
      fixedMentor,
      bannedMentor1,
      bannedMentor2,
      personality,
      attendance = {},
      math,
      korean,
      explore1,
      explore2,
    } = student;

    if (fixedMentor) {
      return {
        studentId: id,
        first: fixedMentor,
        second: "",
        third: "",
        reasons: {
          first: "고정 멘토 지정됨",
          second: "",
          third: ""
        }
      };
    }

    const candidateMap = {};
    const alreadyEvaluatedMentors = new Set(); // ✅ 과목 매칭 중복 방지

    for (let day of Object.keys(mentorsByDay)) {
      const times = attendance[day];
      if (!times || !times[0] || !times[1]) continue;

      const sStart = toMinutes(times[0]);
      const sEnd = toMinutes(times[1]);

      for (let mentor of mentorsByDay[day] || []) {
        if (!mentor.name) continue;
        const name = mentor.name;

        if (!candidateMap[name]) {
          candidateMap[name] = {
            name,
            matchCount: 0,
            matchedSubjectsSet: new Set(),
            matchedSubjectsList: [],
            timeOK: "X",
            ageOK: "X",
            personalityOK: "X"
          };
        }

        if ([bannedMentor1, bannedMentor2].includes(name)) continue;
        const c = candidateMap[name];

        // 시간 조건
        if (mentor.time && mentor.time.includes("~")) {
          const [mStart, mEnd] = mentor.time.split("~").map(toMinutes);
          if (![sStart, sEnd, mStart, mEnd].some(isNaN)) {
            const overlap = Math.min(sEnd, mEnd) - Math.max(sStart, mStart);
            if (overlap >= 30) c.timeOK = "OK";
          }
        }

        // 나이 조건
        if (mentor.birthYear && Number(mentor.birthYear) < Number(birthYear)) {
          c.ageOK = "OK";
        }

        // 성격 조건
        if (personalityCompatible(mentor.personality, personality)) {
          c.personalityOK = "OK";
        }

        // ✅ mentor 1명당 과목 매칭은 단 1회만 수행
        if (!alreadyEvaluatedMentors.has(name)) {
          if (mentor.mathSubject === math) {
            c.matchedSubjectsSet.add(`수학(${math})`);
          }
          if (mentor.koreanSubject === korean) {
            c.matchedSubjectsSet.add(`국어(${korean})`);
          }
          if ([mentor.explore1, mentor.explore2].includes(explore1)) {
            c.matchedSubjectsSet.add(`탐구1(${explore1})`);
          }
          if ([mentor.explore1, mentor.explore2].includes(explore2)) {
            c.matchedSubjectsSet.add(`탐구2(${explore2})`);
          }

          alreadyEvaluatedMentors.add(name); // ✅ 과목 평가 완료 표시

          // 목록과 카운트 업데이트
          c.matchedSubjectsList = Array.from(c.matchedSubjectsSet);
          c.matchCount = c.matchedSubjectsList.length;
        }
      }
    }

    const candidates = Object.values(candidateMap)
      .filter(c => c.timeOK === "OK" && c.ageOK === "OK" && c.personalityOK === "OK")
      .sort((a, b) => b.matchCount - a.matchCount);

    const [c1, c2, c3] = candidates;

    const makeReason = (c) => {
      if (!c) return "이유 없음";
      const reasons = [
        `시간 조건 ${c.timeOK}`,
        `성격 조건 ${c.personalityOK}`,
        `나이 조건 ${c.ageOK}`,
        `과목 매칭: ${c.matchedSubjectsList.join(", ") || "없음"}`
      ];
      return reasons.join(" / ");
    };

    return {
      studentId: id,
      first: c1?.name || "배정불가",
      second: c2?.name || "",
      third: c3?.name || "",
      reasons: {
        first: makeReason(c1),
        second: makeReason(c2),
        third: makeReason(c3)
      }
    };
  });
}
