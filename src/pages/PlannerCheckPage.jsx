// src/pages/PlannerCheckPage.jsx
import { useSchedule } from '../context/ScheduleContext';
import { timeToMinutes, minutesToTime, generateSlots } from '../utils/scheduler';
import React, { useState, useEffect, useMemo } from 'react';

const days = ["월", "화", "수", "목", "금", "토"];
const dayLabelByJs = ["일", "월", "화", "수", "목", "금", "토"];

const dayIndexMap = {
  "월": 0,
  "화": 1,
  "수": 2,
  "목": 3,
  "금": 4,
  "토": 5,
};

const n = v => String(v || '').trim();
const dayFromYmd = ymd => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(n(ymd));
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return '';
  return dayLabelByJs[d.getDay()] || '';
};

// 🔹 멘토링 기준 요일 계산
const getMentoringAnchorDay = ({
  student,
  mentorsByDay,
  attendanceByPeriod,
  currentPeriodId,
}) => {
  // 재학생: 이번 주 확정 멘토 요일
  if (!student.isNewStudent) {
    return student?.mentorHistory?.[currentPeriodId]?.day || null;
  }

  // 신입생: 선택멘토 + 출결 겹치는 요일 중 월→토 가장 앞 요일
  const mentorName = student.selectedMentor;
  if (!mentorName) return null;

  for (const day of days) {
    const mentors = mentorsByDay[day] || [];
    const hasMentor = mentors.some(m => m.name === mentorName);
    const hasAttendance =
      attendanceByPeriod?.[currentPeriodId]?.[student.id]?.[day];

    if (hasMentor && hasAttendance) {
      return day;
    }
  }

  return null;
};

const getDayDistance = (anchorDay, targetDay) => {
  if (!anchorDay) return 0;
  return Math.abs(dayIndexMap[targetDay] - dayIndexMap[anchorDay]);
};

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

function normalizeAttendancePair(value) {
  if (Array.isArray(value) && value.length === 2) {
    const [a, b] = value;
    if (!a || !b) return null;
    return [a.trim(), b.trim()];
  }
  return null;
}

export default function PlannerCheckPage() {
  const {
    students,
    setStudents,
    attendance,
    mentorsByDay,
    currentPeriodId,
    plannerCheckTime: checkerTime,
    setPlannerCheckTime: setCheckerTime,
    plannerSessionDuration: sessionDuration,
    setPlannerSessionDuration: setSessionDuration,
    plannerScheduleByDay: scheduleByDay,
    setPlannerScheduleByDay: setScheduleByDay,
    noticeMessage,
    setNoticeMessage,
    monthlyNotice,
    setMonthlyNotice,
  } = useSchedule();

  const [searchText, setSearchText] = useState('');
  const [useMentoringDistance, setUseMentoringDistance] = useState(false); // ✅ 추가
  const isPlannerOptOut = student => student?.plannerOptOut === true;

  const togglePlannerOptOut = (studentId, checked) => {
    setStudents(prev =>
      prev.map(s => {
        if (s.id !== studentId) return s;
        const history = { ...(s.plannerHistory || {}) };
        if (currentPeriodId) {
          const rec = { ...(history[currentPeriodId] || {}) };
          if (checked) {
            delete rec.attended;
            delete rec.missedCarryOver;
            delete rec.missedDay;
            delete rec.manualApplied;
          }
          history[currentPeriodId] = rec;
        }
        return { ...s, plannerOptOut: checked, plannerHistory: history };
      })
    );

    if (checked) {
      setScheduleByDay(prev => {
        const next = { ...(prev || {}) };
        days.forEach(day => {
          next[day] = (next[day] || []).filter(
            slot => String(slot?.studentId) !== String(studentId)
          );
        });
        return next;
      });
    }
  };

  // Ensure weeklySessions ∈ [0,7]
  useEffect(() => {
    setStudents(prev =>
      prev.map(s => {
        const ws0 = Number.isInteger(s.weeklySessions) ? s.weeklySessions : 1;
        return { ...s, weeklySessions: Math.min(7, Math.max(0, ws0)) };
      })
    );
  }, [setStudents]);

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
  function evaluateSchedule(schedule, targetStudents) {
    const countsByStudent = new Map();
    days.forEach(d => {
      (schedule[d] || []).forEach(({ student }) => {
        countsByStudent.set(student, (countsByStudent.get(student) || 0) + 1);
      });
    });
    let totalMissing = 0;
    let missingStudents = 0;
    let totalAssigned = 0;
    targetStudents.forEach(s => {
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
    const targetStudents = students.filter(s => !isPlannerOptOut(s));
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
    const nStudents = targetStudents.length;
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
    const studentWithTime = targetStudents.map((s, i) => {
      const logs = s.attendance || {};
      const total = Object.values(logs).reduce((sum, [start, end]) => {
        return sum + (timeToMinutes(end) - timeToMinutes(start));
      }, 0);
      return { index: i, total };
    }).sort((a, b) => a.total - b.total);

    // S -> student
    studentWithTime.forEach(({ index: i }) => {
      const u = studentStart + i;
      const w = targetStudents[i].weeklySessions || 0;
      if (w > 0) addEdge(S, u, w);
    });

    // ✅ 핵심 수정: student -> student-day 엣지 추가 순서를 전략별 요일 순서로
    targetStudents.forEach((s, i) => {
      const u = studentStart + i;

      let order =
        (strategy && strategy !== STRATEGY.NIGHT_FIRST)
          ? getDayOrderByStrategy(strategy)
          : days;

      // ✅ 멘토링 기준 거리 고려 옵션
      if (useMentoringDistance) {
        const anchorDay = getMentoringAnchorDay({
          student: s,
          mentorsByDay,
          attendanceByPeriod: attendance,
          currentPeriodId,
        });

        if (anchorDay) {
          order = [...order].sort((a, b) => {
            const da = getDayDistance(anchorDay, a);
            const db = getDayDistance(anchorDay, b);
            if (da !== db) return db - da;           // 🔥 거리 큰 요일 우선
            return dayIndexMap[a] - dayIndexMap[b]; // 월 → 토 안정 정렬
          });
        }
      }

      order.forEach(day => {
        const di = days.indexOf(day);
        const v = studentDayStart + i * nDays + di;
        addEdge(u, v, 1);
      });
    });


    // student-day -> slot (if eligible)
    // allSlots의 현재 순서가 BFS 순서에 반영됨
    targetStudents.forEach((s, i) => {
      for (let di = 0; di < nDays; di++) {

        // 🔥 실제 출결 구조로 접근
        const raw =
          attendance?.[currentPeriodId]?.[s.id]?.[days[di]];

        const att = normalizeAttendancePair(raw);
        if (!att) continue;

        const s0 = timeToMinutes(att[0]);
        const s1 = timeToMinutes(att[1]);
        const uDay = studentDayStart + i * nDays + di;

        allSlots.forEach((slot, j) => {
          if (slot.di !== di) return;

          const slotStartMin = timeToMinutes(slot.start);
          const slotEndMin   = timeToMinutes(slot.end);

          // 🔥 실질적으로 겹치면 허용
          if (Math.min(s1, slotEndMin) - Math.max(s0, slotStartMin) >= sessionDuration) {
            const v = slotStart + j;
            addEdge(uDay, v, 1);
          }
        });
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
    targetStudents.forEach((s, i) => {
      let assigned = 0;
      for (let j = 0; j < nSlots; j++) {
        const slot = allSlots[j];
        const vSlot = slotStart + j;
        const uDay = studentDayStart + i * nDays + slot.di;
        if (cap[vSlot][uDay] > 0) {
          schedule[slot.day].push({
            start: slot.start,
            end: slot.end,
            student: s.name,
            studentId: s.id   // 🔥 추가
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

    return { schedule, reasons, targetStudents };
  };

  const generatePlannerScheduleByDistance = () => {
    const newSchedule = {
      "월": [], "화": [], "수": [], "목": [], "금": [], "토": []
    };

    const usedSlots = {
      "월": [], "화": [], "수": [], "목": [], "금": [], "토": []
    };

    const targetStudents = students.filter(student => !isPlannerOptOut(student));

    targetStudents.forEach(student => {
      const anchorDay = getMentoringAnchorDay({
        student,
        mentorsByDay,
        attendanceByPeriod: attendance,
        currentPeriodId,
      });

      const candidateDays = days
        .filter(day => {
          const att = attendance?.[currentPeriodId]?.[student.id]?.[day];
          return Array.isArray(att) && att[0] && att[1];
        })
        .sort((a, b) => {
          const da = getDayDistance(anchorDay, a);
          const db = getDayDistance(anchorDay, b);
          if (da !== db) return db - da;          // 거리 큰 요일 우선
          return dayIndexMap[a] - dayIndexMap[b]; // 월 → 화 → 수 → 목 → 금 → 토
        });

      let assigned = false;

      for (const day of candidateDays) {
        const ranges = checkerTime?.[day] || [];

        for (const range of ranges) {
          if (!range.start || !range.end) continue;

          const slots = generateSlots(
            range.start,
            range.end,
            sessionDuration
          );

          for (const slot of slots) {
            const isUsed = usedSlots[day].some(
              s => s.start === slot.start && s.end === slot.end
            );
            if (isUsed) continue;

            newSchedule[day].push({
              studentId: student.id,
              student: student.name,
              start: slot.start,
              end: slot.end,
            });

            usedSlots[day].push(slot);
            assigned = true;
            break;
          }

          if (assigned) break;
        }

        if (assigned) break;
      }
    });

    setScheduleByDay(newSchedule);
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
        const { schedule, reasons, targetStudents } = generatePlannerSchedule(name);
        const score = evaluateSchedule(schedule, targetStudents);
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
    if (isPlannerOptOut(s)) {
      return { id: s.id, name: s.name, counts, missing: 0, optOut: true };
    }
    const need = s.weeklySessions || 0;
    return { id: s.id, name: s.name, counts, missing: Math.max(0, need - assigned), optOut: false };
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

  const hasPlannerSessionForStudentDay = (student, day) =>
    (scheduleByDay?.[day] || []).some(
      slot =>
        String(slot?.studentId) === String(student.id) ||
        n(slot?.student) === n(student.name)
    );

  const toggleTotalMentoringMissed = (studentId, day) =>
    setStudents(prev =>
      prev.map(s => {
        if (s.id !== studentId || !currentPeriodId) return s;
        if (isPlannerOptOut(s)) return s;
        const history = { ...(s.plannerHistory || {}) };
        const rec = { ...(history[currentPeriodId] || {}) };
        rec.day = rec.day || day;

        if (rec.attended === false && rec.missedDay === day) {
          rec.attended = true;
          rec.missedCarryOver = false;
          rec.missedDay = undefined;
          rec.manualApplied = false;
        } else {
          rec.attended = false;
          rec.missedCarryOver = true;
          rec.missedDay = day;
          rec.manualApplied = false;
        }

        history[currentPeriodId] = rec;
        return { ...s, plannerHistory: history };
      })
    );

  const missedTotalMentoringRows = useMemo(
    () =>
      students
        .map(s => {
          if (isPlannerOptOut(s)) return null;
          const rec = s?.plannerHistory?.[currentPeriodId];
          if (!rec || rec.attended !== false || !rec.missedDay) return null;
          return {
            studentId: s.id,
            studentName: s.name,
            missedDay: n(rec.missedDay),
            missedReason: n(rec.missedReason),
            manualManager: n(rec.manualManager),
            rescheduleDate: n(rec.rescheduleDate),
          };
        })
        .filter(Boolean),
    [students, currentPeriodId]
  );

  const updateMissedTotalMentoringMeta = (studentId, patch) =>
    setStudents(prev =>
      prev.map(s => {
        if (s.id !== studentId || !currentPeriodId) return s;
        const history = { ...(s.plannerHistory || {}) };
        const rec = { ...(history[currentPeriodId] || {}) };
        history[currentPeriodId] = { ...rec, ...patch };
        return { ...s, plannerHistory: history };
      })
    );

  const applyManualTotalMentoringReassign = (studentId, managerFromRow = '', missedDayFromRow = '') => {
    if (!currentPeriodId) return;

    const target = students.find(s => s.id === studentId);
    if (!target) return;
    if (isPlannerOptOut(target)) {
      window.alert('플래너체크 미희망 인원은 수동 재배정 대상이 아닙니다.');
      return;
    }
    const rec = target?.plannerHistory?.[currentPeriodId] || {};
    const manualManager = n(managerFromRow) || n(rec.manualManager);
    const rescheduleDate = n(rec.rescheduleDate);
    const rescheduleDay = dayFromYmd(rescheduleDate) || n(missedDayFromRow) || n(rec.missedDay) || '';

    if (!manualManager) {
      window.alert('수동 배정 담당자를 먼저 입력해 주세요.');
      return;
    }

    setStudents(prev =>
      prev.map(s => {
        if (s.id !== studentId) return s;
        const history = { ...(s.plannerHistory || {}) };
        const recNow = { ...(history[currentPeriodId] || {}) };
        history[currentPeriodId] = {
          ...recNow,
          manualManager,
          rescheduleDate,
          rescheduleDay,
          day: rescheduleDay,
          manualApplied: true,
        };
        return { ...s, plannerHistory: history };
      })
    );

    window.alert(
      `${target.name}\n수동 배정 담당자: ${manualManager}\n재진행 날짜: ${rescheduleDate || '-'}\n재진행 요일: ${
        rescheduleDay || '-'
      }`
    );
  };

  return (
    <div className="space-y-6 p-4">
      {/* Top summary */}
      <div className="flex justify-between items-center mb-4">
        <div>배정된 학생 수: {assignedStudentCount}명</div>
        <div>총 세션 수: {totalSessions}회</div>
      </div>

      <h1 className="text-2xl font-bold">플래너 체크 관리</h1>

      <div className="border rounded p-3 bg-white">
        <div className="font-semibold mb-2">플래너체크 미희망 인원 선택</div>
        <div className="flex flex-wrap gap-3">
          {students.map(s => (
            <label key={`planner-optout-${s.id}`} className="inline-flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={Boolean(s?.plannerOptOut)}
                onChange={e => togglePlannerOptOut(s.id, e.target.checked)}
              />
              <span>{s.name}</span>
            </label>
          ))}
        </div>
        <div className="text-xs text-gray-500 mt-2">
          선택된 학생은 총괄멘토링(플래너 체크) 자동 배정에서 제외됩니다.
        </div>
      </div>

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
            <tr key={s.id} className={isPlannerOptOut(s) ? 'opacity-40 bg-gray-50' : ''}>
              <td className="border p-2">{s.name}</td>
              <td className="border p-2">
                <input
                  type="number"
                  min={0}
                  max={7}
                  className="w-16 border px-1 py-1 rounded"
                  value={s.weeklySessions}
                  disabled={isPlannerOptOut(s)}
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
      <div className="flex items-center gap-4 mb-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={useMentoringDistance}
            onChange={e => setUseMentoringDistance(e.target.checked)}
          />
          멘토링 기준 거리 고려
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleAssignClick}
          className="px-4 py-2 bg-blue-700 text-white rounded"
        >
          자동 배정 시작하기
        </button>      
        <button
          onClick={generatePlannerScheduleByDistance}
          className="ml-2 bg-indigo-600 text-white px-3 py-1 rounded"
        >
          멘토링 기준 거리 자동배정
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

      <div>
        <h2 className="text-xl font-semibold mt-6 mb-2">이번주 총괄멘토링 누락 선택</h2>
        <div className="overflow-x-auto border rounded">
          <table className="w-full border-collapse text-center">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-2 py-2">학생</th>
                {days.map(day => (
                  <th key={day} className="border px-2 py-2">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id} className={isPlannerOptOut(s) ? 'opacity-40 bg-gray-50' : ''}>
                  <td className="border px-2 py-2 font-medium">{s.name}</td>
                  {days.map(day => {
                    const hasTotalMentoring = hasPlannerSessionForStudentDay(s, day);
                    const rec = s?.plannerHistory?.[currentPeriodId];
                    const miss = rec?.attended === false && rec?.missedDay === day;
                    const carry = rec?.missedCarryOver === true && rec?.missedDay === day;
                    const manualApplied = rec?.manualApplied === true && rec?.missedDay === day;

                    return (
                      <td key={`${s.id}-${day}`} className="border px-2 py-2 align-top">
                        {hasTotalMentoring ? (
                          <button
                            className={`rounded px-2 py-0.5 text-sm ${
                              manualApplied
                                ? 'bg-green-200'
                                : carry
                                ? 'bg-red-200'
                                : miss
                                ? 'bg-orange-200'
                                : 'bg-yellow-100 hover:bg-yellow-200'
                            }`}
                            disabled={isPlannerOptOut(s)}
                            onClick={() => toggleTotalMentoringMissed(s.id, day)}
                          >
                            {isPlannerOptOut(s)
                              ? '총괄멘토링(미희망)'
                              : manualApplied
                              ? '총괄멘토링(재배정)'
                              : carry
                              ? '총괄멘토링(이월)'
                              : miss
                              ? '총괄멘토링(누락)'
                              : '총괄멘토링'}
                          </button>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">누락 총괄멘토링 사유 및 재배정 관리</h2>
        <div className="overflow-x-auto border rounded">
          <table className="w-full border-collapse text-center text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-2 py-2">학생</th>
                <th className="border px-2 py-2">누락 요일</th>
                <th className="border px-2 py-2">누락 사유</th>
                <th className="border px-2 py-2">수동 배정 담당자</th>
                <th className="border px-2 py-2">재진행 날짜</th>
                <th className="border px-2 py-2">적용</th>
              </tr>
            </thead>
            <tbody>
              {missedTotalMentoringRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="border px-2 py-4 text-gray-500">
                    누락된 총괄멘토링이 없습니다.
                  </td>
                </tr>
              ) : (
                missedTotalMentoringRows.map(row => (
                  <tr key={`planner-missed-${row.studentId}`}>
                    <td className="border px-2 py-2 font-medium">{row.studentName}</td>
                    <td className="border px-2 py-2">{row.missedDay || '-'}</td>
                    <td className="border px-2 py-2 min-w-[220px]">
                      <input
                        className="border rounded px-2 py-1 w-full"
                        placeholder="예: 학생 컨디션 저하"
                        value={row.missedReason}
                        onChange={e =>
                          updateMissedTotalMentoringMeta(row.studentId, {
                            missedReason: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td className="border px-2 py-2 min-w-[170px]">
                      <input
                        className="border rounded px-2 py-1 w-full"
                        placeholder="담당자 이름 입력"
                        value={row.manualManager}
                        onChange={e =>
                          updateMissedTotalMentoringMeta(row.studentId, {
                            manualManager: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td className="border px-2 py-2 min-w-[160px]">
                      <input
                        className="border rounded px-2 py-1 w-full"
                        type="date"
                        value={row.rescheduleDate}
                        onChange={e =>
                          updateMissedTotalMentoringMeta(row.studentId, {
                            rescheduleDate: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td className="border px-2 py-2">
                      <button
                        className="bg-blue-600 text-white px-2 py-1 rounded text-xs"
                        onClick={() =>
                          applyManualTotalMentoringReassign(
                            row.studentId,
                            row.manualManager,
                            row.missedDay
                          )
                        }
                      >
                        수동 배정 적용
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          수동 배정 적용 시 해당 학생의 총괄멘토링 누락 건에 재배정 정보가 저장됩니다.
        </div>
      </div>

      {/* Student summary cards */}
      <h2 className="text-xl font-semibold mt-6">학생별 배정 요약</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {summaryData.map(({ id, name, counts, missing, optOut }) => (
          <div key={id} className={`border p-4 rounded shadow space-y-1 ${optOut ? 'opacity-40 bg-gray-50' : ''}`}>
            <h3 className="font-bold">{name}</h3>
            <ul className="text-sm">
              {days.map(d => (
                <li key={d}>
                  {d}: {counts[d]}회
                </li>
              ))}
            </ul>
            {optOut ? (
              <div className="text-gray-600">미희망(배정 제외)</div>
            ) : missing > 0 ? (
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
