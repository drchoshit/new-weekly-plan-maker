import React from "react";
import { useSchedule } from "../context/ScheduleContext";
import { timeToMinutes } from "../utils/scheduler";

const days = ["월", "화", "수", "목", "금", "토"];

function getOverlapMinutes(aStart, aEnd, bStart, bEnd) {
  return Math.min(aEnd, bEnd) - Math.max(aStart, bStart);
}

function checkOverlap(student, mentorsByDay, attendance) {
  const result = {};
  const att = attendance[student.id] || {};

  for (const day of days) {
    const sTime = att[day];
    if (!sTime || sTime.length < 2) {
      result[day] = "⛔";
      continue;
    }

    const sStart = timeToMinutes(sTime[0]); // 배열의 첫 번째 값 = start
    const sEnd = timeToMinutes(sTime[1]);   // 배열의 두 번째 값 = end

    const mentors = mentorsByDay[day] || [];
    let matched = false;

    for (const mentor of mentors) {
      if (!mentor.time || !mentor.time.includes("~")) continue;
      const [mStartStr, mEndStr] = mentor.time.split("~");
      const mStart = timeToMinutes(mStartStr);
      const mEnd = timeToMinutes(mEndStr);

      const overlap = getOverlapMinutes(sStart, sEnd, mStart, mEnd);
      if (overlap >= 30) {
        result[day] = `✅ (${mentor.name}, ${overlap}분)`;
        matched = true;
        break;
      }
    }

    if (!matched) {
      result[day] = "❌";
    }
  }

  return result;
}

export default function StudentMentorOverlapTable() {
  const { students, mentorsByDay, attendance } = useSchedule();

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">학생별 멘토 근무시간 겹침 여부</h2>
      <table className="w-full table-auto border text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1">학생 이름</th>
            {days.map(day => (
              <th key={day} className="border px-2 py-1">{day}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map(student => {
            const result = checkOverlap(student, mentorsByDay, attendance);
            return (
              <tr key={student.id}>
                <td className="border px-2 py-1 font-semibold">{student.name}</td>
                {days.map(day => (
                  <td key={day} className="border px-2 py-1 text-center">
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
