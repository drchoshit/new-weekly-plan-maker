// src/pages/PlannerCheckPage.jsx
import React, { useState, useEffect } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { timeToMinutes, minutesToTime, generateSlots } from '../utils/scheduler';

const days = ['월', '화', '수', '목', '금', '토'];

// ✅ 전략 상수 (+ MAX_COVER 추가)
const STRATEGY = {
  MON_FIRST: 'MON_FIRST',
  TUE_FIRST: 'TUE_FIRST',
  WED_FIRST: 'WED_FIRST',
  THU_FIRST: 'THU_FIRST',
  FRI_FIRST: 'FRI_FIRST',
  SAT_FIRST: 'SAT_FIRST',
  NIGHT_FIRST: 'NIGHT_FIRST',
  MAX_COVER: 'MAX_COVER',
};

export default function PlannerCheckPage() {
  const {
    students,
    setStudents,
    noticeMessage,
    setNoticeMessage,
    monthlyNotice,
    setMonthlyNotice
  } = useSchedule();

  const [searchText, setSearchText] = useState('');

  // Checker hours & session length
  const defaultTime = days.reduce(
    (o, d) => ({ ...o, [d]: [{ start: '', end: '' }, { start: '', end: '' }] }),
    {}
  );
  const [checkerTime, setCheckerTime] = useState(
    () => JSON.parse(localStorage.getItem('plannerCheckTime')) || defaultTime
  );
  const [sessionDuration, setSessionDuration] = useState(
    () => JSON.parse(localStorage.getItem('plannerSessionDuration')) || 30
  );

  // Schedule state
  const defaultSchedule = days.reduce((o, d) => ({ ...o, [d]: [] }), {});
  const [scheduleByDay, setScheduleByDay] = useState(
    () => JSON.parse(localStorage.getItem('plannerSchedule')) || defaultSchedule
  );

  // Ensure weeklySessions ∈ [0,7]
  useEffect(() => {
    setStudents(prev =>
      prev.map(s => {
        const ws0 = Number.isInteger(s.weeklySessions) ? s.weeklySessions : 1;
        return { ...s, weeklySessions: Math.min(7, Math.max(0, ws0)) };
      })
    );
  }, [setStudents]);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('plannerCheckTime', JSON.stringify(checkerTime));
  }, [checkerTime]);
  useEffect(() => {
    localStorage.setItem('plannerSessionDuration', JSON.stringify(sessionDuration));
  }, [sessionDuration]);
  useEffect(() => {
    localStorage.setItem('plannerSchedule', JSON.stringify(scheduleByDay));
  }, [scheduleByDay]);
  useEffect(() => {
    localStorage.setItem('noticeMessage', noticeMessage);
  }, [noticeMessage]);
  useEffect(() => {
    localStorage.setItem('monthlyNotice', monthlyNotice);
  }, [monthlyNotice]);

  // Edmonds–Karp max-flow
  function edmondsKarp(cap, adj, s, t) {
    const parent = Array(cap.length);
    let flow = 0;
    while (true) {
      const visited = Array(cap.length).fill(false);
      const queue = [s];
      visited[s] = true;
      parent.fill(-1);

      while (queue.length && !visited[t]) {
        const u = queue.shift();
        for (const v of adj[u]) {
          if (!visited[v] && cap[u][v] > 0) {
            visited[v] = true;
            parent[v] = u;
            queue.push(v);
          }
        }
      }
      if (!visited[t]) break;

      let pathFlow = Infinity;
      let v = t;
      while (v !== s) {
        const u = parent[v];
        pathFlow = Math.min(pathFlow, cap[u][v]);
        v = u;
      }
      v = t;
      while (v !== s) {
        const u = parent[v];
        cap[u][v] -= pathFlow;
        cap[v][u] += pathFlow;
        v = u;
      }
      flow += pathFlow;
    }
    return flow;
  }

  // ✅ 전략별 요일 순서 계산
  function getDayOrderByStrategy(strategy) {
    const base = [...days];
    if (!strategy) return base;

    const map = {
      [STRATEGY.MON_FIRST]: '월',
      [STRATEGY.TUE_FIRST]: '화',
      [STRATEGY.WED_FIRST]: '수',
      [STRATEGY.THU_FIRST]: '목',
      [STRATEGY.FRI_FIRST]: '금',
      [STRATEGY.SAT_FIRST]: '토',
    };
    if (strategy in map) {
      const first = map[strategy];
      const idx = base.indexOf(first);
      return [...base.slice(idx), ...base.slice(0, idx)];
    }
    // NIGHT_FIRST / MAX_COVER에서 요일 기본 순서는 base 사용 (월→토)
    return base;
  }

  // ✅ 평가 지표(총 누락 합계, 누락 학생 수, 총 배정 세션 수)
  function evaluateSchedule(schedule) {
    const countsByStudent = new Map();
    days.forEach(d => {
      (schedule[d] || []).forEach(({ student }) => {
        countsByStudent.set(student, (countsByStudent.get(student) || 0) + 1);
      });
    });
    let totalMissing = 0;
    let missingStudents = 0;
    let totalAssigned = 0;
    students.forEach(s => {
      const need = s.weeklySessions || 0;
      const got = countsByStudent.get(s.name) || 0;
      const miss = Math.max(0, need - got);
      totalMissing += miss;
      if (miss > 0) missingStudents += 1;
      totalAssigned += got;
    });
    return { totalMissing, missingStudents, totalAssigned };
  }

  // Generate schedule with per-day constraint (strategy 적용)
  const generatePlannerSchedule = (strategy = null) => {
    // (1) collect all slots
    const allSlots = [];
    const dayOrder = getDayOrderByStrategy(strategy);

    // ✅ 야간 우선: 월→토 각각 "야간(≥21:00) 먼저, 주간(<21:00) 나중" 순으로 밀어넣기
    if (strategy === STRATEGY.NIGHT_FIRST) {
      const NIGHT_MIN = 21 * 60;
      days.forEach(day => {
        const di = days.indexOf(day);
        const ranges = checkerTime[day] || [];
        const daySlots = [];
        ranges.forEach(range => {
          if (!range.start || !range.end) return;
          const c0 = timeToMinutes(range.start);
          const c1 = timeToMinutes(range.end);
          generateSlots(minutesToTime(c0), minutesToTime(c1), sessionDuration)
            .forEach(slot => daySlots.push({ day, di, ...slot }));
        });
        const night = daySlots.filter(s => timeToMinutes(s.start) >= NIGHT_MIN)
                              .sort((a,b)=>timeToMinutes(a.start)-timeToMinutes(b.start));
        const dayt  = daySlots.filter(s => timeToMinutes(s.start) <  NIGHT_MIN)
                              .sort((a,b)=>timeToMinutes(a.start)-timeToMinutes(b.start));
        // Mon Night…Sat Night → Mon Day…Sat Day
        allSlots.push(...night, ...dayt);
      });
    } else {
      // 요일 우선: 선택 요일부터 순회, 각 요일 내부는 시간순
      dayOrder.forEach(day => {
        const di = days.indexOf(day);
        (checkerTime[day] || []).forEach(range => {
          if (!range.start || !range.end) return;
          const c0 = timeToMinutes(range.start);
          const c1 = timeToMinutes(range.end);
          generateSlots(minutesToTime(c0), minutesToTime(c1), sessionDuration)
            .forEach(slot => allSlots.push({ day, di, ...slot }));
        });
      });
    }

    const nStudents = students.length;
    const nDays = days.length;
    const nSlots = allSlots.length;
    const S = 0;
    const studentStart = 1;
    const studentDayStart = studentStart + nStudents;
    const slotStart = studentDayStart + nStudents * nDays;
    const T = slotStart + nSlots;
    const N = T + 1;

    const cap = Array.from({ length: N }, () => Array(N).fill(0));
    const adj = Array.from({ length: N }, () => []);

    function addEdge(u, v, c) {
      if (!adj[u].includes(v)) adj[u].push(v);
      if (!adj[v].includes(u)) adj[v].push(u);
      cap[u][v] = c;
    }

    // 학생 우선순위(기존 유지)
    const studentWithTime = students.map((s, i) => {
      const logs = s.attendance || {};
      const total = Object.values(logs).reduce((sum, [start, end]) => {
        return sum + (timeToMinutes(end) - timeToMinutes(start));
      }, 0);
      return { index: i, total };
    }).sort((a, b) => a.total - b.total);

    // S -> student
    studentWithTime.forEach(({ index: i }) => {
      const u = studentStart + i;
      const w = students[i].weeklySessions || 0;
      if (w > 0) addEdge(S, u, w);
    });

    // ✅ 핵심 수정: student -> student-day 엣지 추가 순서를 전략별 요일 순서로
    students.forEach((_, i) => {
      const u = studentStart + i;
      const order = (strategy && strategy !== STRATEGY.NIGHT_FIRST) ? getDayOrderByStrategy(strategy) : days;
      order.forEach(day => {
        const di = days.indexOf(day);
        const v = studentDayStart + i * nDays + di;
        addEdge(u, v, 1);
      });
    });

    // student-day -> slot (if eligible)
    // allSlots의 현재 순서가 BFS 순서에 반영됨
    students.forEach((s, i) => {
      for (let di = 0; di < nDays; di++) {
        const att = s.attendance?.[days[di]];
        const ranges = checkerTime[days[di]] || [];
        if (!Array.isArray(att) || att.length !== 2) continue;
        const s0 = timeToMinutes(att[0]);
        const s1 = timeToMinutes(att[1]);
        const uDay = studentDayStart + i * nDays + di;

        // 체커 범위와 학생 가능 범위를 동시에 만족하는 슬롯에만 엣지
        if (ranges.some(r => r.start && r.end)) {
          allSlots.forEach((slot, j) => {
            if (
              slot.di === di &&
              s0 <= timeToMinutes(slot.start) &&
              timeToMinutes(slot.end) <= s1
            ) {
              const v = slotStart + j;
              addEdge(uDay, v, 1);
            }
          });
        }
      }
    });

    // slot -> T
    allSlots.forEach((_, j) => {
      const v = slotStart + j;
      addEdge(v, T, 1);
    });

    // max flow
    edmondsKarp(cap, adj, S, T);

    // extract assignments
    const schedule = days.reduce((o, d) => ({ ...o, [d]: [] }), {});
    const reasons = [];
    students.forEach((s, i) => {
      let assigned = 0;
      for (let j = 0; j < nSlots; j++) {
        const slot = allSlots[j];
        const vSlot = slotStart + j;
        const uDay = studentDayStart + i * nDays + slot.di;
        if (cap[vSlot][uDay] > 0) {
          schedule[slot.day].push({
            start: slot.start,
            end: slot.end,
            student: s.name
          });
          assigned++;
        }
      }
      const need = s.weeklySessions || 0;
      if (assigned < need) {
        reasons.push(`${s.name}: ${need - assigned}회 누락`);
      }
    });

    // sort each day's slots by time
    days.forEach(d => {
      schedule[d].sort(
        (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
      );
    });

    return { schedule, reasons };
  };

  const handleAssignClick = () => {
    const { schedule, reasons } = generatePlannerSchedule();
    setScheduleByDay(schedule);
    if (reasons.length) {
      alert('미배정:\n' + reasons.join('\n'));
    } else {
      alert('플래너 체크 자동 배정 완료');
    }
  };

  // 전략 실행
  const handleAssignWithStrategy = (strategy) => {
    if (strategy === STRATEGY.MAX_COVER) {
      // ✅ 7가지 전략을 모두 테스트하고 최적(누락 최소) 결과 선택
      const candidates = [
        STRATEGY.MON_FIRST,
        STRATEGY.TUE_FIRST,
        STRATEGY.WED_FIRST,
        STRATEGY.THU_FIRST,
        STRATEGY.FRI_FIRST,
        STRATEGY.SAT_FIRST,
        STRATEGY.NIGHT_FIRST,
      ];
      let best = null;
      let bestEval = null;
      let bestName = '';

      candidates.forEach(name => {
        const { schedule, reasons } = generatePlannerSchedule(name);
        const score = evaluateSchedule(schedule);
        // 비교: 총 누락 합계 → 누락 학생 수 → 총 배정 세션 수
        if (
          !best ||
          score.totalMissing < bestEval.totalMissing ||
          (score.totalMissing === bestEval.totalMissing && score.missingStudents < bestEval.missingStudents) ||
          (score.totalMissing === bestEval.totalMissing && score.missingStudents === bestEval.missingStudents && score.totalAssigned > bestEval.totalAssigned)
        ) {
          best = { schedule, reasons };
          bestEval = score;
          bestName = name;
        }
      });

      setScheduleByDay(best.schedule);
      const msg =
        `최대 배분 모드 완료\n- 선택된 전략: ${bestName}\n- 총 누락 회수: ${bestEval.totalMissing}\n- 누락 학생 수: ${bestEval.missingStudents}`;
      alert(msg);
      return;
    }

    const { schedule, reasons } = generatePlannerSchedule(strategy);
    setScheduleByDay(schedule);
    if (reasons.length) {
      alert('미배정:\n' + reasons.join('\n'));
    } else {
      alert('플래너 체크 자동 배정 완료');
    }
  };

  // Backup / import
  const exportToDesktop = () => {
    const data = {
      students,
      checkerTime,
      sessionDuration,
      scheduleByDay,
      noticeMessage,
      monthlyNotice
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'plannercheck_backup.json'; a.click();
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
        if (d.checkerTime) setCheckerTime(d.checkerTime);
        if (d.sessionDuration) setSessionDuration(d.sessionDuration);
        if (d.scheduleByDay) setScheduleByDay(d.scheduleByDay);
        if (d.noticeMessage) setNoticeMessage(d.noticeMessage);
        if (d.monthlyNotice) setMonthlyNotice(d.monthlyNotice);
        alert('데이터 불러오기 성공');
      } catch {
        alert('JSON 오류');
      }
    };
    reader.readAsText(file);
  };

  // summary for cards
  const summaryData = students.map(s => {
    const counts = days.reduce((o, d) => ({
      ...o,
      [d]: (scheduleByDay[d] || []).filter(x => x.student === s.name).length
    }), {});
    const assigned = Object.values(counts).reduce((a, b) => a + b, 0);
    const need = s.weeklySessions || 0;
    return { id: s.id, name: s.name, counts, missing: Math.max(0, need - assigned) };
  });

  // --- New summary at top ---
  const totalSessions = days.reduce(
    (sum, d) => sum + (scheduleByDay[d]?.length || 0),
    0
  );
  const assignedStudentsSet = new Set();
  days.forEach(d =>
    (scheduleByDay[d] || []).forEach(slot => assignedStudentsSet.add(slot.student))
  );
  const assignedStudentCount = assignedStudentsSet.size;

  const filteredStudents = students.filter(s =>
    s.name.includes(searchText)
  );

  return (
    <div className="space-y-6 p-4">
      {/* Top summary */}
      <div className="flex justify-between items-center mb-4">
        <div>배정된 학생 수: {assignedStudentCount}명</div>
        <div>총 세션 수: {totalSessions}회</div>
      </div>

      <h1 className="text-2xl font-bold">플래너 체크 관리</h1>

      {/* Search */}
      <input
        type="text"
        placeholder="학생 이름 검색"
        className="border px-3 py-1 rounded w-full max-w-sm"
        value={searchText}
        onChange={e => setSearchText(e.target.value)}
      />

      {/* Weekly sessions */}
      <table className="w-full text-center border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">이름</th>
            <th className="border p-2">주 횟수 (0–7)</th>
          </tr>
        </thead>
        <tbody>
          {filteredStudents.map(s => (
            <tr key={s.id}>
              <td className="border p-2">{s.name}</td>
              <td className="border p-2">
                <input
                  type="number"
                  min={0}
                  max={7}
                  className="w-16 border px-1 py-1 rounded"
                  value={s.weeklySessions}
                  onChange={e =>
                    setStudents(prev =>
                      prev.map(st =>
                        st.id === s.id
                          ? {
                              ...st,
                              weeklySessions: Math.min(
                                7,
                                Math.max(0, Number(e.target.value) || 0)
                              )
                            }
                          : st
                      )
                    )
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Checker hours & session */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">체커 근무시간 설정</h2>
        {days.map(d => (
        <div key={d} className="flex items-start gap-2">
          <span className="w-6 pt-2">{d}</span>
          <div className="flex flex-col gap-1">
            {[0, 1].map(i => {
              const range = (checkerTime[d] && checkerTime[d][i]) || { start: '', end: '' };
              return (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="time"
                    step="600"
                    className="border px-2 py-1 rounded"
                    value={range.start}
                    onChange={e => {
                      const updated = Array.isArray(checkerTime[d]) ? [...checkerTime[d]] : [{ start: '', end: '' }, { start: '', end: '' }];
                      updated[i].start = e.target.value;
                      setCheckerTime(prev => ({ ...prev, [d]: updated }));
                    }}
                  />
                  <span>~</span>
                  <input
                    type="time"
                    step="600"
                    className="border px-2 py-1 rounded"
                    value={range.end}
                    onChange={e => {
                      const updated = Array.isArray(checkerTime[d]) ? [...checkerTime[d]] : [{ start: '', end: '' }, { start: '', end: '' }];
                      updated[i].end = e.target.value;
                      setCheckerTime(prev => ({ ...prev, [d]: updated }));
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
        <div>
          <label className="block font-medium mb-1">세션 길이 (분)</label>
          <input
            type="number"
            min={10}
            max={60}
            step={10}
            className="border px-2 py-1 rounded w-20"
            value={sessionDuration}
            onChange={e => setSessionDuration(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {/* 기존 기본 버튼 */}
        <button
          onClick={handleAssignClick}
          className="px-4 py-2 bg-blue-700 text-white rounded"
        >
          자동 배정 시작하기
        </button>

        {/* 6개 요일 우선 버튼 */}
        <button onClick={() => handleAssignWithStrategy(STRATEGY.MON_FIRST)} className="px-3 py-2 bg-gray-700 text-white rounded">월 우선</button>
        <button onClick={() => handleAssignWithStrategy(STRATEGY.TUE_FIRST)} className="px-3 py-2 bg-gray-700 text-white rounded">화 우선</button>
        <button onClick={() => handleAssignWithStrategy(STRATEGY.WED_FIRST)} className="px-3 py-2 bg-gray-700 text-white rounded">수 우선</button>
        <button onClick={() => handleAssignWithStrategy(STRATEGY.THU_FIRST)} className="px-3 py-2 bg-gray-700 text-white rounded">목 우선</button>
        <button onClick={() => handleAssignWithStrategy(STRATEGY.FRI_FIRST)} className="px-3 py-2 bg-gray-700 text-white rounded">금 우선</button>
        <button onClick={() => handleAssignWithStrategy(STRATEGY.SAT_FIRST)} className="px-3 py-2 bg-gray-700 text-white rounded">토 우선</button>

        {/* 야간(21:00+) 우선 */}
        <button onClick={() => handleAssignWithStrategy(STRATEGY.NIGHT_FIRST)} className="px-3 py-2 bg-black text-white rounded">야간(21:00+) 우선</button>

        {/* ✅ 최대 배분(누락 최소) */}
        <button onClick={() => handleAssignWithStrategy(STRATEGY.MAX_COVER)} className="px-3 py-2 bg-emerald-600 text-white rounded">최대 배분(누락 최소)</button>

        {/* 백업/불러오기 */}
        <button onClick={exportToDesktop} className="px-4 py-2 bg-purple-600 text-white rounded">💾 백업 저장</button>
        <label className="px-4 py-2 bg-orange-500 text-white rounded cursor-pointer">
          📂 불러오기
          <input type="file" accept="application/json" onChange={importFromFile} className="hidden" />
        </label>
      </div>

      {/* Daily schedule */}
      <h2 className="text-xl font-semibold mt-6">요일별 플래너 체크 일정표</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {days.map(d => (
          <div key={d} className="border p-3 rounded shadow">
            <h3 className="font-bold mb-2">
              {d}요일 ({scheduleByDay[d]?.length || 0}명)
            </h3>
            {(scheduleByDay[d] || []).length > 0 ? (
              <ul className="space-y-1 text-sm">
                {scheduleByDay[d].map((slot, i) => (
                  <li key={i}>
                    {slot.start} ~ {slot.end} – {slot.student}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-gray-500 text-sm">스케줄 없음</div>
            )}
          </div>
        ))}
      </div>

      {/* Student summary cards */}
      <h2 className="text-xl font-semibold mt-6">학생별 배정 요약</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {summaryData.map(({ id, name, counts, missing }) => (
          <div key={id} className="border p-4 rounded shadow space-y-1">
            <h3 className="font-bold">{name}</h3>
            <ul className="text-sm">
              {days.map(d => (
                <li key={d}>
                  {d}: {counts[d]}회
                </li>
              ))}
            </ul>
            {missing > 0 ? (
              <div className="text-red-600">누락: {missing}회</div>
            ) : (
              <div className="text-green-600">완료</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
