// src/components/PrintControls.jsx
import React from 'react';
import { Link } from 'react-router-dom';   // 라우터 Link 사용

/**
 * PrintControls
 * - 인쇄 페이지에서 출력 섹션 on/off 제어
 * - options 구조 예:
 *   {
 *     header:   { label: '헤더', enabled: true },
 *     mentors:  { label: '멘토표', enabled: true },
 *     planner:  { label: '플래너체크', enabled: true },
 *     calendar: { label: '학생 주간 일정', enabled: true }, // 🔥 추가된 항목
 *     interview:{ label: '인터뷰', enabled: true },
 *     notices:  { label: '공지사항', enabled: true },
 *   }
 */
export default function PrintControls({ options, onChange }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4">
      {Object.entries(options).map(([key, { label, enabled }]) => (
        <label
          key={key}
          className="inline-flex items-center space-x-1 cursor-pointer select-none"
        >
          <input
            type="checkbox"
            checked={enabled}
            onChange={() => onChange(key, !enabled)}
            className="form-checkbox"
          />
          <span className="text-sm">{label}</span>
        </label>
      ))}

      {/* 인쇄 편집 페이지 (현재는 숨김 유지) */}
      <Link to="/print-edit" className="hidden">
        편집 페이지 열기
      </Link>
    </div>
  );
}
