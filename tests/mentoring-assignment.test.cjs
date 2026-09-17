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
function directorTargetList() {
  return nodes(render()).find(node => node.props["aria-label"] === "원장 컨설팅 지정 학생 목록");
}
function designateDirector(names) {
  nodes(directorPanel()).find(node => node.type === "textarea").props.onChange({ target: { value: names } });
  button("대상 지정").props.onClick();
}
function applyAlternative(id, mentor) {
  select(`학생${id} 대체 멘토`, mentor);
  const panel = nodes(render()).find(node => node.props["aria-label"] === "시간 불일치 및 미배정 학생");
  const row = nodes(panel).find(node => node.type === "tr" && text(node).startsWith(`학생${id}`));
  button("적용", row).props.onClick();
}

test("원장 지정과 완료가 영구 고정 멘토/기존 고정 멘토를 보존하고 다음 주 복귀한다", () => {
  setup([student(1, { fixedMentor: "기존멘토" })]);
  nodes(render()).find(node => node.props["aria-label"] === "고정 멘토 설정 학생 검색").props.onChange({ value: 1 });
  select("학생1 매주 고정 멘토", "멘토A");
  button("확인").props.onClick();
  nodes(render()).find(node => node.type === "textarea").props.onChange({ target: { value: "학생1" } });
  button("대상 지정").props.onClick();
  assert.equal(current.students[0].fixedMentor, "");
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
  designateDirector("학생1");
  assert.equal(rec(1).mentor, "원장님");
  current.selectedPeriod = week2;
  auto();
  assert.equal(rec(1).mentor, "멘토A");
});

test("원장 컨설팅은 시간 불일치여도 확정하며 재배정 목록에 표시하지 않는다", () => {
  setup([student(1, { persistentFixedMentor: "멘토A", directorConsultingByPeriod: { [week1]: { status: "pending" } } })],
    [{ name: "원장님", time: "13:00~14:00" }, { name: "멘토A", time: "09:00~11:00" }]);
  designateDirector("학생1");
  assert.equal(rec(1).mentor, "원장님");
  assert.equal(rec(1).day, "");
  assert.equal(rec(1).assignmentIssue, undefined);
  assert.match(text(directorTargetList()), /학생1지정 완료/);
  const unassigned = nodes(render()).find(node => node.props["aria-label"] === "시간 불일치 및 미배정 학생");
  assert.ok(!text(unassigned).includes("학생1"));
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

test("기존 원장 시간 불일치 기록도 지정 완료로 보이며 시간표에서는 제외한다", () => {
  setup([student(1, { fixedMentor: "원장님", selectedMentor: "원장님", mentorHistory: { [week1]: { mentor: "원장님", day: "월", fixedNoOverlap: true } } })], [{ name: "원장님", time: "13:00~14:00" }]);
  current.mentorAssignmentSnapshots[week1] = { timelineByDay: { 월: { 원장님: { slots: [], unassigned: ["학생1"], assignedCount: 0, requestCount: 1 } } } };
  assert.match(text(directorTargetList()), /학생1지정 완료/);
  assert.ok(!text(render()).includes("원장님 시간 미일치"));
  auto();
  assert.equal(rec(1).mentor, undefined);
  assert.equal(rec(1).fixedNoOverlap, undefined);
  assert.equal(current.students[0].directorConsultingByPeriod[week1].status, "released");
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
  setup([student(1, { persistentFixedMentor: "멘토A", directorConsultingByPeriod: { [week1]: { status: "completed" } } })],
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
  assert.equal(payload.studentsDetail[0].directorConsulting.status, "completed");
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
  designateDirector("학생1");
  assert.equal(rec(1).mentor, "원장님");
  current.selectedPeriod = week2;
  auto();
  assert.equal(rec(1).mentor, "멘토A");
});

test("대체 멘토만 선택하면 근무 요일 중 학생과 시간이 맞는 요일을 자동 배정한다", () => {
  setup([student(1)]);
  current.mentorsByDay = {
    월: [{ name: "멘토A", time: "13:00~14:00" }],
    수: [{ name: "멘토A", time: "09:00~11:00" }],
  };
  current.attendance[week1][1].수 = ["09:00", "10:00"];
  applyAlternative(1, "멘토A");
  assert.equal(rec(1).mentor, "멘토A");
  assert.equal(rec(1).day, "수");
});

test("시간이 모두 안 맞아도 멘토 출근일로 희망 배정하며 변경된 근무표를 반영한다", () => {
  setup([student(1)]);
  current.mentorsByDay = { 목: [{ name: "멘토A", time: "13:00~14:00" }] };
  applyAlternative(1, "멘토A");
  assert.deepEqual(rec(1).pendingReassignment, { mentor: "멘토A", day: "목" });
  current.mentorsByDay = { 금: [{ name: "멘토A", time: "09:00~11:00" }] };
  current.attendance[week1][1].금 = ["09:00", "10:00"];
  // 이전 희망 요일을 사용하지 않고 총괄멘토 Info의 현재 근무표로 다시 계산한다.
  hooks = [];
  const panel = nodes(render()).find(node => node.props["aria-label"] === "시간 불일치 및 미배정 학생");
  button("적용", panel).props.onClick();
  assert.equal(rec(1).day, "금");
  assert.equal(rec(1).mentor, "멘토A");
});

test("근무 요일이 삭제된 대체 멘토는 임의의 요일로 배정하지 않는다", () => {
  setup([student(1, { mentorHistory: { [week1]: { pendingReassignment: { mentor: "퇴사멘토", day: "월" } } } })]);
  const panel = nodes(render()).find(node => node.props["aria-label"] === "시간 불일치 및 미배정 학생");
  assert.equal(button("적용", panel).props.disabled, true);
  button("적용", panel).props.onClick();
  assert.equal(rec(1).mentor, undefined);
});

test("고정 멘토는 확인할 때만 저장되며 목록에는 저장된 학생과 멘토만 표시한다", () => {
  setup([student(1), student(2, { persistentFixedMentor: "멘토A" })]);
  const chooseStudent = id => nodes(render()).find(node => node.props["aria-label"] === "고정 멘토 설정 학생 검색").props.onChange({ value: id });
  const savedList = () => nodes(render()).find(node => node.props["aria-label"] === "저장된 고정 멘토 목록");
  assert.match(text(savedList()), /학생2멘토A/);
  chooseStudent(1);
  select("학생1 매주 고정 멘토", "멘토A");
  assert.equal(current.students[0].persistentFixedMentor, undefined);
  assert.ok(!text(savedList()).includes("학생1"));
  // 학생을 바꾸면 확인하지 않은 선택이 다른 학생에게 저장되지 않는다.
  chooseStudent(2);
  chooseStudent(1);
  assert.equal(nodes(render()).find(node => node.props["aria-label"] === "학생1 매주 고정 멘토").props.value, "");
  select("학생1 매주 고정 멘토", "멘토A");
  button("확인").props.onClick();
  assert.equal(current.students[0].persistentFixedMentor, "멘토A");
  assert.match(text(savedList()), /학생1멘토A/);
  select("학생1 매주 고정 멘토", "");
  assert.match(text(savedList()), /학생1멘토A/);
  button("확인").props.onClick();
  assert.equal(current.students[0].persistentFixedMentor, "");
  assert.ok(!text(savedList()).includes("학생1"));
  assert.match(text(savedList()), /학생2멘토A/);
});

test("쉼표로 지정한 원장 대상은 기존 배정/시간 불일치/미희망 여부와 관계없이 즉시 표시된다", () => {
  setup([
    student(1, { persistentFixedMentor: "멘토A", mentorHistory: { [week1]: { mentor: "멘토A", day: "월" } } }),
    student(2, { mentorHistory: { [week1]: { assignmentIssue: "기존 배정 실패" } } }),
    student(3, { mentoringOptOut: true }),
  ]);
  current.attendance[week1][2].월 = ["13:00", "14:00"];
  const targetList = () => nodes(render()).find(node => node.props["aria-label"] === "원장 컨설팅 지정 학생 목록");
  const assignNames = value => {
    nodes(directorPanel()).find(node => node.type === "textarea").props.onChange({ target: { value } });
    button("대상 지정").props.onClick();
  };
  assignNames(" 학생1, 학생2, 학생3, 학생1, 없는학생 ");
  assert.match(text(targetList()), /지정 학생 · 3명/);
  assert.match(text(targetList()), /학생1지정 완료/);
  assert.match(text(targetList()), /학생2지정 완료/);
  assert.match(text(targetList()), /학생3지정 완료/);
  assert.match(nodes(render()).find(node => node.type === "textarea" && node.props.readOnly).props.value, /학생 목록에서 찾지 못함: 없는학생/);
  assert.equal(rec(1).mentor, "원장님", "목록 지정만으로 원장 컨설팅이 확정된다");
  assert.equal(current.students[0].persistentFixedMentor, "멘토A");
  assignNames("학생1");
  assert.match(text(targetList()), /지정 학생 · 3명/);
  current.students = JSON.parse(JSON.stringify(current.students));
  hooks = [];
  assert.match(text(targetList()), /학생1지정 완료/);
  auto();
  for (const id of [1, 2, 3]) {
    assert.notEqual(rec(id).mentor, "원장님");
    assert.equal(current.students.find(s => s.id === id).directorConsultingByPeriod[week1].status, "released");
  }
  assert.equal(rec(1).mentor, "멘토A");
  assert.match(text(targetList()), /학생2임시 지정 해제/);
  current.selectedPeriod = week2;
  assert.match(text(targetList()), /지정 학생 · 0명/);
});

test("원장 근무표와 출결 없이도 목록 지정만으로 완료되고 일반 슬롯을 소비하지 않는다", () => {
  const targets = Array.from({ length: 20 }, (_, i) => student(i + 1, {
    mentoringOptOut: i === 0, bannedMentor1: "원장님", persistentFixedMentor: "멘토A",
  }));
  setup([...targets, student(21)], [{ name: "멘토A", time: "09:00~09:20" }]);
  targets.forEach(s => { current.attendance[week1][s.id] = {}; });
  nodes(directorPanel()).find(node => node.type === "textarea").props.onChange({ target: { value: targets.map(s => s.name).join(", ") } });
  button("대상 지정").props.onClick();
  targets.forEach(s => {
    assert.equal(rec(s.id).mentor, "원장님");
    assert.equal(rec(s.id).day, "");
    assert.equal(rec(s.id).slotStart, undefined);
  });
  auto();
  assert.equal(rec(21).mentor, "멘토A");
  const popup = nodes(render()).find(node => node.type === "textarea" && node.props.readOnly).props.value;
  assert.match(popup, /원장 임시 지정 해제: 20명/);
  assert.match(popup, /일반 멘토 배정 성공: 1 \/ 20/);
  assert.match(popup, /재배정 필요 19명/);
  current.selectedPeriod = week2;
  auto();
  assert.equal(rec(1).mentor, undefined, "다음 주 일반 멘토링 미희망 설정 유지");
  assert.equal(current.students[1].persistentFixedMentor, "멘토A");
  assert.notEqual(rec(2).mentor, "원장님");
});

test("고정 멘토가 시간 불일치거나 정원이 차면 가능한 다른 멘토로 자동 배정한다", () => {
  setup([student(1, { persistentFixedMentor: "없는멘토" }), student(2, { persistentFixedMentor: "멘토A" }), student(3, { persistentFixedMentor: "멘토A" })],
    [{ name: "멘토A", time: "09:00~09:20" }, { name: "멘토B", time: "09:00~10:00" }]);
  auto();
  assert.equal(rec(1).mentor, "멘토B");
  assert.equal(rec(2).mentor, "멘토A");
  assert.equal(rec(3).mentor, "멘토B");
  assert.equal(current.students[0].persistentFixedMentor, "없는멘토");
  assert.equal(current.students[2].persistentFixedMentor, "멘토A");
});

test("저장된 원장 시간 불일치를 정리하되 고정 멘토와 다른 주차 기록은 보존한다", async () => {
  const { assignDirectorConsulting } = await import("../src/utils/mentoringPriority.mjs");
  const old = student(1, { persistentFixedMentor: "멘토A", mentorHistory: {
    [week1]: { mentor: "원장님", day: "월", slotStart: "09:00", assignmentIssue: "원장 컨설팅 시간 미일치", fixedNoOverlap: true },
    [week2]: { mentor: "멘토A", day: "화" },
  } });
  const repaired = assignDirectorConsulting(old, week1);
  assert.equal(repaired.mentorHistory[week1].assignmentIssue, undefined);
  assert.equal(repaired.mentorHistory[week1].slotStart, undefined);
  assert.equal(repaired.mentorHistory[week1].fixedNoOverlap, undefined);
  assert.equal(repaired.mentorHistory[week1].day, "");
  assert.deepEqual(repaired.mentorHistory[week2], old.mentorHistory[week2]);
  assert.equal(repaired.persistentFixedMentor, "멘토A");
  assert.equal(assignDirectorConsulting(repaired, week1), repaired, "복구 후 재렌더 시 반복 저장하지 않는다");
});

test("시간표 없는 원장 컨설팅도 파일로 저장하고 복구할 수 있다", async () => {
  setup([student(1, { mentoringOptOut: true, persistentFixedMentor: "멘토A", directorConsultingByPeriod: { [week1]: { status: "pending" } } })], []);
  designateDirector("학생1");
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
  assert.equal(payload.summary.assignedStudents, 1);
  assert.equal(payload.summary.unassignedStudents, 0);
  assert.equal(payload.summary.optOutStudents, 0);
  assert.deepEqual(payload.students[0].scheduledDays, []);
  assert.equal(payload.studentsDetail[0].day, "");
  current.students = [student(1)];
  const upload = nodes(render()).find(node => node.type === "input" && node.props.type === "file");
  await upload.props.onChange({ target: { value: "test.json", files: [{ name: "test.json", text: async () => savedText }] } });
  assert.equal(rec(1).mentor, "원장님");
  assert.equal(current.students[0].mentoringOptOut, true);
  assert.equal(current.students[0].persistentFixedMentor, "멘토A");
  assert.match(text(directorTargetList()), /학생1지정 완료/);
});

test("고정멘토 열은 저장값만 표시하고 다음 자동배정에서 원장 임시 지정이 해제된다", () => {
  setup([student(1, { fixedMentor: "멘토A" })], [
    { name: "멘토A", time: "09:00~11:00" }, { name: "멘토B", time: "09:00~11:00" },
  ]);
  const fixedCell = () => nodes(render()).find(node => node.props["aria-label"] === "학생1 고정멘토 표시");
  assert.equal(text(fixedCell()), "멘토A", "기존 저장값도 표시한다");
  assert.ok(!nodes(fixedCell()).some(node => ["input", "button", "select"].includes(node.type)));
  nodes(render()).find(node => node.props["aria-label"] === "고정 멘토 설정 학생 검색").props.onChange({ value: 1 });
  select("학생1 매주 고정 멘토", "멘토B");
  assert.equal(text(fixedCell()), "멘토A", "확인 전에는 기존 저장값 유지");
  button("확인").props.onClick();
  assert.equal(text(fixedCell()), "멘토B");
  designateDirector("학생1");
  assert.equal(text(fixedCell()), "원장님");
  assert.equal(current.students[0].persistentFixedMentor, "멘토B");
  current.students = JSON.parse(JSON.stringify(current.students));
  hooks = [];
  button("화요일 우선 배정").props.onClick();
  assert.equal(current.selectedPeriod, week1);
  assert.equal(rec(1).mentor, "멘토B", "같은 주차의 다음 자동배정도 고정 멘토로 복귀");
  assert.equal(text(fixedCell()), "멘토B");
  assert.equal(current.students[0].directorConsultingByPeriod[week1].status, "released");
  auto();
  assert.equal(rec(1).mentor, "멘토B", "재실행해도 원장 지정이 살아나지 않는다");
  designateDirector("학생1");
  assert.equal(text(fixedCell()), "원장님", "다시 원장 지정 가능");
  auto();
  assert.equal(text(fixedCell()), "멘토B");
  nodes(render()).find(node => node.props["aria-label"] === "고정 멘토 설정 학생 검색").props.onChange({ value: 1 });
  select("학생1 매주 고정 멘토", "");
  button("확인").props.onClick();
  assert.equal(text(fixedCell()), "-", "고정 해제 시 예전 입력값이 되살아나지 않는다");
});

test("원장 임시 지정 후 고정 멘토가 없으면 다음 자동배정에서 일반 멘토를 찾는다", () => {
  setup([student(1)]);
  designateDirector("학생1");
  assert.equal(rec(1).mentor, "원장님");
  auto();
  assert.equal(rec(1).mentor, "멘토A");
  assert.equal(text(nodes(render()).find(node => node.props["aria-label"] === "학생1 고정멘토 표시")), "-");
});
