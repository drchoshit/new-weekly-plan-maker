// src/components/WeeklySchedule.jsx
import React, { useState, useEffect } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import PrintControls from './PrintControls.jsx';
// ✅ 편집페이지에서 저장한 오버라이드 값을 구독
import { usePrintOverrides } from '../printOverrides';

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

export default function WeeklySchedule() {
  const {
    students, setStudents,
    mentorsByDay,
    plannerMessage, setPlannerMessage,
    noticeMessage,  setNoticeMessage,
    monthlyNotice,  setMonthlyNotice,
    studentInterviewAssignments, setStudentInterviewAssignments,
    getAllState, setAllState
  } = useSchedule();

  const careSchedule       = JSON.parse(localStorage.getItem('mentalCareSchedule')    || '{}');
  const planSchedule       = JSON.parse(localStorage.getItem('plannerSchedule')       || '{}');
  const sessionDur         = JSON.parse(localStorage.getItem('plannerSessionDuration')|| '30');

  const [selected, setSelected]       = useState('');
  const [printingAll, setPrintingAll] = useState(false);

  // ✅ 컨텍스트에서 날짜 상태 가져오기
  const { startDate, setStartDate, endDate, setEndDate } = useSchedule();

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
    if (students.length && !selected) setSelected(students[0].name);

    const today = new Date();
    const offset = (today.getDay() + 6) % 7;
    const mon = new Date(today); mon.setDate(today.getDate() - offset);
    const sat = new Date(mon);   sat.setDate(mon.getDate() + 5);
    const fmt = d => `${d.getMonth() + 1}/${d.getDate()}`;

    if (!startDate) setStartDate(fmt(mon));
    if (!endDate) setEndDate(fmt(sat));
  }, [students, selected, startDate, endDate, setStartDate, setEndDate]);

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
    const student = students.find(s => s.name === selected);
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

  const renderPage = (studentName) => {
    const student = students.find((s) => s.name === studentName) || {};
    // ✅ 현재 학생의 오버라이드 값
    const ov = getForStudent(student.id);

    const mentorCols = days.flatMap((day) => {
      const list = mentorsByDay[day] || [];
      return list.map((m, idx) => ({ day, idx, info: m || {} }));
    }).filter((c) => c.info.name);

    // 기본(자동배정) 플래너 시간: 하루에 1개만 표시
    const plannerTimesArr = days.map((day) => {
      const rec = (planSchedule[day] || []).find((x) => x.student === studentName);
      return rec ? `${rec.start}~${rec.end}` : 'X';
    });
    // day -> time 매핑
    const plannerTimesByDay = days.reduce((o, d, i) => (o[d] = plannerTimesArr[i], o), {});

    const careDays = days.filter((day) =>
      (careSchedule[day] || []).some((x) => x.student === studentName)
    );
    let firstTime = 'X';
    for (const day of days) {
      const r = (careSchedule[day] || []).find((x) => x.student === studentName);
      if (r) {
        firstTime = `${r.start}~${r.end}`;
        break;
      }
    }

    const assignedMentor = student?.selectedMentor || '-';
    const selectedInterview = studentInterviewAssignments?.[student.id] || {};

    return (
      <div key={studentName} className="space-y-4">
        {printOpts.header.enabled && (
          <table className="w-full border-collapse text-center text-sm">
            <thead>
              <tr className="bg-green-800 text-white text-lg">
                <th className="border p-2">메디컬로드맵</th>
                <th className="border p-2" colSpan={mentorCols.length}>
                  주간 멘토 일정표 ({startDate} ~ {endDate})
                </th>
                <th className="border p-2">{studentName} 학생</th>
              </tr>
            </thead>
          </table>
        )}

        {/* 멘토표 */}
        {printOpts.mentors.enabled && (
          <table className="w-full border-collapse text-center text-sm">
            <thead>
              <tr className="bg-green-600 text-white">
                {mentorCols.map((c) => (
                  <th key={`${c.day}${c.idx}`} className="border p-2">{c.day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {['name', 'univ', 'major', 'gender', 'time', 'note'].map((field, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                  {mentorCols.map((c) => (
                    <td key={`${c.day}${c.idx}-${field}`} className="border p-2">
                      {c.info[field]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* 플래너 체크 (요일별 시간 직접 수정 가능) */}
        {printOpts.planner.enabled && (
          <div className="border rounded shadow p-2 overflow-x-auto">
            <h3 className="font-semibold mb-1 text-center">플래너 체크</h3>
            <table className="w-full table-fixed border-collapse text-center text-sm">
              <thead>
                <tr className="bg-gray-100">
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
                        onChange={(e) => updatePlannerTimeOverride(student.id, d, e.target.value)}
                        className="border w-full text-center"
                        placeholder="예: 12:48~12:58 또는 X"
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>

            {/* 하단 문구도 필요시 수정 가능(학생별 저장) */}
            <div className="mt-1 text-left text-sm flex items-center gap-2">
              <span className="whitespace-nowrap">※ 플래너 체크 문구:</span>
              <input
                value={ov.planner ?? plannerMessage}
                onChange={(e) => updatePlannerOverride(student.id, e.target.value)}
                className="flex-1 border rounded px-2 py-1 w-full"
                placeholder="예: ○○○○○○○○○○○"
              />
            </div>
          </div>
        )}

        {/* 멘탈 케어링은 요청에 따라 '숨김' 처리 (렌더하지 않음) */}
        {/* {printOpts.mentalCare.enabled && ( ... )}  → 제거 */}

        {/* 금주의 멘토 + 부원장 인터뷰: 2개 카드가 가로를 꽉 채우도록 */}
        {printOpts.interview.enabled && (
          <div className="grid grid-cols-2 gap-4">
            {/* 금주의 멘토 (자동값 기본 + 직접 수정 가능) */}
            <div className="border rounded shadow p-2">
              <h3 className="font-semibold mb-1 text-center">금주의 멘토</h3>
              <table className="w-full border-collapse text-center text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border p-2 font-medium">멘토 이름</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border p-2">
                      <input
                        value={ov.mentorOfWeek ?? assignedMentor}
                        onChange={(e) => updateMentorOverride(student.id, e.target.value)}
                        className="border w-full text-center"
                        placeholder="예: 홍길동"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 부원장 인터뷰 (그대로 유지) */}
            <div className="border rounded shadow p-2">
              <h3 className="font-semibold mb-1 text-center">부원장 인터뷰</h3>
              <table className="w-full border-collapse text-center text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border p-2 font-medium">인터뷰 요일</th>
                    <th className="border p-2 font-medium">인터뷰 시간</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border p-2">
                      <input
                        value={ov.viceDirector?.day ?? (selectedInterview?.day || '')}
                        onChange={(e) => updateInterviewField(student.id, 'day', e.target.value)}
                        className="border w-full text-center"
                      />
                    </td>
                    <td className="border p-2">
                      <input
                        value={
                          ov.viceDirector?.time ??
                          (
                            selectedInterview?.start && selectedInterview?.end
                              ? `${selectedInterview.start}~${selectedInterview.end}`
                              : ''
                          )
                        }
                        onChange={(e) => {
                          const [start, end] = e.target.value.split('~');
                          updateInterviewField(student.id, 'start', start?.trim());
                          updateInterviewField(student.id, 'end', end?.trim());
                        }}
                        className="border w-full text-center"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 공지사항 */}
        <div className="grid grid-cols-2 gap-4">
          {printOpts.notices.enabled && (
            <div className="border rounded p-2 bg-blue-50">
              <h3 className="font-semibold mb-1">📌 주간 공지 사항</h3>
              <ul className="list-disc pl-5 text-xs text-left">
                {noticeMessage.split('\n').filter(Boolean).map((line, i) => <li key={i}>{line}</li>)}
              </ul>
            </div>
          )}
          <div className="border rounded p-2 bg-green-50">
            <h3 className="font-semibold mb-1">📅 월간 공지 사항</h3>
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
      <div className="p-4 flex items-center space-x-4">
        <button onClick={handleExportAll} className="px-3 py-1 bg-yellow-600 text-white rounded">전체 저장</button>
        <label className="px-3 py-1 bg-orange-600 text-white rounded cursor-pointer">
          전체 불러오기
          <input type="file" accept="application/json" onChange={handleImportAll} className="hidden" />
        </label>
        <div>
          <label className="font-medium mr-2">학생 선택:</label>
          <select value={selected} onChange={e => setSelected(e.target.value)} className="border rounded p-1">
            {students.map(s => <option key={s.name}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="font-medium mr-2">주간 일정:</label>
          <input value={startDate} onChange={e => setStartDate(e.target.value)} className="border rounded p-1 w-20" />
          <span className="mx-1">~</span>
          <input value={endDate} onChange={e => setEndDate(e.target.value)} className="border rounded p-1 w-20" />
        </div>
        <div className="space-x-2 ml-auto">
          {/* ✅ 추가: 정보 리셋 버튼 (오른쪽) */}
          <button onClick={resetCurrentStudentOverrides} className="px-3 py-1 bg-red-500 text-white rounded">
            정보 리셋
          </button>
          <button onClick={handlePrintSingle} className="px-3 py-1 bg-blue-600 text-white rounded">인쇄</button>
          <button onClick={handlePrintAll} className="px-3 py-1 bg-green-600 text-white rounded">전체 인쇄</button>
        </div>
      </div>

      <PrintControls options={printOpts} onChange={toggleOpt} />
      <div id="print-area">
        {printingAll
          ? students.map(s => <div key={s.name} className="break-after-page">{renderPage(s.name)}</div>)
          : renderPage(selected)}
      </div>
    </div>
  );
}
