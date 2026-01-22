// src/pages/CurrentStudentMentorPage.jsx
import React, { useEffect } from "react";
import { useSchedule } from "../context/ScheduleContext";
import { weeklyMentorAssigner } from "../utils/weeklyMentorAssigner";

const days = ["월", "화", "수", "목", "금", "토"];

// 🔥 멘토 이름 → 출근 요일 목록 계산
const getMentorWorkingDays = (mentorName, mentorsByDay) => {
  if (!mentorName) return [];

  return Object.entries(mentorsByDay || {})
    .filter(([_, list]) =>
      list.some(m => m.name === mentorName)
    )
    .map(([day]) => day);
};


// ================================
// 🔥 주간 이벤트 수집 (멘토링 + 플래너)
// ================================
const getWeeklyEventsForStudent = (student, selectedPeriod, plannerScheduleByDay, mentorsByDay) => {
  const events = [];

  // 1️⃣ 멘토링 이벤트
  // 1️⃣ 멘토링 이벤트 (멘토 출근 요일 기준으로 생성)
  const mentorName =
    student.weeklyMentorDraft?.mentor ||
    student.mentorHistory?.[selectedPeriod]?.mentor ||
    null;

  if (mentorName) {
    const workingDays = getMentorWorkingDays(mentorName, mentorsByDay);

    workingDays.forEach(d => {
      events.push({
        type: "mentoring",
        day: d,
      });
    });
  }


  // 2️⃣ 플래너 체크 이벤트
  days.forEach(day => {
    const slots = plannerScheduleByDay?.[day] || [];
    const hasPlanner = slots.some(s => s.studentId === student.id);

    if (hasPlanner) {
      events.push({
        type: "planner",
        day,
      });
    }
  });

  return events;
};

export default function CurrentStudentMentorPage() {
  const {
    students,
    setStudents,
    selectedPeriod,
    attendance,
    mentorsByDay,
    periods,
    plannerScheduleByDay,   // 🔥 추가
  } = useSchedule();

  // ✅ 멘토 수동 수정 중인 학생
  const [editingStudentId, setEditingStudentId] = React.useState(null);

  // ✅ [추가] 멘토정보란에 등록된 전체 멘토 이름 목록
  const allMentorNames = React.useMemo(() => {
    return Array.from(
      new Set(
        Object.values(mentorsByDay || {})
          .flat()
          .map(m => m.name)
          .filter(Boolean)
      )
    );
  }, [mentorsByDay]);
  
  // ✅ createdAt 기준 단일 정렬 (전 페이지 공통 기준)
  const safePeriods = React.useMemo(() => {
    return Array.isArray(periods)
      ? [...periods]
          .filter(p => p && p.id)
          .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
      : [];
  }, [periods]);

  // ================================
  // ✅ 최신 멘토 계산 (직전 주 기준)
  // ⚠️ runWeeklyAutoAssign보다 반드시 위
  // ================================
  const getLatestMentor = (student) => {
  if (!selectedPeriod) return null;

  const history = student.mentorHistory || {};
  const idx = safePeriods.findIndex(p => p.id === selectedPeriod);
  if (idx === -1) return null;

  // 🔥 핵심: 직전 1주가 아니라 "가장 최근 유효 멘토"를 역방향 탐색
  for (let i = idx - 1; i >= 0; i--) {
    const pid = safePeriods[i].id;
    const record = history[pid];

    if (record?.mentor) {
      return {
        mentor: record.mentor,
        day: record.day ?? null, // day 없어도 OK
        periodId: pid,
      };
    }
  }

  return null;
};


  // ✅ 최초 멘토 계산 (단일 버전)
  const getInitialMentor = (student) => {
    // 0순위: initialMentor가 있으면 그걸 사용
    if (
      student?.initialMentor?.mentor &&
      student.initialMentor.mentor.trim() !== ""
    ) {
      return {
        mentor: student.initialMentor.mentor,
        day: student.initialMentor.day?.trim() || null,
        periodId: student.initialMentor.periodId || "initial",
      };
    }


    // 1순위: mentorHistory 중 가장 오래된 기록
    const history = student?.mentorHistory || {};
    const periodIds = safePeriods.length
      ? safePeriods.map(p => p.id)
      : Object.keys(history || {});

    const firstPid = periodIds.find(pid => history[pid]?.mentor && history[pid]?.day);


    return firstPid ? { ...history[firstPid], periodId: firstPid } : null;
  };


  // ================================
  // ✅ 배정 기준에 따른 base 멘토 결정 (단일 진실 소스)
  // ================================
  const resolveBaseMentorByAssignBase = (student) => {
    const base = student.assignBase ?? "latest";

    if (base === "initial") {
      return getInitialMentor(student);
    }

    // default: latest
    return getLatestMentor(student) || getInitialMentor(student);
  };


  // ✅ 누적 기록용 period 목록은 "공식 periods 전체"
  const orderedPeriods = safePeriods.map(p => p.id);

  
    // ✅ period 유틸 (prev / next 계산용)  ← 바로 여기!
  const getPeriodIndex = (pid) =>
    safePeriods.findIndex(p => p.id === pid);

  const getPrevPeriodId = (pid) => {
    const idx = getPeriodIndex(pid);
    return idx > 0 ? safePeriods[idx - 1].id : null;
  };

  const getNextPeriodId = (pid) => {
    const idx = getPeriodIndex(pid);
    return idx >= 0 && idx < safePeriods.length - 1
      ? safePeriods[idx + 1].id
      : null;
  };

  // ================================
  // 🔥 학생 1명만 자동배정
  // ================================
  const runWeeklyAutoAssignOne = (studentId) => {
    console.log("🔥 AUTO ASSIGN CLICKED", selectedPeriod);
    if (!selectedPeriod) {
      alert("주차가 선택되지 않았습니다.");
      return;
    }

    setStudents(prev =>
      prev.map(s => {
        if (s.id !== studentId) return s;

        const baseRecord = resolveBaseMentorByAssignBase(s) ?? {
          mentor: null,
          day: null,
        };

        const rawDraft = weeklyMentorAssigner({
          student: s,
          attendance: attendance[selectedPeriod]?.[s.id] || {},
          mentorsByDay,

          // 🔥 기준 멘토를 모든 키로 강제 주입
          prevRecord: baseRecord,
        });

        if (!rawDraft) {
          console.warn("❌ rawDraft null:", s.name);
          return s;
        }

        return {
          ...s,
          weeklyMentorDraft: {
            mentor: rawDraft.mentor,
            day: rawDraft.day,
            autoRank: rawDraft.autoRank,
            fromDay: rawDraft.fromDay,
            toDay: rawDraft.toDay,
            dayDiff: rawDraft.dayDiff,
          },
        };
      })
    );
  };



  // ================================
  // 🔥 이번주 멘토 자동배정 (전체)
  // ================================
  const runWeeklyAutoAssign = () => {
    if (!selectedPeriod) {
      alert("주차가 선택되지 않았습니다.");
      return;
    }

    setStudents(prev =>
      prev.map(s => {
        const baseRecord = resolveBaseMentorByAssignBase(s);

        // 🔍 [디버그] 자동배정 기준 확인
        console.log(
          "[AUTO ASSIGN]",
          s.name,
          "assignBase =", s.assignBase,
          "initial =", getInitialMentor(s)?.mentor,
          "latest =", getLatestMentor(s)?.mentor,
          "baseRecord =", baseRecord
        );

        if (!baseRecord?.mentor) {
          return {
            ...s,
            assignBase: s.assignBase,
            weeklyMentorDraft: {
              mentor: null,
              day: null,
              autoRank: null,
              fromDay: null,
              toDay: null,
              dayDiff: null,
            },
          };
        }

        const rawDraft = weeklyMentorAssigner({
          student: s,
          attendance: attendance[selectedPeriod]?.[s.id] || {},
          mentorsByDay,

          // 🔥 기준 멘토를 모든 키로 강제 주입
          prevRecord: baseRecord,
        });


        if (!rawDraft) return s;

        // ✅ 자동배정 결과 그대로 사용
        const pickedMentor = rawDraft.mentor ?? null;
        const pickedDay = rawDraft.day ?? null;

        if (!pickedMentor) return s;

        return {
          ...s,
          assignBase: s.assignBase ?? "latest",
          weeklyMentorDraft: {
            mentor: pickedMentor,
            day: pickedDay,
            autoRank: rawDraft.autoRank,
            fromDay: rawDraft.fromDay,
            toDay: rawDraft.toDay,
            dayDiff: rawDraft.dayDiff,
            source: "auto",
          },
        };
      })
    );
  };



  // ================================
  // 🔒 이번주 멘토 확정
  // ================================
  const confirmWeeklyMentors = () => {
    if (!selectedPeriod) {
      alert("주차가 선택되지 않았습니다.");
      return;
    }

    setStudents(prev =>
      prev.map(s => {
        if (!s.weeklyMentorDraft?.mentor) return s;

        const draft = s.weeklyMentorDraft;

        const fixedDay =
          draft.day ??
          getMentorWorkingDays(draft.mentor, mentorsByDay)[0] ??
          null;

        return {
          ...s,

          // 최초 멘토는 딱 한 번만 생성
          initialMentor: s.initialMentor?.mentor
            ? s.initialMentor
            : {
                mentor: draft.mentor,
                day: fixedDay,
                periodId: selectedPeriod,
              },

          mentorHistory: {
            ...(s.mentorHistory || {}),
            [selectedPeriod]: {
              mentor: draft.mentor,

              // ✅ 핵심 수정: 멘토 출근 요일에서 day를 계산해서 저장
              day:
                draft.day ??
                getMentorWorkingDays(draft.mentor, mentorsByDay)[0] ??
                null,

              attended: true,
              autoRank: draft.autoRank ?? 0,
              actualMentor:
                s.mentorHistory?.[selectedPeriod]?.actualMentor,
            },
          },
          weeklyMentorDraft: undefined, 
        };
      })
    );
  };


  // ================================
  // 🔥 플래너 누락 / 이월 토글 (STEP 6)
  // ================================
  const togglePlannerMissed = (studentId, day) => {
    if (!selectedPeriod) return;

    setStudents(prev =>
      prev.map(s => {
        if (s.id !== studentId) return s;

        const history = { ...(s.plannerHistory || {}) };
        const record = { ...(history[selectedPeriod] || {}) };

        record.day = day;
        record.attended = record.attended ?? true;

        if (record.attended === false && record.missedDay === day) {
          // ✅ 누락 해제 (정상 출석으로 복귀)
          record.attended = true;
          delete record.missedDay;
          record.missedCarryOver = false;

          // 🔥 핵심: 실제 진행 멘토 제거
          delete record.actualMentor;
        } else {
          // ✅ 누락 + 이월
          record.attended = false;
          record.missedDay = day;
          record.missedCarryOver = true;
        }

        history[selectedPeriod] = record;

        return {
          ...s,
          plannerHistory: history, // ⭐ 멘토링과 완전 분리
        };
      })
    );
  };

  // ================================
  // 🔥 멘토링 누락 / 이월 토글
  // ================================
  const toggleMentoringMissed = (studentId, day) => {
    if (!selectedPeriod) return;

    setStudents(prev =>
      prev.map(s => {
        if (s.id !== studentId) return s;

        const history = { ...(s.mentorHistory || {}) };

        // 🔥 핵심: draft라도 멘토링 기록을 강제로 만든다
        const baseMentor =
          history[selectedPeriod]?.mentor ||
          s.weeklyMentorDraft?.mentor ||
          null;

        const baseDay = day;

        if (!baseMentor) return s;

        const record = {
          ...(history[selectedPeriod] || {}),
          mentor: baseMentor,
          day: baseDay,
        };

        record.attended = record.attended ?? true;

        if (record.attended === false && record.missedDay === day) {
          // ✅ 누락 해제 (원상복구)
          record.attended = true;
          delete record.missedDay;
          record.missedCarryOver = false;
        } else {
          // ✅ 누락 + 이월
          record.attended = false;
          record.missedDay = day;
          record.missedCarryOver = true;
        }

        history[selectedPeriod] = record;

        return {
          ...s,
          mentorHistory: history,
        };
      })
    );
  };

  // ================================
  // 🔥 STEP 6-2-1: 이월 여부 판단 헬퍼
  // ================================
  const isMentoringCarriedOver = (student, periodId) => {
    const r = student.mentorHistory?.[periodId];
    return r?.missedCarryOver === true;
  };

  const isPlannerCarriedOver = (student, periodId) => {
    const r = student.plannerHistory?.[periodId];
    return r?.missedCarryOver === true;
  };


  // ================================
  // 🔥 STEP 3: 누락자 관리용 정렬 데이터 생성
  // ================================
  const getMissedSummaryForStudent = (student) => {
    const mentorRecord = student.mentorHistory?.[selectedPeriod];
    const plannerRecord = student.plannerHistory?.[selectedPeriod];

    const mentorMissed =
      mentorRecord?.attended === false || mentorRecord?.missedCarryOver === true;

    const plannerMissed =
      plannerRecord?.attended === false || plannerRecord?.missedCarryOver === true;

    return {
      mentorMissed,
      plannerMissed,
      bothMissed: mentorMissed && plannerMissed,
    };
  };

  const sortedStudentsForMissedTable = React.useMemo(() => {
    if (!selectedPeriod) return [];

    return [...students].sort((a, b) => {
      const A = getMissedSummaryForStudent(a);
      const B = getMissedSummaryForStudent(b);

      const score = (x) =>
        x.bothMissed ? 0 :
        x.mentorMissed ? 1 :
        x.plannerMissed ? 2 : 3;

      return score(A) - score(B);
    });
  }, [students, selectedPeriod]);

  // ================================
  // 🧠 STEP 6-1: 멘토 표시 우선순위 헬퍼
  // actualMentor > 확정 멘토 > draft > 미배정
  // ================================
  const getDisplayMentorName = (student) => {
    if (!selectedPeriod) return "미배정";

    const record = student.mentorHistory?.[selectedPeriod];

    // 1️⃣ 실제 진행 멘토 (최우선)
    if (record?.actualMentor) {
      return record.actualMentor;
    }

    // 🔥 2️⃣ draft를 확정 멘토보다 먼저 보여준다
    if (student.weeklyMentorDraft?.mentor) {
      return student.weeklyMentorDraft.mentor + " (자동)";
    }

    // 3️⃣ 이번주 확정 멘토
    if (record?.mentor) {
      return record.mentor;
    }

    return "미배정";
  };



  // ================================
  // 🔍 STEP 1: 누락 여부 판단 헬퍼
  // ================================
  const isMentoringMissed = (student) => {
    const r = student.mentorHistory?.[selectedPeriod];
    return r?.attended === false;
  };

  const isPlannerMissed = (student) => {
    const r = student.plannerHistory?.[selectedPeriod];
    return r?.attended === false;
  };

  // ================================
  // 🔍 STEP 1: 누락자 관리 정렬 리스트
  // ================================
  const sortedForMissedTable = React.useMemo(() => {
    if (!selectedPeriod) return [];

    return [...students].sort((a, b) => {
      const aM = isMentoringMissed(a);
      const aP = isPlannerMissed(a);
      const bM = isMentoringMissed(b);
      const bP = isPlannerMissed(b);

      const score = (m, p) => {
        if (m && p) return 0;
        if (m) return 1;
        if (p) return 2;
        return 3;
      };

      return score(aM, aP) - score(bM, bP);
    });
  }, [students, selectedPeriod]);


  // ================================
  // 🔽 화면 렌더링
  // ================================
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">
        재학생 멘토 배정 페이지
        {selectedPeriod && (
          <span className="ml-3 text-blue-600 text-lg">
            ({selectedPeriod} 기준)
          </span>
        )}
      </h1>
      
      <div className="flex gap-4 mb-6">
        <button
          onClick={runWeeklyAutoAssign}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          이번주 멘토 자동배정
        </button>

        <button
          onClick={confirmWeeklyMentors}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          이번주 멘토 확정
        </button>
      </div>
      <table className="w-full border-collapse border text-center mb-8">
        <thead>
          <tr className="bg-gray-100">
            <th>학생</th>
            <th>최초 멘토</th>
            <th>최근 멘토</th>
            <th>멘토링 배정 기준</th>
            <th>진행 예정 요일</th>
            <th>이번주 확정 멘토</th>

            <th>
              실제 진행 멘토
              <div className="text-xs text-gray-500 mt-1">
                학습 멘토링이 누락된 경우<br />
                임시로 그 주만 배정된 멘토입니다
              </div>
            </th>

            <th>개별 자동배정</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => {
            const initialRecord = getInitialMentor(s);
            const latestRecord = getLatestMentor(s);

            // ✅ 진행 예정 요일은 "실제 기준 멘토" 기준으로 계산
            const mentorRecord = s.mentorHistory?.[selectedPeriod];

            const scheduledDays = (() => {
              // 1️⃣ 실제 진행 멘토가 있으면 그 멘토 기준
              const mentorName =
                mentorRecord?.actualMentor ||
                mentorRecord?.mentor ||
                s.weeklyMentorDraft?.mentor;

              if (!mentorName) return [];

              // 2️⃣ mentorsByDay에서 해당 멘토가 출근하는 요일 전부 찾기
              return Object.entries(mentorsByDay || {})
                .filter(([_, list]) =>
                  list.some(m => m.name === mentorName)
                )
                .map(([day]) => day);
            })();


           const periodIdx = safePeriods.findIndex(p => p.id === selectedPeriod);
            const prevPeriodId =
              periodIdx > 0 ? safePeriods[periodIdx - 1].id : null;
            const current = selectedPeriod
              ? s.mentorHistory?.[selectedPeriod]
              : null;

            // 🔹 지난주 period 계산
            let prevRecord = null;
            if (selectedPeriod && s.mentorHistory) {
              const periodIdx = safePeriods.findIndex(p => p.id === selectedPeriod);
              const prevPeriodId =
                periodIdx > 0 ? safePeriods[periodIdx - 1].id : null;

              prevRecord = prevPeriodId
                ? s.mentorHistory?.[prevPeriodId]
                : null;
            }

            return (
              <tr
                key={s.id}
                className={
                  s.mentorHistory?.[selectedPeriod]?.attended === false
                    ? "bg-red-50"
                    : ""
                }
              >

                {/* 학생 */}
                <td className="border px-2 py-2 font-medium">
                  {s.name}
                </td>

                {/* ✅ 최초 멘토 */}
                <td className="border px-2 py-2 text-sm text-gray-700">
                  {initialRecord ? (
                    <>
                      <div className="font-semibold">{initialRecord.mentor}</div>
                      {initialRecord.day && (
                        <div className="text-xs text-gray-500">({initialRecord.day})</div>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>

                {/* 최근 멘토 */}
                <td className="border px-2 py-2 text-sm text-gray-700">
                  {latestRecord ? (
                    <>
                      <div className="font-semibold">
                        {latestRecord.mentor}
                      </div>
                      {latestRecord.day && (
                        <div className="text-xs text-gray-500">
                          ({latestRecord.day})
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>


                {/* 🔥 배정 기준 */}
                <td className="border px-2 py-2">
                  <select
                    className="border px-1 py-1 text-sm w-full"
                    value={s.assignBase ?? "latest"}
                    onChange={(e) => {
                      const value = e.target.value;

                      setStudents(prev =>
                        prev.map(st => {
                          if (st.id !== s.id) return st;

                          // 🔥 기준 바꾸면 기존 자동 결과 제거
                          return {
                            ...st,
                            assignBase: value || undefined,
                            weeklyMentorDraft: undefined, // 🔥 기준 바꾸면 자동결과 제거
                          };
                        })
                      );
                    }}

                  >
                    <option value="">선택</option>
                    <option value="initial">최초 멘토 기준</option>
                    <option
                      value="latest"
                      disabled={!getLatestMentor(s)?.mentor}
                    >
                      최근 멘토 기준
                    </option>
                  </select>
                </td>

                {/* 🆕 멘토링 진행 예정 요일 */}
                <td className="border px-2 py-2 text-sm">
                  {(() => {
                    // 1️⃣ 이번주 기준 멘토 결정
                    const mentorName =
                      s.weeklyMentorDraft?.mentor ??
                      s.mentorHistory?.[selectedPeriod]?.mentor ??
                      null;

                    // 2️⃣ 멘토 출근 요일 계산
                    const workingDays = getMentorWorkingDays(
                      mentorName,
                      mentorsByDay
                    );

                    return workingDays.length > 0 ? (
                      <span className="font-semibold">
                        ({workingDays.join("/")})
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    );
                  })()}
                </td>


                {/* 이번주 확정 멘토 */}
                <td
                  className={`border px-2 py-2
                    ${
                      s.mentorHistory?.[selectedPeriod]?.missedCarryOver
                        ? "bg-red-200 font-bold"
                        : s.mentorHistory?.[selectedPeriod]?.attended === false
                        ? "bg-red-100"
                        : ""
                    }
                  `}
                >
                  {editingStudentId === s.id ? (
                    <select
                      className="border px-1 py-1 text-sm w-full"
                      value={s.weeklyMentorDraft?.mentor || ""}
                      onChange={(e) => {
                        const mentor = e.target.value;

                        setStudents(prev =>
                          prev.map(st => {
                            if (st.id !== s.id) return st;

                            return {
                              ...st,
                              weeklyMentorDraft: mentor
                                ? {
                                    mentor,
                                    // 🔥 day는 저장하지 않는다
                                    // 진행 예정 요일은 mentorsByDay 기준으로 화면에서 계산
                                    day: null,
                                    autoRank: 0,
                                    source: "manual",
                                  }
                                : null,
                            };
                          })
                        );
                        setEditingStudentId(null);
                      }}
                    >
                      <option value="">-- 멘토 선택 --</option>
                      {allMentorNames.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>

                  ) : (
                    <span
                      className="cursor-pointer hover:bg-yellow-50 inline-block w-full"
                      onClick={() => setEditingStudentId(s.id)}
                    >
                      {getDisplayMentorName(s)}
                    </span>
                  )}
                </td>


                {/* 실제 진행 멘토 */}
                <td className="border px-2 py-2">
                  {s.mentorHistory?.[selectedPeriod]?.attended === false ? (
                    <select
                      className="border px-1 py-1 text-sm w-full"
                      value={s.mentorHistory?.[selectedPeriod]?.actualMentor || ""}
                      onChange={(e) => {
                        const value = e.target.value;

                        setStudents(prev =>
                          prev.map(st => {
                            if (st.id !== s.id) return st;

                            const prevRecord = st.mentorHistory?.[selectedPeriod] || {};

                            return {
                              ...st,
                              mentorHistory: {
                                ...(st.mentorHistory || {}),
                                [selectedPeriod]: {
                                  ...(st.mentorHistory?.[selectedPeriod] || {}),

                                  // ❗ 확정 멘토는 건드리지 않는다
                                  mentor: st.mentorHistory?.[selectedPeriod]?.mentor,

                                  // ✅ 실제 진행 멘토만 별도 저장
                                  actualMentor: value,

                                  attended: true,
                                  missedCarryOver: false,
                                  missedDay: undefined,
                                },
                              },
                            };
                          })
                        );
                      }}
                    >
                      <option value="">선택</option>
                      {allMentorNames.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>

                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>

                {/* 개별 자동배정 */}
                <td className="border px-2 py-2">
                  <button
                    className="px-2 py-1 bg-blue-500 text-white text-xs rounded"
                    onClick={() => runWeeklyAutoAssignOne(s.id)}
                  >
                    자동배정
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
            </table>

            {/* ================================
                🔥 여기에 붙이면 됨 (STEP 4)
                요일별 멘토링 누락 선택 그리드
            ================================ */}

            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-3">
                이번주 멘토링 누락 선택
              </h2>

              {!selectedPeriod && (
                <div className="text-gray-400">
                  주차가 선택되지 않았습니다.
                </div>
              )}

              {selectedPeriod && (
                <div className="overflow-x-auto">
                  <table className="border-collapse border w-full text-center">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border px-2 py-2">학생</th>
                        {days.map(day => (
                          <th key={day} className="border px-2 py-2">
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {students.map(s => {
                        const record = s.mentorHistory?.[selectedPeriod];

                        return (
                          <tr key={s.id}>
                            <td className="border px-2 py-2 font-medium">
                              {s.name}
                            </td>

                            {days.map(day => {
                              // 🔹 이번 요일의 이벤트 수집
                              const events = getWeeklyEventsForStudent(
                                s,
                                selectedPeriod,
                                plannerScheduleByDay,
                                mentorsByDay    // 🔥 반드시 추가
                              ).filter(e => e.day === day);

                              return (
                                <td key={day} className="border px-2 py-2 align-top">
                                  <div className="flex flex-col gap-1">
                                    {/* 🟦 멘토링 */}
                                    {events.some(e => e.type === "mentoring") && (() => {
                                      const mentorRecord = s.mentorHistory?.[selectedPeriod];

                                      const isMissed =
                                        mentorRecord?.attended === false &&
                                        mentorRecord?.missedDay === day;

                                      const isCarry =
                                        mentorRecord?.missedCarryOver === true &&
                                        mentorRecord?.missedDay === day;

                                      return (
                                        <div
                                          onClick={() => toggleMentoringMissed(s.id, day)}
                                          className={`cursor-pointer rounded px-1 py-0.5 text-sm font-semibold
                                            ${isCarry ? "bg-red-200" : ""}
                                            ${isMissed && !isCarry ? "bg-orange-200" : ""}
                                            ${!isMissed && !isCarry ? "bg-blue-100 hover:bg-blue-200" : ""}
                                          `}
                                        >
                                          {isCarry
                                            ? "멘토링(이월)"
                                            : isMissed
                                              ? "멘토링(누락)"
                                              : "멘토링"}
                                        </div>
                                      );
                                    })()}

                                    {/* 🟨 플래너 */}
                                    {events
                                      .filter(e => e.type === "planner")
                                      .map((_, idx) => {
                                        const plannerRecord = s.plannerHistory?.[selectedPeriod];

                                        const isMissed =
                                          plannerRecord?.attended === false &&
                                          plannerRecord?.missedDay === day;

                                        const isCarry =
                                          plannerRecord?.missedCarryOver === true &&
                                          plannerRecord?.missedDay === day;

                                        return (
                                          <div
                                            key={idx}
                                            onClick={() => togglePlannerMissed(s.id, day)}
                                            className={`cursor-pointer rounded px-1 py-0.5 text-sm
                                              ${isCarry ? "bg-red-200" : ""}
                                              ${isMissed && !isCarry ? "bg-orange-200" : ""}
                                              ${!isMissed && !isCarry ? "bg-yellow-100 hover:bg-yellow-200" : ""}
                                            `}
                                          >
                                            {isCarry
                                              ? "플래너(이월)"
                                              : isMissed
                                                ? "플래너(누락)"
                                                : "플래너"}
                                          </div>
                                        );
                                      })}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ================================
                🔥 STEP 3: 누락자 관리
            ================================ */}
            <div className="mb-12">
              <h2 className="text-xl font-semibold mb-3">
                누락자 관리
                {selectedPeriod && (
                  <span className="ml-2 text-sm text-gray-500">
                    ({selectedPeriod})
                  </span>
                )}
              </h2>

              {!selectedPeriod && (
                <div className="text-gray-400">주차를 선택하세요.</div>
              )}

              {selectedPeriod && (
                <div className="overflow-x-auto">
                  <table className="border-collapse border w-full text-center text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border px-2 py-2">학생</th>
                        <th className="border px-2 py-2">멘토링</th>
                        <th className="border px-2 py-2">플래너</th>
                        <th className="border px-2 py-2">담당 멘토</th>
                        <th className="border px-2 py-2">실제 진행 멘토</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedStudentsForMissedTable.map(s => {
                        const mentorRecord = s.mentorHistory?.[selectedPeriod];
                        const plannerRecord = s.plannerHistory?.[selectedPeriod];

                        const mentorMissed =
                          mentorRecord?.attended === false ||
                          mentorRecord?.missedCarryOver === true;

                        const plannerMissed =
                          plannerRecord?.attended === false ||
                          plannerRecord?.missedCarryOver === true;

                        const assignedMentor = getDisplayMentorName(s);

                        return (
                          <tr key={s.id}>
                            <td className="border px-2 py-2 font-medium">{s.name}</td>

                            <td
                              className={`border px-2 py-2 ${
                                mentorMissed ? "text-red-600 font-semibold" : ""
                              }`}
                            >
                              {mentorMissed
                                ? mentorRecord?.missedCarryOver
                                  ? "X (이월)"
                                  : "X"
                                : "O"}
                            </td>

                            <td
                              className={`border px-2 py-2 ${
                                plannerMissed ? "text-red-600 font-semibold" : ""
                              }`}
                            >
                              {plannerMissed
                                ? plannerRecord?.missedCarryOver
                                  ? "X (이월)"
                                  : "X"
                                : "O"}
                            </td>

                            <td className="border px-2 py-2">
                              {assignedMentor}
                            </td>

                            <td className="border px-2 py-2">
                              {mentorMissed ? (
                                <select
                                  className="border px-1 py-1 text-sm w-full"
                                  value={mentorRecord?.actualMentor || ""}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setStudents(prev =>
                                      prev.map(st => {
                                        if (st.id !== s.id) return st;
                                        return {
                                          ...st,
                                          mentorHistory: {
                                            ...(st.mentorHistory || {}),
                                            [selectedPeriod]: {
                                              ...(st.mentorHistory?.[selectedPeriod] || {}),
                                              actualMentor: value,
                                              attended: true,
                                              missedCarryOver: false,
                                              missedDay: undefined,
                                            },
                                          },
                                        };
                                      })
                                    );
                                  }}
                                >
                                  <option value="">선택</option>
                                  {allMentorNames.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>


            {/* 👆 여기까지가 STEP 4 */}

            {/* ================================
                🔥 STEP 6: 누적 멘토링 히스토리
            ================================ */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold mb-4">
                학생별 멘토링 누적 기록
              </h2>

              {/* 🔥 날짜별 누락 / 이월 요약 데이터 */}
              {selectedPeriod && (() => {
                const summary = {};

                orderedPeriods.forEach(pid => {
                  summary[pid] = [];

                  students.forEach(s => {
                    const record = s.mentorHistory?.[pid];
                    if (!record) return;

                    if (record.attended === false || record.missedCarryOver === true) {
                      summary[pid].push({
                        student: s.name,
                        mentor: record.mentor,
                        type: record.missedCarryOver ? "이월" : "누락",
                      });
                    }
                  });
                });

                return (
                  <div className="mb-6 space-y-3">
                    {orderedPeriods.map(pid => {
                      const list = summary[pid];
                      if (!list || list.length === 0) return null;

                      return (
                        <div key={pid} className="border rounded p-3 bg-gray-50">
                          <div className="font-semibold mb-1">
                            {pid} 누락 / 이월
                          </div>
                          {list.map((item, idx) => (
                            <div key={idx} className="text-sm">
                              - {item.student} : {item.mentor} ({item.type})
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {!selectedPeriod && (
                <div className="text-gray-400">
                  주차를 선택하면 누적 기록이 표시됩니다.
                </div>
              )}

              {selectedPeriod && (
                <div className="overflow-x-auto">
                  <table className="border-collapse border w-full text-center text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border px-2 py-2 sticky left-0 bg-gray-100 z-10">
                          학생
                        </th>

                        <th className="border px-2 py-2 bg-gray-100">
                          최초 멘토
                        </th>

                        {orderedPeriods.map(periodId => (
                          <th key={periodId} className="border px-3 py-2">
                            {periodId}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {students.map(s => {
                        const im = getInitialMentor(s); // ⭐ 여기 핵심

                        return (
                          <tr key={s.id}>
                            {/* 학생 */}
                            <td className="border px-2 py-2 font-medium sticky left-0 bg-white z-10">
                              {s.name}
                            </td>

                            {/* 최초 멘토 */}
                            <td className="border px-2 py-2 leading-tight">
                              {im ? (
                                <>
                                  <div className="font-semibold">{im.mentor}</div>
                                  {im.day && (
                                    <div className="text-xs text-gray-600">({im.day})</div>
                                  )}
                                </>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>

                            {/* 기간별 기록 */}
                            {orderedPeriods.map(periodId => {
                              const record = s.mentorHistory?.[periodId];

                              if (!record) {
                                return (
                                  <td key={periodId} className="border px-2 py-2 text-gray-300">
                                    -
                                  </td>
                                );
                              }

                              const isMissed = record.attended === false;
                              const isCarry = record.missedCarryOver === true;

                              return (
                                <td
                                  key={periodId}
                                  className={`border px-2 py-2 leading-tight
                                    ${isCarry ? "bg-red-100" : ""}
                                    ${isMissed ? "bg-orange-100" : ""}
                                  `}
                                >
                                  {/* 배정 멘토 */}
                                  <div className="font-semibold">{record.mentor}</div>

                                  {/* 요일 */}
                                  {(() => {
                                    const day =
                                      record.day ??
                                      getMentorWorkingDays(record.mentor, mentorsByDay)[0] ??
                                      null;

                                    return day ? (
                                      <div className="text-xs text-gray-600">({day})</div>
                                    ) : null;
                                  })()}

                                  {/* 자동배정 순위 */}
                                  {record.autoRank && (
                                    <div className="text-xs text-blue-600">
                                      {record.autoRank}순위
                                    </div>
                                  )}

                                  {/* 이월 / 누락 표시 */}
                                  {isCarry && (
                                    <div className="text-xs text-red-700 font-bold mt-1">
                                      ⤴ 이월
                                    </div>
                                  )}

                                  {isMissed && !isCarry && (
                                    <div className="text-xs text-orange-600 font-semibold">누락</div>
                                  )}

                                  {/* 🔥 실제 진행 멘토 표시 (STEP 4 핵심) */}
                                  {record.attended === false && record.actualMentor && (
                                    <div className="text-xs text-green-700 font-semibold mt-1">
                                      실제 진행: {record.actualMentor}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
}  