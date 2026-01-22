// src/pages/EditablePrintPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useSchedule } from "../context/ScheduleContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import WeeklySchedule from "../components/WeeklySchedule";

function getWeeklyMentorInfo({ student, currentPeriodId }) {
  if (!student) return { mentor: "", day: "" };

  // 1️⃣ 신입생 → 선택 멘토
  if (student.isNewStudent) {
    return {
      mentor: student.selectedMentor || "",
      day: student.selectedMentorDay || "",
    };
  }

  // 2️⃣ 재학생 → 이번주 확정 멘토 (강제 포함)
  if (student.weeklyMentorConfirmed) {
    return {
      mentor: student.weeklyMentorConfirmed.mentor || "",
      day: student.weeklyMentorConfirmed.day || "",
    };
  }

  // 🔥🔥🔥 추가: 재학생 멘토 히스토리 (강제배정 포함)
  const history = student.mentorHistory?.[currentPeriodId];
  if (history) {
    return {
      mentor: history.mentor || "",
      day: history.day || "",
    };
  }

  return { mentor: "", day: "" };
}


const DAYS = ["월", "화", "수", "목", "금", "토"];
const OV_KEY = "printOverrides";

function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(OV_KEY)) || {}; }
  catch { return {}; }
}
function saveOverrides(next) {
  localStorage.setItem(OV_KEY, JSON.stringify(next));
  // 인쇄페이지에게 즉시 반영하도록 알림 (같은 탭에서도 수신 가능하게 커스텀 이벤트 사용)
  window.dispatchEvent(new Event("print-overrides-updated"));
}

function confirmAndCreateNewPeriod({
  startDate,
  endDate,
  periods,
  setPeriods,
  setSelectedPeriod,
}) {
  if (!startDate || !endDate) {
    alert("시작일과 종료일을 먼저 입력하세요.");
    return;
  }

  const newId = `${startDate}~${endDate}`;

  // 이미 존재하면 그냥 선택만
  if (periods.some(p => p.id === newId)) {
    setSelectedPeriod(newId);
    return;
  }

  const ok = window.confirm(
    `새로운 기간 (${startDate} ~ ${endDate})을 시작하시겠습니까?`
  );

  if (!ok) return;

  setPeriods(prev => [
    ...prev,
    {
      id: newId,
      start: startDate,
      end: endDate,
      createdAt: Date.now(),
    },
  ]);

  setSelectedPeriod(newId);
}

function confirmAndFixPeriod({
  startDate,
  endDate,
  periods,
  setPeriods,
  setSelectedPeriod,
  setCurrentPeriodId,
}) {
  if (!startDate || !endDate) {
    alert("시작일과 종료일을 입력하세요.");
    return;
  }

  const periodId = `${startDate}~${endDate}`;

  const ok = window.confirm(
    `이 기간 (${startDate} ~ ${endDate})을\n자동배정 기준 주로 등록하시겠습니까?`
  );
  if (!ok) return;

  // 🔹 periods에 없으면 추가
  if (!periods.some(p => p.id === periodId)) {
    setPeriods(prev => [
      ...prev,
      {
        id: periodId,
        start: startDate,
        end: endDate,
        createdAt: Date.now(),
      },
    ]);
  }

  // 🔥 핵심: 기준 주 확정
  setSelectedPeriod(periodId);
  setCurrentPeriodId(periodId);

  alert("기준 주가 확정되었습니다.");
}

function buildPlannerSummaryFromLocalStorage(studentName) {
  try {
    const sched = JSON.parse(localStorage.getItem("plannerSchedule")) || {};
    const lines = [];
    DAYS.forEach((d) => {
      const arr = (sched[d] || []).filter((x) => x.student === studentName);
      if (arr.length > 0) {
        const ts = arr.map((x) => `${x.start}~${x.end}`).join(", ");
        lines.push(`${d}: ${ts}`);
      }
    });
    return lines.join(" / ");
  } catch {
    return "";
  }
}

export default function EditablePrintPage() {
  const {
    students = [],
    startDate,
    endDate,
    periods,
    setPeriods,
    setSelectedPeriod,

    // 🔥 추가
    currentPeriodId,
    setCurrentPeriodId,

    // 🔥🔥🔥 이게 빠져 있었음 (핵심)
    mentorsByDay,
  } = useSchedule();

  const navigate = useNavigate();
  const [sp] = useSearchParams();

    // ✅ debug=1 이면 디버그 패널/로그 활성화
  const debugMode = sp.get("debug") === "1";

  // 안전 출력용
  const safeJson = (v) => {
    try { return JSON.stringify(v, null, 2); }
    catch { return String(v); }
  };


  // 선택 학생
  const initialId = sp.get("id") || (students[0]?.id ?? "");
  const [studentId, setStudentId] = useState(String(initialId));
  
  // 편집 모드
  const [editing, setEditing] = useState(true);

  const student = useMemo(
    () => students.find((s) => String(s.id) === String(studentId)) || null,
    [studentId, students]
  );

  useEffect(() => {
  if (student) {
    console.log("🧩 PRINT STUDENT RAW", student);
  }
}, [student]);

  useEffect(() => {
    if (!debugMode) return;
    if (!student) {
      console.log("[PRINT DEBUG] student is null", { studentId });
      return;
    }

    const confirmed = student.weeklyMentorConfirmed || null;
    const historyKeys = Object.keys(student.mentorHistory || {});
    const historyForPeriod = student.mentorHistory?.[currentPeriodId];

    console.log("[PRINT DEBUG] ===== snapshot =====");
    console.log("[PRINT DEBUG] studentId/name", studentId, student.name);
    console.log("[PRINT DEBUG] currentPeriodId", currentPeriodId);
    console.log("[PRINT DEBUG] weeklyMentorConfirmed", confirmed);
    console.log("[PRINT DEBUG] mentorHistory keys", historyKeys);
    console.log("[PRINT DEBUG] mentorHistory[currentPeriodId]", historyForPeriod);
    console.log("[PRINT DEBUG] day candidate",
      confirmed?.day,
      historyForPeriod?.day
    );
  }, [debugMode, studentId, student, currentPeriodId]);


  const [overrides, setOverrides] = useState(loadOverrides());
  const current = overrides[studentId] || {};

  const [plannerText, setPlannerText] = useState("");
  const [mentalCareText, setMentalCareText] = useState(current.mentalCare || "");
  const [mentorNameText, setMentorNameText] = useState("");
  const [vdDayText, setVdDayText] = useState(current.viceDirector?.day || "");
  const [vdTimeText, setVdTimeText] = useState(current.viceDirector?.time || "");

  // 학생 변경/초기 로드 시 자동 채움(오버라이드가 있으면 그걸 우선)
  useEffect(() => {
    if (!student) return;

    const ov = loadOverrides();
    const mine = ov[studentId] || {};
    const autoPlanner = buildPlannerSummaryFromLocalStorage(student.name);
    useEffect(() => {
      if (!student || !mentorNameText) return;

      console.group("🧪 MENTOR DAY DEBUG");
      console.log("학생:", student.name, "(ID:", student.id, ")");
      console.log("mentorNameText:", mentorNameText);
      console.log("mentorsByDay 전체:", mentorsByDay);

      Object.entries(mentorsByDay || {}).forEach(([day, list]) => {
        console.log(
          `요일 ${day}:`,
          list.map(m => m.name)
        );
      });

      console.groupEnd();
    }, [studentId, mentorNameText, mentorsByDay]);


    // 🔥 이번 주 기준 멘토/요일을 "항상 최신 student 상태"로 계산
    const weeklyMentorInfo = (() => {
    // 🔧 멘토 이름 → 출근 요일 계산 헬퍼
    const getWorkingDays = (mentorName) => {
      if (!mentorName) return [];
      return Object.entries(mentorsByDay || {})
        .filter(([_, list]) =>
          list.some(m => m.name === mentorName)
        )
        .map(([day]) => day);
    };

    // 1️⃣ override 최우선
    if (mine.mentorOfWeek) {
      const days = getWorkingDays(mine.mentorOfWeek);
      return {
        mentor: mine.mentorOfWeek,
        day: days.join("/"),
      };
    }

    // 2️⃣ 이번주 확정 멘토
    if (student.weeklyMentorConfirmed?.mentor) {
      const days = getWorkingDays(student.weeklyMentorConfirmed.mentor);
      return {
        mentor: student.weeklyMentorConfirmed.mentor,
        day: days.join("/"),
      };
    }

    // 3️⃣ 재학생 히스토리
    const history = student.mentorHistory?.[currentPeriodId];
    if (history?.mentor) {
      const days = getWorkingDays(history.mentor);
      return {
        mentor: history.mentor,
        day: days.join("/"),
      };
    }

    return { mentor: "", day: "" };
  })();


    setPlannerText(mine.planner ?? autoPlanner ?? "");
    setMentalCareText(mine.mentalCare ?? "");

    // ✅ 수동 변경된 멘토 / 요일 즉시 반영
    setMentorNameText(weeklyMentorInfo.mentor ?? "");
    setVdDayText(weeklyMentorInfo.day ?? "");

    setVdTimeText(mine.viceDirector?.time ?? "");
    setOverrides(ov);
  }, [studentId, student, currentPeriodId, mentorsByDay]);



  const onSave = () => {
    const next = loadOverrides();
    next[studentId] = {
      planner: plannerText,
      mentalCare: mentalCareText,
      mentorOfWeek: mentorNameText,
      viceDirector: { day: vdDayText, time: vdTimeText },
    };
    saveOverrides(next);
    setOverrides(next);

    alert("저장 완료 (인쇄페이지에 즉시 반영됩니다)");
  };

  const onPrint = () => {
    const wasEditing = editing;
    setEditing(false);
    setTimeout(() => {
      window.print();
      setTimeout(() => setEditing(wasEditing), 100);
    }, 50);
  };

  const goBack = () => {
    navigate("/");
  };

  // 🔥🔥🔥 현재 주차 데이터 전체 삭제
  const deleteCurrentPeriodData = () => {
    const periodId = currentPeriodId;

    if (!periodId) {
      alert("삭제할 주차가 선택되지 않았습니다.");
      return;
    }

    const ok = window.confirm(
      `⚠️ ${periodId} 주차의 모든 데이터가 삭제됩니다.\n\n정말 삭제하시겠습니까?`
    );
    if (!ok) return;

    // 1️⃣ periods 목록에서 제거
    setPeriods(prev => prev.filter(p => p.id !== periodId));

    // 2️⃣ 선택 주차 초기화
    setSelectedPeriod("");
    setCurrentPeriodId("");

    alert(`${periodId} 주차 데이터가 삭제되었습니다.`);
  };


  return (
    <div className="p-4 max-w-5xl mx-auto">
      <section className="mb-6 print-calendar">
        <WeeklySchedule
          mode="print"
          selectedStudentId={studentId}
        />
      </section>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">인쇄용 편집 페이지</h1>
        <div className="flex gap-2">
          <button
            className="px-3 py-2 rounded bg-orange-500 text-white"
            onClick={() =>
              confirmAndCreateNewPeriod({
                startDate,
                endDate,
                periods,
                setPeriods,
                setSelectedPeriod,
              })
            }
          >
            날짜 변경하기
          </button>

          {/* 🔥 신규 버튼 */}
          <button
            className="px-3 py-2 rounded bg-red-600 text-white"
            onClick={() =>
              confirmAndFixPeriod({
                startDate,
                endDate,
                periods,
                setPeriods,
                setSelectedPeriod,
                setCurrentPeriodId,
              })
            }
          >
            날짜 변경 확정
          </button>

          <button
            className="px-3 py-2 rounded bg-red-800 text-white"
            onClick={deleteCurrentPeriodData}
          >
            주차 데이터 삭제
          </button>

          <button
            className="px-3 py-2 rounded bg-gray-200"
            onClick={goBack}
          >
            ← 돌아가기
          </button>
          <button
            className="px-3 py-2 rounded bg-slate-700 text-white"
            onClick={() => setEditing((e) => !e)}
          >
            {editing ? "편집 잠금" : "편집 모드"}
          </button>
          <button
            className="px-3 py-2 rounded bg-emerald-600 text-white"
            onClick={onSave}
          >
            저장
          </button>
          <button
            className="px-3 py-2 rounded bg-indigo-600 text-white"
            onClick={onPrint}
          >
            인쇄
          </button>
        </div>
      </div>

      {/* 학생 선택 */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm text-slate-600">학생 선택</span>
        <select
          className="border rounded px-2 py-1"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
        >
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} (ID:{s.id})
            </option>
          ))}
        </select>
      </div>
      

      {/* 인쇄 카드 */}
      <div className="space-y-4 print:space-y-2 print-hide-border">
        
        {/* 플래너 체크 */}
        <section className="border rounded">
          <header className="bg-gray-100 px-3 py-2 font-semibold">플래너 체크</header>
          <div className="p-3">
            {editing ? (
              <textarea
                value={plannerText}
                onChange={(e) => setPlannerText(e.target.value)}
                className="w-full border rounded px-2 py-2 min-h-[60px]"
                placeholder="예: 월 12:40~12:50 / 수 12:50~13:00 / 금 16:40~16:50"
              />
            ) : (
              <div className="whitespace-pre-wrap">{plannerText || "-"}</div>
            )}
          </div>
        </section>

        {/* 멘탈 케어링 */}
        <section className="border rounded">
          <header className="bg-gray-100 px-3 py-2 font-semibold">멘탈 케어링</header>
          <div className="p-3">
            {editing ? (
              <textarea
                value={mentalCareText}
                onChange={(e) => setMentalCareText(e.target.value)}
                className="w-full border rounded px-2 py-2 min-h-[48px]"
                placeholder="예: 진행 요일/시간 또는 메모 입력"
              />
            ) : (
              <div className="whitespace-pre-wrap">{mentalCareText || "-"}</div>
            )}
          </div>
        </section>

        {/* 금주의 멘토 */}
        <section className="border rounded">
          <header className="bg-gray-100 px-3 py-2 font-semibold">금주의 멘토</header>
          <div className="p-3">
            {editing ? (
              <>
                <input
                  value={mentorNameText}
                  onChange={(e) => setMentorNameText(e.target.value)}
                  className="w-full border rounded px-2 py-2 mb-1"
                />
                <input
                  value={vdDayText}
                  onChange={(e) => setVdDayText(e.target.value)}
                  className="w-full border rounded px-2 py-2"
                />
              </>
            ) : (
              <>
                <div className="font-semibold">
                  {mentorNameText || "N/A"}
                </div>
                <div className="text-sm text-gray-600">
                  {
                    student?.weeklyMentorConfirmed?.day
                      || student?.mentorHistory?.[currentPeriodId]?.day
                      || "-"
                  }
                </div>
              </>
            )}
          </div>
        </section>



        {/* 부원장 인터뷰 */}
        <section className="border rounded">
          <header className="bg-gray-100 px-3 py-2 font-semibold">부원장 인터뷰</header>
          <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="text-sm text-slate-600 mb-1">인터뷰 요일</div>
              {editing ? (
                <input
                  value={vdDayText}
                  onChange={(e) => setVdDayText(e.target.value)}
                  className="w-full border rounded px-2 py-2"
                  placeholder="예: 금"
                />
              ) : (
                <div>{vdDayText || "-"}</div>
              )}
            </div>
            <div className="sm:col-span-2">
              <div className="text-sm text-slate-600 mb-1">인터뷰 시간</div>
              {editing ? (
                <input
                  value={vdTimeText}
                  onChange={(e) => setVdTimeText(e.target.value)}
                  className="w-full border rounded px-2 py-2"
                  placeholder="예: 15:00~15:10"
                />
              ) : (
                <div>{vdTimeText || "-"}</div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* 프린트 모드에서 편집/컨트롤 숨기기 */}
      <style>{`
        @media print {
          button, select { display: none !important; }

          .print-hide-border .border { border-width: 0 !important; }
          .print-hide-border .bg-gray-100 { background: transparent !important; }

          .px-3, .py-2, .p-3 { padding: 0 !important; }
          .mb-4 { margin: 0 !important; }
          .space-y-4 > * + * { margin-top: 6px !important; }
        }
      `}</style>
    </div>
  );
}
