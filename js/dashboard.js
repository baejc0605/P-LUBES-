// 로그인 체크
if (sessionStorage.getItem('isLoggedIn') !== 'true') {
    alert('로그인이 필요합니다.');
    window.location.href = 'index.html';
}

function logout() {
    if (confirm('로그아웃 하시겠습니까?')) {
        sessionStorage.removeItem('isLoggedIn');
        window.location.href = 'index.html';
    }
}

const CATEGORIES = ['예비소성로', '본소성', '열처리', '혼합설비', '필터프레스', '진공건조기', '냉각기'];

// 전체 데이터 로드
function loadAllData() {
    let allData = [];
    CATEGORIES.forEach(cat => {
        const data = JSON.parse(localStorage.getItem('equipment_' + cat) || '[]');
        data.forEach(row => row._category = cat);
        allData = allData.concat(data);
    });
    return allData;
}

// D-Day 계산
function calcDday(nextDate) {
    if (!nextDate) return null;
    const today = new Date();
    today.setHours(0,0,0,0);
    const next = new Date(nextDate);
    return Math.ceil((next - today) / (1000 * 60 * 60 * 24));
}

// 대시보드 렌더링
function renderDashboard() {
    const allData = loadAllData();
    let urgent = 0, warning = 0, normal = 0;
    const urgentList = [];

    allData.forEach(row => {
        const dday = calcDday(row.nextDate);
        if (dday === null) return;
        if (dday <= 0) { urgent++; urgentList.push({...row, dday}); }
        else if (dday <= 7) warning++;
        else normal++;
    });

    document.getElementById('urgentCount').textContent = urgent;
    document.getElementById('warningCount').textContent = warning;
    document.getElementById('normalCount').textContent = normal;
    document.getElementById('totalCount').textContent = allData.length;

    // 긴급 리스트 렌더링
    const tbody = document.getElementById('urgentTableBody');
    tbody.innerHTML = '';
    if (urgentList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:20px;color:#999;">차회수리일자 도달 항목이 없습니다.</td></tr>';
    } else {
        urgentList.forEach(row => {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.onclick = () => window.location.href = `management.html?category=${row._category}`;
            tr.innerHTML = `
                <td>${row._category}</td>
                <td>${row.line || '-'}</td>
                <td>${row.target || '-'}</td>
                <td>${row.point || '-'}</td>
                <td>${row.nextDate || '-'}</td>
                <td><span class="dday-badge dday-urgent">D${row.dday >= 0 ? '+'+row.dday : row.dday}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    // 그래프 1: 진행률 (완료/전체)
    const progressData = CATEGORIES.map(cat => {
        const data = JSON.parse(localStorage.getItem('equipment_' + cat) || '[]');
        const done = data.filter(r => {
            const d = calcDday(r.nextDate);
            return d !== null && d > 0;
        }).length;
        return data.length === 0 ? 0 : Math.round((done / data.length) * 100);
    });

    new Chart(document.getElementById('progressChart'), {
        type: 'bar',
        data: {
            labels: CATEGORIES,
            datasets: [{
                label: '작업 진행률 (%)',
                data: progressData,
                backgroundColor: 'rgba(42, 82, 152, 0.7)',
                borderColor: '#1e3c72', borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true, max: 100 } },
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const cat = CATEGORIES[elements[0].index];
                    window.location.href = `management.html?category=${cat}`;
                }
            }
        }
    });

    // 그래프 2: 카테고리별 등록 현황
    const countData = CATEGORIES.map(cat => 
        JSON.parse(localStorage.getItem('equipment_' + cat) || '[]').length
    );

    new Chart(document.getElementById('categoryChart'), {
        type: 'doughnut',
        data: {
            labels: CATEGORIES,
            datasets: [{
                data: countData,
                backgroundColor: ['#1e3c72','#2a5298','#4CAF50','#FF9800','#F44336','#9C27B0','#00BCD4']
            }]
        },
        options: {
            responsive: true,
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const cat = CATEGORIES[elements[0].index];
                    window.location.href = `management.html?category=${cat}`;
                }
            }
        }
    });
}

renderDashboard();
