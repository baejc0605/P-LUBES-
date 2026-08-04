const LOGIN_ID = "1004";
const LOGIN_PW = "1005";
const AUTH_KEY = "equip_v1_auth";

const loginOverlay = document.getElementById("login-overlay");
const loginForm = document.getElementById("login-form");
const loginId = document.getElementById("login-id");
const loginPw = document.getElementById("login-pw");
const app = document.getElementById("app");
const logoutBtn = document.getElementById("logout-btn");

function openApp() {
  loginOverlay.classList.add("hidden");
  app.classList.remove("hidden");
}

function closeApp() {
  loginOverlay.classList.remove("hidden");
  app.classList.add("hidden");
}

if (sessionStorage.getItem(AUTH_KEY) === "true") {
  openApp();
} else {
  closeApp();
}

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = loginId.value.trim();
  const pw = loginPw.value.trim();

  if (id === LOGIN_ID && pw === LOGIN_PW) {
    sessionStorage.setItem(AUTH_KEY, "true");
    openApp();
  } else {
    alert("아이디 또는 비밀번호가 올바르지 않습니다.");
  }
});

logoutBtn.addEventListener("click", () => {
  sessionStorage.removeItem(AUTH_KEY);
  closeApp();
});
