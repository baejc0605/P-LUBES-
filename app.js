/* =========================================================
   설비관리V1(기계1파트) - Vanilla JS SPA
   ========================================================= */

/* ---------- 상수 & 초기 설정 ---------- */
const AUTH = { id: "1004", pw: "1005" };
const STORAGE_KEY = "eqmt_master_v1";     // 마스터 데이터
const RECORD_KEY  = "eqmt_records_v1";    // 회차 기록 데이터
const SESSION_KEY = "eqmt_session";

// 공휴일(예시). 필요시 확장/수정.
const HOLIDAYS = [
  "2025-01-01","2025-03-01","2025-05-05","2025-06-06","2025-08-15",
  "2025-10-03","2025-10-09","2025-12-25",
  "2026-01-01","2026-03-01","2026-05-05","2026-06-06","2026-08-15",
  "2026-10-03","2026-10-09","2026-12-25"
];

const SUB_MENUS = ["예비소성로","본소성","열처리","혼합설비","필터프레스","진공건조기","냉각기","관리메뉴"];

let state = {
  currentMenu: "home",
  currentSub: null,
  filters: {},        // 컬럼 헤더 필터
  dateFrom: "",       // 차회수리일자 기간필터
  dateTo: ""
};

/* ---------- 유틸: 데이터 CRUD ---------- */
function loadMaster() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}
function saveMaster(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
function loadRecords() {
  return JSON.parse(localStorage.getItem(RECORD_KEY) || "{}");
}
function saveRecords(data) {
  localStorage.setItem(RECORD_KEY, JSON.stringify(data));
}
function uid() {
  return "id_" + Date.now() + "_" + Math.random().toString(36).slice(2,7);
}

/* ---------- 유틸: 날짜 계산 ---------- */
function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d) ? null : d;
}
function fmt(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function isHoliday(d) {
  const s = fmt(d);
  const w = d.getDay();
  return w === 0 || w === 6 || HOLIDAYS.includes(s);
}
function nextBusinessDay(d) {
  const nd = new Date(d);
  while (isHoliday(nd)) nd.setDate(nd.getDate()+1);
  return nd;
}
/**
 * 주기 파싱: "6M" -> {value:6, unit:'M'}, "10D" -> {value:10
