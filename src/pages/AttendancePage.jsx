import React, { useState } from "react"; 
import { useSchedule } from "../context/ScheduleContext";
import { timeToMinutes } from "../utils/scheduler";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const days = ["월", "화", "수", "목", "금", "토"];

export default function AttendancePage() {
  const {
    students, setStudents,
    attendance, setAttendance,
    mentorsByDay,
    startDate, endDate,
    periods, setPeriods,
    selectedPeriod, setSelectedPeriod,
  } = useSchedule();

  const [searchValue, setSearchValue] = useState("");
  const [search, setSearch] = useState("");

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
    if (!selectedPeriod) return;

    setAttendance(prev => {
      const next = { ...prev };
      const periodAtt = { ...(next[selectedPeriod] || {}) };
      const studentAtt = { ...(periodAtt[id] || {}) };
      const per = Array.isArray(studentAtt[day]) ? [...studentAtt[day]] : [];

      per[index] = value;

      // 둘 다 비어 있으면 출결 없음 처리
      if (!per[0] && !per[1]) {
        delete studentAtt[day];
      } else {
        studentAtt[day] = [per[0] || "", per[1] || ""];
      }

      periodAtt[id] = studentAtt;
      next[selectedPeriod] = periodAtt;

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
  };

  const deleteStudent = id => {
    setStudents(prev => prev.filter(s => s.id !== id));
    setAttendance(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(pid => {
        if (next[pid]) delete next[pid][id];
      });
      return next;
    });
  };

  const deleteAllStudents = () => {
    if (window.confirm("전체 학생 데이터를 삭제하시겠습니까?")) {
      setStudents([]);
      setAttendance({});
      setPeriods([]);
      setSelectedPeriod("");
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

  // ✅ [추가] 바로 이전 주차(period) id 구하기
  const getPrevPeriodId = (periods, currentId) => {
    const idx = (periods || []).findIndex(p => p.id === currentId);
    if (idx <= 0) return null;
    return periods[idx - 1].id;
  };

  // ================================
  // 🗑 선택 삭제
  // ================================
  const deleteSelectedRows = () => {
    if (selectedIds.size === 0) {
      alert("삭제할 학생을 선택하세요.");
      return;
    }
    if (!window.confirm(`${selectedIds.size}명을 삭제할까요?`)) return;

    setStudents(prev => prev.filter(s => !selectedIds.has(s.id)));
    setAttendance(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(pid => {
        selectedIds.forEach(id => {
          if (next[pid]) delete next[pid][id];
        });
      });
      return next;
    });
    setSelectedIds(new Set());
    setSelectionMode(false);
  };


  const calculateWeeklyTotal = studentId => {
    if (!selectedPeriod) return "0시간 0분";
    const att = attendance[selectedPeriod]?.[studentId] || {};
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
  // 주차 키를 만들어진 순서대로 정렬(저장된 periods 순서대로)
  const periodIds = (periods || []).map(p => p.id);

  // 학생의 특정 주차 멘토 히스토리 텍스트 만들기
  const getMentorHistoryText = (student, periodId) => {
    const item = student?.mentorHistory?.[periodId];
    if (!item) return "";
    const mentor = item.mentor || "";
    const day = item.day || "";
    return day ? `${mentor} (${day})` : mentor;
  };

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

  const filteredStudents = students.filter(s =>
    s.name.includes(searchValue.trim())
  );

  // ✅ 실제 엑셀 업로드 + 자동 입력 로직 (최종)
  const handleUploadExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedPeriod) {
      alert("주차를 먼저 선택하세요.");
      e.target.value = "";
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });

      // ✅ 시트 선택: '센터일정' 우선, 없으면 첫 시트
      const sheetName = workbook.SheetNames.includes("센터일정")
        ? "센터일정"
        : workbook.SheetNames[0];

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        blankrows: false,
        defval: "",
      });

      // ✅ 헤더 행 찾기 (이름 + 요일 포함된 행)
      const headerRowIndex = rows.findIndex(row =>
        row.includes("이름") && days.some(d => row.includes(d))
      );

      if (headerRowIndex === -1) {
        alert("엑셀에서 헤더(이름/요일)를 찾을 수 없습니다.");
        return;
      }

      const header = rows[headerRowIndex];
      const colIndex = {};
      header.forEach((h, i) => {
        if (h) colIndex[String(h).trim()] = i;
      });

      const nameCol = colIndex["이름"];
      if (nameCol == null) {
        alert("엑셀에 '이름' 컬럼이 없습니다.");
        return;
      }

      // 요일 컬럼 인덱스
      const dayCols = {};
      days.forEach(d => {
        if (colIndex[d] != null) dayCols[d] = colIndex[d];
      });

      const nextAttendance = { ...attendance };
      nextAttendance[selectedPeriod] = nextAttendance[selectedPeriod] || {};

      const nextStudents = [...students];
      const nameToStudent = {};
      students.forEach(s => {
        if (s.name) nameToStudent[s.name] = s;
      });

      // ===============================
      // 🔥 핵심: 시간 선택 규칙
      // - 복수 구간 → 22시 이하 중 가장 늦은 구간
      // ===============================
      const pickBestRange = (cell) => {
        if (!cell || typeof cell !== "string") return null;

        const ranges = cell
          .split(",")
          .map(s => s.trim())
          .map(s => {
            if (!s.includes("~")) return null;
            const [st, en] = s.split("~").map(x => x.trim());
            const stMin = timeToMinutes(st);
            let enMin = timeToMinutes(en);
            if (enMin < stMin) enMin += 1440; // 새벽 보정
            return { st, en, enMin };
          })
          .filter(Boolean);

        if (ranges.length === 0) return null;

        const limit = 22 * 60;
        const under22 = ranges.filter(r => r.enMin <= limit);

        if (under22.length > 0) {
          under22.sort((a, b) => b.enMin - a.enMin);
          return under22[0];
        }

        // 전부 22시 초과면 가장 가까운 것
        ranges.sort(
          (a, b) =>
            Math.abs(a.enMin - limit) - Math.abs(b.enMin - limit)
        );
        return ranges[0];
      };

      // ===============================
      // 📥 데이터 파싱
      // ===============================
      for (let r = headerRowIndex + 1; r < rows.length; r++) {
        const row = rows[r];
        const name = String(row[nameCol] || "").trim();
        if (!name) continue;

        let student = nameToStudent[name];
        if (!student) {
          student = { id: Date.now() + Math.random(), name, seatNumber: "" };
          nextStudents.push(student);
          nameToStudent[name] = student;
        }

        const sid = student.id;
        nextAttendance[selectedPeriod][sid] =
          nextAttendance[selectedPeriod][sid] || {};

        days.forEach(day => {
          const cell = row[dayCols[day]];
          const picked = pickBestRange(cell);
          if (picked) {
            nextAttendance[selectedPeriod][sid][day] = [picked.st, picked.en];
          } else {
            delete nextAttendance[selectedPeriod][sid][day];
          }
        });
      }

      setStudents(nextStudents);
      setAttendance(nextAttendance);

    } catch (err) {
      console.error(err);
      alert("엑셀 처리 중 오류가 발생했습니다.");
    }

    // 같은 파일 재업로드 가능하게 리셋
    e.target.value = "";
  };

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
        const times = attendance[selectedPeriod]?.[s.id]?.[d] || [];
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

  const deletePeriod = (id) => {
    if (!window.confirm("이 주차를 삭제하시겠습니까?")) return;

    setPeriods(prev => prev.filter(p => p.id !== id));

    if (selectedPeriod === id) {
      setSelectedPeriod("");
    }
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
                const [start = "", end = ""] = attendance[selectedPeriod]?.[student.id]?.[day] || [];
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
              <strong>{s.name}</strong>: 
              {formatAttendanceSummary(
                attendance[selectedPeriod]?.[s.id] || {}
              )
            }
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
