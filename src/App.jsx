// src/App.jsx
import React, { useState } from "react";
import { Routes, Route } from "react-router-dom";
import { ScheduleProvider } from "./context/ScheduleContext";

// 메인 페이지 컴포넌트들
import WeeklySchedule from "./components/WeeklySchedule";
import SettingsPage from "./components/SettingsPage";
import AttendancePage from "./pages/AttendancePage";
import MentalCarePage from "./pages/MentalCarePage";
import PlannerCheckPage from "./pages/PlannerCheckPage";
import MentorAssignmentPage from "./pages/MentorAssignmentPage";
import ViceDirectorPage from "./pages/ViceDirectorPage";
import CurrentStudentMentorPage from "./pages/CurrentStudentMentorPage";
import DirectorConsultingPage from "./pages/DirectorConsultingPage";

// 🔥 인쇄 편집 페이지 (주차 삭제 버튼 있는 페이지)
import EditablePrintPage from "./pages/EditablePrintPage";

/* =========================
   기존 버튼 기반 메인 화면
========================= */
function InnerApp() {
  const [plannerText, setPlannerText] = useState(
    "월,수,금: 이민섭M / 화, 목: 임현지M / 부원장님: 김영편입 교수"
  );
  const [notices, setNotices] = useState([
    "노 말마기 대여 가능 (최대 20분)",
    "마스크 착용 필수",
    "무단 이동 시 기록됨",
  ]);
  const [page, setPage] = useState(1);

  const pageNames = [
    "인쇄페이지",
    "멘토정보란",
    "학생출결표",
    "플래너체크",
    "신입생 멘토배정AI",
    "재학생 멘토배정AI",
    "월간인터뷰",
    "원장컨설팅",
  ];

  return (
    <div className="p-4">
      {/* 상단 네비 버튼 */}
      <div className="mb-4">
        {pageNames.map((name, idx) => (
          <button
            key={idx}
            onClick={() => setPage(idx + 1)}
            className={`mr-2 px-4 py-2 ${
              page === idx + 1 ? "bg-blue-600 text-white" : "bg-gray-200"
            } rounded`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* 페이지별 렌더 */}
      {page === 1 && (
        <WeeklySchedule plannerText={plannerText} notices={notices} />
      )}
      {page === 2 && (
        <SettingsPage
          plannerText={plannerText}
          setPlannerText={setPlannerText}
          notices={notices}
          setNotices={setNotices}
        />
      )}
      {page === 3 && <AttendancePage />}
      {page === 4 && <PlannerCheckPage />}
      {page === 5 && <MentorAssignmentPage />}
      {page === 6 && <CurrentStudentMentorPage />}
      {page === 7 && <ViceDirectorPage />}
      {page === 8 && <DirectorConsultingPage />}
    </div>
  );
}

/* =========================
   최상위 App (라우터 연결)
========================= */
export default function App() {
  return (
    <ScheduleProvider>
      <Routes>
        {/* 메인 화면 */}
        <Route path="/" element={<InnerApp />} />

        {/* 🔥 인쇄 편집 페이지 (주차 삭제 버튼 여기 있음) */}
        <Route path="/print-edit" element={<EditablePrintPage />} />
      </Routes>
    </ScheduleProvider>
  );
}
