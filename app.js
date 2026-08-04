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
 * 주기 파싱: "6M" -> {value:6, unit:'M'}, "10D" -> {value:10, unit:'D'}
 */
function parseCycle(cycle) {
  if (!cycle) return null;
  const m = String(cycle).trim().toUpperCase().match(/^(\d+)\s*([MD])$/);
  if (!m) return null;
  return { value: parseInt(m[1],10), unit: m[2] };
}
/**
 * 차회수리일자 = 최근 회차일자 + 주기 + 휴일이월
 */
function calcNextDate(lastDateStr, cycleStr) {
  const base = parseDate(lastDateStr);
  const cyc  = parseCycle(cycleStr);
  if (!base || !cyc) return "";
  const d = new Date(base);
  if (cyc.unit === "M") d.setMonth(d.getMonth() + cyc.value);
  else                  d.setDate(d.getDate() + cyc.value);
  return fmt(nextBusinessDay(d));
}

/* ---------- 로그인 처리 ---------- */
function initLogin() {
  const modal = document.getElementById("loginModal");
  const app   = document.getElementById("app");

  // 세션 확인
  if (sessionStorage.getItem(SESSION_KEY) === "ok") {
    modal.classList.add("hidden");
    app.classList.remove("app-hidden");
    document.getElementById("userInfo").textContent = "사용자: 1004";
    renderPage();
    return;
  }

  document.getElementById("btnLogin").addEventListener("click", tryLogin);
  document.getElementById("loginPw").addEventListener("keydown", e => {
    if (e.key === "Enter") tryLogin();
  });
}
function tryLogin() {
  const id = document.getElementById("loginId").value.trim();
  const pw = document.getElementById("loginPw").value.trim();
  if (id === AUTH.id && pw === AUTH.pw) {
    sessionStorage.setItem(SESSION_KEY, "ok");
    document.getElementById("loginModal").classList.add("hidden");
    document.getElementById("app").classList.remove("app-hidden");
    document.getElementById("userInfo").textContent = "사용자: " + id;
    renderPage();
  } else {
    alert("아이디 또는 비밀번호가 올바르지 않습니다.");
  }
}
function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  location.reload();
}

/* ---------- 메뉴 이벤트 ---------- */
function initMenu() {
  document.querySelectorAll(".gnb-item").forEach(el => {
    el.addEventListener("click", e => {
      e.preventDefault();
      document.querySelectorAll(".gnb-item").forEach(x=>x.classList.remove("active"));
      el.classList.add("active");
      state.currentMenu = el.dataset.menu;
      state.currentSub  = null;

      const lnb = document.getElementById("lnb");
      if (state.currentMenu === "lubrication") {
        lnb.classList.remove("hidden");
        // 첫 서브메뉴 활성화
        const first = document.querySelector(".lnb-item");
        document.querySelectorAll(".lnb-item").forEach(x=>x.classList.remove("active"));
        first.classList.add("active");
        state.currentSub = first.dataset.sub;
      } else {
        lnb.classList.add("hidden");
      }
      renderPage();
    });
  });

  document.querySelectorAll(".lnb-item").forEach(el => {
    el.addEventListener("click", e => {
      e.preventDefault();
      document.querySelectorAll(".lnb-item").forEach(x=>x.classList.remove("active"));
      el.classList.add("active");
      state.currentSub = el.dataset.sub;
      state.filters = {};
      state.dateFrom = ""; state.dateTo = "";
      renderPage();
    });
  });

  document.getElementById("btnLogout").addEventListener("click", logout);
}

/* ---------- 페이지 라우팅 ---------- */
function renderPage() {
  const c = document.getElementById("content");
  c.innerHTML = "";
  if (state.currentMenu === "home") {
    renderHome(c);
  } else if (state.currentMenu === "lubrication") {
    if (state.currentSub === "관리메뉴") renderAdmin(c);
    else renderProcessPage(c, state.currentSub);
  }
}

/* ---------- HOME (대시보드) ---------- */
function renderHome(container) {
  const master = loadMaster();
  const records = loadRecords();

  // 진도율: 당월 내 마지막 회차일자가 이번달인 항목 비율
  const now = new Date();
  const ymNow = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  let doneCnt = 0;
  const nextList = [];
  master.forEach(row => {
    const recs = (records[row.id] || []).filter(r => r.date);
    const lastDate = recs.length ? recs[recs.length-1].date : "";
    if (lastDate && lastDate.startsWith(ymNow)) doneCnt++;
    const nd = calcNextDate(lastDate, row.cycle);
    if (nd) nextList.push({ ...row, nextDate: nd });
  });
  nextList.sort((a,b)=> a.nextDate.localeCompare(b.nextDate));
  const top5 = nextList.slice(0,5);
  const rate = master.length ? Math.round(doneCnt / master.length * 100) : 0;

  container.innerHTML = `
    <div class="dashboard-grid">
      <div class="card">
        <div class="card-title">전체 설비 수</div>
        <div class="card-value">${master.length}</div>
        <div class="card-sub">등록된 마스터 데이터 기준</div>
      </div>
      <div class="card">
        <div class="card-title">당월 점검 완료율</div>
        <div class="card-value">${rate}%</div>
        <div class="progress-bar"><div style="width:${rate}%"></div></div>
        <div class="card-sub">${doneCnt} / ${master.length} 건 완료</div>
      </div>
      <div class="card">
        <div class="card-title">다음 예정 설비</div>
        <div class="card-value">${top5.length}</div>
        <div class="card-sub">임박한 예정건 TOP 5</div>
      </div>
    </div>

    <div class="section-title">📌 다음 예정 설비 TOP 5</div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>순위</th><th>라인</th><th>대상</th><th>점검/급지포인트</th>
            <th>주기</th><th>차회수리일자</th>
          </tr>
        </thead>
        <tbody>
          ${
            top5.length === 0
            ? `<tr><td colspan="6" style="padding:20px;color:#888;">등록된 예정 항목이 없습니다.</td></tr>`
            : top5.map((r,i)=>`
                <tr>
                  <td>${i+1}</td>
                  <td>${r.line||""}</td>
                  <td>${r.target||""}</td>
                  <td>${r.point||""}</td>
                  <td>${r.cycle||""}</td>
                  <td class="next-date-warn">${r.nextDate}</td>
                </tr>`).join("")
          }
        </tbody>
      </table>
    </div>
  `;
}

/* ---------- 관리메뉴 (마스터 CRUD) ---------- */
function renderAdmin(container) {
  container.innerHTML = `
    <div class="section-title">🛠 급유급지 마스터 관리</div>

    <div class="form-grid" id="masterForm">
      <input type="hidden" id="m_id" />
      <div><label>라인</label><input id="m_line" placeholder="예: A라인"/></div>
      <div><label>대상</label><input id="m_target" placeholder="예: 예비소성로"/></div>
      <div><label>점검</label><input id="m_inspect" placeholder="점검항목"/></div>
      <div><label>급지포인트</label><input id="m_point" placeholder="포인트"/></div>
      <div><label>주기 (예: 6M, 10D)</label><input id="m_cycle" placeholder="6M"/></div>
      <div><label>공정 구분</label>
        <select id="m_process">
          ${SUB_MENUS.filter(s=>s!=="관리메뉴").map(s=>`<option>${s}</option>`).join("")}
        </select>
      </div>
      <div><label>비고</label><input id="m_remark" placeholder="비고"/></div>
      <div style="display:flex;align-items:end;gap:6px;">
        <button class="btn btn-primary" id="btnSaveMaster">저장</button>
        <button class="btn btn-ghost" id="btnClearMaster" style="color:#333;border-color:#ccd3dd;">초기화</button>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>공정</th><th>라인</th><th>대상</th><th>점검</th>
            <th>급지포인트</th><th>주기</th><th>비고</th><th>관리</th>
          </tr>
        </thead>
        <tbody id="masterTbody"></tbody>
      </table>
    </div>
  `;

  document.getElementById("btnSaveMaster").addEventListener("click", saveMasterRow);
  document.getElementById("btnClearMaster").addEventListener("click", clearMasterForm);
  renderMasterTable();
}

function renderMasterTable() {
  const tbody = document.getElementById("masterTbody");
  const data = loadMaster();
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="padding:20px;color:#888;">등록된 데이터가 없습니다.</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(r=>`
    <tr>
      <td>${r.process||""}</td>
      <td>${r.line||""}</td>
      <td>${r.target||""}</td>
      <td>${r.inspect||""}</td>
      <td>${r.point||""}</td>
      <td>${r.cycle||""}</td>
      <td>${r.remark||""}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="editMaster('${r.id}')">수정</button>
        <button class="btn btn-sm btn-danger"  onclick="deleteMaster('${r.id}')">삭제</button>
      </td>
    </tr>
  `).join("");
}

function saveMasterRow() {
  const row = {
    id:      document.getElementById("m_id").value || uid(),
    process: document.getElementById("m_process").value,
    line:    document.getElementById("m_line").value.trim(),
    target:  document.getElementById("m_target").value.trim(),
    inspect: document.getElementById("m_inspect").value.trim(),
    point:   document.getElementById("m_point").value.trim(),
    cycle:   document.getElementById("m_cycle").value.trim(),
    remark:  document.getElementById("m_remark").value.trim()
  };
  if (!row.line || !row.target || !row.cycle) {
    alert("라인, 대상, 주기는 필수 항목입니다.");
    return;
  }
  const data = loadMaster();
  const idx = data.findIndex(x=>x.id===row.id);
  if (idx>=0) data[idx] = row; else data.push(row);
  saveMaster(data);
  clearMasterForm();
  renderMasterTable();
}

function clearMasterForm() {
  ["m_id","m_line","m_target","m_inspect","m_point","m_cycle","m_remark"]
    .forEach(id => document.getElementById(id).value = "");
}

window.editMaster = function(id) {
  const row = loadMaster().find(x=>x.id===id);
  if (!row) return;
  document.getElementById("m_id").value      = row.id;
  document.getElementById("m_process").value = row.process;
  document.getElementById("m_line").value    = row.line;
  document.getElementById("m_target").value  = row.target;
  document.getElementById("m_inspect").value = row.inspect;
  document.getElementById("m_point").value   = row.point;
  document.getElementById("m_cycle").value   = row.cycle;
  document.getElementById("m_remark").value  = row.remark;
  window.scrollTo({top:0, behavior:"smooth"});
};
window.deleteMaster = function(id) {
  if (!confirm("삭제하시겠습니까? 관련 회차 기록도 함께 삭제됩니다.")) return;
  saveMaster(loadMaster().filter(x=>x.id!==id));
  const recs = loadRecords();
  delete recs[id];
  saveRecords(recs);
  renderMasterTable();
};

/* ---------- 공정별 페이지 ---------- */
function renderProcessPage(container, process) {
  container.innerHTML = `
    <div class="section-title">🔧 ${process} 급유급지 점검 현황</div>

    <div class="toolbar">
      <label>차회수리일자</label>
      <input type="date" id="dateFrom" value="${state.dateFrom}"/>
      <span>~</span>
      <input type="date" id="dateTo" value="${state.dateTo}"/>
      <button class="btn btn-sm btn-primary" id="btnFilterDate">기간조회</button>
      <button class="btn btn-sm btn-ghost" style="color:#333;border-color:#ccd3dd;" id="btnResetFilter">초기화</button>
      <span style="margin-left:auto;font-size:12px;color:#888;">※ 회차 일자/사유 입력 후 [저장] 클릭</span>
    </div>

    <div class="table-wrap">
      <table id="processTable">
        <thead>
          <tr>
            <th>라인</th><th>대상</th><th>점검/급지포인트</th><th>주기</th>
            <th>차회수리일자</th>
            <th>1회차</th><th>2회차</th><th>3회차</th><th>4회차</th>
            <th>관리</th>
          </tr>
          <tr class="filter-row">
            <th><input data-f="line"    placeholder="검색"/></th>
            <th><input data-f="target"  placeholder="검색"/></th>
            <th><input data-f="point"   placeholder="검색"/></th>
            <th><input data-f="cycle"   placeholder="검색"/></th>
            <th colspan="6"></th>
          </tr>
        </thead>
        <tbody id="processTbody"></tbody>
      </table>
    </div>
  `;

  // 이벤트
  document.getElementById("btnFilterDate").addEventListener("click", ()=>{
    state.dateFrom = document.getElementById("dateFrom").value;
    state.dateTo   = document.getElementById("dateTo").value;
    renderProcessRows(process);
  });
  document.getElementById("btnResetFilter").addEventListener("click", ()=>{
    state.filters = {}; state.dateFrom=""; state.dateTo="";
    document.getElementById("dateFrom").value = "";
    document.getElementById("dateTo").value = "";
    document.querySelectorAll(".filter-row input").forEach(i=>i.value="");
    renderProcessRows(process);
  });
  document.querySelectorAll(".filter-row input").forEach(inp=>{
    inp.addEventListener("input", e=>{
      state.filters[e.target.dataset.f] = e.target.value.toLowerCase();
      renderProcessRows(process);
    });
  });

  renderProcessRows(process);
}

function renderProcessRows(process) {
  const tbody = document.getElementById("processTbody");
  const master = loadMaster().filter(r => r.process === process);
  const records = loadRecords();

  const rows = master.map(r => {
    const recs = records[r.id] || [];
    const lastDate = recs.filter(x=>x.date).slice(-1)[0]?.date || "";
    const nextDate = calcNextDate(lastDate, r.cycle);
    return { ...r, recs, nextDate };
  })
  // 컬럼 필터
  .filter(r => {
    for (const k of Object.keys(state.filters)) {
      const v = state.filters[k];
      if (v && !String(r[k]||"").toLowerCase().includes(v)) return false;
    }
    return true;
  })
  // 기간 필터
  .filter(r => {
    if (!state.dateFrom && !state.dateTo) return true;
    if (!r.nextDate) return false;
    if (state.dateFrom && r.nextDate < state.dateFrom) return false;
    if (state.dateTo   && r.nextDate > state.dateTo)   return false;
    return true;
  });

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="padding:20px;color:#888;">해당 조건의 데이터가 없습니다.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r=>{
    const roundCells = [0,1,2,3].map(i=>{
      const rec = r.recs[i] || { date:"", reason:"" };
      return `<td>
        <div class="round-cell">
          <input type="date"  data-id="${r.id}" data-i="${i}" data-k="date"   value="${rec.date}"/>
          <input type="text"  data-id="${r.id}" data-i="${i}" data-k="reason" placeholder="사유" value="${rec.reason||""}"/>
        </div>
      </td>`;
    }).join("");

    return `
      <tr>
        <td>${r.line||""}</td>
        <td>${r.target||""}</td>
        <td>${r.point||""}</td>
        <td>${r.cycle||""}</td>
        <td class="next-date-ok">${r.nextDate || "-"}</td>
        ${roundCells}
        <td>
          <button class="btn btn-sm btn-primary" onclick="saveRoundRow('${r.id}')">저장</button>
        </td>
      </tr>
    `;
  }).join("");
}

window.saveRoundRow = function(id) {
  const inputs = document.querySelectorAll(`#processTbody input[data-id="${id}"]`);
  const recs = [];
  inputs.forEach(inp => {
    const i = +inp.dataset.i;
    const k = inp.dataset.k;
    if (!recs[i]) recs[i] = { date:"", reason:"" };
    recs[i][k] = inp.value;
  });
  const cleaned = recs.filter(r => r && (r.date || r.reason));
  const all = loadRecords();
  all[id] = cleaned;
  saveRecords(all);
  renderProcessRows(state.currentSub);
  alert("저장되었습니다.");
};

/* ---------- 앱 시작 ---------- */
document.addEventListener("DOMContentLoaded", () => {
  initLogin();
  initMenu();
});
