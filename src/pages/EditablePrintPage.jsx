// src/pages/EditablePrintPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useSchedule } from "../context/ScheduleContext";
import { useNavigate, useSearchParams } from "react-router-dom";

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
  const { students = [] } = useSchedule();
  const navigate = useNavigate();
  const [sp] = useSearchParams();

  // 선택 학생
  const initialId = sp.get("id") || (students[0]?.id ?? "");
  const [studentId, setStudentId] = useState(String(initialId));

  // 편집 모드
  const [editing, setEditing] = useState(true);

  const student = useMemo(
    () => students.find((s) => String(s.id) === String(studentId)) || null,
    [studentId, students]
  );

  const [overrides, setOverrides] = useState(loadOverrides());
  const current = overrides[studentId] || {};

  const [plannerText, setPlannerText] = useState("");
  const [mentalCareText, setMentalCareText] = useState(current.mentalCare || "");
  const [mentorNameText, setMentorNameText] = useState(current.mentorOfWeek || "");
  const [vdDayText, setVdDayText] = useState(current.viceDirector?.day || "");
  const [vdTimeText, setVdTimeText] = useState(current.viceDirector?.time || "");

  // 학생 변경/초기 로드 시 자동 채움(오버라이드가 있으면 그걸 우선)
  useEffect(() => {
    if (!student) return;
    const ov = loadOverrides();
    const mine = ov[studentId] || {};
    const autoPlanner = buildPlannerSummaryFromLocalStorage(student.name);
    setPlannerText(mine.planner ?? autoPlanner ?? "");
    setMentalCareText(mine.mentalCare ?? "");
    setMentorNameText(mine.mentorOfWeek ?? "");
    setVdDayText(mine.viceDirector?.day ?? "");
    setVdTimeText(mine.viceDirector?.time ?? "");
    setOverrides(ov);
  }, [studentId, student]);

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
    // 인쇄 페이지(루트)로 돌아가기
    navigate("/");
  };

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">인쇄용 편집 페이지</h1>
        <div className="flex gap-2">
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
      <div className="space-y-4 print:space-y-2">
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
              <input
                value={mentorNameText}
                onChange={(e) => setMentorNameText(e.target.value)}
                className="w-full border rounded px-2 py-2"
                placeholder="예: 홍길동"
              />
            ) : (
              <div>{mentorNameText || "N/A"}</div>
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
          .border { border-width: 0 !important; }
          .bg-gray-100 { background: transparent !important; }
          .px-3, .py-2, .p-3 { padding: 0 !important; }
          .mb-4 { margin: 0 !important; }
          .space-y-4 > * + * { margin-top: 6px !important; }
        }
      `}</style>
    </div>
  );
}
