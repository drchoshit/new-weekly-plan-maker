import React, { useContext, useMemo, useState } from "react";
import MentorInfoEditor from "./MentorInfoEditor";
import { ScheduleContext } from "../context/ScheduleContext";
import { getApiBaseUrl, setApiBaseUrlOverride } from "../api/client";

const isValidApiUrl = value => {
  if (!value) {
    return true;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

export default function SettingsPage() {
  const {
    mentorsByDay,
    setMentorsByDay,
    plannerMessage,
    setPlannerMessage,
    noticeMessage,
    setNoticeMessage,
    monthlyNotice,
    setMonthlyNotice,
  } = useContext(ScheduleContext);

  const initialApiUrl = useMemo(() => getApiBaseUrl(), []);
  const [apiBaseUrlInput, setApiBaseUrlInput] = useState(initialApiUrl);
  const [apiSaveMessage, setApiSaveMessage] = useState("");
  const [apiSaveError, setApiSaveError] = useState("");

  const handleSaveApiUrl = () => {
    const nextValue = apiBaseUrlInput.trim();
    setApiSaveMessage("");
    setApiSaveError("");

    if (!isValidApiUrl(nextValue)) {
      setApiSaveError(
        "API 서버 주소 형식이 올바르지 않습니다. 예: https://mentoring-api-xxxx.onrender.com"
      );
      return;
    }

    const saved = setApiBaseUrlOverride(nextValue);
    setApiBaseUrlInput(saved);
    setApiSaveMessage(
      saved
        ? "저장되었습니다. 다른 PC도 같은 API 주소로 맞춰 주세요."
        : "오버라이드가 제거되었습니다. .env의 기본 API 주소를 사용합니다."
    );
  };

  return (
    <div className="space-y-6 p-4 w-full max-w-none overflow-hidden">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="font-bold text-slate-800">공통 API 서버</h3>
        <p className="mt-1 text-sm text-slate-600">
          여러 PC에서 최신 데이터가 동일하게 보이려면, 아래 주소를 같은 값으로
          맞춰야 합니다.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={apiBaseUrlInput}
            onChange={e => setApiBaseUrlInput(e.target.value)}
            placeholder="예: https://mentoring-api-xxxx.onrender.com"
          />
          <button
            type="button"
            onClick={handleSaveApiUrl}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            API 주소 저장
          </button>
        </div>
        {apiSaveError ? (
          <p className="mt-2 text-sm text-red-600">{apiSaveError}</p>
        ) : null}
        {apiSaveMessage ? (
          <p className="mt-2 text-sm text-emerald-700">{apiSaveMessage}</p>
        ) : null}
      </section>

      <MentorInfoEditor
        mentorsByDay={mentorsByDay}
        onMentorsByDayChange={setMentorsByDay}
        summaryTitle="필드 멘토 근무시간 요약"
      />

      <div>
        <h3 className="font-bold mt-6 mb-2">플래너 체크 문구</h3>
        <textarea
          className="border p-2 w-full h-20"
          value={plannerMessage}
          onChange={e => setPlannerMessage(e.target.value)}
        />
      </div>

      <div>
        <h3 className="font-bold mt-6 mb-2">주간 공지사항</h3>
        <textarea
          className="border p-2 w-full h-24"
          value={noticeMessage}
          onChange={e => setNoticeMessage(e.target.value)}
        />
      </div>

      <div>
        <h3 className="font-bold mt-6 mb-2">월간 공지사항</h3>
        <textarea
          className="border p-2 w-full h-24"
          value={monthlyNotice}
          onChange={e => setMonthlyNotice(e.target.value)}
        />
      </div>
    </div>
  );
}
