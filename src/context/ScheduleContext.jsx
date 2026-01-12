import React, { createContext, useContext, useState, useEffect } from "react";

export const ScheduleContext = createContext();

// ✅ 추가: 요일 상수 (정규화에 사용)
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

  const [mentorsByDay, setMentorsByDay] = useState(() => {
    try {
      const saved = localStorage.getItem("mentorsByDay");
      return saved ? JSON.parse(saved) : { 월: [], 화: [], 수: [], 목: [], 금: [], 토: [] };
    } catch {
      return { 월: [], 화: [], 수: [], 목: [], 금: [], 토: [] };
    }
  });

  const [plannerMessage, setPlannerMessage] = useState(() => localStorage.getItem("plannerMessage") || "");
  const [noticeMessage, setNoticeMessage] = useState(() => localStorage.getItem("noticeMessage") || "");
  const [monthlyNotice, setMonthlyNotice] = useState(() => localStorage.getItem("monthlyNotice") || "");

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

  // ✅ 추가: 시작일 & 종료일 (엑셀 다운로드용)
  const [startDate, setStartDate] = useState(() => localStorage.getItem("startDate") || "");
  const [endDate, setEndDate] = useState(() => localStorage.getItem("endDate") || "");

  // ✅ 학생 리스트 변경 시 기본 출결 정보 추가 (기존 출결 유지)
  useEffect(() => {
    setAttendance((prev) => {
      const updated = { ...prev };
      students.forEach((s) => {
        if (!updated[s.id]) {
          updated[s.id] = { 월: "", 화: "", 수: "", 목: "", 금: "", 토: "" };
        }
      });
      return updated;
    });
  }, [students]);

  // ====== ⬇⬇⬇ 추가: 엑셀 업로드 후 입력 잠김 방지(모양 정규화) ⬇⬇⬇ ======
  // 모든 출결 값을 항상 배열 형태([start, end]) 또는 []로 정규화
  function normalizeTimeValue(value) {
    // 허용 형태: [], ["HH:MM","HH:MM"], "HH:MM~HH:MM", "", undefined
    if (Array.isArray(value)) {
      const a = value.map((v) => (typeof v === "string" ? v.trim() : ""));
      // 길이를 2로 맞추되, 완전 공백이면 [] 유지
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
      // 단일 "HH:MM"만 온 경우 -> 시작만 채워진 상태로 보관
      return [s, ""];
    }
    return [];
  }

  function normalizeAttendanceShape(rawAttendance, list = students) {
    const next = { ...(rawAttendance || {}) };
    let changed = false;

    // 학생별 보정
    list.forEach((s) => {
      if (!next[s.id]) {
        next[s.id] = {};
        changed = true;
      }
      const per = next[s.id];
      days.forEach((d) => {
        const before = per[d];
        const after = normalizeTimeValue(before);
        const beforeStr = JSON.stringify(before === undefined ? null : before);
        const afterStr = JSON.stringify(after);
        if (beforeStr !== afterStr) {
          per[d] = after;
          changed = true;
        }
      });
    });

    // 존재하지만 학생 목록에 없는 잔여 키는 그대로 유지(삭제 X)
    return { normalized: next, changed };
  }

  // attendance/students 변동 시 한 번 더 정규화하여 입력 잠김 방지
  useEffect(() => {
    const { normalized, changed } = normalizeAttendanceShape(attendance, students);
    if (changed) setAttendance(normalized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, attendance]);
  // ====== ⬆⬆⬆ 추가 끝 ⬆⬆⬆ ======

  // 🔁 로컬스토리지 동기화
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
    localStorage.setItem("attendance", JSON.stringify(attendance));
  }, [attendance]);

  useEffect(() => {
    localStorage.setItem("mentorAssignments", JSON.stringify(assignments));
  }, [assignments]);

  useEffect(() => {
    localStorage.setItem("studentInterviewAssignments", JSON.stringify(studentInterviewAssignments));
  }, [studentInterviewAssignments]);

  // ✅ 추가: 날짜 정보 동기화
  useEffect(() => {
    localStorage.setItem("startDate", startDate);
  }, [startDate]);

  useEffect(() => {
    localStorage.setItem("endDate", endDate);
  }, [endDate]);

  // ✅ 전체 상태를 한 번에 반환하는 getter
  const getAllState = () => ({
    students,
    mentorsByDay,
    plannerMessage,
    noticeMessage,
    monthlyNotice,
    mentalCareSettings,
    scheduleByDay,
    attendance,
    assignments,
    studentInterviewAssignments,
    startDate,
    endDate
  });

  // ✅ 전체 상태를 한 번에 덮어쓰는 setter
  const setAllState = (data) => {
    if (data.students) setStudents(data.students);
    if (data.mentorsByDay) setMentorsByDay(data.mentorsByDay);
    if (typeof data.plannerMessage === "string") setPlannerMessage(data.plannerMessage);
    if (typeof data.noticeMessage === "string") setNoticeMessage(data.noticeMessage);
    if (typeof data.monthlyNotice === "string") setMonthlyNotice(data.monthlyNotice);
    if (data.mentalCareSettings) setMentalCareSettings(data.mentalCareSettings);
    if (data.scheduleByDay) setScheduleByDay(data.scheduleByDay);
    if (data.attendance) setAttendance(data.attendance);
    if (data.assignments) setAssignments(data.assignments);
    if (data.studentInterviewAssignments) {
      setStudentInterviewAssignments(prev => ({
        ...prev,
        ...data.studentInterviewAssignments
      }));
    }
    if (data.startDate) setStartDate(data.startDate);
    if (data.endDate) setEndDate(data.endDate);
  };

  // ====== ⬇⬇⬇ 추가: 엑셀 업로드용 안전 setter/병합기 ⬇⬇⬇ ======
  // 사용처: AttendancePage에서 엑셀 파싱 뒤 setAttendanceNormalized(...)로 넣으면 바로 정규화됨
  const setAttendanceNormalized = (nextOrUpdater) => {
    setAttendance((prev) => {
      const draft = typeof nextOrUpdater === "function" ? nextOrUpdater(prev) : nextOrUpdater;
      const { normalized } = normalizeAttendanceShape(draft, students);
      return normalized;
    });
  };

  // 사용처: AttendancePage에서 기존 데이터에 "병합"하고 싶을 때
  const mergeAttendanceFromExcel = (incoming) => {
    setAttendance((prev) => {
      const base = { ...prev };
      Object.entries(incoming || {}).forEach(([sid, perDay]) => {
        if (!base[sid]) base[sid] = {};
        days.forEach((d) => {
          if (perDay && perDay[d] !== undefined) {
            base[sid][d] = normalizeTimeValue(perDay[d]);
          }
        });
      });
      const { normalized } = normalizeAttendanceShape(base, students);
      return normalized;
    });
  };
  // ====== ⬆⬆⬆ 추가 끝 ⬆⬆⬆ ======

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
        attendance, setAttendance,
        assignments, setAssignments,
        studentInterviewAssignments, setStudentInterviewAssignments,
        startDate, setStartDate,
        endDate, setEndDate,
        getAllState, setAllState,
        // ✅ 추가로 공개: 정규화/병합 유틸
        setAttendanceNormalized,
        mergeAttendanceFromExcel,
      }}
    >
      {children}
    </ScheduleContext.Provider>
  );
};

export const useSchedule = () => useContext(ScheduleContext);
