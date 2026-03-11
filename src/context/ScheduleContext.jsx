// src/context/ScheduleContext.jsx
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { getAppState, saveAppState, saveWeeklyCalendars } from "../api/client";

export const ScheduleContext = createContext();

const days = ["월", "화", "수", "목", "금", "토"];
const createEmptyDayArrayMap = () =>
  days.reduce((acc, day) => ({ ...acc, [day]: [] }), {});
const createEmptyDayObjectMap = () =>
  days.reduce((acc, day) => ({ ...acc, [day]: {} }), {});
const defaultDaySchedule = createEmptyDayArrayMap();

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

const isSameValue = (left, right) => {
  if (Object.is(left, right)) {
    return true;
  }

  if (typeof left !== typeof right) {
    return false;
  }

  if (left == null || right == null) {
    return false;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }
    for (let index = 0; index < left.length; index += 1) {
      if (!isSameValue(left[index], right[index])) {
        return false;
      }
    }
    return true;
  }

  if (
    typeof left === "object" &&
    typeof right === "object" &&
    !Array.isArray(left) &&
    !Array.isArray(right)
  ) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);

    if (leftKeys.length !== rightKeys.length) {
      return false;
    }

    for (const key of leftKeys) {
      if (!Object.prototype.hasOwnProperty.call(right, key)) {
        return false;
      }
      if (!isSameValue(left[key], right[key])) {
        return false;
      }
    }

    return true;
  }

  return false;
};

const getUnionKeys = (...states) => {
  const keys = new Set();

  states.forEach(state => {
    if (!state || typeof state !== "object") {
      return;
    }
    Object.keys(state).forEach(key => keys.add(key));
  });

  return [...keys];
};

const createRebasedState = ({ serverState, localState, baselineState }) => {
  const nextState = { ...(serverState ?? {}) };
  const dirtyKeys = [];

  for (const key of getUnionKeys(serverState, localState, baselineState)) {
    const localValue = localState?.[key];
    const baselineValue = baselineState?.[key];

    if (!isSameValue(localValue, baselineValue)) {
      nextState[key] = localValue;
      dirtyKeys.push(key);
    }
  }

  return { nextState, dirtyKeys };
};

export const ScheduleProvider = ({ children, authToken, onUnauthorized }) => {
  const hasHydratedRef = useRef(false);
  const saveTimeoutRef = useRef();
  const skipNextFullSaveRef = useRef(false);
  const pendingLocalSaveRef = useRef(false);
  const isSavingRef = useRef(false);
  const lastConflictAlertAtRef = useRef(0);
  const serverVersionRef = useRef();
  const lastSyncedStateRef = useRef(null);
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
  // ?뵦 STEP 1: students 援ъ“ ?먮룞 ?뺤옣 (Migration)
  // ================================
  useEffect(() => {
    setStudents(prev =>
      prev.map(s => ({
        ...s,

        // ???좎엯???뚮옒洹??듯빀 (??以?異붽?)
       isNewStudent: s.isNewStudent ?? s.isNewbie ?? false,
        
        // ?뵻 怨쇰ぉ ?좏깮 (?놁쑝硫?湲곕낯媛?
        subjects: s.subjects ?? {
          kor: false,
          math: false,
          sci1: false,
          sci2: false,
        },

        // ?뵻 ?깃꺽 / 異쒖깮?꾨룄
        personality: s.personality ?? "",
        birthYear: s.birthYear ?? "",

        // ?뵏 理쒖큹 諛곗젙 硫섑넗 (?좎엯??泥??뺤젙媛?諛뺤젣)
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


        // ?봽 二쇱감蹂?硫섑넗 ?덉뒪?좊━ (怨듭떇)
        // mentorHistory[periodId] = {
        //   mentorId: "hong-B", // ?뵦 mentorId 湲곗?
        //   day: "??,
        //   source: "newbie" | "auto",
        //   autoRank: 1,
        //   fromDay: "??,
        //   toDay: "??,
        //   dayDiff: -1,
        //   attended: true,        // ?ㅼ젣 吏꾪뻾 ?щ?
        //   missedCarryOver: false // ?댁썡 ?꾨씫 ?щ?
        // }
        mentorHistory: s.mentorHistory ?? {},

        // ?쭬 ?먮룞 諛곗젙 ?꾩떆 寃곌낵 (?ы븰???섏씠吏?먯꽌留??ъ슜, ?뺤젙 ????젣)
        weeklyMentorDraft: s.weeklyMentorDraft ?? undefined,
        weeklyMentorInfo: s.weeklyMentorInfo ?? undefined,
      }))
    );
    // ?좑툘 理쒖큹 1?뚮쭔 ?ㅽ뻾
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [mentorsByDay, setMentorsByDay] = useState(() => {
    try {
      const saved = localStorage.getItem("mentorsByDay");
      return saved
        ? JSON.parse(saved)
        : createEmptyDayArrayMap();
    } catch {
      return createEmptyDayArrayMap();
    }
  });
  const [clinicMentorsByDay, setClinicMentorsByDay] = useState(() => {
    try {
      const saved = localStorage.getItem("clinicMentorsByDay");
      return saved
        ? JSON.parse(saved)
        : createEmptyDayArrayMap();
    } catch {
      return createEmptyDayArrayMap();
    }
  });

  // ?뵦 [?좉퇋] ?뚮옒??泥댄겕 寃곌낵 (?쎄린 ?꾩슜 怨듭쑀??
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
    mentorTime: createEmptyDayObjectMap(),
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

  // ??二쇨컙 踰붿쐞
  const [startDate, setStartDate] = useState(
    () => localStorage.getItem("startDate") || ""
  );
  const [endDate, setEndDate] = useState(
    () => localStorage.getItem("endDate") || ""
  );

  // ?뵦 [?좉퇋] 怨듭떇 二쇱감 紐⑸줉
  const [periods, setPeriods] = useState(() => {
    try {
      const saved = localStorage.getItem("periods");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // ?뵦 [?좉퇋] ?꾩옱 ?좏깮??二쇱감
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    return localStorage.getItem("selectedPeriod") || "";
  });
  
  // ?뵦 [?좉퇋] ?먮룞諛곗젙 湲곗? 二쇱감 (?뺤젙??二?
  const [currentPeriodId, setCurrentPeriodId] = useState(() => {
    return localStorage.getItem("currentPeriodId") || "";
  });

  // ?뵦 selectedPeriod ??currentPeriodId ?숆린??(?듭떖)
  useEffect(() => {
    if (selectedPeriod && selectedPeriod !== currentPeriodId) {
      setCurrentPeriodId(selectedPeriod);
    }
  }, [selectedPeriod]);

  /* =================================================
     ?뵦 ?숈깮蹂?二쇨컙 罹섎┛??(?몃? ?낅줈?쒖슜)
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
     ?뵦 ?먯옣 而⑥꽕???곗씠??
  ================================================= */
  const [studentConsultings, setStudentConsultings] = useState(() => {
    try {
      const saved = localStorage.getItem("studentConsultings");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // ===== ?숈깮 異붽? ??異쒓껐 湲곕낯媛?(二쇱감 湲곗?) =====
  // ?뵦 異쒓껐? "?먮룞諛곗젙 湲곗? 二쇱감" 湲곗??쇰줈 ?앹꽦
  useEffect(() => {
    if (!currentPeriodId) return;

    setAttendance(prev => {
      const next = { ...prev };

      if (!next[currentPeriodId]) {
        next[currentPeriodId] = {};
      }

      students.forEach(s => {
        if (!next[currentPeriodId][s.id]) {
          next[currentPeriodId][s.id] = createEmptyDayArrayMap();
        }
      });

      return next;
    });
  }, [students, currentPeriodId]);

  // ===== 異쒓껐 ?뺢퇋??=====
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

  // ===== localStorage ?숆린??=====
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

  // ===== ?꾩껜 諛깆뾽 =====
  const getAllState = () => ({
    students,
    mentorsByDay,
    clinicMentorsByDay,
    plannerMessage,
    noticeMessage,
    monthlyNotice,
    mentalCareSettings,
    scheduleByDay,

    // ?뵦 ?뚮옒??泥댄겕 寃곌낵
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
      setMentorsByDay(data.mentorsByDay ?? createEmptyDayArrayMap());
    if ("clinicMentorsByDay" in data)
      setClinicMentorsByDay(data.clinicMentorsByDay ?? createEmptyDayArrayMap());
    if ("plannerMessage" in data) setPlannerMessage(data.plannerMessage ?? "");
    if ("noticeMessage" in data) setNoticeMessage(data.noticeMessage ?? "");
    if ("monthlyNotice" in data) setMonthlyNotice(data.monthlyNotice ?? "");
    if ("mentalCareSettings" in data)
      setMentalCareSettings(
        data.mentalCareSettings ?? {
          mentorTime: createEmptyDayObjectMap(),
          sessionDuration: 15,
        }
      );
    if ("scheduleByDay" in data)
      setScheduleByDay(data.scheduleByDay ?? createEmptyDayArrayMap());
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
    const nextState = snapshot.state ?? {};
    lastSyncedStateRef.current = nextState;
    skipNextFullSaveRef.current = true;
    setAllState(nextState);

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
      "다른 컴퓨터에서 먼저 수정된 내용이 있어 최신 데이터로 동기화했습니다. 방금 수정한 내용을 다시 확인해 주세요."
    );
  };

  const handleVersionConflict = async (
    error,
    localStateForRetry = getAllState()
  ) => {
    if (error?.status !== 409) {
      return false;
    }

    const serverState = error?.body?.state ?? {};
    const serverVersion = error?.body?.version;
    const baselineState = lastSyncedStateRef.current ?? {};
    const { nextState: rebasedState, dirtyKeys } = createRebasedState({
      serverState,
      localState: localStateForRetry ?? {},
      baselineState,
    });

    if (!dirtyKeys.length) {
      applyServerSnapshot({
        state: serverState,
        version: serverVersion,
      });
      pendingLocalSaveRef.current = false;
      return true;
    }

    if (!Number.isInteger(serverVersion)) {
      applyServerSnapshot({
        state: serverState,
        version: serverVersion,
      });
      pendingLocalSaveRef.current = false;
      notifyConflict();
      return true;
    }

    try {
      const retryResponse = await saveAppState(authToken, rebasedState, {
        baseVersion: serverVersion,
      });

      skipNextFullSaveRef.current = true;
      setAllState(rebasedState);
      lastSyncedStateRef.current = rebasedState;

      if (Number.isInteger(retryResponse?.version)) {
        serverVersionRef.current = retryResponse.version;
        setServerVersion(retryResponse.version);
      }
    } catch (retryError) {
      if (retryError?.status === 401 && onUnauthorized) {
        onUnauthorized();
        return true;
      }

      applyServerSnapshot({
        state: retryError?.body?.state ?? serverState,
        version: retryError?.body?.version ?? serverVersion,
      });
      notifyConflict();
    } finally {
      pendingLocalSaveRef.current = false;
    }

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
      lastSyncedStateRef.current = {
        ...(lastSyncedStateRef.current ?? {}),
        weeklyCalendars: nextWeeklyCalendars ?? {},
      };
      if (Number.isInteger(response?.version)) {
        serverVersionRef.current = response.version;
        setServerVersion(response.version);
      }
    } catch (error) {
      if (error?.status === 401 && onUnauthorized) {
        onUnauthorized();
      } else if (
        !(await handleVersionConflict(error, {
          ...getAllState(),
          weeklyCalendars: nextWeeklyCalendars ?? {},
        }))
      ) {
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
      lastSyncedStateRef.current = null;
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

    const handleForegroundSync = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      pollLatestState();
    };

    pollLatestState();
    const timer = setInterval(() => {
      pollLatestState();
    }, 5000);

    window.addEventListener("focus", handleForegroundSync);
    document.addEventListener("visibilitychange", handleForegroundSync);

    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener("focus", handleForegroundSync);
      document.removeEventListener("visibilitychange", handleForegroundSync);
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
      const localStateForSave = getAllState();

      (async () => {
        try {
          const response = await saveAppState(authToken, localStateForSave, {
            baseVersion: serverVersionRef.current,
          });
          lastSyncedStateRef.current = localStateForSave;

          if (Number.isInteger(response?.version)) {
            serverVersionRef.current = response.version;
            setServerVersion(response.version);
          }
        } catch (error) {
          if (error?.status === 401 && onUnauthorized) {
            onUnauthorized();
            return;
          }
          if (!(await handleVersionConflict(error, localStateForSave))) {
            console.error("Failed to save app state:", error);
          }
        } finally {
          isSavingRef.current = false;
          pendingLocalSaveRef.current = false;
        }
      })();
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
        // ?뵦 ?뚮옒??泥댄겕 寃곌낵 怨듭쑀??
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

        // ?뵦 ?먮룞諛곗젙 湲곗? 二쇱감
        currentPeriodId, setCurrentPeriodId,

        // ?뵦 罹섎┛??& 而⑥꽕??
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

