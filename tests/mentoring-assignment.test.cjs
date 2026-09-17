const { test, before } = require("node:test");
const assert = require("node:assert/strict");
const { build } = require("esbuild");
const path = require("node:path");
const Module = require("node:module");

// 실제 페이지의 이벤트 핸들러와 배정 알고리즘을 실행한다.
// DOM 대신 요소 트리, React 상태 대신 동기 상태 저장소를 사용한다.
let Page;
let current;
let hooks;
let cursor;
global.__mentoringTest = {
  context: () => current,
  useState(initial) {
    const index = cursor++;
    if (!(index in hooks)) hooks[index] = typeof initial === "function" ? initial() : initial;
    return [hooks[index], value => { hooks[index] = typeof value === "function" ? value(hooks[index]) : value; }];
  },
};
before(async () => {
  const result = await build({
    entryPoints: [path.join(__dirname, "../src/pages/MentorAssignmentPage.jsx")],
    bundle: true, write: false, platform: "node", format: "cjs",
    plugins: [{ name: "page-test-adapters", setup(build) {
      build.onResolve({ filter: /^(react|react-select)$|ScheduleContext$|StudentMentorOverlapTable$/ }, args => ({ path: args.path, namespace: "adapter" }));
      build.onLoad({ filter: /.*/, namespace: "adapter" }, args => ({ contents:
        args.path === "react" ? `
          export const useState = global.__mentoringTest.useState;
          export const useMemo = fn => fn();
          export const useEffect = () => {};
          export default { useRef: value => ({ current: value }), createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
        ` : args.path.includes("ScheduleContext") ? "export const useSchedule = global.__mentoringTest.context;" : "export default () => null;"
      }));
    } }],
  });
  const compiled = new Module(__filename);
  compiled._compile(result.outputFiles[0].text, __filename);
  Page = compiled.exports.default;
  global.window = { alert: message => { throw new Error(message); } };
});

const week1 = "2026-09-14~2026-09-19";
const week2 = "2026-09-21~2026-09-26";
const student = (id, extra = {}) => ({ id, name: `학생${id}`, mentorHistory: {}, ...extra });
function setup(students, mentors = [{ name: "원장님", time: "09:00~10:00" }, { name: "멘토A", time: "09:00~11:00" }]) {
  hooks = [];
  current = {
    students, mentorsByDay: { 월: mentors }, selectedPeriod: week1,
    periods: [{ id: week1, createdAt: 1 }, { id: week2, createdAt: 2 }],
    attendance: Object.fromEntries([week1, week2].map(week => [week, Object.fromEntries(students.map(s => [s.id, { 월: ["09:00", "11:00"] }]))])),
    assignments: [], mentorSessionDuration: 20, mentorAssignmentSnapshots: {},
  };
  for (const key of ["students", "selectedPeriod", "periods", "assignments", "mentorSessionDuration", "mentorAssignmentSnapshots"]) {
    current[`set${key[0].toUpperCase()}${key.slice(1)}`] = value => { current[key] = typeof value === "function" ? value(current[key]) : value; };
  }
}
function render() { cursor = 0; return Page(); }
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (tree == null || typeof tree === "boolean") return "";
  return typeof tree === "object" ? text(tree.props?.children) : String(tree);
}
function button(label, tree = render()) {
  const node = nodes(tree).find(node => node.type === "button" && text(node) === label);
  assert.ok(node, `button ${label}`);
  return node;
}
function select(label, value) {
  const node = nodes(render()).find(node => node.type === "select" && node.props["aria-label"] === label);
  assert.ok(node, `select ${label}`);
  node.props.onChange({ target: { value } });
}
function auto() { button("멘토 배정하기(리셋)").props.onClick(); }
function rec(id, week = current.selectedPeriod) { return current.students.find(s => s.id === id).mentorHistory[week]; }
function directorPanel() {
  return nodes(render()).find(node => node.type === "div" && node.props.className === "border rounded p-3 bg-indigo-50 shadow-sm");
}
function applyAlternative(id, mentor, day = "월") {
  select(`학생${id} 대체 멘토`, mentor);
  select(`학생${id} 대체 요일`, day);
  const panel = nodes(render()).find(node => node.props["aria-label"] === "시간 불일치 및 미배정 학생");
  const row = nodes(panel).find(node => node.type === "tr" && text(node).startsWith(`학생${id}`));
  button("적용", row).props.onClick();
}

test("원장 지정과 완료가 영구 고정 멘토/기존 고정 멘토를 보존하고 다음 주 복귀한다", () => {
  setup([student(1, { fixedMentor: "기존멘토" })]);
  select("학생1 매주 고정 멘토", "멘토A");
  nodes(render()).find(node => node.type === "textarea").props.onChange({ target: { value: "학생1" } });
  button("대상 지정").props.onClick();
  assert.equal(current.students[0].fixedMentor, "기존멘토");
  auto();
  assert.equal(rec(1).mentor, "원장님");
  assert.equal(current.students[0].persistentFixedMentor, "멘토A");
  nodes(directorPanel()).find(node => node.type === "input").props.onChange({ target: { checked: true } });
  assert.equal(rec(1).mentor, "원장님", "완료한 주차의 이력 보존");
  auto();
  assert.equal(rec(1).mentor, "멘토A", "완료 후 재배정은 고정 멘토 우선");
  current.selectedPeriod = week2;
  auto();
  assert.equal(rec(1).mentor, "멘토A");
  assert.equal(current.students[0].persistentFixedMentor, "멘토A");
});

test("원장 지정을 완료하지 않아도 해당 주차에만 적용된다", () => {
  setup([student(1, { persistentFixedMentor: "멘토A", directorConsultingByPeriod: { [week1]: { status: "pending" } } })]);
  auto();
  assert.equal(rec(1).mentor, "원장님");
  current.selectedPeriod = week2;
  auto();
  assert.equal(rec(1).mentor, "멘토A");
});

test("원장 시간 불일치는 원장 목록과 배정에서 제외하고 대체 멘토를 배정한다", () => {
  setup([student(1, { persistentFixedMentor: "멘토A", directorConsultingByPeriod: { [week1]: { status: "pending" } } })],
    [{ name: "원장님", time: "13:00~14:00" }, { name: "멘토A", time: "09:00~11:00" }]);
  auto();
  assert.equal(rec(1).mentor, undefined);
  assert.match(rec(1).assignmentIssue, /원장 컨설팅 시간 미일치/);
  assert.ok(!text(directorPanel()).includes("학생1"));
  applyAlternative(1, "멘토A");
  assert.equal(rec(1).mentor, "멘토A");
  assert.equal(rec(1).assignmentIssue, undefined);
  assert.equal(current.students[0].persistentFixedMentor, "멘토A");
});

test("모든 멘토와 시간 불일치면 희망 배정을 보존하고 시간 조정 후 확정한다", () => {
  setup([student(1)], [{ name: "멘토A", time: "13:00~14:00" }]);
  auto();
  assert.match(rec(1).assignmentIssue, /모든 멘토와 시간 미일치/);
  applyAlternative(1, "멘토A");
  assert.equal(rec(1).mentor, undefined);
  assert.deepEqual(rec(1).pendingReassignment, { mentor: "멘토A", day: "월" });
  current.attendance[week1][1].월 = ["13:00", "14:00"];
  applyAlternative(1, "멘토A");
  assert.equal(rec(1).mentor, "멘토A");
  assert.equal(rec(1).pendingReassignment, undefined);
});

test("고정 멘토는 일반 학생보다 먼저 배정하고 정원을 초과하지 않는다", () => {
  setup([student(1), student(2, { persistentFixedMentor: "멘토A" }), student(3, { persistentFixedMentor: "멘토A" })], [{ name: "멘토A", time: "09:00~09:20" }]);
  auto();
  assert.equal(rec(2).mentor, "멘토A");
  assert.equal(rec(1).mentor, undefined);
  assert.equal(rec(3).mentor, undefined);
  assert.match(rec(3).assignmentIssue, /슬롯 없음/);
});

test("미희망 학생은 제외하고 복수 출결 구간을 사용할 수 있다", () => {
  setup([student(1, { mentoringOptOut: true, persistentFixedMentor: "멘토A" }), student(2)], [{ name: "멘토A", time: "13:00~14:00" }]);
  current.attendance[week1][2].월 = "09:00~10:00, 13:00~14:00";
  auto();
  assert.equal(rec(1).mentor, undefined);
  assert.equal(rec(2).mentor, "멘토A");
});

test("이전 강제 배정 기록은 원장 목록과 저장된 시간표에서 제외한다", () => {
  setup([student(1, { fixedMentor: "원장님", selectedMentor: "원장님", mentorHistory: { [week1]: { mentor: "원장님", day: "월", fixedNoOverlap: true } } })], [{ name: "원장님", time: "13:00~14:00" }]);
  current.mentorAssignmentSnapshots[week1] = { timelineByDay: { 월: { 원장님: { slots: [], unassigned: ["학생1"], assignedCount: 0, requestCount: 1 } } } };
  assert.ok(!text(directorPanel()).includes("학생1"));
  assert.match(text(render()), /원장님 시간 미일치/);
});

test("기존 원장 지정 이전은 고정 멘토를 보존하고 이전 주차 이력을 유지한다", async () => {
  const { setDirectorConsultingStatus, getPriorityMentor } = await import("../src/utils/mentoringPriority.mjs");
  const original = student(1, { fixedMentor: "원장님", persistentFixedMentor: "멘토A" });
  const migrated = setDirectorConsultingStatus(original, week1, "pending");
  assert.equal(migrated.fixedMentor, "");
  assert.equal(getPriorityMentor(migrated, week1), "원장님");
  assert.equal(getPriorityMentor(migrated, week2), "멘토A");
  assert.equal(getPriorityMentor(setDirectorConsultingStatus(migrated, week1, "completed"), week1), "멘토A");
});

test("고정 멘토도 멘토별 정원 제한을 지킨다", () => {
  setup([student(1, { persistentFixedMentor: "멘토A" }), student(2, { persistentFixedMentor: "멘토A" })]);
  const label = nodes(render()).find(node => node.type === "label" && text(node).startsWith("멘토A기본"));
  assert.ok(label);
  nodes(label).find(node => node.type === "select").props.onChange({ target: { value: "1" } });
  auto();
  assert.equal(rec(1).mentor, "멘토A");
  assert.equal(rec(2).mentor, undefined);
  assert.match(rec(2).assignmentIssue, /정원/);
});

test("파일 저장/복구 및 재접속 이후 고정 멘토와 시간 조정 대기가 유지된다", async () => {
  setup([student(1, { persistentFixedMentor: "멘토A", directorConsultingByPeriod: { [week1]: { status: "pending" } } })],
    [{ name: "원장님", time: "13:00~14:00" }, { name: "멘토A", time: "13:00~14:00" }]);
  auto();
  applyAlternative(1, "멘토A");
  let exported;
  const create = URL.createObjectURL;
  const revoke = URL.revokeObjectURL;
  URL.createObjectURL = blob => { exported = blob; return "blob:test"; };
  URL.revokeObjectURL = () => {};
  global.document = { createElement: () => ({ click() {} }) };
  try { button("멘토 매칭 정보 저장하기").props.onClick(); }
  finally { URL.createObjectURL = create; URL.revokeObjectURL = revoke; }
  const savedText = await exported.text();
  const payload = JSON.parse(savedText);
  assert.equal(payload.studentsDetail[0].persistentFixedMentor, "멘토A");
  assert.equal(payload.studentsDetail[0].directorConsulting.status, "pending");
  assert.equal(payload.summary.assignedStudents, 0);
  current.students = [student(1)];
  const upload = nodes(render()).find(node => node.type === "input" && node.props.type === "file");
  await upload.props.onChange({ target: { value: "test.json", files: [{ name: "test.json", text: async () => savedText }] } });
  assert.equal(current.students[0].persistentFixedMentor, "멘토A");
  assert.deepEqual(rec(1).pendingReassignment, { mentor: "멘토A", day: "월" });
  // 로컬/서버 저장과 동일한 JSON 왕복 후 페이지 상태를 새로 만든다.
  current.students = JSON.parse(JSON.stringify(current.students));
  hooks = [];
  assert.match(text(render()), /희망 배정: 멘토A/);
  current.selectedPeriod = week2;
  current.attendance[week2][1].월 = ["13:00", "14:00"];
  auto();
  assert.equal(rec(1).mentor, "멘토A");
});

test("원장 주차가 끝난 일반 학생은 기존 자동 배정으로 돌아간다", () => {
  setup([student(1, { directorConsultingByPeriod: { [week1]: { status: "pending" } } })]);
  auto();
  assert.equal(rec(1).mentor, "원장님");
  current.selectedPeriod = week2;
  auto();
  assert.equal(rec(1).mentor, "멘토A");
});
