// src/components/WeeklySchedule.jsx
import React, { useState, useEffect } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import PrintControls from './PrintControls.jsx';
// ✅ 편집페이지에서 저장한 오버라이드 값을 구독
import { usePrintOverrides } from '../printOverrides';
import convertMedicalScheduleJson from '../utils/convertMedicalScheduleJson';

const days = ['월', '화', '수', '목', '금', '토'];

// ✅ 학생별 오버라이드 저장/즉시 반영을 위한 최소 헬퍼
const OV_KEY = 'printOverrides';
function readOverrides() {
  try { return JSON.parse(localStorage.getItem(OV_KEY)) || {}; }
  catch { return {}; }
}
function writeOverrides(next) {
  localStorage.setItem(OV_KEY, JSON.stringify(next));
  // 인쇄 페이지 즉시 갱신
  window.dispatchEvent(new Event('print-overrides-updated'));
}

export default function WeeklySchedule({ 
  mode = "view", 
  initialStudentId 
}) {

  // ===============================
  // 🔥 필수 로컬 상태 (절대 삭제 금지)
  // ===============================
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [printingAll, setPrintingAll] = useState(false);
  const {
    students, setStudents,
    mentorsByDay,
    plannerMessage, setPlannerMessage,
    noticeMessage, setNoticeMessage,
    monthlyNotice, setMonthlyNotice,
    studentInterviewAssignments, setStudentInterviewAssignments,
    getAllState, setAllState,

    weeklyCalendars, setWeeklyCalendars,
    saveWeeklyCalendarsOnly,

    // ✅ 날짜/주차
    startDate, setStartDate,
    endDate, setEndDate,
    periods, setPeriods,
    selectedPeriod, setSelectedPeriod,
  } = useSchedule();

  // 🔥 현재 선택된 기간 객체
  const activePeriod = periods.find(p => p.id === selectedPeriod);

  useEffect(() => {
    if (
      mode === "print" &&
      !printingAll &&
      initialStudentId &&
      students.length
    ) {
      setSelectedStudentId(String(initialStudentId));
    }
  }, [mode, printingAll, initialStudentId, students]);

  const [printOpts, setPrintOpts]     = useState({
    header:     { label: '헤더',       enabled: true },
    mentors:    { label: '멘토표',     enabled: true },
    planner:    { label: '플래너체크', enabled: true },
    mentalCare: { label: '멘탈케어',   enabled: true }, // (요청에 따라 아래 렌더링은 숨김)
    interview:  { label: '인터뷰',     enabled: true },
    notices:    { label: '공지사항',   enabled: true },
  });

  const toggleOpt = (key,val)=>
    setPrintOpts(o=>({...o,[key]:{...o[key],enabled:val}}));

  // ✅ 추가: 오버라이드 구독 훅
  const { getForStudent } = usePrintOverrides();

  useEffect(() => {
    if (mode !== "print" && students.length && !selectedStudentId) {
      setSelectedStudentId(String(students[0].id));
    }
  }, [mode, students, selectedStudentId]);

  useEffect(() => {
    const today = new Date();
    const offset = (today.getDay() + 6) % 7;
    const mon = new Date(today); mon.setDate(today.getDate() - offset);
    const sat = new Date(mon);   sat.setDate(mon.getDate() + 5);
    const fmt = d => `${d.getMonth() + 1}/${d.getDate()}`;

    if (!startDate) setStartDate(fmt(mon));
    if (!endDate) setEndDate(fmt(sat));
  }, [students, startDate, endDate, setStartDate, setEndDate]);

  const handleExportAll = () => {
    const data = getAllState();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'full_backup.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportAll = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        setAllState(parsed);
        alert('✅ 전체 데이터 불러오기 완료');
      } catch {
        alert('❌ 파일 형식 오류');
      }
    };
    r.readAsText(f);
  };

  const handlePrintSingle=()=>{ setPrintingAll(false); setTimeout(()=>window.print(),0); };
  const handlePrintAll=()=>{ setPrintingAll(true); setTimeout(()=>{ window.print(); setPrintingAll(false); },100); };
  const confirmAndSetPeriodFromInputs = () => {
    const s = (startDate || "").trim();
    const e = (endDate || "").trim();

    if (!s || !e) {
      alert("주간 일정 시작/종료 날짜를 먼저 입력하세요.");
      return;
    }

    const newId = `${s}~${e}`;

    const ok = window.confirm(
      `${s}~${e} 와 함께\n이 기간을 추가 및 설정페이지로 등록하시겠습니까?`
    );
    if (!ok) return;

    // periods에 없으면 추가
    const exists = periods?.some(p => p.id === newId);
    if (!exists) {
      setPeriods(prev => ([
        ...(prev || []),
        { id: newId, start: s, end: e, createdAt: Date.now() }
      ]));
    }

    // 선택 주차 확정
    setSelectedPeriod(newId);
  };

  // ===============================
  // 🔥 로컬 스케줄 캐시 (인쇄 전용)
  // ===============================
  const planSchedule = JSON.parse(
    localStorage.getItem('plannerSchedule') || '{}'
  );

  const careSchedule = JSON.parse(
    localStorage.getItem('mentalCareSchedule') || '{}'
  );

  const updateInterviewField = (studentId, field, value) => {
    const updated = {
      ...studentInterviewAssignments,
      [studentId]: {
        ...(studentInterviewAssignments?.[studentId] || {}),
        [field]: value
      }
    };
    setStudentInterviewAssignments(updated);
    localStorage.setItem("studentInterviewAssignments", JSON.stringify(updated));
  };

  // ===============================
  // 🔥 [추가] 학생 주간 캘린더 JSON 업로드
  // ===============================
  const handleCalendarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const json = JSON.parse(ev.target.result);

        // 🔥 여기서 변환
        const converted = convertMedicalScheduleJson(json);

        if (saveWeeklyCalendarsOnly) {
          saveWeeklyCalendarsOnly(converted);
        } else {
          setWeeklyCalendars(converted);
          localStorage.setItem('weeklyCalendars', JSON.stringify(converted));
        }

        console.log('📅 변환된 주간 캘린더', converted);
        alert('✅ 학생 주간 캘린더 업로드 완료');
      } catch (err) {
        console.error(err);
        alert('❌ 캘린더 JSON 파싱 실패');
      }
    };
    reader.readAsText(file);
  };

  // ✅ 플래너 문구(학생별) 오버라이드 업데이트
  const updatePlannerOverride = (studentId, value) => {
    const next = readOverrides();
    next[String(studentId)] = {
      ...(next[String(studentId)] || {}),
      planner: value
    };
    writeOverrides(next);
  };

  // ✅ 플래너 '요일별 시간' 오버라이드 업데이트
  const updatePlannerTimeOverride = (studentId, day, value) => {
    const sid = String(studentId);
    const next = readOverrides();
    const cur = next[sid] || {};
    next[sid] = {
      ...cur,
      plannerTimes: { ...(cur.plannerTimes || {}), [day]: value }
    };
    writeOverrides(next);
  };

  // ✅ 금주의 멘토 오버라이드 업데이트 (인쇄페이지에서 직접 수정 가능)
  const updateMentorOverride = (studentId, value) => {
    const sid = String(studentId);
    const next = readOverrides();
    next[sid] = { ...(next[sid] || {}), mentorOfWeek: value };
    writeOverrides(next);
  };

  // ✅ 추가: 정보 리셋(현재 선택된 학생의 표시 수정값 초기화 → 자동배정 상태로 복귀)
  const resetCurrentStudentOverrides = () => {
    const student = students.find(
      s => String(s.id) === String(selectedStudentId)
    );

    if (!student) {
      alert('학생을 먼저 선택하세요.');
      return;
    }
    if (!window.confirm(`"${student.name}" 학생의 표시 수정값을 초기화하고 자동배정 상태로 되돌릴까요?`)) return;

    const sid = String(student.id);
    const next = readOverrides();
    if (sid in next) {
      delete next[sid]; // plannerTimes/planner/mentorOfWeek/viceDirector 등 모두 제거
      writeOverrides(next);
    }
    // 인터뷰 입력값(studentInterviewAssignments)은 기본 데이터이므로 유지합니다.
    alert('초기화 완료');
  };

  // 🔥 STEP 4: 주 자동 선택 (가장 최근 주)
  useEffect(() => {
    if (!periods || periods.length === 0) return;

    // selectedPeriod가 없거나, 목록에 없는 값이면 가장 최근 period로 맞춤
    const exists = periods.some(p => p.id === selectedPeriod);
    if (!selectedPeriod || !exists) {
      setSelectedPeriod(periods[periods.length - 1].id);
    }
  }, [periods, selectedPeriod, setSelectedPeriod]);

  // 🔥 선택된 period → startDate / endDate 동기화
  useEffect(() => {
    if (!activePeriod) return;
    setStartDate(activePeriod.start);
    setEndDate(activePeriod.end);
  }, [activePeriod]);

  // ✅ 요일 → 날짜 라벨 계산 (월 → 월(1/12))
  const getDateLabel = (day) => {
    const baseStr = activePeriod?.start ?? startDate;
    if (!baseStr) return '';

    const base = new Date(baseStr);
    const dayIndex = ['월','화','수','목','금','토','일'].indexOf(day);
    if (dayIndex < 0) return '';

    const d = new Date(base);
    d.setDate(base.getDate() + dayIndex);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const renderStudentCalendar = (studentId) => {
    if (!weeklyCalendars) {
      console.warn("❌ weeklyCalendars 없음");
      return null;
    }

    const periodKeys = Object.keys(weeklyCalendars);
    // 🔥 selectedPeriod와 가장 "유사한" key 찾기
    const periodKey =
      Object.keys(weeklyCalendars).find(k =>
        k.replace(/\s/g, "").includes(
          selectedPeriod.replace(/\s/g, "")
        )
      ) || Object.keys(weeklyCalendars).slice(-1)[0];

    if (!periodKey) {
      console.warn("❌ periodKey 없음", selectedPeriod);
      return null;
    }

    const student = students.find(s => String(s.id) === String(studentId));
    if (!student) return null;

    const cal =
      weeklyCalendars[periodKey]?.[student.id] ||
      weeklyCalendars[periodKey]?.[student.name];

    if (!cal) {
      console.warn("❌ 학생 캘린더 없음", {
        periodKey,
        studentId: student.id,
        availableStudents: Object.keys(weeklyCalendars[periodKey] || {})
      });
      return null;
    }

    const dayOrder = ['월', '화', '수', '목', '금', '토', '일'];

    return (
      <div className="border border-print-line rounded-sm p-4 bg-white">
        <div className="grid grid-cols-7 gap-6 text-xs">

          {dayOrder.map(day => (
            <div key={day} className="space-y-2">

              {/* 요일 헤더 */}
              <div className="text-sm font-semibold text-josun-dark tracking-wide border-b border-print-line pb-1">
                {day} <span className="text-print-muted text-xs">({getDateLabel(day)})</span>
              </div>

              {/* 일정 */}
              {(cal[day] || []).length === 0 && (
                <div className="text-print-muted text-xxs">—</div>
              )}

              {(cal[day] || []).map((item, idx) => {
                const isCenter =
                  item.includes('센터') || !item.includes('(');

                const timeText = item.split(' ')[0];
                const descText = item.includes('(')
                  ? item.replace(/.*\(|\)/g, '')
                  : '';

                return (
                  <div
                    key={idx}
                    className={`pl-3 pr-2 py-1.5 text-xs border-l-2 rounded-sm
                      ${isCenter
                        ? 'border-josun-dark bg-josun-soft'
                        : 'border-gold-dark bg-gold-soft'}
                    `}
>
                    <div className="flex justify-between">
                      <span className="font-medium text-josun-dark">{timeText}</span>
                      <span className="text-xxs text-print-muted">
                        {isCenter ? '센터' : '외부'}
                      </span>
                    </div>

                    {descText && (
                      <div className="text-print-muted text-xxs mt-0.5">
                        {descText}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

        </div>
      </div>
    );
  };

  const renderPage = (studentId) => {
    const student = students.find(
      s => String(s.id) === String(studentId)
    );
    if (!student) return null;

    // ✅ 현재 학생의 오버라이드 값
    const ov = getForStudent(student.id);

    const mentorCols = days.flatMap((day) => {
      const list = mentorsByDay[day] || [];
      return list.map((m, idx) => ({ day, idx, info: m || {} }));
    }).filter((c) => c.info.name);

    // 기본(자동배정) 플래너 시간: 하루에 1개만 표시
    const plannerTimesArr = days.map((day) => {
      const rec = (planSchedule[day] || []).find(
        x => String(x.studentId) === String(student.id)
      );
      return rec ? `${rec.start}~${rec.end}` : 'X';
    });

    // day -> time 매핑
    const plannerTimesByDay = days.reduce((o, d, i) => (o[d] = plannerTimesArr[i], o), {});

    const careDays = days.filter((day) =>
      (careSchedule[day] || []).some(
        x => String(x.studentId) === String(student.id)
      )
    );

    let firstTime = 'X';
    for (const day of days) {
      const r = (careSchedule[day] || []).find(
        x => String(x.studentId) === String(student.id)
      );

      if (r) {
        firstTime = `${r.start}~${r.end}`;
        break;
      }
    }

    // ===============================
    // 금주의 멘토 계산 (정답 로직)
    // ===============================
    let mentorName = '-';
    let mentorDayLabel = '-';

    if (student.isNewStudent) {
      // 🔹 신입생: 선택 멘토 + 멘토 출근 요일 전체
      mentorName = student.selectedMentor || '-';

      if (mentorName && mentorName !== '-') {
        const days = Object.entries(mentorsByDay || {})
          .filter(([_, list]) =>
            list?.some(m => m?.name === mentorName)
          )
          .map(([day]) => day);

        mentorDayLabel = days.length ? days.join('/') : '-';
      }

    } else {
      // 🔹 재학생: 이번주 확정 멘토
      const record = student.mentorHistory?.[selectedPeriod];

      mentorName = record?.mentor || '-';
      mentorDayLabel = record?.day || '-';
    }

    const selectedInterview = studentInterviewAssignments?.[student.id] || {};

    return (
      <div key={student.id} className="space-y-4">
        {/* 🔥 학생 주간 캘린더 (플래너 체크 위) */}
        {printOpts.header.enabled && (
          <table className="w-full border-collapse text-center text-sm">
            <thead>
              <tr className="bg-josun-light text-white text-lg tracking-wide">
                <th className="border p-2">메디컬로드맵</th>
                <th className="border p-2" colSpan={mentorCols.length}>
                  주간 멘토 일정표 {activePeriod?.start ?? startDate} ~ {activePeriod?.end ?? endDate}
                </th>
                <th className="border p-2">{student.name} 학생</th>
              </tr>
            </thead>
          </table>
        )}
      

        {/* 멘토표 */}
        {printOpts.mentors.enabled && (
          <table className="w-full border-collapse text-center text-sm">
            <thead>
              <tr>
                {mentorCols.map(c => (
                  <th
                    key={`${c.day}${c.idx}`}
                    className="border border-print-line py-1 text-xs font-medium bg-josun text-white"
                  >
                    {c.day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {['name', 'univ', 'major', 'gender', 'time', 'note'].map((field, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                  {mentorCols.map((c) => (
                    <td key={`${c.day}${c.idx}-${field}`} className="border border-print-line py-1 text-xs">
                      {c.info[field]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {/* 🔥 주간 캘린더 */}
        {renderStudentCalendar(student.id)}

        {/* 멘탈 케어링은 요청에 따라 '숨김' 처리 (렌더하지 않음) */}
        {/* {printOpts.mentalCare.enabled && ( ... )}  → 제거 */}

        {/* 🔥 플래너 체크 + 인터뷰 한 줄 배치 */}
        <div className="grid grid-cols-3 gap-4">

          {/* 왼쪽 2칸 : 플래너 체크 */}
          <div className="col-span-2">
            {printOpts.planner.enabled && (
              <div className="border border-print-line rounded-sm p-3 bg-white h-full flex flex-col justify-between">
                <h3 className="font-semibold mb-1 text-center">플래너 체크</h3>

                <table className="w-full table-fixed border-collapse text-center text-sm">
                  <thead>
                    <tr className="bg-josun-soft">
                      {days.map((d, i) => (
                        <th key={i} className="border p-1">{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {days.map((d, i) => (
                        <td key={i} className="border p-1">
                          <input
                            value={(ov.plannerTimes?.[d] ?? plannerTimesByDay[d])}
                            onChange={(e) =>
                              updatePlannerTimeOverride(student.id, d, e.target.value)
                            }
                            className="border w-full text-center"
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>

                {false && (
                  <div className="mt-1 text-left text-sm flex items-center gap-2">
                    <span className="whitespace-nowrap">※ 플래너 체크 문구:</span>
                    <input
                      value={ov.planner ?? plannerMessage}
                      onChange={(e) =>
                        updatePlannerOverride(student.id, e.target.value)
                      }
                      className="flex-1 border rounded px-2 py-1 w-full"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 오른쪽 1칸 : 금주의 멘토 + 부원장 인터뷰 */}
          <div className="col-span-1">
            {printOpts.interview.enabled && (
              <div className="grid grid-cols-2 gap-2">

                {/* 금주의 멘토 */}
                <div className="border rounded-sm p-2 h-full flex flex-col justify-between">
                  <h3 className="font-semibold mb-1 text-center">금주의 멘토</h3>

                  <div className="text-sm text-center font-medium mb-1">
                    {mentorDayLabel}
                  </div>

                  <input
                    value={ov.mentorOfWeek ?? mentorName}
                    onChange={(e) =>
                      updateMentorOverride(student.id, e.target.value)
                    }
                    className="border w-full text-center font-semibold flex items-center justify-center"
                  />
                </div>

                {/* 부원장 인터뷰 */}
                <div className="border rounded-sm p-2 h-full flex flex-col justify-between">
                  <h3 className="font-semibold mb-1 text-center">부원장 인터뷰</h3>

                  <input
                    placeholder="요일"
                    value={ov.viceDirector?.day ?? selectedInterview?.day ?? ''}
                    onChange={(e) =>
                      updateInterviewField(student.id, 'day', e.target.value)
                    }
                    className="border w-full mb-1 text-center"
                  />

                  <input
                    placeholder="시간"
                    value={
                      ov.viceDirector?.time ??
                      (selectedInterview?.start && selectedInterview?.end
                        ? `${selectedInterview.start}~${selectedInterview.end}`
                        : '')
                    }
                    onChange={(e) => {
                      const [start, end] = e.target.value.split('~');
                      updateInterviewField(student.id, 'start', start);
                      updateInterviewField(student.id, 'end', end);
                    }}
                    className="border w-full text-center"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 공지사항 */}
        <div className="grid grid-cols-2 gap-4">
          {printOpts.notices.enabled && (
            <div className="border border-print-line rounded-sm p-3 bg-josun-soft/40 border-l-4 border-l-josun-dark">
              <h3 className="font-semibold mb-2 text-josun-dark tracking-wide">
              주간 공지 사항  
            </h3>
              <ul className="list-disc pl-5 text-xs text-left">
                {noticeMessage.split('\n').filter(Boolean).map((line, i) => <li key={i}>{line}</li>)}
              </ul>
            </div>
          )}
          <div className="border border-print-line rounded-sm p-3 bg-gold-soft/40 border-l-4 border-l-gold-dark">
              <h3 className="font-semibold mb-2 text-josun-dark tracking-wide">📅 월간 공지 사항</h3>
            <ul className="list-disc pl-5 text-xs text-left">
              {monthlyNotice.split('\n').filter(Boolean).map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {mode !== "print" && (
        <div className="p-4 flex items-center space-x-4">
          <button onClick={handleExportAll} className="px-3 py-1 bg-josun-dark text-white rounded-sm">
            전체 저장
          </button>

          <label className="px-3 py-1 bg-indigo-600 text-white rounded cursor-pointer">
            📅 캘린더 JSON 업로드
            <input
              type="file"
              accept="application/json"
              onChange={handleCalendarUpload}
              className="hidden"
            />
          </label>

          <label className="px-3 py-1 bg-orange-600 text-white rounded cursor-pointer">
            전체 불러오기
            <input type="file" accept="application/json" onChange={handleImportAll} className="hidden" />
          </label>

          <div>
            <label className="font-medium mr-2">학생 선택:</label>
            <select
              value={selectedStudentId}
              onChange={e => setSelectedStudentId(e.target.value)}
            >
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-medium mr-2">주 선택:</label>
            <select
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value)}
              className="border rounded p-1"
            >
              {periods.map(p => (
                <option key={p.id} value={p.id}>
                  {p.start} ~ {p.end}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="font-medium mr-2">주간 일정:</label>

            <input
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="border rounded p-1 w-20"
            />
            <span className="mx-1">~</span>
            <input
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="border rounded p-1 w-20"
            />

            <button
              onClick={confirmAndSetPeriodFromInputs}
              className="px-3 py-1 bg-emerald-600 text-white rounded"
            >
              날짜 변경 확정
            </button>
          </div>

          <div className="space-x-2 ml-auto flex items-center">
            <button
              onClick={resetCurrentStudentOverrides}
              className="px-3 py-1 bg-red-500 text-white rounded"
            >
              정보 리셋
            </button>

            <button
              onClick={handlePrintSingle}
              className="px-3 py-1 bg-blue-600 text-white rounded"
            >
              인쇄
            </button>

            <button
              onClick={handlePrintAll}
              className="px-3 py-1 bg-green-600 text-white rounded"
            >
              전체 인쇄
            </button>

            {/* ✅ 인쇄용 편집 페이지 이동 버튼 */}
            <button
              onClick={() => {
                if (!selectedStudentId) {
                  alert("학생을 먼저 선택하세요.");
                  return;
                }
                window.location.hash = `#/print-edit?id=${selectedStudentId}`;
              }}
              className="px-3 py-1 bg-gray-800 text-white rounded"
            >
              설정페이지(관리자)
            </button>
          </div>
        </div>
      )}


      {mode !== "print" && (
        <PrintControls options={printOpts} onChange={toggleOpt} />
      )}
      <div id="print-area">
        {printingAll
           ? students.map(s =>
                <div key={s.id} className="break-after-page">
                  {renderPage(s.id)}
                </div>
              )
            : renderPage(selectedStudentId)
          } 
      </div>
    </div>
  );
}
