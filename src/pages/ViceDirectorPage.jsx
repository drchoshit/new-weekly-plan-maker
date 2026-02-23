// src/pages/ViceDirectorPage.jsx
import React, { useContext, useState } from 'react';
import { ScheduleContext } from '../context/ScheduleContext';
import { timeToMinutes, minutesToTime, generateSlots } from '../utils/scheduler';

const days = ['월', '화', '수', '목', '금', '토'];
const durations = Array.from({ length: 12 }, (_, i) => (i + 1) * 5); // 5~60분

export default function Page7() {
  const {
    students,
    attendance,
    selectedPeriod, // 🔥 추가
    studentInterviewAssignments,
    setStudentInterviewAssignments,
    interviewSettings,
    setInterviewSettings,
    interviewSchedule,
    setInterviewSchedule,
    interviewDuration: duration,
    setInterviewDuration: setDuration,
    interviewWilling,
    setInterviewWilling,
  } = useContext(ScheduleContext);
  const [errors, setErrors] = useState([]);

  const handleTimeChange = (day, type, value) => {
    setInterviewSettings(prev => ({
      ...prev,
      [day]: { ...(prev[day] || {}), [type]: value }
    }));
  };

  const toggleWilling = (id) => {
    setInterviewWilling(prev => {
      return { ...prev, [id]: !prev[id] };
    });
  };

  const autoAssign = () => {
    const result = {};
    const failed = [];
    const studentDayTime = {};

    const sorted = [...students]
      .filter(s => interviewWilling[s.id])
      .sort((a, b) => getWeeklyMinutes(a.id) - getWeeklyMinutes(b.id));

    for (const s of sorted) {
      const slots = getStudentAvailableSlots(s.id);
      let assigned = false;
      for (const slot of slots) {
        if (!result[slot.day]) result[slot.day] = [];
        const overlap = result[slot.day].some(
          r =>
            timeToMinutes(r.start) < timeToMinutes(slot.end) &&
            timeToMinutes(r.end) > timeToMinutes(slot.start)
        );
        if (!overlap) {
          result[slot.day].push({ student: s.name, ...slot });
          studentDayTime[s.id] = { day: slot.day, start: slot.start, end: slot.end };
          assigned = true;
          break;
        }
      }
      if (!assigned) failed.push(s.name);
    }

    setInterviewSchedule(result);
    setStudentInterviewAssignments(studentDayTime);
    setErrors(failed);
  };

  const getStudentAvailableSlots = (id) => {
    // 🔥 주차 기준 attendance 사용
    const stuAttendance =
      attendance?.[selectedPeriod]?.[id] || {};

    const slots = [];

    for (const day of days) {
      const stu = stuAttendance[day];
      const work = interviewSettings[day];

      if (!stu || !stu[0] || !stu[1] || !work?.start || !work?.end) continue;

      const sStart = timeToMinutes(stu[0]);
      const sEnd = timeToMinutes(stu[1]);
      const wStart = timeToMinutes(work.start);
      const wEnd = timeToMinutes(work.end);

      const start = Math.max(sStart, wStart);
      const end = Math.min(sEnd, wEnd);

      if (end - start >= duration) {
        const possible = generateSlots(
          minutesToTime(start),
          minutesToTime(end),
          duration
        );

        for (const { start: slotStart, end: slotEnd } of possible) {
          slots.push({ day, start: slotStart, end: slotEnd });
        }
      }
    }

    return slots;
  };


  const getWeeklyMinutes = (id) => {
    // 🔥 주차 기준 attendance 사용
    const rec =
      attendance?.[selectedPeriod]?.[id] || {};

    let total = 0;

    for (const times of Object.values(rec)) {
      if (!times || !times[0] || !times[1]) continue;
      total += timeToMinutes(times[1]) - timeToMinutes(times[0]);
    }

    return total;
  };


  const forceAssign = (day, name, start, end) => {
    setInterviewSchedule(prev => {
      const updated = { ...prev };
      if (!updated[day]) updated[day] = [];
      updated[day].push({ student: name, start, end });
      return updated;
    });

    setStudentInterviewAssignments(prev => {
      const updated = { ...prev };
      updated[students.find(s => s.name === name)?.id] = { day, start, end };
      return updated;
    });
  };

  const deleteInterviewSlot = (day, index) => {
    setInterviewSchedule(prev => {
      const updated = { ...prev };
      updated[day] = [...(updated[day] || [])];
      updated[day].splice(index, 1);
      return updated;
    });
  };

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-bold mb-2">부원장 인터뷰 자동 배정</h1>

      <div className="flex items-center space-x-4">
        <label className="font-medium">인터뷰 시간 단위:</label>
        <select
          value={duration}
          onChange={e => setDuration(Number(e.target.value))}
          className="border p-1 rounded"
        >
          {durations.map(d => (
            <option key={d} value={d}>{d}분</option>
          ))}
        </select>
        <button
          onClick={autoAssign}
          className="ml-auto bg-blue-600 text-white px-3 py-1 rounded"
        >
          자동 배정
        </button>
      </div>

      <div className="grid grid-cols-6 gap-4">
        {days.map(day => {
          const setting = interviewSettings[day];
          return (
            <div key={day} className="border rounded p-2 text-center">
              <h2 className="font-semibold text-sm mb-2">{day} 근무시간</h2>
              <div className="space-y-1">
                <input
                  type="time"
                  value={setting?.start || ''}
                  onChange={e => handleTimeChange(day, 'start', e.target.value)}
                  className="border rounded w-full"
                />
                <input
                  type="time"
                  value={setting?.end || ''}
                  onChange={e => handleTimeChange(day, 'end', e.target.value)}
                  className="border rounded w-full"
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {setting?.start && setting?.end
                  ? `근무시간: ${setting.start} ~ ${setting.end}`
                  : '근무시간 미설정'}
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="font-semibold text-lg mt-4">인터뷰 대상 학생</h2>
      <table className="w-full table-fixed border text-sm text-center">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">이름</th>
            <th className="border p-2">참여</th>
            <th className="border p-2">주간 총 출결</th>
            <th className="border p-2">배정 요일</th>
            <th className="border p-2">배정 시간</th>
            <th className="border p-2">강제 배정 시간</th>
            <th className="border p-2">강제 배정 요일</th>
          </tr>
        </thead>
        <tbody>
          {students.map(s => {
            const assign = studentInterviewAssignments[s.id];
            return (
              <tr key={s.id}>
                <td className="border p-1">{s.name}</td>
                <td className="border p-1">
                  <input
                    type="checkbox"
                    checked={!!interviewWilling[s.id]}
                    onChange={() => toggleWilling(s.id)}
                  />
                </td>
                <td className="border p-1">{getWeeklyMinutes(s.id)}분</td>
                <td className="border p-1">{assign?.day || '--'}</td>
                <td className="border p-1">{assign ? `${assign.start}~${assign.end}` : '--'}</td>
                <td className="border p-1">
                  <input
                    type="time"
                    onBlur={(e) => {
                      const start = e.target.value;
                      if (!start) return;
                      const startMin = timeToMinutes(start);
                      const end = minutesToTime(startMin + duration);
                      const day = assign?.day || '월';
                      forceAssign(day, s.name, start, end);
                      e.target.value = '';
                    }}
                  />
                </td>
                <td className="border p-1">
                  <input
                    type="text"
                    placeholder="예: 월"
                    onBlur={(e) => {
                      const newDay = e.target.value;
                      if (!newDay || !days.includes(newDay)) return;
                      const record = interviewSchedule[newDay] || [];
                      const assignment = record.find(r => r.student === s.name);
                      if (!assignment) return;
                      setStudentInterviewAssignments(prev => {
                        const updated = {
                          ...prev,
                          [s.id]: { day: newDay, start: assignment.start, end: assignment.end }
                        };
                        return updated;
                      });
                    }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {errors.length > 0 && (
        <div className="text-red-600 mt-2">배정 실패: {errors.join(', ')}</div>
      )}

      <h2 className="font-semibold text-lg mt-6">부원장 요일별 인터뷰 스케줄</h2>
      <div className="grid grid-cols-2 gap-4">
        {days.map(day => (
          <div key={day} className="border rounded p-2">
            <h3 className="font-semibold mb-1 text-center">{day}</h3>
            <table className="w-full text-sm border">
              <thead>
                <tr className="bg-gray-100 text-center">
                  <th className="border p-1">시간</th>
                  <th className="border p-1">학생</th>
                  <th className="border p-1">삭제</th>
                </tr>
              </thead>
              <tbody>
                {(interviewSchedule[day] || [])
                  .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))
                  .map((s, idx) => (
                    <tr key={idx}>
                      <td className="border p-1 text-center">{s.start}~{s.end}</td>
                      <td className="border p-1 text-center">{s.student}</td>
                      <td className="border p-1 text-center">
                        <button
                          onClick={() => deleteInterviewSlot(day, idx)}
                          className="text-red-500"
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
