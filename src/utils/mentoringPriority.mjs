export const DIRECTOR_MENTOR_NAME = "원장님";
const clean = value => String(value || "").trim();

export function isDirectorConsultingPending(student, periodId) {
  const status = student?.directorConsultingByPeriod?.[periodId]?.status;
  if (status) return status === "pending";
  // 기존 원장 지정은 처음 여는 주차로 이전하기 전까지 호환한다.
  return !student?.directorConsultingByPeriod && clean(student?.fixedMentor) === DIRECTOR_MENTOR_NAME;
}

export function getPriorityMentor(student, periodId) {
  if (isDirectorConsultingPending(student, periodId)) return DIRECTOR_MENTOR_NAME;
  const permanent = clean(student?.persistentFixedMentor);
  if (permanent && permanent !== DIRECTOR_MENTOR_NAME) return permanent;
  const legacy = clean(student?.fixedMentor);
  return legacy === DIRECTOR_MENTOR_NAME ? "" : legacy;
}

export function setDirectorConsultingStatus(student, periodId, status) {
  return {
    ...student,
    // 원장 지정에 사용되던 이전 필드만 정리하고 일반 고정 멘토는 보존한다.
    fixedMentor: clean(student.fixedMentor) === DIRECTOR_MENTOR_NAME ? "" : student.fixedMentor,
    directorConsultingByPeriod: {
      ...(student.directorConsultingByPeriod || {}),
      [periodId]: { status },
    },
  };
}
