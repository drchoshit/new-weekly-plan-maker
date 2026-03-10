import React, { useEffect, useMemo, useRef, useState } from "react";
import Select from "react-select";
import {
  DAYS,
  EXPLORE_OPTIONS,
  KOREAN_OPTIONS,
  MATH_OPTIONS,
  PERSONALITY_OPTIONS,
  buildByDayFromMentorDrafts,
  buildMentorDraftsFromByDay,
  buildMentorWorkSummary,
  createEmptyMentorDraft,
  normalizeMentorsByDay,
  stripMentorDraftIds,
} from "../utils/mentorInfo";

const PREVIEW_PLACEHOLDERS = {
  name: "이름",
  univ: "대학",
  major: "전공",
  gender: "성별",
  time: "근무시간",
  note: "비고",
  birthYear: "생년",
  mathSubject: "수학선택",
  koreanSubject: "국어선택",
  explore1: "탐구선택1",
  explore2: "탐구선택2",
  personality: "성격유형",
};

const TABLE_COLUMNS = [
  { key: "name", label: "이름" },
  { key: "univ", label: "대학" },
  { key: "major", label: "전공" },
  { key: "gender", label: "성별" },
  { key: "time", label: "근무시간" },
  { key: "note", label: "비고" },
  { key: "birthYear", label: "생년" },
  { key: "mathSubject", label: "수학" },
  { key: "koreanSubject", label: "국어" },
  { key: "explore1", label: "탐구1" },
  { key: "explore2", label: "탐구2" },
  { key: "personality", label: "성격" },
];

const FIELD_INPUT_CLASS =
  "h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";

const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 36,
    height: 36,
    borderRadius: 8,
    borderColor: state.isFocused ? "#34d399" : "#cbd5e1",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(16, 185, 129, 0.15)" : "none",
    "&:hover": {
      borderColor: state.isFocused ? "#34d399" : "#94a3b8",
    },
    backgroundColor: "#ffffff",
  }),
  valueContainer: base => ({
    ...base,
    height: 36,
    padding: "0 8px",
  }),
  input: base => ({
    ...base,
    margin: 0,
    padding: 0,
  }),
  indicatorsContainer: base => ({
    ...base,
    height: 36,
  }),
  menuPortal: base => ({
    ...base,
    zIndex: 50,
  }),
};

const multiSelectStyles = {
  ...selectStyles,
  control: (base, state) => ({
    ...selectStyles.control(base, state),
    minHeight: 36,
    height: "auto",
  }),
  valueContainer: base => ({
    ...selectStyles.valueContainer(base),
    height: "auto",
    minHeight: 36,
    paddingTop: 2,
    paddingBottom: 2,
  }),
  indicatorsContainer: base => ({
    ...selectStyles.indicatorsContainer(base),
    height: "auto",
    minHeight: 36,
  }),
};

const splitMultiValues = value =>
  String(value ?? "")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);

const getSelectValue = (options, value, isMulti = false) => {
  if (isMulti) {
    const set = new Set(splitMultiValues(value));
    return options.filter(opt => set.has(opt.value));
  }
  return options.find(opt => opt.value === value) || null;
};

const getSelectDraftValue = (selected, isMulti = false) => {
  if (isMulti) {
    return Array.isArray(selected)
      ? selected.map(opt => opt?.value).filter(Boolean).join(", ")
      : "";
  }
  return selected?.value || "";
};

const serializeByDay = byDay => JSON.stringify(normalizeMentorsByDay(byDay));

export default function MentorInfoEditor({
  mentorsByDay,
  onMentorsByDayChange,
  sessionTitle = "총괄 멘토 등록세션",
  summaryTitle = "🗓️ 멘토 근무시간 요약",
  showJsonDownload = false,
  jsonDownloadLabel = "JSON 다운로드",
  jsonFileName = "mentor_info.json",
  jsonScope = "mentorInfo",
  buildDownloadPayload,
  allowMultiSubjectSelection = false,
}) {
  const [mentorDrafts, setMentorDrafts] = useState(() =>
    buildMentorDraftsFromByDay(mentorsByDay)
  );
  const syncedSnapshotRef = useRef(serializeByDay(mentorsByDay));
  const idCounterRef = useRef(mentorDrafts.length + 1);

  useEffect(() => {
    const incoming = serializeByDay(mentorsByDay);
    if (incoming === syncedSnapshotRef.current) return;

    const nextDrafts = buildMentorDraftsFromByDay(mentorsByDay);
    setMentorDrafts(nextDrafts);
    idCounterRef.current = nextDrafts.length + 1;
    syncedSnapshotRef.current = incoming;
  }, [mentorsByDay]);

  const byDayPreview = useMemo(
    () => buildByDayFromMentorDrafts(mentorDrafts),
    [mentorDrafts]
  );
  const summaryRows = useMemo(
    () => buildMentorWorkSummary(mentorDrafts),
    [mentorDrafts]
  );

  useEffect(() => {
    const nextSnapshot = JSON.stringify(byDayPreview);
    if (nextSnapshot === syncedSnapshotRef.current) return;
    syncedSnapshotRef.current = nextSnapshot;
    onMentorsByDayChange(byDayPreview);
  }, [byDayPreview, onMentorsByDayChange]);

  const updateDraft = (mentorId, updater) => {
    setMentorDrafts(prev =>
      prev.map(draft => {
        if (draft.id !== mentorId) return draft;
        return updater(draft);
      })
    );
  };

  const addMentor = () => {
    const nextId = `mentor-local-${Date.now()}-${idCounterRef.current++}`;
    setMentorDrafts(prev => [...prev, createEmptyMentorDraft(nextId)]);
  };

  const removeMentor = mentorId => {
    setMentorDrafts(prev => {
      const filtered = prev.filter(draft => draft.id !== mentorId);
      return filtered.length ? filtered : [createEmptyMentorDraft("mentor-local-1")];
    });
  };

  const addShift = (mentorId, day = "") => {
    updateDraft(mentorId, draft => ({
      ...draft,
      shifts: [...(Array.isArray(draft.shifts) ? draft.shifts : []), { day, time: "" }],
    }));
  };

  const updateShift = (mentorId, shiftIndex, field, value) => {
    updateDraft(mentorId, draft => ({
      ...draft,
      shifts: (Array.isArray(draft.shifts) ? draft.shifts : []).map((shift, index) =>
        index === shiftIndex
          ? {
              ...shift,
              [field]: value,
            }
          : shift
      ),
    }));
  };

  const removeShift = (mentorId, shiftIndex) => {
    updateDraft(mentorId, draft => ({
      ...draft,
      shifts: (Array.isArray(draft.shifts) ? draft.shifts : []).filter(
        (_, index) => index !== shiftIndex
      ),
    }));
  };

  const downloadJson = () => {
    const payload =
      typeof buildDownloadPayload === "function"
        ? buildDownloadPayload({
            mentorDrafts,
            mentorsByDay: byDayPreview,
          })
        : {
            scope: jsonScope,
            exportedAt: new Date().toISOString(),
            mentors: stripMentorDraftIds(mentorDrafts),
            mentorsByDay: byDayPreview,
          };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = jsonFileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50/60 p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{sessionTitle}</h2>
            <p className="mt-1 text-xs text-slate-600">
              멘토 기본정보를 1회 입력한 뒤, 아래에서 근무 요일/시간을 여러 개 추가하세요.
              같은 요일도 중복 등록할 수 있습니다.
            </p>
          </div>
          <div className="flex gap-2">
            {showJsonDownload && (
              <button
                type="button"
                onClick={downloadJson}
                className="h-9 rounded-md bg-indigo-600 px-3 text-sm font-medium text-white transition hover:bg-indigo-700"
              >
                {jsonDownloadLabel}
              </button>
            )}
            <button
              type="button"
              onClick={addMentor}
              className="h-9 rounded-md bg-emerald-600 px-3 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              멘토 추가
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {mentorDrafts.map((mentor, mentorIndex) => (
            <article
              key={mentor.id}
              className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_1px_0_rgba(15,23,42,0.03)]"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">멘토 #{mentorIndex + 1}</h3>
                <button
                  type="button"
                  onClick={() => removeMentor(mentor.id)}
                  className="h-8 rounded-md bg-rose-500 px-3 text-xs font-medium text-white transition hover:bg-rose-600"
                >
                  삭제
                </button>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[1320px]">
                  <div className="mb-1 grid grid-cols-11 gap-2 text-[11px] font-medium tracking-wide text-slate-500">
                    <span>이름</span>
                    <span>대학</span>
                    <span>전공</span>
                    <span>성별</span>
                    <span>비고</span>
                    <span>생년</span>
                    <span>수학</span>
                    <span>국어</span>
                    <span>탐구1</span>
                    <span>탐구2</span>
                    <span>성격</span>
                  </div>
                  <div className="grid grid-cols-11 gap-2">
                    <input
                      placeholder="이름"
                      className={FIELD_INPUT_CLASS}
                      value={mentor.name}
                      onChange={e =>
                        updateDraft(mentor.id, draft => ({ ...draft, name: e.target.value }))
                      }
                    />
                    <input
                      placeholder="대학"
                      className={FIELD_INPUT_CLASS}
                      value={mentor.univ}
                      onChange={e =>
                        updateDraft(mentor.id, draft => ({ ...draft, univ: e.target.value }))
                      }
                    />
                    <input
                      placeholder="전공"
                      className={FIELD_INPUT_CLASS}
                      value={mentor.major}
                      onChange={e =>
                        updateDraft(mentor.id, draft => ({ ...draft, major: e.target.value }))
                      }
                    />
                    <input
                      placeholder="성별"
                      className={FIELD_INPUT_CLASS}
                      value={mentor.gender}
                      onChange={e =>
                        updateDraft(mentor.id, draft => ({ ...draft, gender: e.target.value }))
                      }
                    />
                    <input
                      placeholder="비고"
                      className={FIELD_INPUT_CLASS}
                      value={mentor.note}
                      onChange={e =>
                        updateDraft(mentor.id, draft => ({ ...draft, note: e.target.value }))
                      }
                    />
                    <input
                      placeholder="예: 1999"
                      className={FIELD_INPUT_CLASS}
                      value={mentor.birthYear}
                      onChange={e =>
                        updateDraft(mentor.id, draft => ({ ...draft, birthYear: e.target.value }))
                      }
                    />
                    <div className="min-w-0">
                      <Select
                        options={MATH_OPTIONS}
                        value={getSelectValue(
                          MATH_OPTIONS,
                          mentor.mathSubject,
                          allowMultiSubjectSelection
                        )}
                        onChange={selected =>
                          updateDraft(mentor.id, draft => ({
                            ...draft,
                            mathSubject: getSelectDraftValue(
                              selected,
                              allowMultiSubjectSelection
                            ),
                          }))
                        }
                        isMulti={allowMultiSubjectSelection}
                        closeMenuOnSelect={!allowMultiSubjectSelection}
                        placeholder="수학선택"
                        styles={
                          allowMultiSubjectSelection ? multiSelectStyles : selectStyles
                        }
                        menuPortalTarget={document.body}
                      />
                    </div>
                    <div className="min-w-0">
                      <Select
                        options={KOREAN_OPTIONS}
                        value={getSelectValue(
                          KOREAN_OPTIONS,
                          mentor.koreanSubject,
                          allowMultiSubjectSelection
                        )}
                        onChange={selected =>
                          updateDraft(mentor.id, draft => ({
                            ...draft,
                            koreanSubject: getSelectDraftValue(
                              selected,
                              allowMultiSubjectSelection
                            ),
                          }))
                        }
                        isMulti={allowMultiSubjectSelection}
                        closeMenuOnSelect={!allowMultiSubjectSelection}
                        placeholder="국어선택"
                        styles={
                          allowMultiSubjectSelection ? multiSelectStyles : selectStyles
                        }
                        menuPortalTarget={document.body}
                      />
                    </div>
                    <div className="min-w-0">
                      <Select
                        options={EXPLORE_OPTIONS}
                        value={getSelectValue(
                          EXPLORE_OPTIONS,
                          mentor.explore1,
                          allowMultiSubjectSelection
                        )}
                        onChange={selected =>
                          updateDraft(mentor.id, draft => ({
                            ...draft,
                            explore1: getSelectDraftValue(
                              selected,
                              allowMultiSubjectSelection
                            ),
                          }))
                        }
                        isMulti={allowMultiSubjectSelection}
                        closeMenuOnSelect={!allowMultiSubjectSelection}
                        placeholder="탐구선택1"
                        styles={
                          allowMultiSubjectSelection ? multiSelectStyles : selectStyles
                        }
                        menuPortalTarget={document.body}
                      />
                    </div>
                    <div className="min-w-0">
                      <Select
                        options={EXPLORE_OPTIONS}
                        value={getSelectValue(
                          EXPLORE_OPTIONS,
                          mentor.explore2,
                          allowMultiSubjectSelection
                        )}
                        onChange={selected =>
                          updateDraft(mentor.id, draft => ({
                            ...draft,
                            explore2: getSelectDraftValue(
                              selected,
                              allowMultiSubjectSelection
                            ),
                          }))
                        }
                        isMulti={allowMultiSubjectSelection}
                        closeMenuOnSelect={!allowMultiSubjectSelection}
                        placeholder="탐구선택2"
                        styles={
                          allowMultiSubjectSelection ? multiSelectStyles : selectStyles
                        }
                        menuPortalTarget={document.body}
                      />
                    </div>
                    <div className="min-w-0">
                      <Select
                        options={PERSONALITY_OPTIONS}
                        value={
                          PERSONALITY_OPTIONS.find(
                            opt => opt.value === mentor.personality
                          ) || null
                        }
                        onChange={selected =>
                          updateDraft(mentor.id, draft => ({
                            ...draft,
                            personality: selected?.value || "",
                          }))
                        }
                        placeholder="성격유형"
                        styles={selectStyles}
                        menuPortalTarget={document.body}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {DAYS.map(day => (
                    <button
                      key={`${mentor.id}-quick-${day}`}
                      type="button"
                      onClick={() => addShift(mentor.id, day)}
                      className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                      {day}요일 추가
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => addShift(mentor.id, "")}
                    className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
                  >
                    + 요일/시간 추가
                  </button>
                </div>

                {Array.isArray(mentor.shifts) && mentor.shifts.length > 0 ? (
                  <div className="space-y-1.5">
                    {mentor.shifts.map((shift, shiftIndex) => (
                      <div
                        key={`${mentor.id}-shift-${shiftIndex}`}
                        className="grid w-fit grid-cols-[84px_140px_64px] items-center gap-2"
                      >
                        <select
                          className="h-8 w-24 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          value={shift.day}
                          onChange={e =>
                            updateShift(mentor.id, shiftIndex, "day", e.target.value)
                          }
                        >
                          <option value="">요일</option>
                          {DAYS.map(day => (
                            <option key={`${mentor.id}-${day}-${shiftIndex}`} value={day}>
                              {day}
                            </option>
                          ))}
                        </select>
                        <input
                          className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          placeholder="예: 18:30~22:00"
                          value={shift.time}
                          onChange={e =>
                            updateShift(mentor.id, shiftIndex, "time", e.target.value)
                          }
                        />
                        <button
                          type="button"
                          onClick={() => removeShift(mentor.id, shiftIndex)}
                          className="h-8 rounded-md bg-slate-200 px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-300"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">
                    요일/시간 추가 버튼으로 근무 스케줄을 등록하세요.
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        {DAYS.map(day => {
          const mentors = byDayPreview[day] || [];
          const rows = mentors.length ? mentors : [{}];

          return (
            <div
              key={`preview-${day}`}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_0_rgba(15,23,42,0.03)]"
            >
              <div className="border-b border-slate-200 bg-gradient-to-r from-slate-100 to-slate-50 px-4 py-2 text-lg font-bold text-slate-800">
                {day}요일 멘토
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[1150px] w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {TABLE_COLUMNS.map(column => (
                        <th
                          key={`${day}-th-${column.key}`}
                          className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold tracking-wide text-slate-600"
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((mentor, rowIndex) => (
                      <tr key={`${day}-row-${rowIndex}`} className="odd:bg-white even:bg-slate-50/50">
                        {TABLE_COLUMNS.map(column => (
                          <td
                            key={`${day}-row-${rowIndex}-${column.key}`}
                            className="border-b border-slate-100 px-3 py-2 text-slate-800"
                          >
                            {mentor[column.key] || (
                              <span className="text-slate-400">
                                {PREVIEW_PLACEHOLDERS[column.key]}
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-4">
        <h2 className="mb-2 text-xl font-bold text-slate-800">{summaryTitle}</h2>
        {summaryRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-sm">
              <thead className="bg-white/70">
                <tr>
                  <th className="rounded-l-md px-3 py-2 text-left font-semibold text-slate-700">
                    멘토
                  </th>
                  {DAYS.map(day => (
                    <th key={`summary-head-${day}`} className="px-3 py-2 text-left font-semibold text-slate-700">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaryRows.map(row => (
                  <tr key={`summary-${row.name}`} className="border-t border-emerald-100">
                    <td className="px-3 py-2 font-semibold text-slate-800">{row.name}</td>
                    {DAYS.map(day => (
                      <td key={`summary-${row.name}-${day}`} className="px-3 py-2 text-slate-700">
                        {row.byDay[day]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-slate-600">등록된 멘토가 없습니다.</div>
        )}
      </section>
    </div>
  );
}
