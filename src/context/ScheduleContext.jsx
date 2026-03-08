// src/context/ScheduleContext.jsx
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { getAppState, saveAppState, saveWeeklyCalendars } from "../api/client";

export const ScheduleContext = createContext();

// ✅ 요일 상수 (월~토)
const days = ["월", "화", "수", "목", "금", "토"];
const defaultDaySchedule = { 월: [], 화: [], 수: [], 목: [], 금: [], 토: [] };

const createDefaultPlannerCheckTime = () =>
  days.reduce(
    (acc, day) => ({
      ...acc,
      [day]: [
        { start: "", end: "" },
        { start: "", end: "" },
      ],
    }),
    {}
  );

export const ScheduleProvider = ({ children, authToken, onUnauthorized }) => {
  const hasHydratedRef = useRef(false);
  const saveTimeoutRef = useRef();
  const skipNextFullSaveRef = useRef(false);
  const pendingLocalSaveRef = useRef(false);
  const isSavingRef = useRef(false);
  const lastConflictAlertAtRef = useRef(0);
  const serverVersionRef = useRef();
  const [hasHydrated, setHasHydrated] = useState(false);
  const [serverVersion, setServerVersion] = useState();
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
  const [clinicMentorsByDay, setClinicMentorsByDay] = useState(() => {
    try {
      const saved = localStorage.getItem("clinicMentorsByDay");
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
      const saved =
        localStorage.getItem("plannerScheduleByDay") ||
        localStorage.getItem("plannerSchedule");
      return saved ? JSON.parse(saved) : defaultDaySchedule;
    } catch {
      return defaultDaySchedule;
    }
  });
  const [plannerCheckTime, setPlannerCheckTime] = useState(() => {
    try {
      const saved = localStorage.getItem("plannerCheckTime");
      return saved ? JSON.parse(saved) : createDefaultPlannerCheckTime();
    } catch {
      return createDefaultPlannerCheckTime();
    }
  });
  const [plannerSessionDuration, setPlannerSessionDuration] = useState(() => {
    try {
      const saved = localStorage.getItem("plannerSessionDuration");
      return saved ? JSON.parse(saved) : 30;
    } catch {
      return 30;
    }
  });
  const [printOverrides, setPrintOverrides] = useState(() => {
    try {
      const saved = localStorage.getItem("printOverrides");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
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

  const defaultSchedule = defaultDaySchedule;
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
  const [interviewSettings, setInterviewSettings] = useState(() => {
    try {
      const saved = localStorage.getItem("interviewSettings");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [interviewSchedule, setInterviewSchedule] = useState(() => {
    try {
      const saved = localStorage.getItem("interviewSchedule");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [interviewDuration, setInterviewDuration] = useState(() => {
    const parsed = Number(localStorage.getItem("interviewDuration"));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
  });
  const [interviewWilling, setInterviewWilling] = useState(() => {
    try {
      const saved = localStorage.getItem("interviewWilling");
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
    localStorage.setItem("clinicMentorsByDay", JSON.stringify(clinicMentorsByDay));
  }, [clinicMentorsByDay]);

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
    // Backward compatibility with legacy pages reading plannerSchedule directly.
    localStorage.setItem("plannerSchedule", JSON.stringify(plannerScheduleByDay));
  }, [plannerScheduleByDay]);

  useEffect(() => {
    localStorage.setItem("plannerCheckTime", JSON.stringify(plannerCheckTime));
  }, [plannerCheckTime]);

  useEffect(() => {
    localStorage.setItem(
      "plannerSessionDuration",
      JSON.stringify(plannerSessionDuration)
    );
  }, [plannerSessionDuration]);

  useEffect(() => {
    localStorage.setItem("printOverrides", JSON.stringify(printOverrides));
    window.dispatchEvent(new Event("print-overrides-updated"));
  }, [printOverrides]);

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
    localStorage.setItem("interviewSettings", JSON.stringify(interviewSettings));
  }, [interviewSettings]);

  useEffect(() => {
    localStorage.setItem("interviewSchedule", JSON.stringify(interviewSchedule));
  }, [interviewSchedule]);

  useEffect(() => {
    localStorage.setItem("interviewDuration", String(interviewDuration));
  }, [interviewDuration]);

  useEffect(() => {
    localStorage.setItem("interviewWilling", JSON.stringify(interviewWilling));
  }, [interviewWilling]);

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
    clinicMentorsByDay,
    plannerMessage,
    noticeMessage,
    monthlyNotice,
    mentalCareSettings,
    scheduleByDay,

    // 🔥 플래너 체크 결과
    plannerScheduleByDay,
    plannerCheckTime,
    plannerSessionDuration,
    printOverrides,

    attendance,
    assignments,
    studentInterviewAssignments,
    interviewSettings,
    interviewSchedule,
    interviewDuration,
    interviewWilling,
    startDate,
    endDate,
    periods,
    selectedPeriod,
    currentPeriodId,
    weeklyCalendars,
    studentConsultings,
  });

  const setAllState = (data) => {
    if (!data) {
      return;
    }

    if ("students" in data) setStudents(data.students ?? []);
    if ("mentorsByDay" in data)
      setMentorsByDay(
        data.mentorsByDay ?? { 월: [], 화: [], 수: [], 목: [], 금: [], 토: [] }
      );
    if ("clinicMentorsByDay" in data)
      setClinicMentorsByDay(
        data.clinicMentorsByDay ?? { 월: [], 화: [], 수: [], 목: [], 금: [], 토: [] }
      );
    if ("plannerMessage" in data) setPlannerMessage(data.plannerMessage ?? "");
    if ("noticeMessage" in data) setNoticeMessage(data.noticeMessage ?? "");
    if ("monthlyNotice" in data) setMonthlyNotice(data.monthlyNotice ?? "");
    if ("mentalCareSettings" in data)
      setMentalCareSettings(
        data.mentalCareSettings ?? {
          mentorTime: { 월: {}, 화: {}, 수: {}, 목: {}, 금: {}, 토: {} },
          sessionDuration: 15,
        }
      );
    if ("scheduleByDay" in data)
      setScheduleByDay(data.scheduleByDay ?? { 월: [], 화: [], 수: [], 목: [], 금: [], 토: [] });
    if ("plannerScheduleByDay" in data)
      setPlannerScheduleByDay(
        data.plannerScheduleByDay ?? defaultDaySchedule
      );
    if ("plannerCheckTime" in data)
      setPlannerCheckTime(
        data.plannerCheckTime ?? createDefaultPlannerCheckTime()
      );
    if ("plannerSessionDuration" in data)
      setPlannerSessionDuration(data.plannerSessionDuration ?? 30);
    if ("printOverrides" in data) setPrintOverrides(data.printOverrides ?? {});
    if ("attendance" in data) setAttendance(data.attendance ?? {});
    if ("assignments" in data) setAssignments(data.assignments ?? []);
    if ("studentInterviewAssignments" in data)
      setStudentInterviewAssignments(data.studentInterviewAssignments ?? {});
    if ("interviewSettings" in data) setInterviewSettings(data.interviewSettings ?? {});
    if ("interviewSchedule" in data) setInterviewSchedule(data.interviewSchedule ?? {});
    if ("interviewDuration" in data) setInterviewDuration(data.interviewDuration ?? 30);
    if ("interviewWilling" in data) setInterviewWilling(data.interviewWilling ?? {});
    if ("startDate" in data) setStartDate(data.startDate ?? "");
    if ("endDate" in data) setEndDate(data.endDate ?? "");
    if ("periods" in data) setPeriods(data.periods ?? []);
    if ("selectedPeriod" in data) setSelectedPeriod(data.selectedPeriod ?? "");
    if ("currentPeriodId" in data) setCurrentPeriodId(data.currentPeriodId ?? "");
    if ("weeklyCalendars" in data) setWeeklyCalendars(data.weeklyCalendars ?? {});
    if ("studentConsultings" in data) setStudentConsultings(data.studentConsultings ?? {});
  };

  const applyServerSnapshot = snapshot => {
    if (!snapshot) return;
    skipNextFullSaveRef.current = true;
    setAllState(snapshot.state ?? {});

    if (Number.isInteger(snapshot.version)) {
      serverVersionRef.current = snapshot.version;
      setServerVersion(snapshot.version);
    }
  };

  const notifyConflict = () => {
    const now = Date.now();
    if (now - lastConflictAlertAtRef.current < 3000) {
      return;
    }
    lastConflictAlertAtRef.current = now;
    window.alert(
      "다른 컴퓨터에서 먼저 수정된 내용이 있어 최신 서버 데이터로 갱신했습니다. 방금 수정한 내용은 다시 확인 후 저장해 주세요."
    );
  };

  const handleVersionConflict = error => {
    if (error?.status !== 409) {
      return false;
    }
    applyServerSnapshot({
      state: error?.body?.state ?? {},
      version: error?.body?.version,
    });
    pendingLocalSaveRef.current = false;
    notifyConflict();
    return true;
  };

  const saveWeeklyCalendarsOnly = async (nextWeeklyCalendars) => {
    const hasAuth = Boolean(authToken);
    const shouldSkipFullSave = Boolean(authToken && hasHydratedRef.current);
    if (shouldSkipFullSave) {
      skipNextFullSaveRef.current = true;
    }

    setWeeklyCalendars(nextWeeklyCalendars ?? {});

    if (!hasAuth) {
      return;
    }

    pendingLocalSaveRef.current = true;
    isSavingRef.current = true;
    try {
      const response = await saveWeeklyCalendars(
        authToken,
        nextWeeklyCalendars ?? {},
        { baseVersion: serverVersionRef.current }
      );
      if (Number.isInteger(response?.version)) {
        serverVersionRef.current = response.version;
        setServerVersion(response.version);
      }
    } catch (error) {
      if (error?.status === 401 && onUnauthorized) {
        onUnauthorized();
      } else if (!handleVersionConflict(error)) {
        console.error("Failed to save weekly calendars:", error);
      }
    } finally {
      pendingLocalSaveRef.current = false;
      isSavingRef.current = false;
    }
  };

  useEffect(() => {
    if (!authToken) {
      hasHydratedRef.current = false;
      setHasHydrated(false);
      serverVersionRef.current = undefined;
      setServerVersion(undefined);
      pendingLocalSaveRef.current = false;
      return;
    }

    let isActive = true;

    const loadFromServer = async () => {
      try {
        const response = await getAppState(authToken);
        if (!isActive) {
          return;
        }
        applyServerSnapshot(response);
        hasHydratedRef.current = true;
        setHasHydrated(true);
      } catch (error) {
        if (error?.status === 401 && onUnauthorized) {
          onUnauthorized();
        }
        console.error("Initial state sync failed:", error);
      }
    };

    loadFromServer();

    return () => {
      isActive = false;
    };
  }, [authToken, onUnauthorized]);

  useEffect(() => {
    if (!authToken) {
      return;
    }

    let disposed = false;

    const pollLatestState = async () => {
      try {
        const response = await getAppState(authToken);
        if (disposed) {
          return;
        }

        const incomingVersion = response?.version;
        const knownVersion = serverVersionRef.current;

        if (!Number.isInteger(incomingVersion)) {
          return;
        }

        if (!hasHydratedRef.current) {
          applyServerSnapshot(response);
          hasHydratedRef.current = true;
          setHasHydrated(true);
          return;
        }

        if (Number.isInteger(knownVersion) && incomingVersion <= knownVersion) {
          return;
        }

        // Preserve local in-flight edits. Conflict check on save handles the rest.
        if (pendingLocalSaveRef.current || isSavingRef.current) {
          return;
        }

        applyServerSnapshot(response);
      } catch (error) {
        if (error?.status === 401 && onUnauthorized) {
          onUnauthorized();
        }
      }
    };

    const timer = setInterval(() => {
      pollLatestState();
    }, 5000);

    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [authToken, onUnauthorized]);

  useEffect(() => {
    if (!authToken || !hasHydrated) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    if (skipNextFullSaveRef.current) {
      skipNextFullSaveRef.current = false;
      return;
    }

    pendingLocalSaveRef.current = true;
    saveTimeoutRef.current = setTimeout(() => {
      isSavingRef.current = true;
      saveAppState(authToken, getAllState(), {
        baseVersion: serverVersionRef.current,
      })
        .then(response => {
          if (Number.isInteger(response?.version)) {
            serverVersionRef.current = response.version;
            setServerVersion(response.version);
          }
        })
        .catch(error => {
          if (error?.status === 401 && onUnauthorized) {
            onUnauthorized();
            return;
          }
          if (!handleVersionConflict(error)) {
            console.error("Failed to save app state:", error);
          }
        })
        .finally(() => {
          isSavingRef.current = false;
          pendingLocalSaveRef.current = false;
        });
    }, 800);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        }
      if (!isSavingRef.current) {
        pendingLocalSaveRef.current = false;
      }
    };
  }, [
    authToken,
    hasHydrated,
    students,
    mentorsByDay,
    clinicMentorsByDay,
    plannerMessage,
    noticeMessage,
    monthlyNotice,
    mentalCareSettings,
    scheduleByDay,
    plannerScheduleByDay,
    plannerCheckTime,
    plannerSessionDuration,
    printOverrides,
    attendance,
    assignments,
    studentInterviewAssignments,
    interviewSettings,
    interviewSchedule,
    interviewDuration,
    interviewWilling,
    startDate,
    endDate,
    periods,
    selectedPeriod,
    currentPeriodId,
    weeklyCalendars,
    studentConsultings,
    onUnauthorized,
  ]);

  return (
    <ScheduleContext.Provider
      value={{
        students, setStudents,
        mentorsByDay, setMentorsByDay,
        clinicMentorsByDay, setClinicMentorsByDay,
        plannerMessage, setPlannerMessage,
        noticeMessage, setNoticeMessage,
        monthlyNotice, setMonthlyNotice,
        mentalCareSettings, setMentalCareSettings,
        scheduleByDay, setScheduleByDay,
        // 🔥 플래너 체크 결과 공유용
        plannerScheduleByDay, setPlannerScheduleByDay,
        plannerCheckTime, setPlannerCheckTime,
        plannerSessionDuration, setPlannerSessionDuration,
        printOverrides, setPrintOverrides,
        attendance, setAttendance,
        assignments, setAssignments,
        studentInterviewAssignments, setStudentInterviewAssignments,
        interviewSettings, setInterviewSettings,
        interviewSchedule, setInterviewSchedule,
        interviewDuration, setInterviewDuration,
        interviewWilling, setInterviewWilling,
        startDate, setStartDate,
        endDate, setEndDate,
        periods, setPeriods,
        selectedPeriod, setSelectedPeriod,

        // 🔥 자동배정 기준 주차
        currentPeriodId, setCurrentPeriodId,

        // 🔥 캘린더 & 컨설팅
        weeklyCalendars, setWeeklyCalendars,
        studentConsultings, setStudentConsultings,

        serverVersion,
        getAllState, setAllState,
        saveWeeklyCalendarsOnly,
      }}
    >
      {children}
    </ScheduleContext.Provider>
  );
};

export const useSchedule = () => useContext(ScheduleContext);
