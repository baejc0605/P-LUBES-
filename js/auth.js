const VALID_ID = "1004";
const VALID_PW = "1005";

/* ===== 로그인 폼 처리 (로그인 페이지에서만 동작) ===== */
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
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
document.addEventListener('DOMContentLoaded', function() {
    const hasSubItems = document.querySelectorAll('.main-nav > ul > li.has-sub');
    
    hasSubItems.forEach(function(item) {
        const link = item.querySelector('a');
        if (!link) return;
        
        link.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // 현재 메뉴의 열림 상태 확인
            const isOpen = item.classList.contains('open');
            
            // 모든 서브메뉴 닫기
            hasSubItems.forEach(function(other) {
                other.classList.remove('open');
            });
            
            // 현재 메뉴가 닫혀있었다면 열기 (토글)
            if (!isOpen) {
                item.classList.add('open');
            }
        });
    });
    
    // 바깥 클릭 시 모든 서브메뉴 닫기
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.main-nav')) {
            hasSubItems.forEach(function(item) {
                item.classList.remove('open');
            });
        }
    });
    
    // 서브메뉴 항목 클릭 시 메뉴 자동 닫기
    document.querySelectorAll('.sub-menu li a').forEach(function(subLink) {
        subLink.addEventListener('click', function() {
            hasSubItems.forEach(function(item) {
                item.classList.remove('open');
            });
        });
    });
    
    // ESC 키로 서브메뉴 닫기
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            hasSubItems.forEach(function(item) {
                item.classList.remove('open');
            });
        }
    });
});
