// src/utils/printOverrides.js
import { useEffect, useState } from "react";

const OV_KEY = "printOverrides";

function read() {
  try { return JSON.parse(localStorage.getItem(OV_KEY)) || {}; }
  catch { return {}; }
}

/**
 * 인쇄페이지에서 오버라이드 값을 구독/사용하기 위한 훅
 * - 저장 시 'print-overrides-updated' 이벤트를 받아 즉시 반영
 * - 다른 탭에서도 storage 이벤트로 반영
 */
export function usePrintOverrides() {
  const [overrides, setOverrides] = useState(read());

  useEffect(() => {
    const onCustom = () => setOverrides(read());
    const onStorage = (e) => {
      if (e.key === OV_KEY) setOverrides(read());
    };
    window.addEventListener("print-overrides-updated", onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("print-overrides-updated", onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const getForStudent = (studentId) => overrides?.[String(studentId)] || {};
  return { overrides, getForStudent };
}
