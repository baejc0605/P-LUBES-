const VALID_ID = "1004";
const VALID_PW = "1005";

/* ===== 로그인 폼 처리 (로그인 페이지에서만 동작) ===== */
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (username === VALID_ID && password === VALID_PW) {
            sessionStorage.setItem('isLoggedIn', 'true');
            alert('로그인 성공! 환영합니다.');
            window.location.href = 'dashboard.html';
        } else {
            alert('아이디 또는 비밀번호가 맞지 않습니다.');
            document.getElementById('password').value = '';
            document.getElementById('password').focus();
        }
    });
}

/* ===== 로그인 체크 (다른 페이지에서 사용) ===== */
function checkLogin() {
    if (sessionStorage.getItem('isLoggedIn') !== 'true') {
        alert('로그인이 필요합니다.');
        window.location.href = 'index.html';
    }
}

/* ===== 로그아웃 ===== */
function logout() {
    if (confirm('로그아웃 하시겠습니까?')) {
        sessionStorage.removeItem('isLoggedIn');
        window.location.href = 'index.html';
    }
}

/* ===== 메인 네비게이션 서브메뉴 토글 ===== */
document.addEventListener('DOMContentLoaded', function () {
    // .main-nav 내부의 has-sub를 폭넓게 잡습니다(구조 변경에도 견고)
    const hasSubItems = document.querySelectorAll('.main-nav li.has-sub');

    // 열려있는 메뉴를 모두 닫는 함수
    function closeAllMenus() {
        hasSubItems.forEach(function (li) {
            li.classList.remove('open');

            // CSS가 hover로 강제 표시하는 경우도 있어 인라인로 한 번 더 방어
            const sub = li.querySelector(':scope > .sub-menu');
            if (sub) sub.style.display = '';
        });
    }

    hasSubItems.forEach(function (item) {
        // 상위 메뉴 링크는 "자식(직계) a"만 대상으로 해야 안정적입니다
        const link = item.querySelector(':scope > a');
        if (!link) return;

        link.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const isOpen = item.classList.contains('open');

            // 다른 메뉴는 닫고
            hasSubItems.forEach(function (other) {
                if (other !== item) other.classList.remove('open');
            });

            // 같은 메뉴를 다시 누르면 닫히도록 "토글"
            if (isOpen) {
                item.classList.remove('open');
            } else {
                item.classList.add('open');
            }
        });
    });

    // 바깥 클릭 시 닫기
    document.addEventListener('click', function (e) {
        const nav = document.querySelector('.main-nav');
        if (!nav) return;

        if (!nav.contains(e.target)) {
            closeAllMenus();
        }
    });

    // 서브메뉴 항목 클릭 시 닫기
    document.querySelectorAll('.main-nav .sub-menu a').forEach(function (subLink) {
        subLink.addEventListener('click', function () {
            closeAllMenus();
        });
    });

    // ESC 키로 닫기
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeAllMenus();
        }
    });
});
