import React from "react";
import { useSchedule } from "../context/ScheduleContext";

// 날짜 차이 계산
const diffDays = (from, to) => {
  if (!from || !to) return null;
  const a = new Date(from);
  const b = new Date(to);
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
};

export default function DirectorConsultingPage() {
  const { students, studentConsultings, setStudentConsultings } = useSchedule();
  const today = new Date().toISOString().slice(0, 10);

  // ===== 컨설팅 최대 회차 =====
  const maxConsultCount = Math.max(
    0,
    ...students.map(
      s => (studentConsultings[s.id]?.consultings || []).length
    )
  );

  // ===== 회차 추가 =====
  const addConsultingColumn = () => {
    setStudentConsultings(prev => {
      const next = { ...prev };
      students.forEach(s => {
        const cur = next[s.id] || { joinDate: "", consultings: [] };
        next[s.id] = {
          ...cur,
          consultings: [...cur.consultings, ""],
        };
      });
      return next;
    });
  };

  // ===== 회차 삭제 =====
  const removeConsultingColumn = (index) => {
    if (!window.confirm(`컨설팅 ${index + 1}회차를 삭제할까요?`)) return;
    setStudentConsultings(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(id => {
        const cur = next[id];
        if (cur?.consultings?.length > index) {
          const list = [...cur.consultings];
          list.splice(index, 1);
          next[id] = { ...cur, consultings: list };
        }
      });
      return next;
    });
  };

  // ===== 값 수정 =====
  const updateJoinDate = (id, value) => {
    setStudentConsultings(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || { consultings: [] }),
        joinDate: value,
      },
    }));
  };

  const updateConsultingDate = (id, idx, value) => {
    setStudentConsultings(prev => {
      const cur = prev[id] || { joinDate: "", consultings: [] };
      const list = [...cur.consultings];
      list[idx] = value;
      return {
        ...prev,
        [id]: { ...cur, consultings: list },
      };
    });
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* ===== 헤더 / 액션 바 ===== */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">원장 컨설팅 관리</h1>
          <p className="text-sm text-gray-500 mt-1">
            학생별 원장 컨설팅 이력 및 주기 관리
          </p>
        </div>

        <button
          onClick={addConsultingColumn}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm"
        >
          + 원장 컨설팅 회차 추가
        </button>
      </div>

      {/* ===== 테이블 카드 ===== */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="border-collapse text-sm min-w-max table-fixed w-full">
          <thead>
            <tr className="bg-gray-100 text-gray-700">
              {/* ===== 고정 열 ===== */}
              <th className="border px-3 py-2 sticky left-0 bg-gray-100 z-10 w-[80px]">
                이름
              </th>
              <th className="border px-3 py-2 sticky left-[80px] bg-gray-100 z-10 w-[300px]">
                선택과목
              </th>
              <th className="border px-3 py-2 sticky left-[280px] bg-gray-100 z-10 w-[140px]">
                센터 등록일
              </th>
              <th className="border px-3 py-2 sticky left-[420px] bg-gray-100 z-10 w-[140px]">
                등록 → 최근
              </th>
              <th className="border px-3 py-2 sticky left-[560px] bg-gray-100 z-10 w-[140px]">
                최근 → 오늘
              </th>

              {/* ===== 가변 컨설팅 열 ===== */}
              {Array.from({ length: maxConsultCount }).map((_, i) => (
                <th
                  key={i}
                  className="border px-3 py-2 w-[140px] min-w-[140px]"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">컨설팅 {i + 1}</span>
                    <button
                      onClick={() => removeConsultingColumn(i)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {students.map(s => {
              const data = studentConsultings[s.id] || {
                joinDate: "",
                consultings: [],
              };
              const valid = data.consultings.filter(Boolean);
              const last = valid.length ? valid[valid.length - 1] : null;

              return (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="border px-3 py-2 sticky left-0 bg-white z-10 font-medium">
                    {s.name}
                  </td>

                  <td className="border px-3 py-2 sticky left-[80px] bg-white z-10 text-gray-600">
                    {[s.korean, s.math, s.explore1, s.explore2]
                      .filter(Boolean)
                      .join(", ")}
                  </td>

                  <td className="border px-3 py-2 sticky left-[280px] bg-white z-10">
                    <input
                      type="date"
                      className="border rounded-md px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
                      value={data.joinDate || ""}
                      onChange={e =>
                        updateJoinDate(s.id, e.target.value)
                      }
                    />
                  </td>

                  <td
                    className={`border px-3 py-2 sticky left-[420px] bg-white z-10 ${
                      !last ? "bg-orange-100 text-orange-700" : ""
                    }`}
                  >
                    {data.joinDate && last
                      ? `${diffDays(data.joinDate, last)}일`
                      : "-"}
                  </td>

                  <td className="border px-3 py-2 sticky left-[560px] bg-white z-10">
                    {last ? `${diffDays(last, today)}일` : "-"}
                  </td>

                  {Array.from({ length: maxConsultCount }).map((_, i) => (
                    <td
                      key={i}
                      className="border px-3 py-2 w-[140px] min-w-[140px]"
                    >
                      <input
                        type="date"
                        className="border rounded-md px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
                        value={data.consultings[i] || ""}
                        onChange={e =>
                          updateConsultingDate(
                            s.id,
                            i,
                            e.target.value
                          )
                        }
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
