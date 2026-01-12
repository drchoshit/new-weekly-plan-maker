import React, { useState } from "react"; 
import { useSchedule } from "../context/ScheduleContext";
import { timeToMinutes } from "../utils/scheduler";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const days = ["월", "화", "수", "목", "금", "토"];

export default function AttendancePage() {
  const { students, setStudents, attendance, setAttendance, startDate, endDate } = useSchedule();

  const [search, setSearch] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [excelOnlyStudentNames, setExcelOnlyStudentNames] = useState([]); // ✅ 추가

  // ✅ 추가: 복수 삭제(선택 모드)
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // ✅ 추가: 컨트롤드 인풋 핸들러 (기존 코드에서 참조하던 함수 정의)
  const updateName = (id, value) => {
    setStudents(prev => prev.map(s => (s.id === id ? { ...s, name: value } : s)));
  };
  const updateSeatNumber = (id, value) => {
    setStudents(prev => prev.map(s => (s.id === id ? { ...s, seatNumber: value } : s)));
  };
  const updateTime = (id, day, index, value) => {
    setAttendance(prev => {
      const next = { ...prev };
      const per = Array.isArray(next[id]?.[day]) ? [...next[id][day]] : ["", ""];
      per[index] = value;
      next[id] = { ...(next[id] || {}), [day]: per };
      return next;
    });
  };

  // ✅ 추가: 시간 값 정규화 유틸 (엑셀 업로드 후 입력 잠김 방지)
  const normalizeTimeValue = (value) => {
    if (Array.isArray(value)) {
      const a = value.map(v => (typeof v === "string" ? v.trim() : ""));
      if (!a[0] && !a[1]) return [];
      return [a[0] || "", a[1] || ""];
    }
    if (typeof value === "string") {
      const s = value.trim();
      if (!s) return [];
      if (s.includes("~")) {
        const [st, en] = s.split("~").map(x => x.trim());
        if (!st && !en) return [];
        return [st || "", en || ""];
      }
      return [s, ""];
    }
    return [];
  };

  const addStudent = () => {
    const newStudent = { id: Date.now(), name: "", seatNumber: "" };
    setStudents(prev => [...prev, newStudent]);
    setAttendance(prev => ({
      ...prev,
      [newStudent.id]: {}
    }));
  };

  const deleteStudent = id => {
    setStudents(prev => prev.filter(s => s.id !== id));
    setAttendance(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const deleteAllStudents = () => {
    if (window.confirm("전체 학생 데이터를 삭제하시겠습니까?")) {
      setStudents([]);
      setAttendance({});
    }
  };

  // ✅ 추가: 선택 모드/체크/일괄 삭제
  const toggleSelectionMode = () => {
    setSelectionMode(v => !v);
    setSelectedIds(new Set());
  };
  const toggleSelectRow = (id) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const toggleSelectAll = (e, list) => {
    const checked = e.target.checked;
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(list.map(s => s.id)));
  };
  const deleteSelectedRows = () => {
    if (selectedIds.size === 0) {
      alert("삭제할 학생을 선택하세요.");
      return;
    }
    if (!window.confirm(`${selectedIds.size}명을 삭제할까요?`)) return;

    setStudents(prev => prev.filter(s => !selectedIds.has(s.id)));
    setAttendance(prev => {
      const next = { ...prev };
      for (const id of selectedIds) delete next[id];
      return next;
    });
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const calculateWeeklyTotal = studentId => {
    const att = attendance[studentId] || {};
    const totalMinutes = days.reduce((sum, d) => {
      const times = att[d];
      if (Array.isArray(times) && times[0] && times[1]) {
        let start = timeToMinutes(times[0]);
        let end = timeToMinutes(times[1]);
        if (end < start) end += 1440; // ✅ 새벽 넘김 처리
        sum += end - start;
      }
      return sum;
    }, 0);

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}시간 ${minutes}분`;
  };

  const formatAttendanceSummary = (att = {}) =>
    days
      .map(d => {
        const times = att[d];
        return `${d}: ${
          Array.isArray(times) && times[0] && times[1]
            ? `${times[0]}~${times[1]}`
            : "없음"
        }`;
      })
      .join(", ");

  const handleSortByName = () => {
    const sorted = [...students].sort((a, b) =>
      a.name.localeCompare(b.name, "ko-KR")
    );
    setStudents(sorted);
  };

  const handleSortBySeat = () => {
    const sorted = [...students].sort((a, b) => {
      const seatA = parseInt(a.seatNumber, 10);
      const seatB = parseInt(b.seatNumber, 10);
      if (isNaN(seatA) && isNaN(seatB)) return 0;
      if (isNaN(seatA)) return 1;
      if (isNaN(seatB)) return -1;
      return seatA - seatB;
    });
    setStudents(sorted);
  };

  const handleSearch = () => {
    setSearch(searchValue.trim());
  };

  const filteredStudents = students.filter(s => s.name.includes(search));

  const handleDownloadExcel = () => {
    const wb = XLSX.utils.book_new();
    const header = ["이름", "좌석번호", "전화번호", ...days, "총 체류(분)"];
    const wsData = [
      [`주간 일정: ${startDate || ""} ~ ${endDate || ""}`],
      header,
    ];

    students.forEach((s) => {
      const row = [s.name, s.seatNumber || "", ""];
      let total = 0;
      days.forEach((d) => {
        const times = attendance[s.id]?.[d] || [];
        const range = times[0] && times[1] ? `${times[0]}~${times[1]}` : "";
        row.push(range);
        if (times[0] && times[1]) {
          total += timeToMinutes(times[1]) - timeToMinutes(times[0]);
        }
      });
      row.push(total);
      wsData.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "출결표");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([wbout], { type: "application/octet-stream" }),
      `학생출결_${startDate || "start"}-${endDate || "end"}.xlsx`
    );
  };

  const handleUploadExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const existingStudents = [...students];
      const updatedAttendance = { ...attendance };
      const nameToStudent = Object.fromEntries(existingStudents.map(s => [s.name, s]));
      const importedNames = new Set();
      const dayIndex = { 월: 3, 화: 4, 수: 5, 목: 6, 금: 7, 토: 8 };
      const newStudents = [];

      for (let i = 2; i < rows.length; i++) {
        const row = rows[i];
        const name = (row[0] || "").trim();
        const seat = row[1] || "";
        if (!name) continue;

        importedNames.add(name);

        let student = nameToStudent[name];
        if (!student) {
          student = { id: Date.now() + i, name, seatNumber: seat };
          newStudents.push(student);
          nameToStudent[name] = student;
        }

        const id = student.id;
        updatedAttendance[id] = updatedAttendance[id] || {};

        for (const day of days) {
          const cell = row[dayIndex[day]];
          if (typeof cell === "string") {
            const ranges = cell
              .split(",")
              .map(s => s.trim())
              .filter(s => s.includes("~"))
              .map(s => {
                const [start, end] = s.split("~").map(t => t.trim());
                let endMinutes = timeToMinutes(end);
                if (endMinutes < 120) endMinutes += 1440;
                return { start, end, adjustedEndMinutes: endMinutes };
              });

            if (ranges.length > 0) {
              ranges.sort((a, b) => b.adjustedEndMinutes - a.adjustedEndMinutes);
              const { start, end } = ranges[0];
              // ✅ 정규화해서 저장
              updatedAttendance[id][day] = normalizeTimeValue([start, end]);
            } else {
              // ✅ 빈 값도 정규화
              updatedAttendance[id][day] = normalizeTimeValue("");
            }
          } else {
            updatedAttendance[id][day] = normalizeTimeValue("");
          }
        }
      }

      // ⚠ 엑셀에 없는 기존 학생 이름들 찾기
      const missingStudents = existingStudents
        .filter(s => !importedNames.has(s.name))
        .map(s => s.name);

      if (missingStudents.length > 0) {
        alert(`⚠️ 엑셀에 없는 학생:\n${missingStudents.join(", ")}`);
      }

      // ✅ 엑셀에만 있는 학생 목록 저장 (삭제용)
      const excelOnlyNames = Array.from(importedNames).filter(
        name => !existingStudents.find(s => s.name === name)
      );
      setExcelOnlyStudentNames(excelOnlyNames);

      // ✅ 학생 목록 병합
      setStudents([...existingStudents, ...newStudents]);

      // ✅ 출결 병합 + 최종 정규화(모든 요일을 배열 형태로 맞춤)
      const merged = { ...attendance, ...updatedAttendance };
      Object.keys(merged).forEach(sid => {
        days.forEach(d => {
          merged[sid][d] = normalizeTimeValue(merged[sid][d]);
        });
      });

      setAttendance(merged);

      // ✅ 같은 파일 다시 업로드 가능하도록 리셋
      if (e.target && "value" in e.target) {
        e.target.value = "";
      }
    };

    reader.readAsBinaryString(file);
  };

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold mb-2">학생 출결 입력</h1>

      <div className="flex items-center gap-4 mb-4">
        <button onClick={addStudent} className="bg-green-500 text-white px-4 py-2 rounded">+ 학생 추가</button>
        <button onClick={handleSortByName} className="bg-blue-500 text-white px-4 py-2 rounded">이름순 정렬</button>
        <button onClick={handleSortBySeat} className="bg-purple-500 text-white px-4 py-2 rounded">좌석순 정렬</button>
        <input
          type="text"
          placeholder="이름 검색"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="border px-2 py-1"
        />
        <button onClick={handleSearch} className="bg-gray-500 text-white px-4 py-2 rounded">검색</button>

        <input
          type="file"
          accept=".xlsx, .xls"
          onChange={handleUploadExcel}
          className="border px-2 py-1"
        />
        <button onClick={handleDownloadExcel} className="bg-green-600 text-white px-4 py-2 rounded">엑셀 다운로드</button>

        {/* ✅ 추가: 선택 모드 토글 + 선택 삭제 */}
        <button onClick={toggleSelectionMode} className="bg-orange-500 text-white px-4 py-2 rounded">
          {selectionMode ? "선택 모드 해제" : "선택 모드"}
        </button>
        {selectionMode && (
          <button onClick={deleteSelectedRows} className="bg-red-600 text-white px-4 py-2 rounded">
            선택 삭제
          </button>
        )}

        <div className="ml-auto text-lg font-medium">총 학생 수: {students.length}명</div>
      </div>

      <table className="w-full mt-4 text-center border-collapse border">
        <thead>
          <tr className="bg-gray-100">
            {/* ✅ 선택 모드일 때만 체크박스 헤더 */}
            {selectionMode && (
              <th className="border px-2">
                <input
                  type="checkbox"
                  onChange={(e) => toggleSelectAll(e, filteredStudents)}
                />
              </th>
            )}
            <th className="border px-2">이름</th>
            <th className="border px-2">좌석 번호</th>
            {days.map(d => (
              <th key={d} colSpan={2} className="border px-2">{d}</th>
            ))}
            <th className="border px-2">총합</th>
            <th className="border px-2">삭제</th>
          </tr>
        </thead>
        <tbody>
          {filteredStudents.map(student => (
            <tr key={student.id}>
              {/* ✅ 선택 모드일 때 체크박스 셀 */}
              {selectionMode && (
                <td className="border px-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(student.id)}
                    onChange={() => toggleSelectRow(student.id)}
                  />
                </td>
              )}
              <td className="border px-2">
                <input
                  className="border px-1 w-24"
                  value={student.name}
                  onChange={e => updateName(student.id, e.target.value)}
                />
              </td>
              <td className="border px-2">
                <input
                  className="border px-1 w-16 text-center"
                  value={student.seatNumber || ""}
                  onChange={e => updateSeatNumber(student.id, e.target.value)}
                  placeholder="좌석"
                />
              </td>
              {days.map(day => {
                const [start = "", end = ""] = attendance[student.id]?.[day] || [];
                return (
                  <React.Fragment key={day}>
                    <td className="border px-1">
                      <input
                        type="text"
                        className="border px-1 w-16 text-center"
                        value={start}
                        placeholder="HH:MM"
                        onChange={e => updateTime(student.id, day, 0, e.target.value)}
                      />
                    </td>
                    <td className="border px-1">
                      <input
                        type="text"
                        className="border px-1 w-16 text-center"
                        value={end}
                        placeholder="HH:MM"
                        onChange={e => updateTime(student.id, day, 1, e.target.value)}
                      />
                    </td>
                  </React.Fragment>
                );
              })}
              <td className="border px-2">{calculateWeeklyTotal(student.id)}</td>
              <td className="border px-2">
                <button
                  onClick={() => deleteStudent(student.id)}
                  className="bg-red-500 text-white px-2 py-1 rounded"
                >
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-2">학생 출결 요약</h2>
        <div className="space-y-1 text-sm">
          {filteredStudents.map(s => (
            <div key={s.id}>
              <strong>{s.name}</strong>: {formatAttendanceSummary(attendance[s.id])}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
