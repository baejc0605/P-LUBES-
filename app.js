/* =========================================================
   설비관리V1(기계1파트) - Vanilla JS SPA
   ✅ 최종본: 표에서 '비고' 컬럼 제거, 좌측 6컬럼 sticky 고정
   ========================================================= */

/* ---------- 상수 ---------- */
const AUTH = { id: "1004", pw: "1005" };
const STORAGE_KEY = "eqmt_master_v1";
const RECORD_KEY  = "eqmt_records_v1";
const PAUSE_KEY   = "eqmt_pauses_v1";
const SESSION_KEY = "eqmt_session";

const HOLIDAYS = [
  "2025-01-01","2025-03-01","2025-05-05","2025-06-06","2025-08-15",
  "2025-10-03","2025-10-09","2025-12-25",
  "2026-01-01","2026-03-01","2026-05-05","2026-06-06","2026-08-15",
  "2026-10-03","2026-10-09","2026-12-25"
];

const SUB_MENUS = ["예비소성로","본소성","열처리","혼합설비","필터프레스","진공건조기","냉각기","관리메뉴"];
const MIN_ROUNDS = 4;

let state = {
  currentMenu: "home",
  currentSub: null,
  filters: {},
  dateFrom: "",
  dateTo: ""
};

/* ---------- 저장/조회 ---------- */
function loadMaster()      { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
function saveMaster(d)     { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }
function loadRecords()     { return JSON.parse(localStorage.getItem(RECORD_KEY) || "{}"); }
function saveRecords(d)    { localStorage.setItem(RECORD_KEY, JSON.stringify(d)); }
function loadPauses()      { return JSON.parse(localStorage.getItem(PAUSE_KEY) || "{}"); }
function savePauses(d)     { localStorage.setItem(PAUSE_KEY, JSON.stringify(d)); }
function uid() { return "id_" + Date.now() + "_" + Math.random().toString(36).slice(2,7); }

/* ---------- 날짜 유틸 ---------- */
function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
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
function parseCycle(cycle) {
  if (!cycle) return null;
  const m = String(cycle).trim().toUpperCase().match(/^(\d+)\s*([MD])$/);
  if (!m) return null;
  return { value: parseInt(m[1],10), unit: m[2] };
}
function diffDays(a, b) {
  const ms = 1000*60*60*24;
  return Math.floor((b.getTime() - a.getTime()) / ms) + 1;
}
function calcNextDate(lastDateStr, cycleStr, pauses) {
  const base = parseDate(lastDateStr);
  const cyc  = parseCycle(cycleStr);
  if (!base || !cyc) return "";

  const d = new Date(base);
  if (cyc.unit === "M") d.setMonth(d.getMonth() + cyc.value);
  else                  d.setDate(d.getDate() + cyc.value);

  if (pauses && pauses.length) {
    let pauseDays = 0;
    pauses.forEach(p => {
      const ps = parseDate(p.start);
      const pe = parseDate(p.end);
      if (!ps || !pe) return;
      const effStart = ps > base ? ps : new Date(base.getTime() + 86400000);
      const effEnd   = pe;
      if (effEnd >= effStart) pauseDays += diffDays(effStart, effEnd);
    });
    if (pauseDays > 0) d.setDate(d.getDate() + pauseDays);
  }
  return fmt(nextBusinessDay(d));
}

/* ---------- 공용 유틸 ---------- */
function debounce(fn, wait) {
  let t = null;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(()=> fn.apply(this, args), wait);
  };
}
function escapeHtml(s) {
  return String(s||"").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
}

/* =========================================================
   로그인
   ========================================================= */
function initLogin() {
  const modal = document.getElementById("loginModal");
  const app   = document.getElementById("app");

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

/* =========================================================
   메뉴
   ========================================================= */
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

/* =========================================================
   라우팅
   ========================================================= */
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

/* =========================================================
   HOME (대시보드)
   ========================================================= */
function renderHome(container) {
  const master = loadMaster();
  const records = loadRecords();
  const pauses = loadPauses();

  const now = new Date();
  const ymNow = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  let doneCnt = 0;
  const nextList = [];
  master.forEach(row => {
    const recs = (records[row.id] || []).filter(r => r.date);
    const lastDate = recs.length ? recs[recs.length-1].date : "";
    if (lastDate && lastDate.startsWith(ymNow)) doneCnt++;
    const nd = calcNextDate(lastDate, row.cycle, pauses[row.id] || []);
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
                  <td>${escapeHtml(r.line)}</td>
                  <td>${escapeHtml(r.target)}</td>
                  <td>${escapeHtml(r.point)}</td>
                  <td>${escapeHtml(r.cycle)}</td>
                  <td class="next-date-warn">${r.nextDate}</td>
                </tr>`).join("")
          }
        </tbody>
      </table>
    </div>
  `;
}

/* =========================================================
   관리메뉴 (전체 마스터 CRUD)
   ========================================================= */
function renderAdmin(container) {
  container.innerHTML = `
    <div class="section-title">🛠 급유급지 마스터 관리 (전체 공정)</div>

    <div class="form-grid" id="masterForm">
      <input type="hidden" id="m_id" />
      <div><label>라인</label><input id="m_line" placeholder="예: 1라인"/></div>
      <div><label>대상</label><input id="m_target" placeholder="예: 예비소성로"/></div>
      <div><label>점검/급지포인트</label><input id="m_point" placeholder="포인트"/></div>
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
            <th>공정</th><th>라인</th><th>대상</th>
            <th>점검/급지포인트</th><th>주기</th><th>비고</th><th>관리</th>
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
    tbody.innerHTML = `<tr><td colspan="7" style="padding:20px;color:#888;">등록된 데이터가 없습니다.</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(r=>`
    <tr>
      <td>${escapeHtml(r.process)}</td>
      <td>${escapeHtml(r.line)}</td>
      <td>${escapeHtml(r.target)}</td>
      <td>${escapeHtml(r.point)}</td>
      <td>${escapeHtml(r.cycle)}</td>
      <td>${escapeHtml(r.remark)}</td>
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
  ["m_id","m_line","m_target","m_point","m_cycle","m_remark"]
    .forEach(id => document.getElementById(id).value = "");
}
window.editMaster = function(id) {
  const row = loadMaster().find(x=>x.id===id);
  if (!row) return;
  document.getElementById("m_id").value      = row.id;
  document.getElementById("m_process").value = row.process;
  document.getElementById("m_line").value    = row.line;
  document.getElementById("m_target").value  = row.target;
  document.getElementById("m_point").value   = row.point;
  document.getElementById("m_cycle").value   = row.cycle;
  document.getElementById("m_remark").value  = row.remark;
  window.scrollTo({top:0, behavior:"smooth"});
};
window.deleteMaster = function(id) {
  if (!confirm("삭제하시겠습니까? 관련 회차·휴지 기록도 함께 삭제됩니다.")) return;
  saveMaster(loadMaster().filter(x=>x.id!==id));
  const recs = loadRecords(); delete recs[id]; saveRecords(recs);
  const pss  = loadPauses();  delete pss[id];  savePauses(pss);
  if (state.currentSub && state.currentSub !== "관리메뉴") {
    renderProcessRows(state.currentSub, { rebuildHead:true });
  } else {
    renderMasterTable();
  }
};

/* =========================================================
   공정별 페이지
   ========================================================= */
function renderProcessPage(container, process) {
  container.innerHTML = `
    <div class="section-title">🔧 ${process} 급유급지 점검 현황</div>

    <!-- ▼ 인라인 빠른 추가 폼 -->
    <div id="quickAddForm">
      <div><label>라인</label><input id="q_line" placeholder="예: A라인" autocomplete="off"/></div>
      <div><label>대상</label><input id="q_target" placeholder="대상 설비" autocomplete="off"/></div>
      <div><label>점검/급지포인트</label><input id="q_point" placeholder="점검 또는 급지 포인트" autocomplete="off"/></div>
      <div><label>주기 (예: 6M, 10D)</label><input id="q_cycle" placeholder="6M" autocomplete="off"/></div>
      <div><label>비고</label><input id="q_remark" placeholder="비고" autocomplete="off"/></div>
      <div><button id="btnQuickAdd">＋ ${process}에 추가</button></div>
    </div>

    <div class="toolbar">
      <button class="btn btn-primary" id="btnAddRow">＋ 상세 추가</button>
      <label style="margin-left:20px;">차회수리일자</label>
      <input type="date" id="dateFrom" value="${state.dateFrom}"/>
      <span>~</span>
      <input type="date" id="dateTo" value="${state.dateTo}"/>
      <button class="btn btn-sm btn-primary" id="btnFilterDate">기간조회</button>
      <button class="btn btn-sm btn-ghost" style="color:#333;border-color:#ccd3dd;" id="btnResetFilter">초기화</button>
    </div>

    <div class="table-wrap sticky-wrap">
      <table id="processTable" class="sticky-table">
        <thead id="processThead"></thead>
        <tbody id="processTbody"></tbody>
      </table>
    </div>

    <!-- ▼ 추가/수정 모달 -->
    <div id="rowModal" class="modal-overlay hidden">
      <div class="modal" style="width:480px;">
        <h2 id="rowModalTitle" style="text-align:center;color:#1a3a6c;margin-bottom:18px;">행 추가</h2>
        <input type="hidden" id="r_id"/>
        <div class="form-row"><label>라인 *</label><input id="r_line" autocomplete="off"/></div>
        <div class="form-row"><label>대상 *</label><input id="r_target" autocomplete="off"/></div>
        <div class="form-row"><label>점검/급지포인트</label><input id="r_point" autocomplete="off"/></div>
        <div class="form-row"><label>주기 * (예: 6M, 10D)</label><input id="r_cycle" autocomplete="off"/></div>
        <div class="form-row"><label>비고</label><input id="r_remark" autocomplete="off"/></div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="btn btn-primary btn-block" id="btnRowSave">저장</button>
          <button class="btn btn-ghost btn-block" style="color:#333;border-color:#ccd3dd;" id="btnRowCancel">취소</button>
        </div>
      </div>
    </div>

    <!-- ▼ 휴지 관리 모달 -->
    <div id="pauseModal" class="modal-overlay hidden">
      <div class="modal" style="width:520px;">
        <h2 style="text-align:center;color:#1a3a6c;margin-bottom:12px;">🛑 휴지 기간 관리</h2>
        <div id="pauseTargetInfo" style="text-align:center;color:#666;font-size:13px;margin-bottom:14px;"></div>

        <div class="form-row" style="display:flex;gap:8px;align-items:end;">
          <div style="flex:1;"><label>시작일</label><input type="date" id="p_start"/></div>
          <div style="flex:1;"><label>종료일</label><input type="date" id="p_end"/></div>
          <button class="btn btn-primary" id="btnPauseAdd">＋ 추가</button>
        </div>

        <div class="table-wrap" style="max-height:220px;overflow:auto;margin-top:10px;">
          <table>
            <thead>
              <tr><th>#</th><th>시작일</th><th>종료일</th><th>일수</th><th>관리</th></tr>
            </thead>
            <tbody id="pauseTbody"></tbody>
          </table>
        </div>

        <button class="btn btn-primary btn-block" id="btnPauseClose" style="margin-top:14px;">닫기</button>
      </div>
    </div>
  `;

  document.getElementById("btnQuickAdd").addEventListener("click", ()=>quickAdd(process));
  document.getElementById("btnAddRow").addEventListener("click", ()=>openRowModal(process));
  document.getElementById("btnRowSave").addEventListener("click", ()=>saveRowModal(process));
  document.getElementById("btnRowCancel").addEventListener("click", closeRowModal);
  document.getElementById("btnPauseClose").addEventListener("click", closePauseModal);
  document.getElementById("btnPauseAdd").addEventListener("click", addPause);

  document.getElementById("btnFilterDate").addEventListener("click", ()=>{
    state.dateFrom = document.getElementById("dateFrom").value;
    state.dateTo   = document.getElementById("dateTo").value;
    renderProcessRows(process, { rebuildHead:true });
  });
  document.getElementById("btnResetFilter").addEventListener("click", ()=>{
    state.filters = {}; state.dateFrom=""; state.dateTo="";
    document.getElementById("dateFrom").value = "";
    document.getElementById("dateTo").value = "";
    document.querySelectorAll("#processThead .filter-row input").forEach(i=> i.value="");
    renderProcessRows(process, { rebuildHead:true });
  });

  renderProcessRows(process, { rebuildHead:true });
}

/* ---------- 빠른 추가 ---------- */
function quickAdd(process) {
  const row = {
    id: uid(),
    process,
    line:    document.getElementById("q_line").value.trim(),
    target:  document.getElementById("q_target").value.trim(),
    point:   document.getElementById("q_point").value.trim(),
    cycle:   document.getElementById("q_cycle").value.trim(),
    remark:  document.getElementById("q_remark").value.trim()
  };
  if (!row.line || !row.target || !row.cycle) {
    alert("라인, 대상, 주기는 필수 항목입니다.");
    return;
  }
  if (!parseCycle(row.cycle)) {
    alert("주기 형식이 올바르지 않습니다. 예: 6M, 10D");
    return;
  }
  const data = loadMaster();
  data.push(row);
  saveMaster(data);
  ["q_line","q_target","q_point","q_cycle","q_remark"]
    .forEach(id => document.getElementById(id).value = "");
  renderProcessRows(process, { rebuildHead:true });
}

/* =========================================================
   행 추가/수정 모달
   ========================================================= */
function openRowModal(process, id) {
  document.getElementById("rowModal").classList.remove("hidden");
  document.getElementById("rowModalTitle").textContent = id ? "행 수정" : "행 추가";
  if (id) {
    const row = loadMaster().find(x=>x.id===id);
    if (!row) return;
    document.getElementById("r_id").value      = row.id;
    document.getElementById("r_line").value    = row.line || "";
    document.getElementById("r_target").value  = row.target || "";
    document.getElementById("r_point").value   = row.point || "";
    document.getElementById("r_cycle").value   = row.cycle || "";
    document.getElementById("r_remark").value  = row.remark || "";
  } else {
    ["r_id","r_line","r_target","r_point","r_cycle","r_remark"]
      .forEach(fid => document.getElementById(fid).value = "");
  }
  bindAutocomplete(process);
}
function closeRowModal() {
  document.getElementById("rowModal").classList.add("hidden");
}
function saveRowModal(process) {
  const row = {
    id:      document.getElementById("r_id").value || uid(),
    process: process,
    line:    document.getElementById("r_line").value.trim(),
    target:  document.getElementById("r_target").value.trim(),
    point:   document.getElementById("r_point").value.trim(),
    cycle:   document.getElementById("r_cycle").value.trim(),
    remark:  document.getElementById("r_remark").value.trim()
  };
  if (!row.line || !row.target || !row.cycle) {
    alert("라인, 대상, 주기는 필수 항목입니다.");
    return;
  }
  if (!parseCycle(row.cycle)) {
    alert("주기 형식이 올바르지 않습니다. 예: 6M, 10D");
    return;
  }
  const data = loadMaster();
  const idx = data.findIndex(x=>x.id===row.id);
  if (idx>=0) data[idx] = row; else data.push(row);
  saveMaster(data);
  closeRowModal();
  renderProcessRows(process, { rebuildHead:true });
}

/* =========================================================
   휴지 관리 모달
   ========================================================= */
let _currentPauseTargetId = null;
window.openPauseModal = function(id) {
  _currentPauseTargetId = id;
  const row = loadMaster().find(x=>x.id===id);
  document.getElementById("pauseTargetInfo").textContent =
    row ? `[${row.line}] ${row.target} - ${row.point||""}` : "";
  document.getElementById("p_start").value = "";
  document.getElementById("p_end").value = "";
  document.getElementById("pauseModal").classList.remove("hidden");
  renderPauseList();
};
function closePauseModal() {
  document.getElementById("pauseModal").classList.add("hidden");
  _currentPauseTargetId = null;
  renderProcessRows(state.currentSub, { rebuildHead:true });
}
function addPause() {
  const s = document.getElementById("p_start").value;
  const e = document.getElementById("p_end").value;
  if (!s || !e) { alert("시작일과 종료일을 모두 입력하세요."); return; }
  if (s > e)    { alert("종료일이 시작일보다 빠릅니다."); return; }
  const all = loadPauses();
  const list = all[_currentPauseTargetId] || [];
  list.push({ start:s, end:e });
  all[_currentPauseTargetId] = list;
  savePauses(all);
  document.getElementById("p_start").value = "";
  document.getElementById("p_end").value = "";
  renderPauseList();
}
window.removePause = function(idx) {
  const all = loadPauses();
  const list = all[_currentPauseTargetId] || [];
  list.splice(idx, 1);
  all[_currentPauseTargetId] = list;
  savePauses(all);
  renderPauseList();
};
function renderPauseList() {
  const tbody = document.getElementById("pauseTbody");
  const list = (loadPauses()[_currentPauseTargetId]) || [];
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding:14px;color:#888;">등록된 휴지 기간이 없습니다.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((p,i)=>{
    const ps = parseDate(p.start), pe = parseDate(p.end);
    const days = (ps && pe) ? diffDays(ps, pe) : 0;
    return `
      <tr>
        <td>${i+1}</td>
        <td>${p.start}</td>
        <td>${p.end}</td>
        <td>${days}일</td>
        <td><button class="btn btn-sm btn-danger" onclick="removePause(${i})">삭제</button></td>
      </tr>
    `;
  }).join("");
}

/* =========================================================
   회차 계산
   ========================================================= */
function calcRoundsCount(rows) {
  let max = MIN_ROUNDS;
  rows.forEach(r => {
    const filled = (r.recs || []).filter(x => x.date).length;
    const need = filled + 1;
    if (need > max) max = need;
  });
  return max;
}

/* =========================================================
   테이블 데이터 만들기
   ========================================================= */
function buildRowsData(process) {
  const master = loadMaster().filter(r => r.process === process);
  const records = loadRecords();
  const pauses = loadPauses();

  const rowsAll = master.map(r => {
    const recs = records[r.id] || [];
    const filled = recs.filter(x => x.date);
    const lastDate = filled.length ? filled[filled.length-1].date : "";
    const pauseList = pauses[r.id] || [];
    const nextDate = calcNextDate(lastDate, r.cycle, pauseList);
    const pauseDays = pauseList.reduce((s,p)=>{
      const ps=parseDate(p.start), pe=parseDate(p.end);
      return s + (ps && pe ? diffDays(ps,pe) : 0);
    },0);
    return { ...r, recs, nextDate, pauseCount: pauseList.length, pauseDays };
  });

  const rows = rowsAll
    .filter(r => {
      for (const k of Object.keys(state.filters)) {
        const v = state.filters[k];
        if (v && !String(r[k]||"").toLowerCase().includes(v)) return false;
      }
      return true;
    })
    .filter(r => {
      if (!state.dateFrom && !state.dateTo) return true;
      if (!r.nextDate) return false;
      if (state.dateFrom && r.nextDate < state.dateFrom) return false;
      if (state.dateTo   && r.nextDate > state.dateTo)   return false;
      return true;
    });

  return { rowsAll, rows };
}

/* =========================================================
   테이블 렌더 (비고 컬럼 없음 - 좌측 6개 고정)
   순서: 라인 · 대상 · 점검/급지포인트 · 주기 · 차회수리일자 · 휴지
        → 이후: 1회차 · 2회차 · ... · 관리
   ========================================================= */
function renderProcessRows(process, opts = {}) {
  const thead = document.getElementById("processThead");
  const tbody = document.getElementById("processTbody");
  if (!thead || !tbody) return;

  const { rowsAll, rows } = buildRowsData(process);
  const roundsCnt = calcRoundsCount(rowsAll);

  const prevRounds = thead.dataset.rounds ? +thead.dataset.rounds : -1;
  if (prevRounds !== roundsCnt || opts.rebuildHead) {
    renderThead(process, roundsCnt);
    thead.dataset.rounds = roundsCnt;
  }
  renderTbody(rows, roundsCnt);
}

function renderThead(process, roundsCnt) {
  const thead = document.getElementById("processThead");
  const roundHeaders = Array.from({length: roundsCnt}, (_,i)=>`<th class="col-round">${i+1}회차</th>`).join("");

  thead.innerHTML = `
    <tr>
      <th class="col-line   sticky-col sticky-1">라인</th>
      <th class="col-target sticky-col sticky-2">대상</th>
      <th class="col-point  sticky-col sticky-3">점검/급지포인트</th>
      <th class="col-cycle  sticky-col sticky-4">주기</th>
      <th class="col-next   sticky-col sticky-5">차회수리일자</th>
      <th class="col-pause  sticky-col sticky-6 sticky-last">휴지</th>
      ${roundHeaders}
      <th class="col-mgr">관리</th>
    </tr>
    <tr class="filter-row">
      <th class="sticky-col sticky-1"><input data-f="line"   placeholder="검색" value="${escapeHtml(state.filters.line||"")}"/></th>
      <th class="sticky-col sticky-2"><input data-f="target" placeholder="검색" value="${escapeHtml(state.filters.target||"")}"/></th>
      <th class="sticky-col sticky-3"><input data-f="point"  placeholder="검색" value="${escapeHtml(state.filters.point||"")}"/></th>
      <th class="sticky-col sticky-4"><input data-f="cycle"  placeholder="검색" value="${escapeHtml(state.filters.cycle||"")}"/></th>
      <th class="sticky-col sticky-5"></th>
      <th class="sticky-col sticky-6 sticky-last"></th>
      <th colspan="${roundsCnt + 1}"></th>
    </tr>
  `;

  thead.querySelectorAll(".filter-row input").forEach(inp=>{
    let composing = false;
    inp.addEventListener("compositionstart", ()=> composing = true);
    inp.addEventListener("compositionend", e => {
      composing = false;
      state.filters[e.target.dataset.f] = e.target.value.toLowerCase();
      const { rows } = buildRowsData(process);
      renderTbody(rows, roundsCnt);
    });
    inp.addEventListener("input", debounce(e => {
      if (composing) return;
      state.filters[e.target.dataset.f] = e.target.value.toLowerCase();
      const { rows } = buildRowsData(process);
      renderTbody(rows, roundsCnt);
    }, 150));
  });
}

function renderTbody(rows, roundsCnt) {
  const tbody = document.getElementById("processTbody");
  // 총 컬럼: 6(고정) + roundsCnt + 1(관리) = 7 + roundsCnt
  const totalCols = 7 + roundsCnt;
  if (!rows.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="${totalCols}" style="padding:20px;color:#888;text-align:center;">검색 결과가 없습니다.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r=>{
    const roundCells = Array.from({length: roundsCnt}, (_,i)=>{
      const rec = r.recs[i] || { date:"", reason:"" };
      return `<td class="col-round">
        <div class="round-cell">
          <input type="date"  data-id="${r.id}" data-i="${i}" data-k="date"   value="${rec.date}"/>
          <input type="text"  data-id="${r.id}" data-i="${i}" data-k="reason" placeholder="사유" value="${escapeHtml(rec.reason||"")}"/>
        </div>
      </td>`;
    }).join("");

    const pauseBtnLabel = r.pauseCount > 0
      ? `🛑 휴지 (${r.pauseCount}건/${r.pauseDays}일)`
      : `🛑 휴지`;
    const pauseBtnClass = r.pauseCount > 0 ? "btn-warn" : "btn-ghost-dark";
    const rowClass = r.pauseCount>0 ? 'paused-row' : '';

    return `
      <tr data-row="${r.id}" class="${rowClass}">
        <td class="col-line   sticky-col sticky-1">${escapeHtml(r.line)}</td>
        <td class="col-target sticky-col sticky-2">${escapeHtml(r.target)}</td>
        <td class="col-point  sticky-col sticky-3">${escapeHtml(r.point)}</td>
        <td class="col-cycle  sticky-col sticky-4">${escapeHtml(r.cycle)}</td>
        <td class="col-next   sticky-col sticky-5 next-date-ok">${r.nextDate || "-"}</td>
        <td class="col-pause  sticky-col sticky-6 sticky-last">
          <button class="btn btn-sm ${pauseBtnClass}" onclick="openPauseModal('${r.id}')">${pauseBtnLabel}</button>
        </td>
        ${roundCells}
        <td class="col-mgr">
          <button class="btn btn-sm btn-primary" onclick="editRow('${r.id}')">수정</button>
          <button class="btn btn-sm btn-danger"  onclick="deleteMaster('${r.id}')">삭제</button>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll("input[data-id]").forEach(inp=>{
    inp.addEventListener("change", handleRoundChange);
  });
}

function handleRoundChange(e) {
  const id = e.target.dataset.id;
  updateRecord(id);
}

window.editRow = function(id) {
  openRowModal(state.currentSub, id);
};

function updateRecord(id) {
  const inputs = document.querySelectorAll(`#processTbody input[data-id="${id}"]`);
  const recs = [];
  inputs.forEach(inp => {
    const i = +inp.dataset.i;
    const k = inp.dataset.k;
    if (!recs[i]) recs[i] = { date:"", reason:"" };
    recs[i][k] = inp.value;
  });
  let lastIdx = -1;
  recs.forEach((r,i)=>{ if (r && (r.date || r.reason)) lastIdx = i; });
  const cleaned = recs.slice(0, lastIdx+1).map(r => r || { date:"", reason:"" });

  const all = loadRecords();
  all[id] = cleaned;
  saveRecords(all);

  renderProcessRows(state.currentSub, { rebuildHead:true });
}

/* =========================================================
   자동완성
   ========================================================= */
function getSuggestions(process, field) {
  const master = loadMaster().filter(r => r.process === process);
  const set = new Set();
  master.forEach(r => {
    const v = (r[field] || "").trim();
    if (v) set.add(v);
  });
  return Array.from(set).sort((a,b)=> a.localeCompare(b, "ko"));
}
function bindAutocomplete(process) {
  const map = [
    { inputId: "r_line",   field: "line"   },
    { inputId: "r_target", field: "target" },
    { inputId: "r_point",  field: "point"  },
    { inputId: "r_cycle",  field: "cycle"  }
  ];
  map.forEach(m => attachAutocomplete(m.inputId, process, m.field));
}
function attachAutocomplete(inputId, process, field) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const oldPop = document.getElementById(inputId + "_ac");
  if (oldPop) oldPop.remove();

  const oldVal = input.value;
  const clone = input.cloneNode(true);
  clone.value = oldVal;
  input.parentNode.replaceChild(clone, input);
  const el = document.getElementById(inputId);

  const parent = el.parentNode;
  if (getComputedStyle(parent).position === "static") {
    parent.style.position = "relative";
  }

  const pop = document.createElement("ul");
  pop.className = "ac-popup";
  pop.id = inputId + "_ac";
  parent.appendChild(pop);

  let activeIdx = -1;
  let items = [];

  const render = (keyword) => {
    const all = getSuggestions(process, field);
    const kw = (keyword || "").trim().toLowerCase();
    items = kw ? all.filter(v => v.toLowerCase().includes(kw)) : all;

    if (!items.length) { pop.classList.remove("show"); pop.innerHTML = ""; return; }
    pop.innerHTML = items.map((v,i)=>{
      let display = escapeHtml(v);
      if (kw) {
        const idx = v.toLowerCase().indexOf(kw);
        if (idx >= 0) {
          display =
            escapeHtml(v.substring(0, idx)) +
            `<mark>${escapeHtml(v.substring(idx, idx + kw.length))}</mark>` +
            escapeHtml(v.substring(idx + kw.length));
        }
      }
      return `<li data-idx="${i}" class="ac-item">${display}</li>`;
    }).join("");
    pop.classList.add("show");
    activeIdx = -1;

    pop.querySelectorAll(".ac-item").forEach(li => {
      li.addEventListener("mousedown", e => {
        e.preventDefault();
        el.value = items[+li.dataset.idx];
        pop.classList.remove("show");
      });
      li.addEventListener("mouseenter", () => {
        pop.querySelectorAll(".ac-item").forEach(x=>x.classList.remove("active"));
        li.classList.add("active");
        activeIdx = +li.dataset.idx;
      });
    });
  };

  el.addEventListener("focus", () => render(el.value));
  el.addEventListener("input", () => render(el.value));
  el.addEventListener("keydown", (e) => {
    if (!pop.classList.contains("show")) return;
    const lis = pop.querySelectorAll(".ac-item");
    if (!lis.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault(); activeIdx = (activeIdx + 1) % lis.length; updateActive(lis);
    } else if (e.key === "ArrowUp") {
      e.preventDefault(); activeIdx = (activeIdx - 1 + lis.length) % lis.length; updateActive(lis);
    } else if (e.key === "Enter") {
      if (activeIdx >= 0) { e.preventDefault(); el.value = items[activeIdx]; pop.classList.remove("show"); }
    } else if (e.key === "Escape") {
      pop.classList.remove("show");
    }
  });
  function updateActive(lis) {
    lis.forEach(x=>x.classList.remove("active"));
    if (activeIdx >= 0 && lis[activeIdx]) {
      lis[activeIdx].classList.add("active");
      lis[activeIdx].scrollIntoView({ block: "nearest" });
    }
  }
  el.addEventListener("blur", () => {
    setTimeout(() => pop.classList.remove("show"), 120);
  });
}

/* =========================================================
   앱 시작
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  initLogin();
  initMenu();
});
