// src/pages/MentorAssignmentPage.jsx
import React, { useEffect, useContext, useState } from "react";
import StudentMentorOverlapTable from "../components/StudentMentorOverlapTable";
import { ScheduleContext } from "../context/ScheduleContext";
import Select from "react-select";
import { assignMentorsToStudents } from "../utils/mentorAssigner";
import { timeToMinutes } from "../utils/scheduler";

const koreanOptions = ["화작", "언매", "공통"].map(v => ({ label: v, value: v }));
const mathOptions = ["미적", "확통", "기하", "공통"].map(v => ({ label: v, value: v }));
const exploreOptions = [
  "통합사회", "한국지리", "세계지리", "세계사", "동아시아사",
  "경제", "정치와 법", "사회·문화", "생활과 윤리", "윤리와 사상",
  "통합과학", "과학탐구 실험", "물리학Ⅰ", "화학Ⅰ", "생명과학Ⅰ", "지구과학Ⅰ"
].map(v => ({ label: v, value: v }));

const days = ["월", "화", "수", "목", "금", "토"];

// ✅ STEP 3-1: 선택된 멘토가 오는 요일 목록 계산
const getMentorDays = (mentorName, mentorsByDay) => {
  if (!mentorName) return [];

  return days.filter((day) => {
    const mentors = mentorsByDay[day] || [];
    return mentors.some((m) => m.name === mentorName);
  });
};

const MentorAssignmentPage = () => {
  // ✅ 신입생 여부 기본값 보장 (기존 학생 데이터 보호)
  useEffect(() => {
    setStudents(prev =>
      prev.map(s => ({
        ...s,
        isNewStudent: s.isNewStudent ?? false,
      }))
    );
  }, []);

  const {
    assignments, setAssignments,
    students, setStudents,
    mentorsByDay,
    attendance,
    selectedPeriod,
    currentPeriodId,
  } = useContext(ScheduleContext);

  const [modalContent, setModalContent] = useState(null);

  const updateStudent = (id, field, value) => {
    setStudents(prev =>
      prev.map(s => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const assignMentors = () => {
    console.log("selectedPeriod:", selectedPeriod);
    console.log("currentPeriodId:", currentPeriodId);
    console.log(
      "attendance[selectedPeriod]:",
      attendance[selectedPeriod]
    );
    console.log(
      "attendance[currentPeriodId]:",
      attendance[currentPeriodId]
    );

    if (!currentPeriodId) {
      alert("기준 주가 확정되지 않았습니다.\n인쇄 페이지에서 '날짜 변경 확정'을 먼저 하세요.");
      return;
    }

    const periodAttendance = attendance[selectedPeriod] || {};

    // 🔥 신입생만 자동 배정 대상
    const newStudents = students.filter(s => s.isNewStudent);

    const result = assignMentorsToStudents({
      students: newStudents,
      mentorsByDay,
      attendanceByPeriod: attendance,
      currentPeriodId,
    });

    setAssignments(result);

    // ✅ 자동배정 결과는 assignments로만 관리
    // (선택 멘토 / mentorHistory는 여기서 건드리지 않음)

    alert(`자동 배정 완료\n기준 주: ${currentPeriodId}`);
  };

  const showModal = (text) => {
    setModalContent(text);
  };

  const closeModal = () => {
    setModalContent(null);
  };

  const setSelectedMentorAndFreezeInitial = (
    studentId,
    mentorName,
    source = "manual"
  ) => {
    if (!mentorName) return;

    setStudents(prev =>
      prev.map(s => {
        if (s.id !== studentId) return s;

        // 1️⃣ 선택 멘토 갱신
        const next = {
          ...s,
          selectedMentor: mentorName,
        };

        // 2️⃣ 최초 멘토가 없을 때만 박제 (🔥 핵심)
        next.initialMentor = {
          mentor: mentorName,
          day: "",
          periodId: currentPeriodId || "initial",
          createdAt: Date.now(),
        };
        return next;
      })
    );
  };



  // ✅ ESC 키로 모달 닫기
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") closeModal(); };
    if (modalContent) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalContent]);

  // ✅ 검증 함수 (멘토링 가능 여부 + 상세 결과)
  const checkOverlap = (student) => {
    const selectedMentorName = student.selectedMentor;
    if (!selectedMentorName) {
      showModal("⚠ 선택된 멘토가 없습니다.");
      return;
    }

    let result = [];
    let matchFound = false;

    for (const day of days) {
      const periodAttendance = attendance[selectedPeriod] || {};
      const sTime = periodAttendance[student.id]?.[day];

      if (!sTime || sTime.length < 2) {
        result.push(`${day} ⛔ (출결 없음)`);
        continue;
      }

      const sStart = timeToMinutes(sTime[0]);
      const sEnd = timeToMinutes(sTime[1]);

      const mentors = mentorsByDay[day] || [];
      const mentor = mentors.find(m => m.name === selectedMentorName);

      if (!mentor || !mentor.time || !mentor.time.includes("~")) {
        result.push(`${day} ⛔ (멘토 없음)`);
        continue;
      }

      const [mStartStr, mEndStr] = mentor.time.split("~");
      const mStart = timeToMinutes(mStartStr);
      const mEnd = timeToMinutes(mEndStr);

      const overlap = Math.min(sEnd, mEnd) - Math.max(sStart, mStart);

      if (overlap >= 30) {
        result.push(`${day} ✅ (${overlap}분 겹침)`);
        matchFound = true;
      } else {
        result.push(`${day} ❌ (${overlap > 0 ? overlap + "분" : "0분"})`);
      }
    }

    showModal(
      matchFound
        ? `🟢 멘토링 가능 (${selectedMentorName})\n\n${result.join("\n")}`
        : `🔴 멘토링 불가능 (${selectedMentorName})\n\n${result.join("\n")}`
    );
  };

  // ✅ 요일별 멘토링 현황 계산 (화면 표시용)
  const mentoringByDay = days.reduce((acc, day) => {
    acc[day] = {};

    students.forEach((s) => {
      const mentor = s.selectedMentor;
      if (!mentor) return;

      const periodAttendance = attendance[selectedPeriod] || {};
      const studentTime = periodAttendance[s.id]?.[day];
      if (!studentTime || studentTime.length < 2) return;

      const mentors = mentorsByDay[day] || [];
      const mentorInfo = mentors.find(m => m.name === mentor);
      if (!mentorInfo) return;

      if (!acc[day][mentor]) acc[day][mentor] = [];
      acc[day][mentor].push(s.name);
    });

    return acc;
  }, {});

  // ✅ 추가: 전체 검증 (모든 학생을 검사하여 불일치 학생만 모아서 팝업)
  const checkAllOverlaps = () => {
    const fails = [];

    students.forEach((s) => {
      const selectedMentorName = s.selectedMentor;

      if (!selectedMentorName) {
        fails.push(`• ${s.name}: 선택 멘토 없음`);
        return;
      }

      let matchFound = false;
      const lines = [];

      for (const day of days) {
        const periodAttendance = attendance[selectedPeriod] || {};
        const sTime = periodAttendance[s.id]?.[day];

        if (!sTime || sTime.length < 2) {
          lines.push(`${day} ⛔ (출결 없음)`);
          continue;
        }

        const sStart = timeToMinutes(sTime[0]);
        const sEnd = timeToMinutes(sTime[1]);

        const mentors = mentorsByDay[day] || [];
        const mentor = mentors.find(m => m.name === selectedMentorName);

        if (!mentor || !mentor.time || !mentor.time.includes("~")) {
          lines.push(`${day} ⛔ (멘토 없음)`);
          continue;
        }

        const [mStartStr, mEndStr] = mentor.time.split("~");
        const mStart = timeToMinutes(mStartStr);
        const mEnd = timeToMinutes(mEndStr);

        const overlap = Math.min(sEnd, mEnd) - Math.max(sStart, mStart);

        if (overlap >= 30) {
          lines.push(`${day} ✅ (${overlap}분 겹침)`);
          matchFound = true;
        } else {
          lines.push(`${day} ❌ (${overlap > 0 ? overlap + "분" : "0분"})`);
        }
      }

      if (!matchFound) {
        fails.push(`${s.name} (${selectedMentorName})\n  - ${lines.join("\n  - ")}`);
      }
    });

    if (fails.length === 0) {
      showModal("🟢 모든 학생이 선택된 멘토와 최소 30분 이상 겹칩니다.");
    } else {
      showModal(`🔴 시간 불일치 학생 ${fails.length}명\n\n${fails.join("\n\n")}`);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold mb-2">6페이지: 자동 멘토 배정</h1>
      <button
        onClick={assignMentors}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        자동 배정 실행
      </button>

      {/* ✅ 전체 검증 버튼 */}
      <button
        onClick={checkAllOverlaps}
        className="ml-2 bg-purple-600 text-white px-4 py-2 rounded"
      >
        전체 검증
      </button>

      {/* ✅ 테이블을 스크롤 가능 영역으로 감쌈 */}
      <div className="overflow-y-auto max-h-[500px] border mt-4">
        <table className="w-full table-auto border-collapse text-center">
          <thead className="sticky top-0 bg-gray-100 z-10">
            <tr>
              <th className="border p-2">신입</th>   {/* 🔥 추가 */}
              <th className="border p-2">이름</th>
              <th className="border p-2">태어난 해</th>
              <th className="border p-2">성격</th>
              <th className="border p-2">국어</th>
              <th className="border p-2">수학</th>
              <th className="border p-2">탐구1</th>
              <th className="border p-2">탐구2</th>
              <th className="border p-2">고정멘토</th>
              <th className="border p-2">멘토 배제</th>
              <th className="border p-2 bg-blue-100">선택 멘토</th>
              <th className="border p-2">1순위</th>
              <th className="border p-2">2순위</th>
              <th className="border p-2">3순위</th>
              <th className="border p-2">검증</th>
            </tr>
          </thead>
          <tbody>
            {students.map(s => {
              const assign = assignments.find(a => a.studentId === s.id) || {};
              return (
                <tr
                  key={s.id}
                  className={
                    s.isNewStudent
                      ? ""
                      : "bg-gray-100 text-gray-400 opacity-60"
                  }
                >

                  {/* 🔥 신입생 체크박스 */}
                  <td className="border p-1 text-center">
                    <input
                      type="checkbox"
                      checked={!!s.isNewStudent}
                      onChange={(e) => {
                        const nextChecked = e.target.checked; // true=신입 유지, false=재학생 전환

                        setStudents(prev =>
                          prev.map(st => {
                            if (st.id !== s.id) return st;

                            // 신입으로 다시 켜는 건 상태만 변경
                            if (nextChecked) {
                              return { ...st, isNewStudent: true };
                            }

                            // 여기부터: 신입 해제(재학생 전환)
                            const selected = (st.selectedMentor || "").trim();

            
                            return {
                              ...st,
                              isNewStudent: false,
                            };
                          })
                        );
                      }}
                    />

                  </td>
                  <td className="border p-1">
                    {s.name}
                    {!s.isNewStudent && (
                      <span className="ml-1 text-xs bg-gray-300 text-gray-700 px-1 rounded">
                        재학생
                      </span>
                    )}
                  </td>

                  <td className="border p-1">
                    <input
                      type="number"
                      value={s.birthYear || ""}
                      onChange={(e) => updateStudent(s.id, "birthYear", e.target.value)}
                      className="w-24 border p-1"
                    />
                  </td>
                  <td className="border p-1">
                    <select
                      value={s.personality || ""}
                      onChange={(e) => updateStudent(s.id, "personality", e.target.value)}
                    >
                      <option value="">--선택--</option>
                      <option value="극I">극I</option>
                      <option value="극E">극E</option>
                      <option value="비극단적">비극단적</option>
                    </select>
                  </td>
                  <td className="border p-1">
                    <Select
                      options={koreanOptions}
                      value={koreanOptions.find(o => o.value === s.korean) || null}
                      onChange={opt => updateStudent(s.id, "korean", opt?.value || "")}
                    />
                  </td>
                  <td className="border p-1">
                    <Select
                      options={mathOptions}
                      value={mathOptions.find(o => o.value === s.math) || null}
                      onChange={opt => updateStudent(s.id, "math", opt?.value || "")}
                    />
                  </td>
                  <td className="border p-1">
                    <Select
                      options={exploreOptions}
                      value={exploreOptions.find(o => o.value === s.explore1) || null}
                      onChange={opt => updateStudent(s.id, "explore1", opt?.value || "")}
                    />
                  </td>
                  <td className="border p-1">
                    <Select
                      options={exploreOptions}
                      value={exploreOptions.find(o => o.value === s.explore2) || null}
                      onChange={opt => updateStudent(s.id, "explore2", opt?.value || "")}
                    />
                  </td>
                  <td className="border p-1">
                    <input
                      value={s.fixedMentor || ""}
                      onChange={(e) => updateStudent(s.id, "fixedMentor", e.target.value)}
                      className="w-24 border p-1"
                    />
                  </td>
                  <td className="border p-1">
                    <input
                      value={s.bannedMentor1 || ""}
                      onChange={(e) => updateStudent(s.id, "bannedMentor1", e.target.value)}
                      className="w-24 border p-1"
                    />
                  </td>
                  <td className="border p-1 text-sm">
                    <div className="font-semibold">
                      {s.selectedMentor || ""}
                    </div>
                    {s.selectedMentor && (
                      <div className="text-xs text-gray-500 mt-1">
                        {getMentorDays(s.selectedMentor, mentorsByDay).join(", ")}
                      </div>
                    )}
                  </td>

                  <td
                    className="border p-1 cursor-pointer hover:bg-yellow-100"
                    onClick={() => {
                      setSelectedMentorAndFreezeInitial(
                        s.id,
                        assign.first,
                        "manual" // 🔥 관리자 선택
                      );
                      showModal(assign.reasons?.first || "이유 없음");
                    }}
                  >
                    {assign.first || ""}
                  </td>
                  <td
                    className="border p-1 cursor-pointer hover:bg-yellow-100"
                    onClick={() => {
                      setSelectedMentorAndFreezeInitial(
                        s.id,
                        assign.second,
                        "manual"
                      );
                      showModal(assign.reasons?.second || "이유 없음");
                    }}
                  >
                    {assign.second || ""}
                  </td>
                  <td
                    className="border p-1 cursor-pointer hover:bg-yellow-100"
                    onClick={() => {
                      setSelectedMentorAndFreezeInitial(s.id, assign.third);
                      showModal(assign.reasons?.third || "이유 없음");
                    }}
                  >
                    {assign.third || ""}
                  </td>
                  <td className="border p-1">
                    <button
                      onClick={() => checkOverlap(s)}
                      className="px-2 py-1 bg-green-500 text-white rounded text-sm"
                    >
                      검증
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ✅ 요일별 멘토링 진행 현황 */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">
          요일별 멘토링 진행 현황
        </h2>

        <div className="grid grid-cols-2 gap-4">
          {days.map(day => (
            <div key={day} className="border rounded p-3 bg-white shadow-sm">
              <h3 className="font-bold mb-2">{day}요일</h3>

              {Object.keys(mentoringByDay[day]).length === 0 ? (
                <div className="text-sm text-gray-400">
                  배정된 멘토링 없음
                </div>
              ) : (
                Object.entries(mentoringByDay[day]).map(([mentor, students]) => (
                  <div key={mentor} className="mb-2">
                    <div className="font-semibold text-sm">
                      {mentor} ({students.length}명)
                    </div>
                    <ul className="list-disc pl-5 text-sm">
                      {students.map(name => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-2">멘토별 담당 학생</h2>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(
            students.reduce((acc, s) => {
              const selected = s.selectedMentor;
              if (selected) {
                if (!acc[selected]) acc[selected] = [];
                acc[selected].push(s.name);
              }
              return acc;
            }, {})
          ).map(([mentor, names]) => (
            <div key={mentor} className="p-2 border rounded bg-gray-50 shadow-sm">
              <h3 className="font-bold text-sm mb-1">{mentor} ({names.length}명)</h3>
              <ul className="text-sm list-disc pl-4">
                {names.map(n => <li key={n}>{n}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <StudentMentorOverlapTable />

      {/* ✅ 모달: 화면 가득 + 내부 스크롤 + sticky 헤더/푸터 + 오버레이 클릭/ESC 닫기 */}
      {modalContent && (
        <div className="fixed inset-0 z-50">
          {/* overlay */}
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
          {/* center panel */}
          <div className="relative mx-auto my-6 max-w-3xl w-[92%] h-[85vh]">
            <div className="bg-white rounded shadow flex flex-col h-full">
              {/* header (sticky) */}
              <div className="px-4 py-2 border-b sticky top-0 bg-white z-10 flex items-center justify-between">
                <h3 className="text-lg font-semibold">검증 결과</h3>
                <button
                  onClick={closeModal}
                  className="text-gray-500 hover:text-black"
                  aria-label="닫기"
                  title="닫기"
                >
                  ✕
                </button>
              </div>
              {/* body (scrollable) */}
              <div className="p-4 overflow-y-auto whitespace-pre-wrap">
                {modalContent}
              </div>
              {/* footer (sticky) */}
              <div className="px-4 py-2 border-t sticky bottom-0 bg-white z-10">
                <button
                  onClick={closeModal}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MentorAssignmentPage;
