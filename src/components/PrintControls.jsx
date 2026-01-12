// src/components/PrintControls.jsx
import React from 'react'
import { Link } from 'react-router-dom'   // 라우터 Link 사용

export default function PrintControls({ options, onChange }) {
  return (
    <div className="flex space-x-4 mb-4">
      {Object.entries(options).map(([key, { label, enabled }]) => (
        <label key={key} className="inline-flex items-center space-x-1">
          <input
            type="checkbox"
            checked={enabled}
            onChange={() => onChange(key, !enabled)}
            className="form-checkbox"
          />
          <span>{label}</span>
        </label>
      ))}

      {/* 편집 페이지 진입 링크 */}
      <Link to="/print-edit" className="hidden">
        편집 페이지 열기
      </Link>
    </div>
  );
}
