import React, { useState } from "react";
import { useSchedule } from "../context/ScheduleContext";
import * as XLSX from "xlsx"; // ✅ 엑셀 라이브러리 추가
import { saveAs } from "file-saver"; // ✅ 파일 저장

const days = ["월", "화", "수", "목", "금", "토"];

const parseTimeRange = (range) => {
  if (!range.includes("~")) return 0;
  const [start, end] = range.split("~").map((t) => t.trim());
  const [sh, sm = "0"] = start.split(":").map(Number);
  const [eh, em = "0"] = end.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  return Math.max(0, endMin - startMin);
};

const studentsSample = Array.from({ length: 100 }, (_, i) => ({
  name: `학생${i + 1}`,
  attendance: {},
}));

const AttendancePage = () => {
  // ✅ 컨텍스트에서 데이터 가져오기
  const {
    students,
    setStudents,
    attendance,
    setAttendance,
    startDate,
    endDate,
  } = useSchedule();

  const [search, setSearch] = useState("");

  // ✅ 출결 업데이트 함수
  const updateTime = (id, day, value) => {
    const updated = { ...attendance };
    if (!updated[id]) updated[id] = {};
    updated[id][day] = value;
    setAttendance(updated);
  };

  // ✅ 학생 이름 변경
  const updateName = (id, value) => {
    const updated = [...students];
    const idx = updated.findIndex((s) => s.id === id);
    if (idx > -1) {
      updated[idx].name = value;
      setStudents(updated);
    }
  };

  // ✅ 검색 필터 적용
  const filtered = students.filter((s) => s.name.includes(search));

  // ✅ 엑셀 다운로드 기능
  const handleDownloadExcel = () => {
    const wb = XLSX.utils.book_new();

    // ✅ 헤더 (템플릿 매핑)
    const header = [
      "이름",
      "전화번호", // 공란
      "월",
      "화",
      "수",
      "목",
      "금",
      "토",
      "총 체류(분)",
    ];

    const wsData = [
      [`주간 일정: ${startDate} ~ ${endDate}`],
      header,
    ];

    // ✅ 학생 데이터 작성
    students.forEach((s) => {
      const row = [];
      row.push(s.name);
      row.push(""); // 전화번호는 공란
      let total = 0;
      days.forEach((d) => {
        const range = attendance[s.id]?.[d] || "";
        row.push(range);
        total += parseTimeRange(range);
      });
      row.push(total);
      wsData.push(row);
    });

    // ✅ 워크시트 생성
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "출결표");

    // ✅ 다운로드
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([wbout], { type: "application/octet-stream" }),
      `학생출결_${startDate}-${endDate}.xlsx`
    );
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">3페이지 - 주간 출석 및 재원 시간 관리</h1>
      <div className="flex justify-between items-center mb-4">
        <input
          type="text"
          placeholder="이름 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-2 py-1 w-1/3"
        />
        {/* ✅ 엑셀 다운로드 버튼 */}
        <button
          onClick={handleDownloadExcel}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          엑셀 다운로드
        </button>
      </div>
      <div className="overflow-auto max-h-[70vh] border">
        <table className="table-auto w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-gray-100 z-10">
            <tr>
              <th className="border px-2 py-1">이름</th>
              {days.map((day) => (
                <th key={day} className="border px-2 py-1">
                  {day} (입~퇴)
                </th>
              ))}
              {days.map((day) => (
                <th key={day + "dur"} className="border px-2 py-1">
                  {day} 체류
                </th>
              ))}
              <th className="border px-2 py-1 font-bold">주간 합계</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((student, idx) => {
              const durations = days.map((day) =>
                parseTimeRange(attendance[student.id]?.[day] || "")
              );
              const weekly = durations.reduce((a, b) => a + b, 0);
              return (
                <tr key={student.id}>
                  <td className="border px-1">
                    <input
                      type="text"
                      className="w-full px-1 py-0.5 font-semibold"
                      value={student.name}
                      onChange={(e) => updateName(student.id, e.target.value)}
                    />
                  </td>
                  {days.map((day) => (
                    <td key={day + "in"} className="border px-1">
                      <input
                        type="text"
                        className="w-full px-1 py-0.5"
                        placeholder="9:00~12:00"
                        value={attendance[student.id]?.[day] || ""}
                        onChange={(e) => updateTime(student.id, day, e.target.value)}
                      />
                    </td>
                  ))}
                  {durations.map((min, i) => (
                    <td key={i + "dur"} className="border text-center">
                      {min}
                    </td>
                  ))}
                  <td className="border text-center font-bold">{weekly}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttendancePage;
