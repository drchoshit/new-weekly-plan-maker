import React from "react";
import MentorInfoEditor from "../components/MentorInfoEditor";
import { useSchedule } from "../context/ScheduleContext";
import { buildMentorDraftsFromByDay, stripMentorDraftIds } from "../utils/mentorInfo";

export default function ClinicMentorInfoPage() {
  const {
    mentorsByDay,
    clinicMentorsByDay,
    setClinicMentorsByDay,
    plannerMessage,
    noticeMessage,
    monthlyNotice,
  } = useSchedule();

  return (
    <div className="space-y-6 p-4 w-full max-w-none overflow-hidden">
      <MentorInfoEditor
        mentorsByDay={clinicMentorsByDay}
        onMentorsByDayChange={setClinicMentorsByDay}
        sessionTitle="클리닉 멘토 등록 세션"
        summaryTitle="🗓️ 클리닉 멘토 근무시간 요약"
        allowMultiSubjectSelection
        showJsonDownload
        jsonDownloadLabel="총괄/클리닉 멘토 info 다운로드"
        jsonFileName="total_clinic_mentor_info.json"
        jsonScope="totalAndClinicMentorInfo"
        buildDownloadPayload={() => ({
          scope: "totalAndClinicMentorInfo",
          exportedAt: new Date().toISOString(),
          totalMentorInfo: {
            mentors: stripMentorDraftIds(buildMentorDraftsFromByDay(mentorsByDay)),
            mentorsByDay,
            plannerMessage,
            noticeMessage,
            monthlyNotice,
          },
          clinicMentorInfo: {
            mentors: stripMentorDraftIds(buildMentorDraftsFromByDay(clinicMentorsByDay)),
            mentorsByDay: clinicMentorsByDay,
          },
        })}
      />
    </div>
  );
}
