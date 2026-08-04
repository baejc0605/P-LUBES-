const VALID_ID = "1004";
const VALID_PW = "1005";

document.getElementById('loginForm').addEventListener('submit', function(e) {
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

// 로그인 체크 (다른 페이지에서 사용)
function checkLogin() {
    if (sessionStorage.getItem('isLoggedIn') !== 'true') {
        alert('로그인이 필요합니다.');
        window.location.href = 'index.html';
    }
}

function logout() {
    if (confirm('로그아웃 하시겠습니까?')) {
        sessionStorage.removeItem('isLoggedIn');
        window.location.href = 'index.html';
    }
}
