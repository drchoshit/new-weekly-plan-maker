// src/pages/MentalCarePage.jsx
import React, { useState, useEffect } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { timeToMinutes, minutesToTime, generateSlots } from '../utils/scheduler';

const days = ['월', '화', '수', '목', '금', '토'];
const frequencyToWeeks = {
  '주1회':    1,
  '2주 1회':  2,
  '3주 1회':  3,
  '4주 1회':  4,
};

export default function MentalCarePage() {
  const [search, setSearch] = useState('');
  const { students, setStudents, mentalCareSettings, setMentalCareSettings } = useSchedule();
  const { mentorTime, sessionDuration } = mentalCareSettings;

  // ─── scheduleByDay 초기화 & 저장 ───
  const defaultSchedule = days.reduce((o, d) => ({ ...o, [d]: [] }), {});
  const [scheduleByDay, setScheduleByDay] = useState(() => {
    const saved = localStorage.getItem('mentalCareSchedule');
    return saved ? JSON.parse(saved) : defaultSchedule;
  });
  useEffect(() => {
    localStorage.setItem('mentalCareSchedule', JSON.stringify(scheduleByDay));
  }, [scheduleByDay]);

  // ─── 설정 불러오기 & 저장 ───
  useEffect(() => {
    const saved = localStorage.getItem('mentalCareSettings');
    if (saved) {
      try {
        const { mentorTime: mt, sessionDuration: sd } = JSON.parse(saved);
        setMentalCareSettings(prev => ({
          ...prev,
          mentorTime:     mt ?? prev.mentorTime,
          sessionDuration: sd ?? prev.sessionDuration,
        }));
      } catch {
        console.error('멘탈케어 설정 불러오기 실패');
      }
    }
  }, [setMentalCareSettings]);
  useEffect(() => {
    localStorage.setItem(
      'mentalCareSettings',
      JSON.stringify({ mentorTime, sessionDuration })
    );
  }, [mentorTime, sessionDuration]);

  // ─── JSON 백업/복원 ───
  const exportToDesktop = () => {
    const data = { students, mentorTime, sessionDuration, scheduleByDay };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'mentalcare_backup.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  const importFromFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const d = JSON.parse(ev.target.result);
        if (d.students) setStudents(d.students);
        if (d.mentorTime || d.sessionDuration) {
          setMentalCareSettings(prev => ({
            ...prev,
            mentorTime:     d.mentorTime     ?? prev.mentorTime,
            sessionDuration: d.sessionDuration ?? prev.sessionDuration,
          }));
        }
        if (d.scheduleByDay) setScheduleByDay(d.scheduleByDay);
        alert('📂 저장된 데이터를 성공적으로 불러왔습니다.');
      } catch {
        alert('❌ JSON 파일이 올바르지 않습니다.');
      }
    };
    reader.readAsText(file);
  };

  // ─── 관심 / 빈도 토글 ───
  const toggleInterest = id => {
    setStudents(prev =>
      prev.map(s =>
        s.id === id ? { ...s, interested: !s.interested } : s
      )
    );
  };
  const updateFrequency = (id, freq) => {
    setStudents(prev =>
      prev.map(s =>
        s.id === id ? { ...s, frequency: freq } : s
      )
    );
  };

  // ─── 자동 배정 로직 ───
  const generateSchedule = () => {
    const result = days.reduce((o, d) => ({ ...o, [d]: [] }), {});
    const reasons = [];
    const interested = students.filter(s => s.interested);

    // 학생별 출결 총량 계산 (정렬용)
    const getDuration = attendance =>
      Object.values(attendance || {})
        .filter(times => Array.isArray(times) && times.length === 2)
        .reduce((sum, [start, end]) => sum + (timeToMinutes(end) - timeToMinutes(start)), 0);

    // “창이 좁은” 학생 먼저
    const sorted = [...interested].sort(
      (a, b) => getDuration(a.attendance) - getDuration(b.attendance)
    );

    const assignedSet = new Set();

    sorted.forEach(student => {
      const freq     = student.frequency || '주1회';
      const maxCount = 1 / (frequencyToWeeks[freq] || 1);
      let assigned   = 0;

      for (const day of days) {
        if (assigned >= maxCount) break;

        const attendance = student.attendance?.[day];
        const range      = mentorTime[day];
        if (!range?.start || !range.end) continue;
        if (!Array.isArray(attendance) || attendance.length !== 2) continue;

        const sStart = timeToMinutes(attendance[0]);
        const sEnd   = timeToMinutes(attendance[1]);
        const mStart = timeToMinutes(range.start);
        const mEnd   = timeToMinutes(range.end);
        const start  = Math.max(sStart, mStart);
        const end    = Math.min(sEnd, mEnd);
        if (isNaN(start) || isNaN(end) || end - start < sessionDuration) continue;

        const slots = generateSlots(
          minutesToTime(start),
          minutesToTime(end),
          sessionDuration
        );

        let placed = false;
        for (const slot of slots) {
          const key = `${day}_${slot.start}`;
          if (!assignedSet.has(key)) {
            result[day].push({ ...slot, student: student.name });
            assignedSet.add(key);
            assigned++;
            placed = true;
            break;
          }
        }
        if (placed) assignedSet.add(student.id);
      }

      // 배정 안 된 경우
      if (assigned === 0) {
        reasons.push(`${student.name}: 배정 실패`);
      }
    });

    return { result, reasons };
  };

  // ─── 자동 배정 실행 ───
  const handleAssignClick = () => {
    if (!window.confirm('자동 배정을 진행하시겠습니까?')) return;
    const { result, reasons } = generateSchedule();
    setScheduleByDay(result);
    if (reasons.length) {
      alert('미배정 학생:\n' + reasons.join('\n'));
    } else {
      alert('🧠 멘탈케어링 자동 배정이 완료되었습니다.');
    }
  };

  const filtered = students.filter(s => s.name.includes(search));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">멘탈 케어링 관리</h1>

      {/* 설정 */}
      <div className="p-4 bg-gray-100 rounded-lg space-y-4">
        <h2 className="text-xl font-semibold">멘탈케어링 설정</h2>
        {days.map(day => (
          <div key={day} className="flex items-center gap-2 mb-1">
            <span className="w-6">{day}</span>
            <input
              type="time"
              className="border px-2 py-1 rounded"
              value={mentorTime[day].start}
              onChange={e =>
                setMentalCareSettings(prev => ({
                  ...prev,
                  mentorTime: {
                    ...prev.mentorTime,
                    [day]: { ...prev.mentorTime[day], start: e.target.value }
                  }
                }))
              }
            />
            <span>~</span>
            <input
              type="time"
              className="border px-2 py-1 rounded"
              value={mentorTime[day].end}
              onChange={e =>
                setMentalCareSettings(prev => ({
                  ...prev,
                  mentorTime: {
                    ...prev.mentorTime,
                    [day]: { ...prev.mentorTime[day], end: e.target.value }
                  }
                }))
              }
            />
          </div>
        ))}
        <div>
          <label className="block font-medium mb-1">
            멘탈케어 세션 길이 (분)
          </label>
          <input
            type="number"
            min={5}
            max={60}
            step={5}
            className="border px-2 py-1 rounded w-20"
            value={sessionDuration}
            onChange={e =>
              setMentalCareSettings(prev => ({
                ...prev,
                sessionDuration: Number(e.target.value)
              }))
            }
          />
        </div>
      </div>

      {/* 검색 */}
      <input
        type="text"
        placeholder="학생 이름 검색"
        className="border p-2 w-full max-w-md"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* 학생 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {filtered.map(st => (
          <div key={st.id} className="p-2 border rounded shadow flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <span>{st.name}</span>
              <button
                onClick={() => toggleInterest(st.id)}
                className={`px-2 py-1 rounded text-sm ${
                  st.interested ? 'bg-green-500 text-white' : 'bg-gray-200'
                }`}
              >
                {st.interested ? '희망함' : '희망 안함'}
              </button>
            </div>
            <select
              value={st.frequency || '주1회'}
              onChange={e => updateFrequency(st.id, e.target.value)}
              className="border px-1 py-1 rounded text-sm"
            >
              {Object.keys(frequencyToWeeks).map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* 강사용 스케줄 */}
      <h2 className="text-xl font-semibold mt-10">요일별 케어링 일정표 (강사용)</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {days.map(day => (
          <div key={day} className="border p-3 rounded shadow">
            <h3 className="font-bold mb-2">{day}요일</h3>
            {scheduleByDay[day].length > 0 ? (
              <ul className="text-sm space-y-1">
                {scheduleByDay[day].map((s, i) => (
                  <li key={i}>{s.start} ~ {s.end} – {s.student}</li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-gray-500">스케줄 없음</div>
            )}
          </div>
        ))}
      </div>

      {/* 조작 버튼 */}
      <div className="flex flex-wrap gap-4 mt-4">
        <button
          onClick={handleAssignClick}
          className="px-6 py-3 bg-blue-700 text-white rounded shadow text-lg"
        >
          🧠 자동 배정 시작하기
        </button>
        <button
          onClick={exportToDesktop}
          className="px-6 py-3 bg-purple-600 text-white rounded"
        >
          💾 바탕화면에 저장
        </button>
        <label className="px-6 py-3 bg-orange-500 text-white rounded cursor-pointer">
          📂 불러오기
          <input
            type="file"
            accept="application/json"
            onChange={importFromFile}
            className="hidden"
          />
        </label>
      </div>
    </div>
);
}
