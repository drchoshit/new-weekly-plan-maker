// 문자열 시간("오전 09:00", "오후 09:00" 또는 24시간 "HH:MM") → 분 단위 숫자
export function timeToMinutes(t) {
  if (!t || typeof t !== 'string') return 0;

  // HTML <input type="time"> 의 24시간 순수 포맷 감지 ("09:00", "14:30" 등)
  if (/^\d{2}:\d{2}$/.test(t)) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }

  // 기존 "오전"/"오후" 처리 로직
  try {
    const isPM = t.includes("오후");
    const clean = t.replace(/오전|오후| /g, "");
    const [h, m] = clean.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return 0;
    const hour = isPM && h !== 12
      ? h + 12
      : !isPM && h === 12
        ? 0
        : h;
    return hour * 60 + m;
  } catch {
    return 0;
  }
}

// 숫자(분) → 문자열 시간("09:00")
export function minutesToTime(m) {
  if (typeof m !== 'number' || isNaN(m) || m < 0) return '00:00';
  const h = String(Math.floor(m / 60)).padStart(2, "0");
  const min = String(m % 60).padStart(2, "0");
  return `${h}:${min}`;
}

// 시간 슬롯 생성기
// start/end: "오전 09:00", "14:30" 등, duration: 분 단위 숫자
export function generateSlots(start, end, duration) {
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  const slots = [];

  if (isNaN(startMin) || isNaN(endMin) || startMin >= endMin || duration <= 0) {
    return slots;
  }

  let current = startMin;
  while (current + duration <= endMin) {
    slots.push({
      start: minutesToTime(current),
      end: minutesToTime(current + duration),
    });
    current += duration;
  }

  return slots;
}
