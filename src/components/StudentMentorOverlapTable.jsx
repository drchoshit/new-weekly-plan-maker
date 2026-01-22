// src/components/StudentMentorOverlapTable.jsx
import React from "react";
import { useSchedule } from "../context/ScheduleContext";
import { timeToMinutes } from "../utils/scheduler";

const days = ["월", "화", "수", "목", "금", "토"];

function getOverlapMinutes(aStart, aEnd, bStart, bEnd) {
  return Math.min(aEnd, bEnd) - Math.max(aStart, bStart);
}

export default function StudentMentorOverlapTable() {
  const { students, mentorsByDay, attendance, selectedPeriod } = useSchedule();

  const periodAttendance = attendance[selectedPeriod] || {};

  const checkOverlapByStudent = (student) => {
    const result = {};
    const att = periodAttendance[student.id] || {};

    for (const day of days) {
      const sTime = att[day];

      if (!Array.isArray(sTime) || sTime.length < 2) {
        result[day] = "⛔";
        continue;
      }

      const sStart = timeToMinutes(sTime[0]);
      const sEnd = timeToMinutes(sTime[1]);

      if (isNaN(sStart) || isNaN(sEnd)) {
        result[day] = "⛔";
        continue;
      }

      const mentors = mentorsByDay[day] || [];
      let matched = false;

      for (const mentor of mentors) {
        if (!mentor.time || !mentor.time.includes("~")) continue;

        const [mStartStr, mEndStr] = mentor.time.split("~");
        const mStart = timeToMinutes(mStartStr);
        const mEnd = timeToMinutes(mEndStr);

        if (isNaN(mStart) || isNaN(mEnd)) continue;

        const overlap = getOverlapMinutes(sStart, sEnd, mStart, mEnd);

        if (overlap >= 30) {
          result[day] = `✅ ${mentor.name}`;
          matched = true;
          break;
        }
      }

      if (!matched) {
        result[day] = "❌";
      }
    }

    return result;
  };

  if (!selectedPeriod) {
    return (
      <div className="p-4 text-red-600 font-semibold">
        ⚠ 주차가 선택되지 않았습니다.
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">
        학생별 멘토 근무시간 겹침 여부 (주차 기준)
      </h2>

      <table className="w-full table-auto border text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1">학생</th>
            {days.map((day) => (
              <th key={day} className="border px-2 py-1">
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((student) => {
            const result = checkOverlapByStudent(student);

            return (
              <tr key={student.id}>
                <td className="border px-2 py-1 font-semibold">
                  {student.name}
                </td>
                {days.map((day) => (
                  <td
                    key={day}
                    className="border px-2 py-1 text-center"
                  >
                    {result[day]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
