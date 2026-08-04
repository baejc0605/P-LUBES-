/* =========================
 * 설비관리V1(기계1파트) - SPA
 * ========================= */

const LOGIN_ID = "1004";
const LOGIN_PW = "1005";

const STORAGE_KEYS = {
  AUTH: "equip_v1_auth",
  MASTER: "equip_v1_master",
  ROUNDS: "equip_v1_rounds"
};

const PROCESS_LIST = ["예비소성로", "본소성", "열처리", "혼합설비", "필터프레스", "진공건조기", "냉각기"];
const HOLIDAYS = [
  "2026-01-01", "2026-03-01", "2026-05-05", "2026-06-06",
  "2026-08-15", "2026-10-03", "2026-10-09", "2026-12-25"
];
const ROUND_COUNT = 4;

const state = {
  mainMenu: "home", // home | lubrication
  subMenu: PROCESS_LIST[0], // process or 관리메뉴
  editId: null,
  masterData: [],
  roundData: {}, // { [id]: [{date, reason}, ...] }
  filters: {
    line: "",
    target: "",
    point: "",
    cycle: "",
    startDate: "",
    endDate: ""
  }
};

/* ---------- DOM ---------- */
const dom = {
  loginOverlay: document.getElementById("login-overlay"),
  loginForm: document.getElementById("login-form"),
  loginId: document.getElementById("login-id"),
  loginPw: document.getElementById("login-pw"),
  app: document.getElementById("app"),
  logoutBtn: document.getElementById("logout-btn"),
  gnbBtns: Array.from(document.querySelectorAll(".gnb-btn")),
  lnb: document.getElementById("lnb"),
  lnbBtns: Array.from(document.querySelectorAll(".lnb-btn")),
  homeSection: document.getElementById("home-section"),
  processSection: document.getElementById("process-section"),
  managementSection: document.getElementById("management-section")
};

init();

/* =========================
 * 초기화
 * ========================= */
function init() {
  loadStorage();
  bindBaseEvents();

  if (sessionStorage.getItem(STORAGE_KEYS.AUTH) === "true") openApp();
  else closeApp();

  render();
}

function loadStorage() {
  state.masterData = JSON.parse(localStorage.getItem(STORAGE_KEYS.MASTER) || "[]");
  state.roundData = JSON.parse(localStorage.getItem(STORAGE_KEYS.ROUNDS) || "{}");
}

function saveStorage() {
  localStorage.setItem(STORAGE_KEYS.MASTER, JSON.stringify(state.masterData));
  localStorage.setItem(STORAGE_KEYS.ROUNDS, JSON.stringify(state.roundData));
}

/* =========================
 * 로그인/로그아웃
 * ========================= */
function bindBaseEvents() {
  dom.loginForm.addEventListener("submit", onLoginSubmit);
  dom.logoutBtn.addEventListener("click", onLogout);

  dom.gnbBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.mainMenu = btn.dataset.main;
      render();
    });
  });

  dom.lnbBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.subMenu = btn.dataset.sub;
      render();
    });
  });

  dom.managementSection.addEventListener("submit", onMasterSubmit);
  dom.managementSection.addEventListener("click", onManagementClick);

  dom.processSection.addEventListener("input", onProcessInput);
  dom.processSection.addEventListener("change", onProcessChange);
}

function onLoginSubmit(e) {
  e.preventDefault();
  const id = dom.loginId.value.trim();
  const pw = dom.loginPw.value.trim();

  if (id === LOGIN_ID && pw === LOGIN_PW) {
    sessionStorage.setItem(STORAGE_KEYS.AUTH, "true");
    openApp();
    render();
  } else {
    alert("아이디 또는 비밀번호가 올바르지 않습니다.");
  }
}

function onLogout() {
  sessionStorage.removeItem(STORAGE_KEYS.AUTH);
  closeApp();
}

function openApp() {
  dom.loginOverlay.classList.add("hidden");
  dom.app.classList.remove("hidden");
}

function closeApp() {
  dom.loginOverlay.classList.remove("hidden");
  dom.app.classList.add("hidden");
}

/* =========================
 * 렌더링
 * ========================= */
function render() {
  // GNB active
  dom.gnbBtns.forEach((b) => b.classList.toggle("active", b.dataset.main === state.mainMenu));

  // LNB show/hide
  const isLubrication = state.mainMenu === "lubrication";
  dom.lnb.classList.toggle("hidden", !isLubrication);

  dom.lnbBtns.forEach((b) => b.classList.toggle("active", b.dataset.sub === state.subMenu));

  // section show/hide
  const isHome = state.mainMenu === "home";
  const isManagement = isLubrication && state.subMenu === "관리메뉴";

  dom.homeSection.classList.toggle("hidden", !isHome);
  dom.managementSection.classList.toggle("hidden", !isManagement);
  dom.processSection.classList.toggle("hidden", isHome || isManagement);

  if (isHome) renderHome();
  else if (isManagement) renderManagement();
  else renderProcessPage(state.subMenu);
}

/* =========================
 * HOME 대시보드
 * ========================= */
function renderHome() {
  const total = state.masterData.length;
  const done = getMonthlyCompletedCount();
  const rate = total > 0 ? ((done / total) * 100).toFixed(1) : "0.0";
  const top5 = getUpcomingTop5();

  dom.homeSection.innerHTML = `
    <h2 class="section-title">HOME</h2>
    <div class="card-grid">
      <article class="card">
        <h3>전체 설비 수</h3>
        <div class="metric">${total}</div>
      </article>
      <article class="card">
        <h3>당월 점검 완료율(진도율)</h3>
        <div class="metric">${rate}%</div>
      </article>
      <article class="card list-box">
        <h3>다음 예정 설비 TOP 5</h3>
        <ul>
          ${
            top5.length
              ? top5.map((x) => `<li>${x.process} | ${x.target} | ${x.nextDate}</li>`).join("")
              : "<li>데이터 없음</li>"
          }
        </ul>
      </article>
    </div>
  `;
}

function getMonthlyCompletedCount() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  return state.masterData.filter((item) => {
    const rounds = getRounds(item.id);
    return rounds.some((r) => {
      if (!r.date) return false;
      const d = toDate(r.date);
      return d && d.getFullYear() === y && d.getMonth() === m;
    });
  }).length;
}

function getUpcomingTop5() {
  return state.masterData
    .map((item) => ({ ...item, nextDate: calcNextRepairDate(item) }))
    .filter((x) => !!x.nextDate)
    .sort((a, b) => toDate(a.nextDate) - toDate(b.nextDate))
    .slice(0, 5);
}

/* =========================
 * 관리메뉴 (마스터)
 * ========================= */
function renderManagement() {
  const editItem = state.editId ? state.masterData.find((m) => m.id === state.editId) : null;

  dom.managementSection.innerHTML = `
    <h2 class="section-title">급유급지관리 - 관리메뉴</h2>
    <form id="master-form" class="form-grid">
      <input type="hidden" name="id" value="${editItem?.id || ""}" />
      <div>
        <label>공정</label>
        <select name="process" required>
          ${PROCESS_LIST.map((p) => `<option value="${p}" ${editItem?.process === p ? "selected" : ""}>${p}</option>`).join("")}
        </select>
      </div>
      <div><label>라인</label><input name="line" required value="${escapeHtml(editItem?.line || "")}" /></div>
      <div><label>대상</label><input name="target" required value="${escapeHtml(editItem?.target || "")}" /></div>
      <div><label>점검</label><input name="inspection" required value="${escapeHtml(editItem?.inspection || "")}" /></div>
      <div><label>급지포인트</label><input name="point" required value="${escapeHtml(editItem?.point || "")}" /></div>
      <div><label>주기 (예: 6M, 30D)</label><input name="cycle" required value="${escapeHtml(editItem?.cycle || "")}" /></div>
      <div class="full"><label>비고</label><input name="note" value="${escapeHtml(editItem?.note || "")}" /></div>
      <button type="submit" class="action-btn">${editItem ? "수정 저장" : "신규 추가"}</button>
      ${
        editItem
          ? `<button type="button" class="action-btn" data-action="cancel-edit">수정 취소</button>`
          : ""
      }
    </form>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>공정</th><th>라인</th><th>대상</th><th>점검</th><th>급지포인트</th><th>주기</th><th>비고</th><th>관리</th>
          </tr>
        </thead>
        <tbody>
          ${
            state.masterData.length
              ? state.masterData.map((m) => `
                <tr>
                  <td>${escapeHtml(m.process)}</td>
                  <td>${escapeHtml(m.line)}</td>
                  <td>${escapeHtml(m.target)}</td>
                  <td>${escapeHtml(m.inspection)}</td>
                  <td>${escapeHtml(m.point)}</td>
                  <td>${escapeHtml(m.cycle)}</td>
                  <td>${escapeHtml(m.note || "")}</td>
                  <td class="inline-actions">
                    <button class="small-btn" data-action="edit" data-id="${m.id}">수정</button>
                    <button class="small-btn" data-action="delete" data-id="${m.id}">삭제</button>
                  </td>
                </tr>
              `).join("")
              : `<tr><td colspan="8">등록된 기준 정보가 없습니다.</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function onMasterSubmit(e) {
  if (e.target.id !== "master-form") return;
  e.preventDefault();

  const fd = new FormData(e.target);
  const data = {
    id: fd.get("id") || crypto.randomUUID(),
    process: String(fd.get("process") || "").trim(),
    line: String(fd.get("line") || "").trim(),
    target: String(fd.get("target") || "").trim(),
    inspection: String(fd.get("inspection") || "").trim(),
    point: String(fd.get("point") || "").trim(),
    cycle: normalizeCycle(String(fd.get("cycle") || "").trim()),
    note: String(fd.get("note") || "").trim()
  };

  if (!/^\d+[MD]$/i.test(data.cycle)) {
    alert("주기는 예: 6M 또는 30D 형식으로 입력해 주세요.");
    return;
  }

  const idx = state.masterData.findIndex((x) => x.id === data.id);
  if (idx >= 0) state.masterData[idx] = data;
  else state.masterData.push(data);

  state.editId = null;
  saveStorage();
  render();
}

function onManagementClick(e) {
  const btn = e.target.closest("button");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;

  if (action === "cancel-edit") {
    state.editId = null;
    render();
    return;
  }

  if (action === "edit") {
    state.editId = id;
    render();
    return;
  }

  if (action === "delete") {
    if (!confirm("삭제하시겠습니까?")) return;
    state.masterData = state.masterData.filter((x) => x.id !== id);
    delete state.roundData[id];
    if (state.editId === id) state.editId = null;
    saveStorage();
    render();
  }
}

/* =========================
 * 공정 페이지
 * ========================= */
function renderProcessPage(processName) {
  const rows = state.masterData.filter((m) => m.process === processName);
  const filteredRows = applyProcessFilters(rows);

  dom.processSection.innerHTML = `
    <h2 class="section-title">급유급지관리 - ${processName}</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr class="filter-row">
            <th><input placeholder="라인 필터" data-filter="line" value="${escapeHtml(state.filters.line)}" /></th>
            <th><input placeholder="대상 필터" data-filter="target" value="${escapeHtml(state.filters.target)}" /></th>
            <th><input placeholder="점검/급지포인트 필터" data-filter="point" value="${escapeHtml(state.filters.point)}" /></th>
            <th><input placeholder="주기 필터" data-filter="cycle" value="${escapeHtml(state.filters.cycle)}" /></th>
            <th>
              <div style="display:grid;gap:6px;">
                <input type="date" data-filter="startDate" value="${escapeHtml(state.filters.startDate)}" />
                <input type="date" data-filter="endDate" value="${escapeHtml(state.filters.endDate)}" />
              </div>
            </th>
            ${Array.from({ length: ROUND_COUNT }).map(() => "<th></th>").join("")}
          </tr>
          <tr>
            <th>라인</th>
            <th>대
