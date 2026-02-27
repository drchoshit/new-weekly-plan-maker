import React, { useState } from "react";
import { Routes, Route } from "react-router-dom";
import { ScheduleProvider } from "./context/ScheduleContext";
import LoginPage from "./pages/LoginPage";

import WeeklySchedule from "./components/WeeklySchedule";
import SettingsPage from "./components/SettingsPage";
import AttendancePage from "./pages/AttendancePage";
import PlannerCheckPage from "./pages/PlannerCheckPage";
import MentorAssignmentPage from "./pages/MentorAssignmentPage";
import ViceDirectorPage from "./pages/ViceDirectorPage";
import DirectorConsultingPage from "./pages/DirectorConsultingPage";
import EditablePrintPage from "./pages/EditablePrintPage";

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
    "멘토링 배정 AI",
    "월간인터뷰",
    "원장컨설팅",
  ];

  return (
    <div className="p-4">
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

      {page === 1 && <WeeklySchedule plannerText={plannerText} notices={notices} />}
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
      {page === 6 && <ViceDirectorPage />}
      {page === 7 && <DirectorConsultingPage />}
    </div>
  );
}

export default function App() {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("authToken"));

  const handleLoginSuccess = token => {
    localStorage.setItem("authToken", token);
    setAuthToken(token);
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    setAuthToken(null);
  };

  return (
    <ScheduleProvider authToken={authToken} onUnauthorized={handleLogout}>
      {authToken ? (
        <Routes>
          <Route path="/" element={<InnerApp />} />
          <Route path="/print-edit" element={<EditablePrintPage />} />
        </Routes>
      ) : (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      )}
    </ScheduleProvider>
  );
}
