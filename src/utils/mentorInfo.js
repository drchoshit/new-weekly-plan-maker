export const DAYS = ["월", "화", "수", "목", "금", "토"];

export const MATH_OPTIONS = ["미적", "확통", "기하", "공통"].map(value => ({
  label: value,
  value,
}));

export const KOREAN_OPTIONS = ["화작", "언매", "공통"].map(value => ({
  label: value,
  value,
}));

export const EXPLORE_OPTIONS = [
  "통합사회",
  "한국지리",
  "세계지리",
  "세계사",
  "동아시아사",
  "경제",
  "정치와 법",
  "사회·문화",
  "생활과 윤리",
  "윤리와 사상",
  "통합과학",
  "과학탐구 실험",
  "물리학Ⅰ",
  "화학Ⅰ",
  "생명과학Ⅰ",
  "지구과학Ⅰ",
].map(value => ({ label: value, value }));

export const PERSONALITY_OPTIONS = ["극I", "극E", "비극단적"].map(value => ({
  label: value,
  value,
}));

const MENTOR_FIELDS = [
  "name",
  "univ",
  "major",
  "gender",
  "note",
  "birthYear",
  "mathSubject",
  "koreanSubject",
  "explore1",
  "explore2",
  "personality",
];

const trimText = value => String(value ?? "").trim();

const cloneShift = shift => ({
  day: DAYS.includes(shift?.day) ? shift.day : "",
  time: trimText(shift?.time),
});

const hasMentorCoreData = mentor =>
  MENTOR_FIELDS.some(field => trimText(mentor?.[field])) ||
  (Array.isArray(mentor?.shifts) &&
    mentor.shifts.some(shift => DAYS.includes(shift?.day) || trimText(shift?.time)));

export const createEmptyMentorByDay = () =>
  DAYS.reduce((acc, day) => {
    acc[day] = [];
    return acc;
  }, {});

export const normalizeMentorsByDay = source => {
  const normalized = createEmptyMentorByDay();
  DAYS.forEach(day => {
    normalized[day] = Array.isArray(source?.[day]) ? source[day] : [];
  });
  return normalized;
};

export const createEmptyMentorDraft = id => ({
  id,
  name: "",
  univ: "",
  major: "",
  gender: "",
  note: "",
  birthYear: "",
  mathSubject: "",
  koreanSubject: "",
  explore1: "",
  explore2: "",
  personality: "",
  shifts: [],
});

const createMentorFromEntry = (id, entry) => ({
  ...createEmptyMentorDraft(id),
  ...MENTOR_FIELDS.reduce((acc, field) => {
    acc[field] = trimText(entry?.[field]);
    return acc;
  }, {}),
  shifts: [],
});

export const buildMentorDraftsFromByDay = source => {
  const byDay = normalizeMentorsByDay(source);
  const mentorMap = new Map();
  let seq = 1;

  DAYS.forEach(day => {
    byDay[day].forEach((entry, rowIndex) => {
      const mentorName = trimText(entry?.name);
      const key = mentorName ? `name:${mentorName}` : `anon:${day}:${rowIndex}`;

      if (!mentorMap.has(key)) {
        mentorMap.set(key, createMentorFromEntry(`mentor-${seq++}`, entry));
      }

      const target = mentorMap.get(key);
      MENTOR_FIELDS.forEach(field => {
        const value = trimText(entry?.[field]);
        if (!target[field] && value) target[field] = value;
      });

      const nextShift = { day, time: trimText(entry?.time) };
      const duplicated = target.shifts.some(
        shift => shift.day === nextShift.day && shift.time === nextShift.time
      );
      if (!duplicated) target.shifts.push(nextShift);
    });
  });

  const mentors = Array.from(mentorMap.values()).filter(hasMentorCoreData);
  return mentors.length ? mentors : [createEmptyMentorDraft("mentor-1")];
};

export const buildByDayFromMentorDrafts = drafts => {
  const byDay = createEmptyMentorByDay();

  (Array.isArray(drafts) ? drafts : []).forEach(rawDraft => {
    const draft = rawDraft || {};
    const name = trimText(draft.name);
    if (!name) return;

    const base = MENTOR_FIELDS.reduce((acc, field) => {
      acc[field] = field === "name" ? name : trimText(draft[field]);
      return acc;
    }, {});

    const shifts = Array.isArray(draft.shifts) ? draft.shifts.map(cloneShift) : [];
    shifts.forEach(shift => {
      if (!DAYS.includes(shift.day)) return;
      byDay[shift.day].push({
        ...base,
        time: shift.time,
      });
    });
  });

  return byDay;
};

export const buildMentorWorkSummary = drafts => {
  const summaryMap = new Map();

  (Array.isArray(drafts) ? drafts : []).forEach(rawDraft => {
    const draft = rawDraft || {};
    const name = trimText(draft.name);
    if (!name) return;

    if (!summaryMap.has(name)) {
      summaryMap.set(
        name,
        DAYS.reduce((acc, day) => {
          acc[day] = [];
          return acc;
        }, {})
      );
    }

    const dayMap = summaryMap.get(name);
    (Array.isArray(draft.shifts) ? draft.shifts : []).forEach(rawShift => {
      const shift = cloneShift(rawShift);
      if (!DAYS.includes(shift.day)) return;
      if (!shift.time) return;
      dayMap[shift.day].push(shift.time);
    });
  });

  return Array.from(summaryMap.entries()).map(([name, byDay]) => ({
    name,
    byDay: DAYS.reduce((acc, day) => {
      const values = byDay[day];
      acc[day] = values.length ? values.join(" / ") : "없음";
      return acc;
    }, {}),
  }));
};

export const stripMentorDraftIds = drafts =>
  (Array.isArray(drafts) ? drafts : []).map(draft => ({
    ...MENTOR_FIELDS.reduce((acc, field) => {
      acc[field] = trimText(draft?.[field]);
      return acc;
    }, {}),
    shifts: (Array.isArray(draft?.shifts) ? draft.shifts : [])
      .map(cloneShift)
      .filter(shift => DAYS.includes(shift.day)),
  }));
