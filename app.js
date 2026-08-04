const LOGIN_ID = "1004";
const LOGIN_PW = "1005";

const STORAGE_KEYS = {
  AUTH: "equip_v1_auth",
  MASTER: "equip_v1_master",
  ROUNDS: "equip_v1_rounds"
};

const PROCESS_LIST = ["예비소성로", "본소성", "열처리", "혼합설비", "필터프레스", "진공건조기", "냉각기"];
const HOLIDAYS = ["2026-01-01", "2026-03-01", "2026-05-05", "2026-06-06", "2026-08-15", "2026-10-03", "2026-10-09", "2026-12-25"];
const ROUND_COUNT = 4;

const state = {
  main: "home",
  sub: PROCESS_LIST[0],
  editId: null,
  masterData: [],
  roundData: {},
  filters: {
    line: "",
    target: "",
    point: "",
    cycle: "",
    startDate: "",
    endDate: ""
  }
};

const el = {
  loginOverlay: document.getElementById("login-overlay"),
  loginForm: document.getElementById("login-form"),
  loginId: document.getElementById("login-id"),
  loginPw: document.getElementById("login-pw"),
  app: document.getElementById("app"),
  logoutBtn: document.getElementById("logout-btn"),
  gnbBtns: [...document.querySelectorAll(".gnb-btn")],
  lnb: document.getElementById("lnb"),
  lnbBtns: [...document.querySelectorAll(".lnb-btn")],
  homeSection: document.getElementById("home-section"),
  processSection: document.getElementById("process-section"),
  managementSection: document.getElementById("management-section")
};

init();

/* ---------- init ---------- */
function init() {
  loadData();
  bindEvents();

  if (sessionStorage.getItem(STORAGE_KEYS.AUTH) === "true") {
    openApp();
  } else {
    closeApp();
  }

  render();
}

function bindEvents() {
  el.loginForm.addEventListener("submit", onLoginSubmit);
  el.logoutBtn.addEventListener("click", onLogout);

  el.gnbBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.main = btn.dataset.main;
      render();
    });
  });

  el.lnbBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.sub = btn.dataset.sub;
      render();
    });
  });

  el.managementSection.addEventListener("submit", onMasterSubmit);
  el.managementSection.addEventListener("click", onManagementClick);

  el.processSection.addEventListener("input", onProcessInput);
  el.processSection.addEventListener("change", onProcessChange);
}

function loadData() {
  state.masterData = JSON.parse(localStorage.getItem(STORAGE_KEYS.MASTER) || "[]");
  state.roundData = JSON.parse(localStorage.getItem(STORAGE_KEYS.ROUNDS) || "{}");
}

function saveData() {
  localStorage.setItem(STORAGE_KEYS.MASTER, JSON.stringify(state.masterData));
  localStorage.setItem(STORAGE_KEYS.ROUNDS, JSON.stringify(state.roundData));
}

/* ---------- auth ---------- */
function onLoginSubmit(e) {
  e.preventDefault();
  const id = el.loginId.value.trim();
  const pw = el.loginPw.value.trim();

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
  el.loginOverlay.classList.add("hidden");
  el.app.classList.remove("hidden");
}

function closeApp() {
  el.loginOverlay.classList.remove("hidden");
  el.app.classList.add("hidden");
}

/* ---------- render ---------- */
function render() {
  el.gnbBtns.forEach((b) => b.classList.toggle("active", b.dataset.main === state.main));
  el.lnbBtns.forEach((b) => b.classList.toggle("active", b.dataset.sub === state.sub));

  const isHome = state.main === "home";
  const isMgmt = state.main === "lubrication" && state.sub === "관리메뉴";

  el.lnb.classList.toggle("hidden", state.main !== "lubrication");
  el.homeSection.classList.toggle("hidden", !isHome);
  el.managementSection.classList.toggle("hidden", !isMgmt);
  el.processSection.classList.toggle("hidden", isHome || isMgmt);

  if (isHome) renderHome();
  else if (isMgmt) renderManagement();
  else renderProcessPage(state.sub);
}

/* ---------- HOME ---------- */
function renderHome() {
  const total = state.masterData.length;
  const done = getCompletedCountThisMonth();
  const rate = total ? ((done / total) * 100).toFixed(1) : "0.0";
  const top5 = getUpcomingTop5();

  el.homeSection.innerHTML = `
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
          ${top5.length
            ? top5.map((x) => `<li>${escapeHtml(x.process)} | ${escapeHtml(x.target)} | ${x.nextDate}</li>`).join("")
            : "<li>데이터 없음</li>"}
        </ul>
      </article>
    </div>
  `;
}

function getCompletedCountThisMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  return state.masterData.filter((row) => {
    const rounds = getRounds(row.id);
    return rounds.some((r) => {
      if (!r.date) return false;
      const d = toDate(r.date);
      return d && d.getFullYear() === y && d.getMonth() === m;
    });
  }).length;
}

function getUpcomingTop5() {
  return state.masterData
    .map((row) => ({ ...row, nextDate: calcNextRepairDate(row) }))
    .filter((x) => !!x.nextDate)
    .sort((a, b) => toDate(a.nextDate) - toDate(b.nextDate))
    .slice(0, 5);
}

/* ---------- 관리메뉴 ---------- */
function renderManagement() {
  const editItem = state.editId ? state.masterData.find((m) => m.id === state.editId) : null;

  el.managementSection.innerHTML = `
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
      <div><label>주기(예: 6M, 30D)</label><input name="cycle" required value="${escapeHtml(editItem?.cycle || "")}" /></div>
      <div class="full"><label>비고</label><input name="note" value="${escapeHtml(editItem?.note || "")}" /></div>
      <button type="submit" class="action-btn">${editItem ? "수정 저장" : "신규 추가"}</button>
      ${editItem ? `<button type="button" class="action-btn" data-action="cancel-edit">수정 취소</button>` : ""}
    </form>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>공정</th><th>라인</th><th>대상</th><th>점검</th><th>급지포인트</th><th>주기</th><th>비고</th><th>관리</th>
          </tr>
        </thead>
        <tbody>
          ${state.masterData.length
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
            : `<tr><td colspan="8">등록된 기준 정보가 없습니다.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function onMasterSubmit(e) {
  if (e.target.id !== "master-form") return;
  e.preventDefault();

  const fd = new FormData(e.target);
  const cycle = normalizeCycle(String(fd.get("cycle") || "").trim());

  if (!/^\d+[MD]$/i.test(cycle)) {
    alert("주기는 예: 6M 또는 30D 형식으로 입력해 주세요.");
    return;
  }

  const data = {
    id: String(fd.get("id") || makeId()),
    process: String(fd.get("process") || "").trim(),
    line: String(fd.get("line") || "").trim(),
    target: String(fd.get("target") || "").trim(),
    inspection: String(fd.get("inspection") || "").trim(),
    point: String(fd.get("point") || "").trim(),
    cycle,
    note: String(fd.get("note") || "").trim()
  };

  const idx = state.masterData.findIndex((x) => x.id === data.id);
  if (idx >= 0) state.masterData[idx] = data;
  else state.masterData.push(data);

  state.editId = null;
  saveData();
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
    saveData();
    render();
  }
}

/* ---------- 공정 페이지 ---------- */
function renderProcessPage(processName) {
  const rows = state.masterData.filter((m) => m.process === processName);
  const filtered = applyFilters(rows);

  el.processSection.innerHTML = `
    <h2 class="section-title">급유급지관리 - ${escapeHtml(processName)}</h2>

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
            <th>대상</th>
            <th>점검/급지포인트</th>
            <th>주기</th>
            <th>차회수리일자</th>
            ${Array.from({ length: ROUND_COUNT })
              .map((_, i) => `<th>${i + 1}회차(일자, 사유)</th>`)
              .join("")}
          </tr>
        </thead>
        <tbody>
          ${filtered.length
            ? filtered.map((row) => {
                const rounds = getRounds(row.id);
                const nextDate = calcNextRepairDate(row);
                return `
                  <tr>
                    <td>${escapeHtml(row.line)}</td>
                    <td>${escapeHtml(row.target)}</td>
                    <td>${escapeHtml(`${row.inspection} / ${row.point}`)}</td>
                    <td>${escapeHtml(row.cycle)}</td>
                    <td>${nextDate || "-"}</td>
                    ${Array.from({ length: ROUND_COUNT }).map((_, i) => {
                      const r = rounds[i] || { date: "", reason: "" };
                      return `
                        <td class="round-cell">
                          <input type="date"
                            data-type="round-date"
                            data-id="${row.id}"
                            data-index="${i}"
                            value="${escapeHtml(r.date || "")}" />
                          <input type="text"
                            data-type="round-reason"
                            data-id="${row.id}"
                            data-index="${i}"
                            placeholder="사유"
                            value="${escapeHtml(r.reason || "")}" />
                        </td>
                      `;
                    }).join
