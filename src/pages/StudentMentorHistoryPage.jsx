// src/pages/StudentMentorHistoryPage.jsx
import React, { useMemo, useState } from "react";
import { useSchedule } from "../context/ScheduleContext";

export default function StudentMentorHistoryPage() {
  const {
    students,
    periods,
    selectedPeriod,
    setSelectedPeriod,
  } = useSchedule();

  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [viewMode, setViewMode] = useState("student"); // 🔥 핵심

  // periodId 순서 보장
  const orderedPeriods = useMemo(() => {
    return Array.isArray(periods)
      ? [...periods]
          .filter(p => p && p.id)
          .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
      : [];
  }, [periods]);


  const toggleStudent = (id) => {
    setExpandedStudentId(prev => (prev === id ? null : id));
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">
        학생 멘토링 누적 기록
      </h1>

      {/* 🔀 보기 모드 토글 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setViewMode("student")}
          className={`px-3 py-1 rounded border
            ${viewMode === "student" ? "bg-blue-500 text-white" : "bg-white"}
          `}
        >
          학생 기준
        </button>
        <button
          onClick={() => setViewMode("period")}
          className={`px-3 py-1 rounded border
            ${viewMode === "period" ? "bg-blue-500 text-white" : "bg-white"}
          `}
        >
          기간 기준
        </button>
      </div>

      {/* 기간 선택 (공통) */}
      <div className="flex items-center gap-3">
        <span className="font-medium">기간 선택:</span>
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="border rounded px-2 py-1"
        >
          {orderedPeriods.map(p => (
            <option key={p.id} value={p.id}>
              {p.start} ~ {p.end}
            </option>
          ))}
        </select>
      </div>

      {/* ===================== */}
      {/* 🟦 학생 기준 보기 */}
      {/* ===================== */}
      {viewMode === "student" && (
        <div className="overflow-x-auto border rounded">
          <table className="w-full border-collapse text-sm text-center">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2 sticky left-0 bg-gray-100 z-10">
                  학생
                </th>
                {orderedPeriods.map(p => (
                  <th
                    key={p.id}
                    className={`border p-2
                      ${p.id === selectedPeriod ? "bg-blue-100 font-semibold" : ""}
                    `}
                  >
                    {p.start} ~ {p.end}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {students.map(student => {
                const history = student.mentorHistory || {};

                return (
                  <React.Fragment key={student.id}>
                    <tr
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleStudent(student.id)}
                    >
                      <td className="border p-2 sticky left-0 bg-white font-semibold">
                        {student.name}
                      </td>

                      {orderedPeriods.map(p => {
                        const h = history[p.id];
                        return (
                          <td key={p.id} className="border p-2">
                            {h ? (
                              <>
                                <div className="font-medium">{h.mentor}</div>
                                <div className="text-xs text-gray-500">
                                  {h.day} / {h.autoRank}순위
                                </div>
                              </>
                            ) : (
                              <span className="text-gray-300">–</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>

                    {expandedStudentId === student.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={orderedPeriods.length + 1} className="border p-4 text-left">
                          {orderedPeriods.map(p => {
                            const h = history[p.id];
                            if (!h) return null;
                            return (
                              <div key={p.id} className="border rounded p-2 mb-2 bg-white">
                                <div className="font-medium">{p.start} ~ {p.end}</div>
                                <div>멘토: {h.mentor}</div>
                                <div>요일: {h.day}</div>
                                <div>자동배정 순위: {h.autoRank}</div>
                              </div>
                            );
                          })}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ===================== */}
      {/* 🟩 기간 기준 보기 */}
      {/* ===================== */}
      {viewMode === "period" && (
        <div className="border rounded overflow-x-auto">
          <table className="w-full border-collapse text-sm text-center">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2">학생</th>
                <th className="border p-2">멘토</th>
                <th className="border p-2">요일</th>
                <th className="border p-2">자동배정 순위</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => {
                const h = s.mentorHistory?.[selectedPeriod];
                if (!h) return null;

                return (
                  <tr key={s.id}>
                    <td className="border p-2 font-semibold">{s.name}</td>
                    <td className="border p-2">{h.mentor}</td>
                    <td className="border p-2">{h.day}</td>
                    <td className="border p-2">{h.autoRank}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
