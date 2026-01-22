// src/context/ScheduleContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";

export const ScheduleContext = createContext();

// ✅ 요일 상수 (월~토)
const days = ["월", "화", "수", "목", "금", "토"];

export const ScheduleProvider = ({ children }) => {
  const [students, setStudents] = useState(() => {
    try {
      const saved = localStorage.getItem("students");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // ================================
  // 🔥 STEP 1: students 구조 자동 확장 (Migration)
  // ================================
  useEffect(() => {
    setStudents(prev =>
      prev.map(s => ({
        ...s,

        // ✅ 신입생 플래그 통합 (이 줄 추가)
       isNewStudent: s.isNewStudent ?? s.isNewbie ?? false,
        
        // 🔹 과목 선택 (없으면 기본값)
        subjects: s.subjects ?? {
          kor: false,
          math: false,
          sci1: false,
          sci2: false,
        },

        // 🔹 성격 / 출생년도
        personality: s.personality ?? "",
        birthYear: s.birthYear ?? "",

        // 🔒 최초 배정 멘토 (신입생 첫 확정값 박제)
        initialMentor: s.initialMentor
          ? {
              mentor: s.initialMentor.mentor || s.initialMentor.mentorId || "",
              day: s.initialMentor.day || "",
              periodId: s.initialMentor.periodId || "initial",
              createdAt: s.initialMentor.createdAt || Date.now(),
            }
          : {
              mentor: "",
              day: "",
              periodId: "initial",
              createdAt: Date.now(),
            },


        // 🔄 주차별 멘토 히스토리 (공식)
        // mentorHistory[periodId] = {
        //   mentorId: "hong-B", // 🔥 mentorId 기준
        //   day: "수",
        //   source: "newbie" | "auto",
        //   autoRank: 1,
        //   fromDay: "수",
        //   toDay: "화",
        //   dayDiff: -1,
        //   attended: true,        // 실제 진행 여부
        //   missedCarryOver: false // 이월 누락 여부
        // }
        mentorHistory: s.mentorHistory ?? {},

        // 🧠 자동 배정 임시 결과 (재학생 페이지에서만 사용, 확정 시 삭제)
        weeklyMentorDraft: s.weeklyMentorDraft ?? undefined,
        weeklyMentorInfo: s.weeklyMentorInfo ?? undefined,
      }))
    );
    // ⚠️ 최초 1회만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [mentorsByDay, setMentorsByDay] = useState(() => {
    try {
      const saved = localStorage.getItem("mentorsByDay");
      return saved
        ? JSON.parse(saved)
        : { 월: [], 화: [], 수: [], 목: [], 금: [], 토: [] };
    } catch {
      return { 월: [], 화: [], 수: [], 목: [], 금: [], 토: [] };
    }
  });

  // 🔥 [신규] 플래너 체크 결과 (읽기 전용 공유용)
  const [plannerScheduleByDay, setPlannerScheduleByDay] = useState(() => {
    try {
      const saved = localStorage.getItem("plannerScheduleByDay");
      return saved ? JSON.parse(saved) : { 월: [], 화: [], 수: [], 목: [], 금: [], 토: [] };
    } catch {
      return { 월: [], 화: [], 수: [], 목: [], 금: [], 토: [] };
    }
  });

  const [plannerMessage, setPlannerMessage] = useState(
    () => localStorage.getItem("plannerMessage") || ""
  );
  const [noticeMessage, setNoticeMessage] = useState(
    () => localStorage.getItem("noticeMessage") || ""
  );
  const [monthlyNotice, setMonthlyNotice] = useState(
    () => localStorage.getItem("monthlyNotice") || ""
  );

  const defaultMentalCare = {
    mentorTime: { 월: {}, 화: {}, 수: {}, 목: {}, 금: {}, 토: {} },
    sessionDuration: 15,
  };
  const [mentalCareSettings, setMentalCareSettings] = useState(() => {
    try {
      const saved = localStorage.getItem("mentalCareSettings");
      return saved ? JSON.parse(saved) : defaultMentalCare;
    } catch {
      return defaultMentalCare;
    }
  });

  const defaultSchedule = { 월: [], 화: [], 수: [], 목: [], 금: [], 토: [] };
  const [scheduleByDay, setScheduleByDay] = useState(() => {
    try {
      const saved = localStorage.getItem("mentalCareSchedule");
      return saved ? JSON.parse(saved) : defaultSchedule;
    } catch {
      return defaultSchedule;
    }
  });

  const [attendance, setAttendance] = useState(() => {
    try {
      const saved = localStorage.getItem("attendance");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [assignments, setAssignments] = useState(() => {
    try {
      const saved = localStorage.getItem("mentorAssignments");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [studentInterviewAssignments, setStudentInterviewAssignments] = useState(() => {
    try {
      const saved = localStorage.getItem("studentInterviewAssignments");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // ✅ 주간 범위
  const [startDate, setStartDate] = useState(
    () => localStorage.getItem("startDate") || ""
  );
  const [endDate, setEndDate] = useState(
    () => localStorage.getItem("endDate") || ""
  );

  // 🔥 [신규] 공식 주차 목록
  const [periods, setPeriods] = useState(() => {
    try {
      const saved = localStorage.getItem("periods");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 🔥 [신규] 현재 선택된 주차
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    return localStorage.getItem("selectedPeriod") || "";
  });
  
  // 🔥 [신규] 자동배정 기준 주차 (확정된 주)
  const [currentPeriodId, setCurrentPeriodId] = useState(() => {
    return localStorage.getItem("currentPeriodId") || "";
  });

  // 🔥 selectedPeriod → currentPeriodId 동기화 (핵심)
  useEffect(() => {
    if (selectedPeriod && selectedPeriod !== currentPeriodId) {
      setCurrentPeriodId(selectedPeriod);
    }
  }, [selectedPeriod]);

  /* =================================================
     🔥 학생별 주간 캘린더 (외부 업로드용)
  ================================================= */
  const [weeklyCalendars, setWeeklyCalendars] = useState(() => {
    try {
      const saved = localStorage.getItem("weeklyCalendars");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  /* =================================================
     🔥 원장 컨설팅 데이터
  ================================================= */
  const [studentConsultings, setStudentConsultings] = useState(() => {
    try {
      const saved = localStorage.getItem("studentConsultings");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // ===== 학생 추가 시 출결 기본값 (주차 기준) =====
  // 🔥 출결은 "자동배정 기준 주차" 기준으로 생성
  useEffect(() => {
    if (!currentPeriodId) return;

    setAttendance(prev => {
      const next = { ...prev };

      if (!next[currentPeriodId]) {
        next[currentPeriodId] = {};
      }

      students.forEach(s => {
        if (!next[currentPeriodId][s.id]) {
          next[currentPeriodId][s.id] = {
            월: [],
            화: [],
            수: [],
            목: [],
            금: [],
            토: [],
          };
        }
      });

      return next;
    });
  }, [students, currentPeriodId]);

  // ===== 출결 정규화 =====
  function normalizeTimeValue(value) {
    if (Array.isArray(value)) {
      const a = value.map((v) => (typeof v === "string" ? v.trim() : ""));
      if (!a[0] && !a[1]) return [];
      return [a[0] || "", a[1] || ""];
    }
    if (typeof value === "string") {
      const s = value.trim();
      if (!s) return [];
      if (s.includes("~")) {
        const [st, en] = s.split("~").map((x) => x.trim());
        if (!st && !en) return [];
        return [st || "", en || ""];
      }
      return [s, ""];
    }
    return [];
  }

  function normalizeAttendanceShape(rawAttendance, list = students) {
    const next = { ...(rawAttendance || {}) };
    let changed = false;

    list.forEach((s) => {
      if (!next[s.id]) {
        next[s.id] = {};
        changed = true;
      }
      const per = next[s.id];
      days.forEach((d) => {
        const before = per[d];
        const after = normalizeTimeValue(before);
        if (JSON.stringify(before) !== JSON.stringify(after)) {
          per[d] = after;
          changed = true;
        }
      });
    });

    return { normalized: next, changed };
  }

  useEffect(() => {
    if (!currentPeriodId) return;

    setAttendance(prev => {
      const periodAtt = prev[currentPeriodId] || {};
      let changed = false;
      const nextPeriodAtt = { ...periodAtt };

      students.forEach(s => {
        if (!nextPeriodAtt[s.id]) {
          nextPeriodAtt[s.id] = {};
          changed = true;
        }

        days.forEach(d => {
          const before = nextPeriodAtt[s.id][d];
          const after = normalizeTimeValue(before);

          if (JSON.stringify(before) !== JSON.stringify(after)) {
            nextPeriodAtt[s.id][d] = after;
            changed = true;
          }
        });
      });

      if (!changed) return prev;

      return {
        ...prev,
        [currentPeriodId]: nextPeriodAtt,
      };
    });
  }, [students, currentPeriodId]);

  // ===== localStorage 동기화 =====
  useEffect(() => {
    localStorage.setItem("students", JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem("mentorsByDay", JSON.stringify(mentorsByDay));
  }, [mentorsByDay]);

  useEffect(() => {
    localStorage.setItem("plannerMessage", plannerMessage);
  }, [plannerMessage]);

  useEffect(() => {
    localStorage.setItem("noticeMessage", noticeMessage);
  }, [noticeMessage]);

  useEffect(() => {
    localStorage.setItem("monthlyNotice", monthlyNotice);
  }, [monthlyNotice]);

  useEffect(() => {
    localStorage.setItem("mentalCareSettings", JSON.stringify(mentalCareSettings));
  }, [mentalCareSettings]);

  useEffect(() => {
    localStorage.setItem("mentalCareSchedule", JSON.stringify(scheduleByDay));
  }, [scheduleByDay]);

  useEffect(() => {
    localStorage.setItem(
      "plannerScheduleByDay",
      JSON.stringify(plannerScheduleByDay)
    );
  }, [plannerScheduleByDay]);

  useEffect(() => {
    localStorage.setItem("attendance", JSON.stringify(attendance));
  }, [attendance]);

  useEffect(() => {
    localStorage.setItem("mentorAssignments", JSON.stringify(assignments));
  }, [assignments]);

  useEffect(() => {
    localStorage.setItem(
      "studentInterviewAssignments",
      JSON.stringify(studentInterviewAssignments)
    );
  }, [studentInterviewAssignments]);

  useEffect(() => {
    localStorage.setItem("startDate", startDate);
  }, [startDate]);

  useEffect(() => {
    localStorage.setItem("endDate", endDate);
  }, [endDate]);

  useEffect(() => {
    localStorage.setItem("periods", JSON.stringify(periods));
  }, [periods]);

  useEffect(() => {
    localStorage.setItem("selectedPeriod", selectedPeriod);
  }, [selectedPeriod]);

  useEffect(() => {
    localStorage.setItem("currentPeriodId", currentPeriodId);
  }, [currentPeriodId]);

  useEffect(() => {
    localStorage.setItem("weeklyCalendars", JSON.stringify(weeklyCalendars));
  }, [weeklyCalendars]);

  useEffect(() => {
    localStorage.setItem(
      "studentConsultings",
      JSON.stringify(studentConsultings)
    );
  }, [studentConsultings]);

  // ===== 전체 백업 =====
  const getAllState = () => ({
    students,
    mentorsByDay,
    plannerMessage,
    noticeMessage,
    monthlyNotice,
    mentalCareSettings,
    scheduleByDay,

    // 🔥 플래너 체크 결과
    plannerScheduleByDay,

    attendance,
    assignments,
    studentInterviewAssignments,
    startDate,
    endDate,
    weeklyCalendars,
    studentConsultings,
  });

  const setAllState = (data) => {
    if (data.students) setStudents(data.students);
    if (data.mentorsByDay) setMentorsByDay(data.mentorsByDay);
    if (typeof data.plannerMessage === "string") setPlannerMessage(data.plannerMessage);
    if (typeof data.noticeMessage === "string") setNoticeMessage(data.noticeMessage);
    if (typeof data.monthlyNotice === "string") setMonthlyNotice(data.monthlyNotice);
    if (data.mentalCareSettings) setMentalCareSettings(data.mentalCareSettings);
    if (data.scheduleByDay) setScheduleByDay(data.scheduleByDay);
    if (data.plannerScheduleByDay)
      setPlannerScheduleByDay(data.plannerScheduleByDay);
    if (data.attendance) setAttendance(data.attendance);
    if (data.assignments) setAssignments(data.assignments);
    if (data.studentInterviewAssignments)
      setStudentInterviewAssignments(data.studentInterviewAssignments);
    if (data.startDate) setStartDate(data.startDate);
    if (data.endDate) setEndDate(data.endDate);
    if (data.weeklyCalendars) setWeeklyCalendars(data.weeklyCalendars);
    if (data.studentConsultings) setStudentConsultings(data.studentConsultings);
  };

  return (
    <ScheduleContext.Provider
      value={{
        students, setStudents,
        mentorsByDay, setMentorsByDay,
        plannerMessage, setPlannerMessage,
        noticeMessage, setNoticeMessage,
        monthlyNotice, setMonthlyNotice,
        mentalCareSettings, setMentalCareSettings,
        scheduleByDay, setScheduleByDay,
        // 🔥 플래너 체크 결과 공유용
        plannerScheduleByDay, setPlannerScheduleByDay,
        attendance, setAttendance,
        assignments, setAssignments,
        studentInterviewAssignments, setStudentInterviewAssignments,
        startDate, setStartDate,
        endDate, setEndDate,
        periods, setPeriods,
        selectedPeriod, setSelectedPeriod,

        // 🔥 자동배정 기준 주차
        currentPeriodId, setCurrentPeriodId,

        // 🔥 캘린더 & 컨설팅
        weeklyCalendars, setWeeklyCalendars,
        studentConsultings, setStudentConsultings,

        getAllState, setAllState,
      }}
    >
      {children}
    </ScheduleContext.Provider>
  );
};

export const useSchedule = () => useContext(ScheduleContext);
