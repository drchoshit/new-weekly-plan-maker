import React, { useContext } from "react";
import MentorInfoEditor from "./MentorInfoEditor";
import { ScheduleContext } from "../context/ScheduleContext";

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

  return (
    <div className="space-y-6 p-4 w-full max-w-none overflow-hidden">
      <MentorInfoEditor
        mentorsByDay={mentorsByDay}
        onMentorsByDayChange={setMentorsByDay}
        summaryTitle="🗓️ 멘토 근무시간 요약"
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
