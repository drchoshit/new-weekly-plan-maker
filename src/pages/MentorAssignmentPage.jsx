import React, { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { useSchedule } from "../context/ScheduleContext";
import StudentMentorOverlapTable from "../components/StudentMentorOverlapTable";

const DAYS = ["\uC6D4", "\uD654", "\uC218", "\uBAA9", "\uAE08", "\uD1A0"];
const DAY_LABEL_BY_JS = ["\uC77C", "\uC6D4", "\uD654", "\uC218", "\uBAA9", "\uAE08", "\uD1A0"];
const KOREAN = ["\uC5B8\uB9E4", "\uD654\uC791", "\uACF5\uD1B5"].map(v => ({ value: v, label: v }));
const MATH = ["\uBBF8\uC801", "\uD655\uD1B5", "\uAE30\uD558", "\uACF5\uD1B5"].map(v => ({
  value: v,
  label: v,
}));
const EXPLORE = [
  "\uD1B5\uD569\uC0AC\uD68C",
  "\uC138\uACC4\uC9C0\uB9AC",
  "\uD55C\uAD6D\uC9C0\uB9AC",
  "\uC138\uACC4\uC0AC",
  "\uB3D9\uC544\uC2DC\uC544\uC0AC",
  "\uACBD\uC81C",
  "\uC815\uCE58\uC640 \uBC95",
  "\uC0AC\uD68C\uBB38\uD654",
  "\uC0DD\uD65C\uACFC \uC724\uB9AC",
  "\uC724\uB9AC\uC640 \uC0AC\uC0C1",
  "\uD1B5\uD569\uACFC\uD559",
  "\uACFC\uD559\uD0D0\uAD6C \uC2E4\uD5D8",
  "\uBB3C\uB9AC\uD5591",
  "\uD654\uD5591",
  "\uC0DD\uBA85\uACFC\uD5591",
  "\uC9C0\uAD6C\uACFC\uD5591",
  "\uBB3C\uB9AC\uD5592",
  "\uD654\uD5592",
  "\uC0DD\uBA85\uACFC\uD5592",
  "\uC9C0\uAD6C\uACFC\uD5592",
].map(v => ({ value: v, label: v }));
const PERSONALITY_OPTIONS = [
  "",
  "\uBE44\uADF9\uB2E8\uC801",
  "\uADF9I",
  "\uADF9E",
].map(v => ({ value: v, label: v || "\uC120\uD0DD" }));

const n = v => String(v || "").trim();
const dayFromYmd = ymd => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(n(ymd));
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return "";
  return DAY_LABEL_BY_JS[d.getDay()] || "";
};
const isExtremeI = value => {
  const cleaned = n(value).toUpperCase().replace(/\s+/g, "");
  return (
    cleaned === "\uADF9I" ||
    cleaned === "EXTREMEI" ||
    cleaned === "EXTREME_I" ||
    cleaned === "I"
  );
};
const isExtremeIConflict = (studentPersonality, mentorPersonality) =>
  isExtremeI(studentPersonality) && isExtremeI(mentorPersonality);
const toMin = t => {
  if (!t || !String(t).includes(":")) return NaN;
  const [h, m] = String(t).split(":").map(Number);
  return Number.isNaN(h) || Number.isNaN(m) ? NaN : h * 60 + m;
};
const pair = v => {
  if (Array.isArray(v)) {
    const a = n(v[0]);
    const b = n(v[1]);
    return a && b ? [a, b] : null;
  }
  const s = n(v)
    .replace(/[∼〜～]/g, "~")
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, "");
  if (!s) return null;
  const d = s.includes("~") ? "~" : s.includes("-") ? "-" : null;
  if (!d) return null;
  const p = s.split(d);
  return p.length === 2 ? [p[0], p[1]] : null;
};
const ranges = raw =>
  String(raw || "")
    .replace(/[∼〜～]/g, "~")
    .replace(/[–—−]/g, "-")
    .split(/[,/|\n]+/)
    .map(v => n(v).replace(/\s+/g, ""))
    .filter(Boolean)
    .map(v => {
      const d = v.includes("~") ? "~" : v.includes("-") ? "-" : null;
      if (!d) return null;
      const [a, b] = v.split(d);
      const st = toMin(a);
      let en = toMin(b);
      if (Number.isNaN(st) || Number.isNaN(en)) return null;
      if (en < st) en += 1440;
      return { st, en };
    })
    .filter(Boolean);
const mTime = m =>
  m?.time ?? m?.workTime ?? m?.workingTime ?? m?.workingHours ?? m?.hours ?? "";
const overlap = (sTime, mentorTime) => {
  const p = pair(sTime);
  if (!p) return 0;
  const st = toMin(p[0]);
  let en = toMin(p[1]);
  if (Number.isNaN(st) || Number.isNaN(en)) return 0;
  if (en < st) en += 1440;
  let mx = 0;
  ranges(mentorTime).forEach(r => {
    mx = Math.max(mx, Math.min(en, r.en) - Math.max(st, r.st));
  });
  return Math.max(0, mx);
};
const workingDays = (mentorName, byDay) =>
  DAYS.filter(day => (byDay?.[day] || []).some(m => n(m?.name) === n(mentorName)));
const nextWeekGap = (prev, curr) => {
  const a = DAYS.indexOf(prev);
  const b = DAYS.indexOf(curr);
  if (a < 0 || b < 0) return null;
  // 이번 주 prev 요일에서 "다음 주 curr 요일"까지의 실제 간격
  return 7 - (a + 1) + (b + 1);
};
const periodPriority = gap => {
  if (!gap || gap < 5) return null;
  // 7일(같은 요일)과 가까울수록 우선
  return Math.abs(gap - 7);
};
const sortedPeriods = periods =>
  (periods || []).filter(p => p?.id).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
const mentorProfiles = byDay => {
  const map = new Map();
  DAYS.forEach(day =>
    (byDay?.[day] || []).forEach(m => {
      const name = n(m?.name);
      if (!name) return;
      if (!map.has(name)) map.set(name, { math: new Set(), exp: new Set() });
      const p = map.get(name);
      if (m?.mathSubject) p.math.add(m.mathSubject);
      if (m?.explore1) p.exp.add(m.explore1);
      if (m?.explore2) p.exp.add(m.explore2);
    })
  );
  return map;
};

const DAY_SET = new Set(DAYS);
const toClock = minutes => {
  const safe = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  const h = String(Math.floor(safe / 60)).padStart(2, "0");
  const m = String(safe % 60).padStart(2, "0");
  return `${h}:${m}`;
};
const normalizeTimeRangePair = value => {
  const p = pair(value);
  if (!p) return null;
  const st = toMin(p[0]);
  let en = toMin(p[1]);
  if (Number.isNaN(st) || Number.isNaN(en)) return null;
  if (en < st) en += 1440;
  return { st, en };
};
const overlapRange = (aStart, aEnd, bStart, bEnd) =>
  Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
const buildSlotsFromMentorTime = (mentorTime, durationMinutes) => {
  const duration = Math.max(10, Number(durationMinutes) || 20);
  const out = [];
  ranges(mentorTime).forEach(r => {
    let cur = r.st;
    while (cur + duration <= r.en) {
      out.push({
        start: toClock(cur),
        end: toClock(cur + duration),
        startMin: cur,
        endMin: cur + duration,
      });
      cur += duration;
    }
  });
  return out;
};
const runMaxFlow = (capacity, adjacency, source, sink) => {
  const parent = Array(capacity.length).fill(-1);

  while (true) {
    const visited = Array(capacity.length).fill(false);
    const queue = [source];
    visited[source] = true;
    parent.fill(-1);

    while (queue.length && !visited[sink]) {
      const u = queue.shift();
      for (const v of adjacency[u]) {
        if (!visited[v] && capacity[u][v] > 0) {
          visited[v] = true;
          parent[v] = u;
          queue.push(v);
        }
      }
    }

    if (!visited[sink]) break;

    let flow = Infinity;
    for (let v = sink; v !== source; v = parent[v]) {
      const u = parent[v];
      flow = Math.min(flow, capacity[u][v]);
    }

    for (let v = sink; v !== source; v = parent[v]) {
      const u = parent[v];
      capacity[u][v] -= flow;
      capacity[v][u] += flow;
    }
  }
};

export default function MentorAssignmentPage() {
  const {
    students,
    setStudents,
    mentorsByDay,
    attendance,
    selectedPeriod,
    periods,
    assignments,
    setAssignments,
    plannerScheduleByDay,
  } = useSchedule();

  const [maxPerMentor, setMaxPerMentor] = useState(6);
  const [sessionDuration, setSessionDuration] = useState(() => {
    const saved = Number(localStorage.getItem("mentorSessionDuration"));
    return Number.isFinite(saved) && saved >= 10 ? saved : 20;
  });
  const [popup, setPopup] = useState({ title: "", text: "" });
  const closePopup = () => setPopup({ title: "", text: "" });
  const minOverlapRequired = Math.max(10, Number(sessionDuration) || 20);

  useEffect(() => {
    localStorage.setItem("mentorSessionDuration", String(minOverlapRequired));
  }, [minOverlapRequired]);

  const pList = useMemo(() => sortedPeriods(periods), [periods]);
  const prevPeriodId = useMemo(() => {
    const idx = pList.findIndex(p => p.id === selectedPeriod);
    return idx > 0 ? pList[idx - 1].id : null;
  }, [pList, selectedPeriod]);
  const profiles = useMemo(() => mentorProfiles(mentorsByDay), [mentorsByDay]);
  const mentorNames = useMemo(
    () => Array.from(profiles.keys()).sort((a, b) => a.localeCompare(b, "ko")),
    [profiles]
  );
  const periodAttendance = attendance?.[selectedPeriod] || {};
  const aMap = useMemo(() => {
    const m = new Map();
    (assignments || []).forEach(a => m.set(a.studentId, a));
    return m;
  }, [assignments]);
  const isMentoringOptOut = student => student?.mentoringOptOut === true;
  const emptyAssignment = studentId => ({
    studentId,
    first: "",
    second: "",
    third: "",
    fourth: "",
    fifth: "",
    days: { first: "", second: "", third: "", fourth: "", fifth: "" },
    reasons: {
      first: "후보 없음",
      second: "후보 없음",
      third: "후보 없음",
      fourth: "후보 없음",
      fifth: "후보 없음",
    },
  });
  const clearCurrentMentoring = student => {
    const old = { ...(student?.mentorHistory?.[selectedPeriod] || {}) };
    delete old.mentor;
    delete old.day;
    delete old.autoRank;
    delete old.actualMentor;
    delete old.attended;
    delete old.missedCarryOver;
    delete old.missedDay;
    delete old.manualApplied;
    delete old.manualMentor;
    delete old.rescheduleDate;
    delete old.rescheduleDay;
    delete old.slotStart;
    delete old.slotEnd;
    delete old.sessionMinutes;
    return {
      ...student,
      selectedMentor: "",
      selectedMentorDay: "",
      mentorHistory: {
        ...(student.mentorHistory || {}),
        [selectedPeriod]: old,
      },
    };
  };

  const prevRecord = student => {
    if (!prevPeriodId) return null;
    const r = student?.mentorHistory?.[prevPeriodId];
    return r?.mentor ? { mentor: n(r.mentor), day: n(r.day) || null } : null;
  };
  const activeMentor = student =>
    isMentoringOptOut(student)
      ? ""
      : n(student?.mentorHistory?.[selectedPeriod]?.actualMentor) ||
        n(student?.mentorHistory?.[selectedPeriod]?.mentor);

  const resolveFixedMentorDay = student => {
    const fixedMentor = n(student?.fixedMentor);
    if (!fixedMentor) return "";

    let best = { day: "", ov: -1 };
    DAYS.forEach(day => {
      const sTime = periodAttendance?.[student.id]?.[day];
      if (!sTime) return;
      const entries = (mentorsByDay?.[day] || []).filter(m => n(m?.name) === fixedMentor);
      if (!entries.length) return;
      entries.forEach(entry => {
        const ov = overlap(sTime, mTime(entry));
        if (ov > best.ov) best = { day, ov };
      });
    });

    return best.day || workingDays(fixedMentor, mentorsByDay)[0] || "";
  };

  const hasAnyOverlapWithMentor = (student, mentorName) => {
    const mentor = n(mentorName);
    if (!mentor) return false;
    for (const day of DAYS) {
      const sTime = periodAttendance?.[student.id]?.[day];
      if (!sTime) continue;
      const entries = (mentorsByDay?.[day] || []).filter(m => n(m?.name) === mentor);
      if (!entries.length) continue;
      if (entries.some(entry => overlap(sTime, mTime(entry)) >= minOverlapRequired)) return true;
    }
    return false;
  };

  const buildCandidates = student => {
    if (isMentoringOptOut(student)) return [];
    const excluded = new Set(
      [student?.bannedMentor1, student?.bannedMentor2]
        .filter(Boolean)
        .flatMap(v => String(v).split(",").map(x => x.trim()).filter(Boolean))
    );
    const prev = prevRecord(student);
    const names = mentorNames;
    const cand = [];
    const studentPersonality = n(student?.personality);

    names.forEach(name => {
      if (!name) return;
      if (excluded.has(name)) return;
      workingDays(name, mentorsByDay).forEach(day => {
        const sTime = periodAttendance?.[student.id]?.[day];
        if (!sTime) return;
        const entries = (mentorsByDay?.[day] || []).filter(m => n(m?.name) === name);
        if (!entries.length) return;
        const compatible = entries.filter(
          entry => !isExtremeIConflict(studentPersonality, entry?.personality)
        );
        if (!compatible.length) return;
        const ov = compatible.reduce((mx, e) => Math.max(mx, overlap(sTime, mTime(e))), 0);
        if (ov < minOverlapRequired) return; // 1순위 필수
        const gap = prev?.day ? nextWeekGap(prev.day, day) : null;
        const rawPeriodScore = prev?.day ? periodPriority(gap) : 0;
        const gapRuleMet = !prev?.day || rawPeriodScore !== null;
        const pScore = gapRuleMet ? rawPeriodScore ?? 0 : 100;

        const p = profiles.get(name);
        const exp =
          Boolean(student?.explore1 && p?.exp?.has(student.explore1)) ||
          Boolean(student?.explore2 && p?.exp?.has(student.explore2));
        const math = Boolean(student?.math && p?.math?.has(student.math));

        // 멘토가 여러 요일 근무하면 (멘토, 요일) 각각 독립 후보로 취급
        cand.push({
          mentor: name,
          day,
          ov,
          gap,
          pScore,
          gapRuleMet,
          exp,
          math,
        });
      });
    });

    return cand.sort((a, b) => {
      // 2순위: 기간
      if ((a.pScore ?? 0) !== (b.pScore ?? 0)) return (a.pScore ?? 0) - (b.pScore ?? 0);
      if ((a.gap ?? 99) !== (b.gap ?? 99)) return (a.gap ?? 99) - (b.gap ?? 99);
      // 3순위: 탐구
      if (a.exp !== b.exp) return a.exp ? -1 : 1; // 3순위
      // 4순위: 수학
      if (a.math !== b.math) return a.math ? -1 : 1; // 4순위
      if (a.ov !== b.ov) return b.ov - a.ov;
      return a.mentor.localeCompare(b.mentor, "ko");
    });
  };

  const reasonText = (student, c) => {
    const prev = prevRecord(student);
    return [
      `시간 겹침: ${c.ov}분`,
      prev?.day
        ? `전주 요일 간격: ${prev.day} -> ${c.day} (${c.gap || 0}일)${
            c.gapRuleMet === false ? " [권장 간격 미달]" : ""
          }`
        : "전주 요일 기준 없음",
      `탐구 매칭: ${c.exp ? "일치" : "불일치"}`,
      `수학 매칭: ${c.math ? "일치" : "불일치"}`,
    ].join("\n");
  };

  const commitMentor = (student, mentorName, day) => {
    if (!selectedPeriod || !mentorName) return;
    const pickedDay = n(day) || workingDays(mentorName, mentorsByDay)[0] || "";
    setStudents(prev =>
      prev.map(s => {
        if (s.id !== student.id) return s;
        const old = s?.mentorHistory?.[selectedPeriod] || {};
        return {
          ...s,
          selectedMentor: mentorName,
          selectedMentorDay: pickedDay,
          initialMentor: s?.initialMentor?.mentor
            ? s.initialMentor
            : { mentor: mentorName, day: pickedDay, periodId: selectedPeriod, createdAt: Date.now() },
          mentorHistory: {
            ...(s.mentorHistory || {}),
            [selectedPeriod]: {
              ...old,
              mentor: mentorName,
              day: pickedDay,
              slotStart: undefined,
              slotEnd: undefined,
              sessionMinutes: undefined,
              attended: true,
              missedCarryOver: false,
              missedDay: undefined,
            },
          },
        };
      })
    );
  };

  const loadText = nextStudents => {
    const counts = {};
    nextStudents.forEach(s => {
      const m = activeMentor(s);
      if (!m) return;
      counts[m] = (counts[m] || 0) + 1;
    });
    const lines = Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
      .map(([m, c]) => `${m}: ${c}명`);
    return lines.length
      ? `멘토별 현재 배정 인원\n\n${lines.join("\n")}`
      : "배정된 멘토 없음";
  };

  const toggleMentoringOptOut = (studentId, checked) => {
    setStudents(prev =>
      prev.map(s => {
        if (s.id !== studentId) return s;
        const next = { ...s, mentoringOptOut: checked };
        if (!checked) return next;
        if (!selectedPeriod) {
          return { ...next, selectedMentor: "", selectedMentorDay: "" };
        }
        return clearCurrentMentoring(next);
      })
    );

    if (checked) {
      setAssignments(prev =>
        (prev || []).map(a => (a.studentId === studentId ? emptyAssignment(studentId) : a))
      );
    }
  };

  const autoAssign = () => {
    if (!selectedPeriod) return window.alert("기준 주차를 먼저 선택해 주세요.");
    const assignableStudents = students.filter(s => !isMentoringOptOut(s));
    const byStudent = {};
    assignableStudents.forEach(s => {
      byStudent[s.id] = buildCandidates(s);
    });
    const loads = {};
    const pick = {};
    const keyByMentorDay = (mentor, day) => `${n(mentor)}@@${n(day)}`;
    const keyBySlot = (mentor, day, idx) => `${n(mentor)}@@${n(day)}@@${idx}`;

    const mentorDaySlots = {};
    DAYS.forEach(day => {
      (mentorsByDay?.[day] || []).forEach(entry => {
        const mentor = n(entry?.name);
        if (!mentor) return;
        const mdKey = keyByMentorDay(mentor, day);
        if (!mentorDaySlots[mdKey]) mentorDaySlots[mdKey] = [];
        mentorDaySlots[mdKey].push(
          ...buildSlotsFromMentorTime(mTime(entry), minOverlapRequired).map(slot => ({
            ...slot,
            mentor,
            day,
          }))
        );
      });
    });
    Object.keys(mentorDaySlots).forEach(key => {
      mentorDaySlots[key].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
    });

    const buildEligibleSlotRefs = (student, candidates) => {
      const attByDay = periodAttendance?.[student.id] || {};
      const slotMap = new Map();
      (candidates || []).forEach(c => {
        const mdKey = keyByMentorDay(c.mentor, c.day);
        const slots = mentorDaySlots[mdKey] || [];
        if (!slots.length) return;
        const att = normalizeTimeRangePair(attByDay?.[c.day]);
        if (!att) return;
        slots.forEach((slot, idx) => {
          const ov = overlapRange(att.st, att.en, slot.startMin, slot.endMin);
          if (ov < minOverlapRequired) return;
          const sKey = keyBySlot(c.mentor, c.day, idx);
          const prevEntry = slotMap.get(sKey);
          const nextEntry = {
            key: sKey,
            candidate: {
              ...c,
              ov: Math.max(c.ov || 0, ov),
              slotStart: slot.start,
              slotEnd: slot.end,
              slotIndex: idx,
            },
          };
          if (!prevEntry) {
            slotMap.set(sKey, nextEntry);
            return;
          }
          const prevScore =
            (prevEntry.candidate?.pScore ?? 0) * 10000 +
            (prevEntry.candidate?.exp ? 0 : 1000) +
            (prevEntry.candidate?.math ? 0 : 100) -
            (prevEntry.candidate?.ov ?? 0);
          const nextScore =
            (nextEntry.candidate?.pScore ?? 0) * 10000 +
            (nextEntry.candidate?.exp ? 0 : 1000) +
            (nextEntry.candidate?.math ? 0 : 100) -
            (nextEntry.candidate?.ov ?? 0);
          if (nextScore < prevScore) slotMap.set(sKey, nextEntry);
        });
      });
      return Array.from(slotMap.values()).sort((a, b) => {
        if ((a.candidate.pScore ?? 0) !== (b.candidate.pScore ?? 0)) {
          return (a.candidate.pScore ?? 0) - (b.candidate.pScore ?? 0);
        }
        if (a.candidate.exp !== b.candidate.exp) return a.candidate.exp ? -1 : 1;
        if (a.candidate.math !== b.candidate.math) return a.candidate.math ? -1 : 1;
        if ((a.candidate.ov ?? 0) !== (b.candidate.ov ?? 0)) {
          return (b.candidate.ov ?? 0) - (a.candidate.ov ?? 0);
        }
        if (a.candidate.mentor !== b.candidate.mentor) {
          return String(a.candidate.mentor || "").localeCompare(String(b.candidate.mentor || ""), "ko");
        }
        if (a.candidate.day !== b.candidate.day) {
          return DAYS.indexOf(a.candidate.day) - DAYS.indexOf(b.candidate.day);
        }
        return (a.candidate.slotIndex ?? 0) - (b.candidate.slotIndex ?? 0);
      });
    };

    const effectiveCandidatesByStudent = {};
    const studentEligibleSlotsById = {};

    assignableStudents.forEach(s => {
      const fixed = n(s?.fixedMentor);
      const base = byStudent[s.id] || [];
      const withSlots = base.filter(c => (mentorDaySlots[keyByMentorDay(c.mentor, c.day)] || []).length > 0);
      const fixedPool = fixed ? withSlots.filter(c => c.mentor === fixed) : [];
      const preferred = fixedPool.length ? fixedPool : withSlots;
      const fallback = fixedPool.length ? withSlots : [];

      let eligibleSlots = buildEligibleSlotRefs(s, preferred);
      let rankPool = preferred;
      if (!eligibleSlots.length && fallback.length) {
        eligibleSlots = buildEligibleSlotRefs(s, fallback);
        rankPool = fallback;
      }

      effectiveCandidatesByStudent[s.id] = rankPool;
      studentEligibleSlotsById[s.id] = eligibleSlots;
    });

    const flowStudents = assignableStudents.filter(s => (studentEligibleSlotsById[s.id] || []).length > 0);
    const slotKeys = Array.from(
      new Set(flowStudents.flatMap(s => (studentEligibleSlotsById[s.id] || []).map(item => item.key)))
    );
    const mentorNamesFromFlow = Array.from(
      new Set(slotKeys.map(key => String(key).split("@@")[0] || "").filter(Boolean))
    );

    const S = 0;
    const studentStart = 1;
    const slotStart = studentStart + flowStudents.length;
    const mentorStart = slotStart + slotKeys.length;
    const T = mentorStart + mentorNamesFromFlow.length;
    const N = T + 1;

    const cap = Array.from({ length: N }, () => Array(N).fill(0));
    const adj = Array.from({ length: N }, () => []);
    const studentNodeById = new Map();
    const slotNodeByKey = new Map();
    const mentorNodeByName = new Map();

    const addEdge = (u, v, c) => {
      if (!adj[u].includes(v)) adj[u].push(v);
      if (!adj[v].includes(u)) adj[v].push(u);
      cap[u][v] += c;
    };

    flowStudents.forEach((s, idx) => {
      const node = studentStart + idx;
      studentNodeById.set(s.id, node);
      addEdge(S, node, 1);
    });

    slotKeys.forEach((key, idx) => {
      slotNodeByKey.set(key, slotStart + idx);
    });

    mentorNamesFromFlow.forEach((name, idx) => {
      const node = mentorStart + idx;
      mentorNodeByName.set(name, node);
      addEdge(node, T, Number(maxPerMentor));
    });

    slotKeys.forEach(key => {
      const [mentor = ""] = String(key).split("@@");
      const sNode = slotNodeByKey.get(key);
      const mNode = mentorNodeByName.get(mentor);
      if (sNode == null || mNode == null) return;
      addEdge(sNode, mNode, 1);
    });

    flowStudents.forEach(s => {
      const sNode = studentNodeById.get(s.id);
      (studentEligibleSlotsById[s.id] || []).forEach(item => {
        const slotNode = slotNodeByKey.get(item.key);
        if (sNode == null || slotNode == null) return;
        addEdge(sNode, slotNode, 1);
      });
    });

    runMaxFlow(cap, adj, S, T);

    const chosenByStudent = new Map();
    flowStudents.forEach(s => {
      const sNode = studentNodeById.get(s.id);
      const options = studentEligibleSlotsById[s.id] || [];
      for (const item of options) {
        const slotNode = slotNodeByKey.get(item.key);
        if (sNode == null || slotNode == null) continue;
        if (cap[slotNode][sNode] > 0) {
          chosenByStudent.set(s.id, item.candidate);
          break;
        }
      }
    });

    assignableStudents.forEach(s => {
      const effective = effectiveCandidatesByStudent[s.id] || [];
      const base = byStudent[s.id] || [];
      const rankSource = effective.length ? effective : base;
      const chosen = chosenByStudent.get(s.id) || null;
      if (chosen) {
        loads[chosen.mentor] = (loads[chosen.mentor] || 0) + 1;
      }
      pick[s.id] = {
        ranks: rankSource.slice(0, 5),
        chosen,
      };
    });

    setAssignments(
      students.map(s => {
        if (isMentoringOptOut(s)) return emptyAssignment(s.id);
        const r = pick[s.id]?.ranks || [];
        return {
          studentId: s.id,
          first: r[0]?.mentor || "",
          second: r[1]?.mentor || "",
          third: r[2]?.mentor || "",
          fourth: r[3]?.mentor || "",
          fifth: r[4]?.mentor || "",
          days: {
            first: r[0]?.day || "",
            second: r[1]?.day || "",
            third: r[2]?.day || "",
            fourth: r[3]?.day || "",
            fifth: r[4]?.day || "",
          },
          reasons: {
            first: r[0] ? reasonText(s, r[0]) : "후보 없음",
            second: r[1] ? reasonText(s, r[1]) : "후보 없음",
            third: r[2] ? reasonText(s, r[2]) : "후보 없음",
            fourth: r[3] ? reasonText(s, r[3]) : "후보 없음",
            fifth: r[4] ? reasonText(s, r[4]) : "후보 없음",
          },
        };
      })
    );

    setStudents(prev =>
      prev.map(s => {
        if (isMentoringOptOut(s)) return clearCurrentMentoring(s);
        const chosen = pick[s.id]?.chosen;
        if (!chosen) return clearCurrentMentoring(s);

        const old = s?.mentorHistory?.[selectedPeriod] || {};
        return {
          ...s,
          selectedMentor: chosen.mentor,
          selectedMentorDay: chosen.day,
          initialMentor: s?.initialMentor?.mentor
            ? s.initialMentor
            : { mentor: chosen.mentor, day: chosen.day, periodId: selectedPeriod, createdAt: Date.now() },
          mentorHistory: {
            ...(s.mentorHistory || {}),
            [selectedPeriod]: {
              ...old,
              mentor: chosen.mentor,
              day: chosen.day,
              slotStart: chosen.slotStart,
              slotEnd: chosen.slotEnd,
              sessionMinutes: minOverlapRequired,
              attended: true,
              missedCarryOver: false,
              missedDay: undefined,
              autoRank: 1,
            },
          },
        };
      })
    );

    const done = Object.values(pick).filter(v => v?.chosen).length;
    const lines = Object.entries(loads)
      .sort((a, b) => b[1] - a[1])
      .map(([m, c]) => `${m}: ${c}명`)
      .join("\n");
    setPopup({
      title: "자동 배정 완료",
      text: `기준 주차: ${selectedPeriod}\n배정 성공: ${done} / ${assignableStudents.length}\n제외 인원: ${
        students.length - assignableStudents.length
      }명\n최대 인원: ${maxPerMentor}명\n세션 길이: ${minOverlapRequired}분\n배정 방식: 슬롯 기반 최대 배정\n\n${
        lines || "배정 없음"
      }`,
    });
  };

  const pickRank = (student, key) => {
    if (isMentoringOptOut(student)) {
      setPopup({
        title: "멘토링 미희망",
        text: `${student.name}: 멘토링 미희망 인원으로 설정되어 수동 선택이 비활성화됩니다.`,
      });
      return;
    }
    const row = aMap.get(student.id);
    const mentor = n(row?.[key]);
    const day = n(row?.days?.[key]);
    if (!mentor) return;
    commitMentor(student, mentor, day);
    const next = students.map(s =>
      s.id === student.id
        ? {
            ...s,
            selectedMentor: mentor,
            mentorHistory: {
              ...(s.mentorHistory || {}),
              [selectedPeriod]: {
                ...(s.mentorHistory?.[selectedPeriod] || {}),
                mentor,
                day,
              },
            },
          }
        : s
    );
    setPopup({
      title: `${student.name} 멘토 변경`,
      text: `${student.name} -> ${mentor}\n\n${row?.reasons?.[key] || ""}\n\n${loadText(next)}`,
    });
  };

  const applyFixedMentorToSelection = student => {
    if (!selectedPeriod) {
      window.alert("기준 주차를 먼저 선택해 주세요.");
      return;
    }
    if (isMentoringOptOut(student)) {
      setPopup({
        title: "멘토링 미희망",
        text: `${student.name}: 멘토링 미희망 인원으로 설정되어 고정멘토 적용이 비활성화됩니다.`,
      });
      return;
    }

    const fixed = n(student?.fixedMentor);
    if (!fixed) {
      setPopup({
        title: "고정멘토 적용",
        text: `${student.name}: 고정멘토를 먼저 입력해 주세요.`,
      });
      return;
    }

    const day = resolveFixedMentorDay(student);
    commitMentor(student, fixed, day);
    const next = students.map(s =>
      s.id === student.id
        ? {
            ...s,
            selectedMentor: fixed,
            mentorHistory: {
              ...(s.mentorHistory || {}),
              [selectedPeriod]: {
                ...(s.mentorHistory?.[selectedPeriod] || {}),
                mentor: fixed,
                day,
              },
            },
          }
        : s
    );
    setPopup({
      title: `${student.name} 고정멘토 적용`,
      text: `${student.name} -> ${fixed}\n선택 요일: ${day || "미지정"}\n\n${loadText(next)}`,
    });
  };

  const verify = student => {
    if (isMentoringOptOut(student)) {
      setPopup({
        title: `검증 결과 - ${student.name}`,
        text: "멘토링 미희망 인원으로 설정되어 검증 대상에서 제외됩니다.",
      });
      return;
    }
    const mentor = activeMentor(student);
    if (!mentor || !selectedPeriod) {
      setPopup({ title: "검증 결과", text: `${student.name}: 선택 멘토가 없습니다.` });
      return;
    }
    const selectedDay =
      n(student?.mentorHistory?.[selectedPeriod]?.day) || n(student?.selectedMentorDay);
    const daysToCheck = selectedDay ? [selectedDay] : workingDays(mentor, mentorsByDay);
    const prev = prevRecord(student);
    const lines = [];
    let pass = false;

    daysToCheck.forEach(day => {
      const m = (mentorsByDay?.[day] || []).find(v => n(v?.name) === mentor);
      const ov = overlap(periodAttendance?.[student.id]?.[day], mTime(m));
      const gap = prev?.day ? nextWeekGap(prev.day, day) : null;
      const ok = ov >= minOverlapRequired && (!prev?.day || (gap && gap >= 5));
      if (ok) pass = true;
      lines.push(
        `${day}: 겹침 ${ov}분 / 간격 ${prev?.day ? `${gap || 0}일` : "N/A"} / ${ok ? "적합" : "부적합"}`
      );
    });

    if (!daysToCheck.length) {
      lines.push("멘토 근무 요일 정보가 없어 검증할 수 없습니다.");
    }

    setPopup({
      title: `검증 결과 - ${student.name}`,
      text: `선택 멘토: ${mentor}\n${
        prev?.mentor ? `전주 멘토: ${prev.mentor} (${prev.day || "-"})` : "전주 멘토 정보 없음"
      }\n선택 요일: ${selectedDay || "미지정"}\n\n${lines.join("\n")}\n\n최종: ${
        pass ? "배정 가능" : "배정 기준 미충족"
      }`,
    });
  };

  const mentorCell = (mentor, day = "") => {
    const name = n(mentor);
    if (!name) return <span className="text-gray-300">-</span>;
    const days = day ? [day] : workingDays(name, mentorsByDay);
    return (
      <div>
        <div className="font-semibold">{name}</div>
        <div className="text-xs text-gray-500">근무: {days.length ? days.join(", ") : "-"}</div>
      </div>
    );
  };

  const mentoringTimelineByDay = useMemo(() => {
    const result = DAYS.reduce((acc, d) => ({ ...acc, [d]: {} }), {});
    const mentorSlotsByDay = DAYS.reduce((acc, d) => ({ ...acc, [d]: {} }), {});

    DAYS.forEach(day => {
      (mentorsByDay?.[day] || []).forEach(entry => {
        const mentor = n(entry?.name);
        if (!mentor) return;
        if (!mentorSlotsByDay[day][mentor]) mentorSlotsByDay[day][mentor] = [];
        mentorSlotsByDay[day][mentor].push(
          ...buildSlotsFromMentorTime(mTime(entry), minOverlapRequired)
        );
      });

      Object.keys(mentorSlotsByDay[day]).forEach(mentor => {
        mentorSlotsByDay[day][mentor].sort(
          (a, b) => a.startMin - b.startMin || a.endMin - b.endMin
        );
      });
    });

    const resolveAssignedDay = (student, mentor) => {
      const explicitDay =
        n(student?.mentorHistory?.[selectedPeriod]?.day) || n(student?.selectedMentorDay);
      if (DAY_SET.has(explicitDay)) return explicitDay;

      let best = { day: "", ov: -1 };
      DAYS.forEach(day => {
        const att = normalizeTimeRangePair(periodAttendance?.[student.id]?.[day]);
        if (!att) return;
        const entries = (mentorsByDay?.[day] || []).filter(v => n(v?.name) === mentor);
        if (!entries.length) return;
        const ov = entries.reduce(
          (mx, entry) => Math.max(mx, overlap(periodAttendance?.[student.id]?.[day], mTime(entry))),
          0
        );
        if (ov >= minOverlapRequired && ov > best.ov) {
          best = { day, ov };
        }
      });
      return best.day;
    };

    const studentsByMentorDay = DAYS.reduce((acc, d) => ({ ...acc, [d]: {} }), {});
    students.forEach(student => {
      if (isMentoringOptOut(student)) return;
      const mentor = activeMentor(student);
      if (!mentor) return;
      const day = resolveAssignedDay(student, mentor);
      if (!DAY_SET.has(day)) return;
      if (!studentsByMentorDay[day][mentor]) studentsByMentorDay[day][mentor] = [];
      studentsByMentorDay[day][mentor].push({
        student,
        fixedSlotStart: n(student?.mentorHistory?.[selectedPeriod]?.slotStart),
        fixedSlotEnd: n(student?.mentorHistory?.[selectedPeriod]?.slotEnd),
      });
    });

    DAYS.forEach(day => {
      const mentorSet = new Set([
        ...Object.keys(mentorSlotsByDay[day] || {}),
        ...Object.keys(studentsByMentorDay[day] || {}),
      ]);

      mentorSet.forEach(mentor => {
        const slots = (mentorSlotsByDay[day]?.[mentor] || []).map(slot => ({
          ...slot,
          studentId: null,
          studentName: "",
        }));
        const requestStudents = studentsByMentorDay[day]?.[mentor] || [];

        const requests = requestStudents
          .map(item => {
            const student = item?.student;
            if (!student) return null;
            const att = normalizeTimeRangePair(periodAttendance?.[student.id]?.[day]);
            if (!att) {
              return {
                studentId: student.id,
                studentName: student.name,
                attStart: 9999,
                eligible: [],
                fixedIdx: -1,
              };
            }

            const eligible = [];
            slots.forEach((slot, idx) => {
              const ov = overlapRange(att.st, att.en, slot.startMin, slot.endMin);
              if (ov >= minOverlapRequired) eligible.push(idx);
            });

            let fixedIdx = -1;
            const fixedStart = n(item?.fixedSlotStart);
            const fixedEnd = n(item?.fixedSlotEnd);
            if (fixedStart && fixedEnd) {
              fixedIdx = slots.findIndex(
                (slot, idx) =>
                  slot.start === fixedStart && slot.end === fixedEnd && eligible.includes(idx)
              );
            }

            return {
              studentId: student.id,
              studentName: student.name,
              attStart: att.st,
              eligible,
              fixedIdx,
            };
          })
          .filter(Boolean);

        const fixedRequests = requests
          .filter(req => req.fixedIdx >= 0)
          .sort((a, b) => {
            if (a.fixedIdx !== b.fixedIdx) return a.fixedIdx - b.fixedIdx;
            if (a.attStart !== b.attStart) return a.attStart - b.attStart;
            return String(a.studentName || "").localeCompare(String(b.studentName || ""), "ko");
          });
        const flexibleRequests = requests
          .filter(req => req.fixedIdx < 0)
          .sort((a, b) => {
            if (a.eligible.length !== b.eligible.length) return a.eligible.length - b.eligible.length;
            if (a.attStart !== b.attStart) return a.attStart - b.attStart;
            return String(a.studentName || "").localeCompare(String(b.studentName || ""), "ko");
          });

        const used = new Set();
        const unassigned = [];

        fixedRequests.forEach(req => {
          if (!used.has(req.fixedIdx) && req.eligible.includes(req.fixedIdx)) {
            used.add(req.fixedIdx);
            slots[req.fixedIdx].studentId = req.studentId;
            slots[req.fixedIdx].studentName = req.studentName;
          } else {
            flexibleRequests.push({ ...req, fixedIdx: -1 });
          }
        });

        flexibleRequests
          .sort((a, b) => {
            if (a.eligible.length !== b.eligible.length) return a.eligible.length - b.eligible.length;
            if (a.attStart !== b.attStart) return a.attStart - b.attStart;
            return String(a.studentName || "").localeCompare(String(b.studentName || ""), "ko");
          })
          .forEach(req => {
          let picked = -1;
          for (const idx of req.eligible) {
            if (!used.has(idx)) {
              picked = idx;
              break;
            }
          }
          if (picked >= 0) {
            used.add(picked);
            slots[picked].studentId = req.studentId;
            slots[picked].studentName = req.studentName;
          } else {
            unassigned.push(req.studentName);
          }
        });

        result[day][mentor] = {
          slots,
          unassigned,
          assignedCount: slots.filter(slot => slot.studentId).length,
          requestCount: requests.length,
        };
      });
    });

    return result;
  }, [students, mentorsByDay, periodAttendance, selectedPeriod, minOverlapRequired]);

  const todayDayLabel = DAY_LABEL_BY_JS[new Date().getDay()] || "";
  const todayMentoringRows = useMemo(() => {
    if (!DAY_SET.has(todayDayLabel)) return [];
    const rows = [];
    const dayData = mentoringTimelineByDay?.[todayDayLabel] || {};
    Object.entries(dayData).forEach(([mentor, info]) => {
      (info?.slots || []).forEach(slot => {
        if (!slot.studentName) return;
        rows.push({
          mentor,
          start: slot.start,
          end: slot.end,
          studentName: slot.studentName,
        });
      });
    });
    rows.sort((a, b) => {
      const t = toMin(a.start) - toMin(b.start);
      if (t !== 0) return t;
      return String(a.mentor || "").localeCompare(String(b.mentor || ""), "ko");
    });
    return rows;
  }, [todayDayLabel, mentoringTimelineByDay]);

  const todayUnassignedRows = useMemo(() => {
    if (!DAY_SET.has(todayDayLabel)) return [];
    const rows = [];
    const dayData = mentoringTimelineByDay?.[todayDayLabel] || {};
    Object.entries(dayData).forEach(([mentor, info]) => {
      (info?.unassigned || []).forEach(studentName => {
        rows.push({ mentor, studentName });
      });
    });
    return rows;
  }, [todayDayLabel, mentoringTimelineByDay]);

  const fixedMentorConflict = useMemo(() => {
    const map = {};
    students.forEach(student => {
      if (isMentoringOptOut(student)) {
        map[student.id] = false;
        return;
      }
      const fixed = n(student?.fixedMentor);
      if (!fixed) {
        map[student.id] = false;
        return;
      }

      const fixedHasOverlap = hasAnyOverlapWithMentor(student, fixed);
      if (fixedHasOverlap) {
        map[student.id] = false;
        return;
      }

      const currentMentor = activeMentor(student);
      const currentHasOverlap =
        Boolean(currentMentor) && hasAnyOverlapWithMentor(student, currentMentor);

      // 고정멘토가 불일치여도, 현재 선택멘토가 일정 충족이면 경고 해제
      map[student.id] = !currentHasOverlap;
    });
    return map;
  }, [students, periodAttendance, mentorsByDay, selectedPeriod]);

  const missedMentoringRows = useMemo(
    () =>
      students
        .map(s => {
          if (isMentoringOptOut(s)) return null;
          const rec = s?.mentorHistory?.[selectedPeriod];
          if (!rec || rec.attended !== false || !rec.missedDay) return null;
          return {
            studentId: s.id,
            studentName: s.name,
            missedMentor: n(rec.mentor) || "-",
            missedDay: n(rec.missedDay) || "-",
            missedReason: n(rec.missedReason),
            manualMentor: n(rec.manualMentor),
            rescheduleDate: n(rec.rescheduleDate),
          };
        })
        .filter(Boolean),
    [students, selectedPeriod]
  );

  const updateMissedMentoringMeta = (studentId, patch) =>
    setStudents(prev =>
      prev.map(s => {
        if (s.id !== studentId || !selectedPeriod) return s;
        const h = { ...(s.mentorHistory || {}) };
        const rec = { ...(h[selectedPeriod] || {}) };
        h[selectedPeriod] = { ...rec, ...patch };
        return { ...s, mentorHistory: h };
      })
    );

  const applyManualMentorAssignment = (studentId, manualMentorFromRow = "", missedDayFromRow = "") => {
    if (!selectedPeriod) return;

    const target = students.find(s => s.id === studentId);
    if (!target) return;
    const rec = target?.mentorHistory?.[selectedPeriod] || {};
    const manualMentor = n(manualMentorFromRow) || n(rec.manualMentor);
    const rescheduleDate = n(rec.rescheduleDate);
    const derivedDay = dayFromYmd(rescheduleDate);
    const manualDay = derivedDay || n(missedDayFromRow) || n(rec.missedDay) || "";

    if (!manualMentor) {
      window.alert("수동 배정 멘토를 먼저 선택해 주세요.");
      return;
    }

    setStudents(prev =>
      prev.map(s => {
        if (s.id !== studentId) return s;
        const h = { ...(s.mentorHistory || {}) };
        const recNow = { ...(h[selectedPeriod] || {}) };
        h[selectedPeriod] = {
          ...recNow,
          manualMentor,
          rescheduleDate,
          rescheduleDay: manualDay,
          mentor: manualMentor,
          day: manualDay,
          manualApplied: true,
          slotStart: undefined,
          slotEnd: undefined,
          sessionMinutes: undefined,
        };
        return {
          ...s,
          selectedMentor: manualMentor,
          selectedMentorDay: manualDay,
          mentorHistory: h,
        };
      })
    );

    setPopup({
      title: "수동 배정 적용",
      text: `${target.name}\n수동 배정 멘토: ${manualMentor}\n재진행 날짜: ${rescheduleDate || "-"}\n재진행 요일: ${
        manualDay || "-"
      }`,
    });
  };

  const toggleMentorMissed = (studentId, day) =>
    setStudents(prev =>
      prev.map(s => {
        if (s.id !== studentId || !selectedPeriod) return s;
        if (isMentoringOptOut(s)) return s;
        const h = { ...(s.mentorHistory || {}) };
        const rec = { ...(h[selectedPeriod] || {}) };
        rec.mentor = rec.mentor || n(s.selectedMentor);
        rec.day = rec.day || day;
        if (!rec.mentor) return s;
        if (rec.attended === false && rec.missedDay === day) {
          rec.attended = true;
          rec.missedCarryOver = false;
          rec.missedDay = undefined;
        } else {
          rec.attended = false;
          rec.missedCarryOver = true;
          rec.missedDay = day;
        }
        h[selectedPeriod] = rec;
        return { ...s, mentorHistory: h };
      })
    );
  const togglePlannerMissed = (studentId, day) =>
    setStudents(prev =>
      prev.map(s => {
        if (s.id !== studentId || !selectedPeriod) return s;
        const h = { ...(s.plannerHistory || {}) };
        const rec = { ...(h[selectedPeriod] || {}), day };
        if (rec.attended === false && rec.missedDay === day) {
          rec.attended = true;
          rec.missedCarryOver = false;
          rec.missedDay = undefined;
        } else {
          rec.attended = false;
          rec.missedCarryOver = true;
          rec.missedDay = day;
        }
        h[selectedPeriod] = rec;
        return { ...s, plannerHistory: h };
      })
    );

  return (
    <div className="p-4 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">멘토링 배정 AI</h1>
        <div className="text-sm text-gray-600">
          {selectedPeriod ? `기준 주차: ${selectedPeriod}` : "기준 주차 미선택"}
        </div>
      </div>

      <div className="border rounded p-3 bg-white">
        <div className="font-semibold mb-2">멘토링 미희망 인원 선택</div>
        <div className="flex flex-wrap gap-3">
          {students.map(s => (
            <label key={`mentoring-optout-${s.id}`} className="inline-flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={Boolean(s?.mentoringOptOut)}
                onChange={e => toggleMentoringOptOut(s.id, e.target.checked)}
              />
              <span>{s.name}</span>
            </label>
          ))}
        </div>
        <div className="text-xs text-gray-500 mt-2">
          선택된 학생은 멘토링 자동/수동 배정에서 제외됩니다.
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium">멘토 1명 당 최대 학생 수</label>
        <select
          className="border rounded px-2 py-1"
          value={maxPerMentor}
          onChange={e => setMaxPerMentor(Number(e.target.value))}
        >
          {Array.from({ length: 20 }, (_, i) => i + 1).map(v => (
            <option key={v} value={v}>
              {v}명
            </option>
          ))}
        </select>
        <label className="text-sm font-medium">멘토링 1회 시간</label>
        <select
          className="border rounded px-2 py-1"
          value={minOverlapRequired}
          onChange={e => setSessionDuration(Number(e.target.value))}
        >
          {[15, 20, 25, 30, 40].map(v => (
            <option key={v} value={v}>
              {v}분
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-600">
          요일/시간 배정 최소 겹침: {minOverlapRequired}분
        </span>
        <button onClick={autoAssign} className="bg-blue-600 text-white px-4 py-2 rounded">
          멘토 배정하기
        </button>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[760px] border rounded">
        <table className="w-full border-collapse text-center">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2 sticky top-0 bg-gray-100 z-20">이름</th>
              <th className="border p-2 sticky top-0 bg-gray-100 z-20">태어난 해</th>
              <th className="border p-2 sticky top-0 bg-gray-100 z-20">성격</th>
              <th className="border p-2 sticky top-0 bg-gray-100 z-20">국어</th>
              <th className="border p-2 sticky top-0 bg-gray-100 z-20">수학</th>
              <th className="border p-2 sticky top-0 bg-gray-100 z-20">탐구1</th>
              <th className="border p-2 sticky top-0 bg-gray-100 z-20">탐구2</th>
            </tr>
          </thead>
          <tbody>
            {students.map(s => (
              <tr key={s.id} className={isMentoringOptOut(s) ? "opacity-40 bg-gray-50" : ""}>
                <td className="border p-2">{s.name}</td>
                <td className="border p-2">
                  <input
                    className="border rounded px-2 py-1 w-24"
                    type="number"
                    value={s.birthYear || ""}
                    onChange={e =>
                      setStudents(prev =>
                        prev.map(x => (x.id === s.id ? { ...x, birthYear: e.target.value } : x))
                      )
                    }
                  />
                </td>
                <td className="border p-2">
                  <select
                    className="border rounded px-2 py-1 w-28"
                    value={s.personality || ""}
                    onChange={e =>
                      setStudents(prev =>
                        prev.map(x => (x.id === s.id ? { ...x, personality: e.target.value } : x))
                      )
                    }
                  >
                    {PERSONALITY_OPTIONS.map(opt => (
                      <option key={opt.value || "empty"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="border p-2 min-w-[140px]">
                  <Select
                    options={KOREAN}
                    value={KOREAN.find(v => v.value === s.korean) || null}
                    onChange={o =>
                      setStudents(prev => prev.map(x => (x.id === s.id ? { ...x, korean: o?.value || "" } : x)))
                    }
                  />
                </td>
                <td className="border p-2 min-w-[140px]">
                  <Select
                    options={MATH}
                    value={MATH.find(v => v.value === s.math) || null}
                    onChange={o =>
                      setStudents(prev => prev.map(x => (x.id === s.id ? { ...x, math: o?.value || "" } : x)))
                    }
                  />
                </td>
                <td className="border p-2 min-w-[160px]">
                  <Select
                    options={EXPLORE}
                    value={EXPLORE.find(v => v.value === s.explore1) || null}
                    onChange={o =>
                      setStudents(prev =>
                        prev.map(x => (x.id === s.id ? { ...x, explore1: o?.value || "" } : x))
                      )
                    }
                  />
                </td>
                <td className="border p-2 min-w-[160px]">
                  <Select
                    options={EXPLORE}
                    value={EXPLORE.find(v => v.value === s.explore2) || null}
                    onChange={o =>
                      setStudents(prev =>
                        prev.map(x => (x.id === s.id ? { ...x, explore2: o?.value || "" } : x))
                      )
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[760px] border rounded">
        <table className="w-full border-collapse text-center">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2 sticky top-0 bg-gray-100 z-20">이름</th>
              <th className="border p-2 sticky top-0 bg-gray-100 z-20">고정멘토</th>
              <th className="border p-2 sticky top-0 bg-gray-100 z-20">멘토 배제</th>
              <th className="border p-2 sticky top-0 bg-gray-100 z-20">지난주 멘토</th>
              <th className="border p-2 sticky top-0 bg-gray-100 z-20">지난주 요일</th>
              <th className="border p-2 bg-blue-100 sticky top-0 z-20">선택 멘토</th>
              <th className="border p-2 sticky top-0 bg-gray-100 z-20">1순위</th>
              <th className="border p-2 sticky top-0 bg-gray-100 z-20">2순위</th>
              <th className="border p-2 sticky top-0 bg-gray-100 z-20">3순위</th>
              <th className="border p-2 sticky top-0 bg-gray-100 z-20">4순위</th>
              <th className="border p-2 sticky top-0 bg-gray-100 z-20">5순위</th>
              <th className="border p-2 sticky top-0 bg-gray-100 z-20">검증</th>
            </tr>
          </thead>
          <tbody>
            {students.map(s => {
              const row = aMap.get(s.id) || {};
              const prev = prevRecord(s);
              const currentMentor = activeMentor(s);
              const currentMentorDay =
                n(s?.mentorHistory?.[selectedPeriod]?.day) || n(s?.selectedMentorDay);
              const dimClass = isMentoringOptOut(s) ? "opacity-40 bg-gray-50" : "";
              return (
                <tr key={s.id} className={`${fixedMentorConflict[s.id] ? "bg-red-50" : ""} ${dimClass}`.trim()}>
                  <td className="border p-2 font-medium">{s.name}</td>
                  <td className="border p-2">
                    <div className="flex items-center justify-center gap-2">
                      <input
                        className="border rounded px-2 py-1 w-28"
                        value={s.fixedMentor || ""}
                        onChange={e =>
                          setStudents(prev =>
                            prev.map(x => (x.id === s.id ? { ...x, fixedMentor: e.target.value } : x))
                          )
                        }
                      />
                      <button
                        type="button"
                        className="bg-blue-600 text-white text-xs px-2 py-1 rounded disabled:opacity-40"
                        onClick={() => applyFixedMentorToSelection(s)}
                        disabled={!n(s.fixedMentor) || !selectedPeriod || isMentoringOptOut(s)}
                      >
                        적용
                      </button>
                    </div>
                  </td>
                  <td className="border p-2">
                    <input
                      className="border rounded px-2 py-1 w-32"
                      placeholder="쉼표 구분"
                      value={s.bannedMentor1 || ""}
                      onChange={e =>
                        setStudents(prev =>
                          prev.map(x => (x.id === s.id ? { ...x, bannedMentor1: e.target.value } : x))
                        )
                      }
                    />
                  </td>
                  <td className="border p-2">{prev?.mentor || "-"}</td>
                  <td className="border p-2">{prev?.day || "-"}</td>
                  <td className="border p-2">
                    {currentMentor ? (
                      mentorCell(currentMentor, currentMentorDay)
                    ) : isMentoringOptOut(s) ? (
                      <span className="text-gray-500 text-sm">미희망</span>
                    ) : (
                      <span className="text-red-500 text-sm">미배정</span>
                    )}
                  </td>
                  <td className="border p-2 cursor-pointer hover:bg-yellow-50" onClick={() => pickRank(s, "first")}>
                    {mentorCell(row.first, row?.days?.first)}
                  </td>
                  <td className="border p-2 cursor-pointer hover:bg-yellow-50" onClick={() => pickRank(s, "second")}>
                    {mentorCell(row.second, row?.days?.second)}
                  </td>
                  <td className="border p-2 cursor-pointer hover:bg-yellow-50" onClick={() => pickRank(s, "third")}>
                    {mentorCell(row.third, row?.days?.third)}
                  </td>
                  <td className="border p-2 cursor-pointer hover:bg-yellow-50" onClick={() => pickRank(s, "fourth")}>
                    {mentorCell(row.fourth, row?.days?.fourth)}
                  </td>
                  <td className="border p-2 cursor-pointer hover:bg-yellow-50" onClick={() => pickRank(s, "fifth")}>
                    {mentorCell(row.fifth, row?.days?.fifth)}
                  </td>
                  <td className="border p-2">
                    <button className="bg-green-600 text-white text-sm px-2 py-1 rounded" onClick={() => verify(s)}>
                      검증
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">
          오늘 멘토링 시간표 {DAY_SET.has(todayDayLabel) ? `(${todayDayLabel}요일)` : ""}
        </h2>
        <div className="border rounded p-3 bg-white shadow-sm">
          {!DAY_SET.has(todayDayLabel) ? (
            <div className="text-sm text-gray-500">
              오늘은 정규 멘토링 요일(월~토)이 아닙니다.
            </div>
          ) : todayMentoringRows.length === 0 ? (
            <div className="text-sm text-gray-400">오늘 배정된 멘토링이 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border px-2 py-1 text-left">시간</th>
                    <th className="border px-2 py-1 text-left">멘토</th>
                    <th className="border px-2 py-1 text-left">학생</th>
                  </tr>
                </thead>
                <tbody>
                  {todayMentoringRows.map((row, idx) => (
                    <tr key={`today-${row.mentor}-${row.start}-${row.studentName}-${idx}`}>
                      <td className="border px-2 py-1">{row.start}~{row.end}</td>
                      <td className="border px-2 py-1">{row.mentor}</td>
                      <td className="border px-2 py-1">{row.studentName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {todayUnassignedRows.length > 0 ? (
            <div className="mt-3 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
              시간 슬롯 미배정:{" "}
              {todayUnassignedRows.map(r => `${r.mentor}-${r.studentName}`).join(", ")}
            </div>
          ) : null}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">요일별 멘토링 진행 현황표 (시간대 기준)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DAYS.map(day => (
            <div key={day} className="border rounded p-3 bg-white shadow-sm">
              <h3 className="font-bold mb-2">{day}요일</h3>
              {Object.keys(mentoringTimelineByDay[day] || {}).length === 0 ? (
                <div className="text-sm text-gray-400">배정 없음</div>
              ) : (
                Object.entries(mentoringTimelineByDay[day])
                  .sort((a, b) => String(a[0] || "").localeCompare(String(b[0] || ""), "ko"))
                  .map(([mentor, info]) => (
                  <div key={mentor} className="mb-2">
                    <div className="font-semibold text-sm">
                      {mentor} ({info.assignedCount}/{info.requestCount}명)
                    </div>
                    {(info?.slots || []).length > 0 ? (
                      <ul className="text-sm space-y-0.5 mt-1">
                        {info.slots.map((slot, idx) => (
                          <li key={`${day}-${mentor}-${slot.start}-${idx}`}>
                            <span className="inline-block min-w-[96px] text-gray-600">
                              {slot.start}~{slot.end}
                            </span>
                            <span>{slot.studentName || "빈 슬롯"}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-xs text-gray-500 mt-1">
                        멘토 근무 시간이 설정되지 않아 시간 슬롯을 만들 수 없습니다.
                      </div>
                    )}
                    {info.unassigned.length > 0 ? (
                      <div className="text-xs text-red-600 mt-1">
                        미배정: {info.unassigned.join(", ")}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">이번주 멘토링 누락 선택</h2>
        <div className="overflow-x-auto overflow-y-auto max-h-[760px] border rounded">
          <table className="w-full border-collapse text-center">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-2 py-2 sticky top-0 bg-gray-100 z-20">학생</th>
                {DAYS.map(day => (
                  <th key={day} className="border px-2 py-2 sticky top-0 bg-gray-100 z-20">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id} className={isMentoringOptOut(s) ? "opacity-40 bg-gray-50" : ""}>
                  <td className="border px-2 py-2 font-medium">{s.name}</td>
                  {DAYS.map(day => {
                    const mentor = activeMentor(s);
                    const selectedMentoringDay =
                      n(s?.mentorHistory?.[selectedPeriod]?.day) || n(s?.selectedMentorDay);
                    const hasMentoring = mentor && (
                      selectedMentoringDay
                        ? selectedMentoringDay === day
                        : workingDays(mentor, mentorsByDay).includes(day)
                    );
                    const hasPlanner = (plannerScheduleByDay?.[day] || []).some(
                      v => String(v?.studentId) === String(s.id)
                    );
                    const mRec = s?.mentorHistory?.[selectedPeriod];
                    const pRec = s?.plannerHistory?.[selectedPeriod];
                    const mMiss = mRec?.attended === false && mRec?.missedDay === day;
                    const mCarry = mRec?.missedCarryOver === true && mRec?.missedDay === day;
                    const pMiss = pRec?.attended === false && pRec?.missedDay === day;
                    const pCarry = pRec?.missedCarryOver === true && pRec?.missedDay === day;

                    return (
                      <td key={`${s.id}-${day}`} className="border px-2 py-2 align-top">
                        <div className="flex flex-col gap-1">
                          {hasMentoring ? (
                            <button
                              className={`rounded px-1 py-0.5 text-sm ${
                                mCarry ? "bg-red-200" : mMiss ? "bg-orange-200" : "bg-blue-100 hover:bg-blue-200"
                              }`}
                              onClick={() => toggleMentorMissed(s.id, day)}
                            >
                              {mCarry ? "멘토링(이월)" : mMiss ? "멘토링(누락)" : "멘토링"}
                            </button>
                          ) : null}
                          {hasPlanner ? (
                            <button
                              className={`rounded px-1 py-0.5 text-sm ${
                                pCarry
                                  ? "bg-red-200"
                                  : pMiss
                                  ? "bg-orange-200"
                                  : "bg-yellow-100 hover:bg-yellow-200"
                              }`}
                              onClick={() => togglePlannerMissed(s.id, day)}
                            >
                              {pCarry ? "플래너(이월)" : pMiss ? "플래너(누락)" : "플래너"}
                            </button>
                          ) : null}
                        </div>
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
        <h2 className="text-xl font-semibold mb-2">누락 멘토링 사유 및 재배정 관리</h2>
        <div className="overflow-x-auto overflow-y-auto max-h-[760px] border rounded">
          <table className="w-full border-collapse text-center text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-2 py-2 sticky top-0 bg-gray-100 z-20">학생</th>
                <th className="border px-2 py-2 sticky top-0 bg-gray-100 z-20">누락 멘토</th>
                <th className="border px-2 py-2 sticky top-0 bg-gray-100 z-20">누락 요일</th>
                <th className="border px-2 py-2 sticky top-0 bg-gray-100 z-20">누락 사유</th>
                <th className="border px-2 py-2 sticky top-0 bg-gray-100 z-20">수동 배정 멘토</th>
                <th className="border px-2 py-2 sticky top-0 bg-gray-100 z-20">재진행 날짜</th>
                <th className="border px-2 py-2 sticky top-0 bg-gray-100 z-20">적용</th>
              </tr>
            </thead>
            <tbody>
              {missedMentoringRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="border px-2 py-4 text-gray-500">
                    누락된 멘토링이 없습니다.
                  </td>
                </tr>
              ) : (
                missedMentoringRows.map(row => (
                  <tr key={`missed-${row.studentId}`}>
                    <td className="border px-2 py-2 font-medium">{row.studentName}</td>
                    <td className="border px-2 py-2">{row.missedMentor}</td>
                    <td className="border px-2 py-2">{row.missedDay}</td>
                    <td className="border px-2 py-2 min-w-[220px]">
                      <input
                        className="border rounded px-2 py-1 w-full"
                        placeholder="예: 학생 컨디션 저하"
                        value={row.missedReason}
                        onChange={e =>
                          updateMissedMentoringMeta(row.studentId, {
                            missedReason: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td className="border px-2 py-2 min-w-[150px]">
                      <select
                        className="border rounded px-2 py-1 w-full"
                        value={row.manualMentor}
                        onChange={e =>
                          updateMissedMentoringMeta(row.studentId, {
                            manualMentor: e.target.value,
                          })
                        }
                      >
                        <option value="">선택</option>
                        {mentorNames.map(name => (
                          <option key={`manual-${row.studentId}-${name}`} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border px-2 py-2 min-w-[160px]">
                      <input
                        className="border rounded px-2 py-1 w-full"
                        type="date"
                        value={row.rescheduleDate}
                        onChange={e =>
                          updateMissedMentoringMeta(row.studentId, {
                            rescheduleDate: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td className="border px-2 py-2">
                      <button
                        className="bg-blue-600 text-white px-2 py-1 rounded text-xs"
                        onClick={() =>
                          applyManualMentorAssignment(row.studentId, row.manualMentor, row.missedDay)
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
          수동 배정 적용 시 해당 학생의 이번 주 선택 멘토가 즉시 변경됩니다.
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-2">학생별 멘토링 누적 기록</h2>
        <div className="text-xs text-gray-600 mb-2">
          색상 의미: <span className="px-1 bg-green-100 rounded">녹색</span> 누락 후 재배정 완료,{" "}
          <span className="px-1 bg-red-100 rounded">빨강</span> 멘토링 이월,{" "}
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[760px] border rounded">
          <table className="w-full border-collapse text-center text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-2 py-2 sticky top-0 left-0 bg-gray-100 z-30">학생</th>
                {pList.map(p => (
                  <th key={p.id} className="border px-2 py-2 sticky top-0 bg-gray-100 z-20">
                    {p.id}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id} className={isMentoringOptOut(s) ? "opacity-40 bg-gray-50" : ""}>
                  <td className="border px-2 py-2 font-medium sticky left-0 bg-white z-10">{s.name}</td>
                  {pList.map(p => {
                    const r = s?.mentorHistory?.[p.id];
                    if (!r?.mentor) {
                      return (
                        <td key={`${s.id}-${p.id}`} className="border px-2 py-2 text-gray-300">
                          -
                        </td>
                      );
                    }
                    const miss = r?.attended === false;
                    const carry = r?.missedCarryOver === true;
                    const manualApplied = r?.manualApplied === true;
                    return (
                      <td
                        key={`${s.id}-${p.id}`}
                        className={`border px-2 py-2 ${
                          manualApplied ? "bg-green-100" : carry ? "bg-red-100" : miss ? "bg-orange-100" : ""
                        }`}
                      >
                        <div className="font-semibold">{r.mentor}</div>
                        {r.day ? <div className="text-xs text-gray-600">({r.day})</div> : null}
                        {r.autoRank ? <div className="text-xs text-blue-600">{r.autoRank}순위</div> : null}
                        {miss && r.actualMentor ? (
                          <div className="text-xs text-green-700">실제 진행: {r.actualMentor}</div>
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

      <StudentMentorOverlapTable />

      {popup.text ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={closePopup} />
          <div className="relative mx-auto my-10 w-[92%] max-w-3xl bg-white rounded shadow-lg">
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold">{popup.title || "안내"}</h3>
              <button onClick={closePopup}>닫기</button>
            </div>
            <div className="p-4">
              <textarea readOnly value={popup.text} className="w-full h-72 border rounded p-2 text-sm whitespace-pre" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

