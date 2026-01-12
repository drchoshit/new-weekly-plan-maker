// src/components/SettingsPage.jsx
import React, { useContext } from "react";
import { ScheduleContext } from "../context/ScheduleContext";
import Select from "react-select";

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

  const days = ["월", "화", "수", "목", "금", "토"];

  const mathOptions = [
    "미적", "확통", "기하", "공통"
  ].map(label => ({ label, value: label }));

  const koreanOptions = [
    "화작", "언매", "공통"
  ].map(label => ({ label, value: label }));

  const exploreOptions = [
    "통합사회", "한국지리", "세계지리", "세계사", "동아시아사",
    "경제", "정치와 법", "사회·문화", "생활과 윤리", "윤리와 사상",
    "통합과학", "과학탐구 실험", "물리학Ⅰ", "화학Ⅰ", "생명과학Ⅰ", "지구과학Ⅰ"
  ].map(label => ({ label, value: label }));

  const personalityOptions = [
    { label: "극I", value: "극I" },
    { label: "극E", value: "극E" },
    { label: "비극단적", value: "비극단적" },
  ];

  const handleMentorChange = (day, index, field, value) => {
    const prev = Array.isArray(mentorsByDay?.[day]) ? mentorsByDay[day] : [];
    const updated = [...prev];
    if (!updated[index]) updated[index] = {};
    updated[index][field] = value;
    setMentorsByDay({ ...mentorsByDay, [day]: updated });
  };

  return (
    <div className="space-y-6 p-4 w-full max-w-none overflow-hidden">
      {days.map((day) => (
        <div key={day}>
          <h3 className="font-bold text-lg mb-2">{day}요일 멘토</h3>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="grid grid-cols-12 gap-2 mb-1">
              <input
                placeholder="이름"
                className="border p-1"
                value={mentorsByDay?.[day]?.[i]?.name || ""}
                onChange={(e) => handleMentorChange(day, i, "name", e.target.value)}
              />
              <input
                placeholder="대학"
                className="border p-1"
                value={mentorsByDay?.[day]?.[i]?.univ || ""}
                onChange={(e) => handleMentorChange(day, i, "univ", e.target.value)}
              />
              <input
                placeholder="전공"
                className="border p-1"
                value={mentorsByDay?.[day]?.[i]?.major || ""}
                onChange={(e) => handleMentorChange(day, i, "major", e.target.value)}
              />
              <input
                placeholder="성별"
                className="border p-1"
                value={mentorsByDay?.[day]?.[i]?.gender || ""}
                onChange={(e) => handleMentorChange(day, i, "gender", e.target.value)}
              />
              <input
                placeholder="근무시간"
                className="border p-1"
                value={mentorsByDay?.[day]?.[i]?.time || ""}
                onChange={(e) => handleMentorChange(day, i, "time", e.target.value)}
              />
              <input
                placeholder="비고"
                className="border p-1 col-span-1"
                value={mentorsByDay?.[day]?.[i]?.note || ""}
                onChange={(e) => handleMentorChange(day, i, "note", e.target.value)}
              />
              <input
                placeholder="생년 (예: 1999)"
                className="border p-1"
                value={mentorsByDay?.[day]?.[i]?.birthYear || ""}
                onChange={(e) => handleMentorChange(day, i, "birthYear", e.target.value)}
              />
              <Select
                options={mathOptions}
                placeholder="수학선택"
                value={mathOptions.find(opt => opt.value === mentorsByDay?.[day]?.[i]?.mathSubject) || null}
                onChange={(selected) => handleMentorChange(day, i, "mathSubject", selected?.value || "")}
              />
              <Select
                options={koreanOptions}
                placeholder="국어선택"
                value={koreanOptions.find(opt => opt.value === mentorsByDay?.[day]?.[i]?.koreanSubject) || null}
                onChange={(selected) => handleMentorChange(day, i, "koreanSubject", selected?.value || "")}
              />
              <Select
                options={exploreOptions}
                placeholder="탐구선택1"
                value={exploreOptions.find(opt => opt.value === mentorsByDay?.[day]?.[i]?.explore1) || null}
                onChange={(selected) => handleMentorChange(day, i, "explore1", selected?.value || "")}
              />
              <Select
                options={exploreOptions}
                placeholder="탐구선택2"
                value={exploreOptions.find(opt => opt.value === mentorsByDay?.[day]?.[i]?.explore2) || null}
                onChange={(selected) => handleMentorChange(day, i, "explore2", selected?.value || "")}
              />
              <Select
                options={personalityOptions}
                placeholder="성격유형"
                value={personalityOptions.find(opt => opt.value === mentorsByDay?.[day]?.[i]?.personality) || null}
                onChange={(selected) => handleMentorChange(day, i, "personality", selected?.value || "")}
              />
            </div>
          ))}
        </div>
      ))}

      <div>
        <h3 className="font-bold mt-6 mb-2">플래너 체크 문구</h3>
        <textarea
          className="border p-2 w-full h-20"
          value={plannerMessage}
          onChange={(e) => setPlannerMessage(e.target.value)}
        />
      </div>

      <div>
        <h3 className="font-bold mt-6 mb-2">주간 공지사항</h3>
        <textarea
          className="border p-2 w-full h-24"
          value={noticeMessage}
          onChange={(e) => setNoticeMessage(e.target.value)}
        />
      </div>

      <div>
        <h3 className="font-bold mt-6 mb-2">월간 공지사항</h3>
        <textarea
          className="border p-2 w-full h-24"
          value={monthlyNotice}
          onChange={(e) => setMonthlyNotice(e.target.value)}
        />
      </div>

      {/* 멘토 근무시간 요약 출력 */}
      <div className="mt-10 border-t pt-4">
        <h2 className="font-bold text-xl mb-2">🗓️ 멘토 근무시간 요약</h2>
        {(() => {
          const allMentors = {};
          days.forEach(day => {
            const mentors = mentorsByDay?.[day] || [];
            mentors.forEach((mentor, i) => {
              const name = mentor?.name?.trim();
              const time = mentor?.time?.trim();
              if (!name) return;
              if (!allMentors[name]) {
                allMentors[name] = { '월': '없음', '화': '없음', '수': '없음', '목': '없음', '금': '없음', '토': '없음' };
              }
              if (time) {
                allMentors[name][day] = time;
              }
            });
          });

          return Object.entries(allMentors).map(([name, schedule]) => (
            <div key={name} className="text-sm">
              <strong>{name}:</strong>&nbsp;
              {days.map((day, i) => (
                <span key={day}>
                  {day}: {schedule[day]}{i < days.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>
          ));
        })()}
      </div>
    </div>
  );
}
