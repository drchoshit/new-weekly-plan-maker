import React, { useState } from "react";
import { Routes, Route } from "react-router-dom";
import { ScheduleProvider } from "./context/ScheduleContext";
import LoginPage from "./pages/LoginPage";

import WeeklySchedule from "./components/WeeklySchedule";
import SettingsPage from "./components/SettingsPage";
import AttendancePage from "./pages/AttendancePage";
import ClinicMentorInfoPage from "./pages/ClinicMentorInfoPage";
import PlannerCheckPage from "./pages/PlannerCheckPage";
import MentorAssignmentPage from "./pages/MentorAssignmentPage";
import ViceDirectorPage from "./pages/ViceDirectorPage";
import DirectorConsultingPage from "./pages/DirectorConsultingPage";
import EditablePrintPage from "./pages/EditablePrintPage";

function InnerApp() {
  const [page, setPage] = useState(1);

  const pageTabs = [
    { page: 1, label: "인쇄페이지" },
    { page: 2, label: "총괄멘토Info" },
    { page: 3, label: "클리닉멘토Info" },
    { page: 4, label: "학생출결표" },
    // page 5(플래너체크)는 탭에서 숨김 처리
    { page: 6, label: "멘토링 배정 AI" },
    { page: 7, label: "월간인터뷰" },
    { page: 8, label: "원장컨설팅" },
  ];

  return (
    <div className="p-4">
      <div className="mb-4">
        {pageTabs.map(({ page: targetPage, label }) => (
          <button
            key={targetPage}
            onClick={() => setPage(targetPage)}
            className={`mr-2 px-4 py-2 ${
              page === targetPage ? "bg-blue-600 text-white" : "bg-gray-200"
            } rounded`}
          >
            {label}
          </button>
        ))}
      </div>

      {page === 1 && <WeeklySchedule />}
      {page === 2 && <SettingsPage />}
      {page === 3 && <ClinicMentorInfoPage />}
      {page === 4 && <AttendancePage />}
      {page === 5 && <PlannerCheckPage />}
      {page === 6 && <MentorAssignmentPage />}
      {page === 7 && <ViceDirectorPage />}
      {page === 8 && <DirectorConsultingPage />}
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
