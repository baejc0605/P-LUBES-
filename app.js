const LOGIN_ID = "1004";
const LOGIN_PW = "1005";

const STORAGE_KEYS = {
  master: "equip_v1_master",
  rounds: "equip_v1_rounds",
  auth: "equip_v1_auth"
};

const PROCESS_LIST = ["예비소성로", "본소성", "열처리", "혼합설비", "필터프레스", "진공건조기", "냉각기"];
const HOLIDAYS = ["2026-01-01", "2026-03-01", "2026-05-05", "2026-06-06", "2026-08-15", "2026-10-03", "2026-10-09", "2026-12-25"];

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
  gnbBtns: document.querySelectorAll(".gnb-btn"),
  lnb: document.getElementById("lnb"),
  lnbBtns: document.querySelectorAll(".lnb-btn"),
  homeSection: document.getElementById("home-section"),
  processSection: document.getElementById("process-section"),
  managementSection: document.getElementById("management-section")
};

init();

function init() {
  loadData();
  bindEvents();

  if (sessionStorage.getItem(STORAGE_KEYS.auth) === "true") {
    openApp();
  } else {
    closeApp();
  }

  render();
}

function bindEvents() {
  el.loginForm.addEventListener("submit", onLoginSubmit);
  el.logoutBtn.addEventListener("click", logout);

  el.gnbBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.main = btn.dataset.main;
      highlightGnb();
      render();
    });
  });

  el.lnbBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.sub = btn.dataset.sub;
      highlightLnb();
      render();
    });
  });

  el.managementSection.addEventListener("submit", onMasterFormSubmit);
  el.managementSection.addEventListener("click", onManagementClick);

  el.processSection.addEventListener("input", onProcessInput);
}

function onLoginSubmit(e) {
  e.preventDefault();
  const id = el.loginId.value.trim();
  const pw = el.loginPw.value.trim();

  if (id === LOGIN_ID && pw === LOGIN_PW) {
    sessionStorage.setItem(STORAGE_KEYS.auth, "true");
    openApp();
    render();
    return;
  }
  alert("아이디 또는 비밀번호가 올바르지 않습니다.");
}

function logout() {
  sessionStorage.removeItem(STORAGE_KEYS.auth);
  closeApp();
}

function openApp() {
  el.loginOverlay.classList.add("hidden");
  el.app.classList.remove("hidden");
}

function closeApp() {
  el.loginOverlay.classList.remove("hidden");
  el.app.classList.add("hidden");
  el.loginForm.reset();
}

function loadData() {
  state.masterData = JSON.parse(localStorage.getItem(STORAGE_KEYS.master) || "[]");
  state.roundData = JSON.parse(localStorage.getItem(STORAGE_KEYS.rounds) || "{}");
}

function saveData() {
  localStorage.setItem(STORAGE_KEYS.master, JSON.stringify(state.masterData));
  localStorage.setItem(STORAGE_KEYS.rounds, JSON.stringify(state.roundData));
}

function render() {
  highlightGnb();
  highlightLnb();

  const isHome = state.main === "home";
  const isMgmt = state.main === "lubrication" && state.sub === "관리메뉴";

  el.lnb.classList.toggle("hidden", state.main !== "lubrication");
  el.homeSection.classList.toggle("hidden", !isHome);
  el.managementSection.classList.toggle("hidden", !isMgmt);
  el.processSection.classList.toggle("hidden", isHome || isMgmt);

  if (isHome) renderHome();
  if (isMgmt) renderManagement();
  if (!isHome && !isMgmt) renderProcess();
}

function highlightGnb() {
  el.gnbBtns.forEach((b) => b.classList.toggle("active", b.dataset.main === state.main));
}

function highlightLnb() {
  el.lnbBtns.forEach((b) => b.classList.toggle("active", b.dataset.sub === state.sub));
}

/* -------------------- HOME -------------------- */
function renderHome() {
  const total = state.masterData.length;
  const monthDone = getCompletedCountThisMonth();
  const rate = total ? ((monthDone / total) * 100).toFixed(1) : "0.0";
  const top5 = getTop5Upcoming();

  el.homeSection.innerHTML = `
    <h2 class="section-title">HOME 대시보드</h2>
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
              ? top5.map((it) => `<li>${it.process} | ${it.target} | ${it.nextDate}</li>`).join("")
              : "<li>예정 데이터가 없습니다.</li>"
          }
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
    const rounds = state.roundData[row.id] || [];
    return rounds.some((r) => {
      const d = parseDate(r.date);
      return d && d.getFullYear() === y && d.getMonth() === m;
    });
  }).length;
}

function getTop5Upcoming() {
  return state.masterData
    .map((row) => ({
      ...row,
      nextDate: getNextRepairDate(row)
    }))
    .filter((x) => !!x.nextDate)
    .sort((a, b) => parseDate(a.nextDate) - parseDate(b.nextDate))
    .slice(0, 5);
}

/* -------------------- 관리메뉴 -------------------- */
function renderManagement() {
  el.managementSection.innerHTML = `
    <h2 class="section-title">급유급지관리 - 관리메뉴</h2>
    <form id="master-form" class="form-grid">
      <input type="hidden" name="id" value="${state.editId || ""}" />
      <div>
        <label>공정</label>
        <select name="process" required>
          ${PROCESS_LIST.map((p) => `<option value="${p}">${p}</option>`).join("")}
        </select>
      </div>
      <div><label>라인</label><input name="line" required /></div>
      <div><label>대상</label><input name="target" required /></div>
      <div><label>점검</label><input name="inspection"
