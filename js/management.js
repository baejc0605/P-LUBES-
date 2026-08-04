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

// URL 파라미터에서 카테고리 추출
const urlParams = new URLSearchParams(window.location.search);
const category = urlParams.get('category') || '예비소성로';
const isManageView = (category === '관리');

document.getElementById('pageTitle').textContent = 
    isManageView ? '📋 관리 (통합 조회)' : `🛢️ 급유급지관리 - ${category}`;

// '관리' 뷰에서는 행 추가 버튼 숨김
if (isManageView) document.getElementById('addRowBtn').style.display = 'none';

// 데이터 로드/저장
function loadData(cat) {
    return JSON.parse(localStorage.getItem('equipment_' + cat) || '[]');
}
function saveData(cat, data) {
    localStorage.setItem('equipment_' + cat, JSON.stringify(data));
}

// 현재 데이터
let currentData = [];
let maxRounds = 1; // 최대 회차 수

function loadCurrentData() {
    if (isManageView) {
        currentData = [];
        CATEGORIES.forEach(cat => {
            const d = loadData(cat);
            d.forEach(row => currentData.push({...row, _category: cat}));
        });
    } else {
        currentData = loadData(category);
    }
    // 최대 회차 계산
    maxRounds = 1;
    currentData.forEach(row => {
        const rounds = row.rounds || [];
        if (rounds.length >= maxRounds) maxRounds = rounds.length + 1;
    });
}

// 날짜 계산: 마지막 회차 일자 + 주기 (휴지가 있으면 그 이후)
function calcNextDate(row) {
    const cycle = parseInt(row.cycle) || 0;
    if (cycle === 0) return '';
    const rounds = row.rounds || [];
    
    let baseDate = null;
    // 가장 최근 회차 일자
    for (let i = rounds.length - 1; i >= 0; i--) {
        if (rounds[i] && rounds[i].date) {
            baseDate = new Date(rounds[i].date);
            break;
        }
    }
    if (!baseDate) return '';
    
    // 휴지일자가 있으면 그것을 기준으로
    if (row.pauseDate) {
        const pause = new Date(row.pauseDate);
        if (pause > baseDate) baseDate = pause;
    }
    
    baseDate.setDate(baseDate.getDate() + cycle);
    return baseDate.toISOString().split('T')[0];
}

// 테이블 헤더 렌더링 (회차 수에 따라 동적)
function renderHeader() {
    const thead = document.getElementById('tableHeader');
    let html = '';
    if (isManageView) html += '<th>카테고리</th>';
    html += `
        <th>라인</th><th>대상</th><th>점검/급지 포인트</th>
        <th>주기(일)</th><th>차회수리일자</th><th>휴지</th>
    `;
    for (let i = 1; i <= maxRounds; i++) {
        html += `<th>${i}회차 일자</th><th>${i}회차 사유</th>`;
    }
    if (!isManageView) html += '<th>작업</th>';
    thead.innerHTML = html;
}

// 테이블 바디 렌더링
function renderBody(filterData = null) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    const data = filterData || currentData;
    
    data.forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.dataset.idx = idx;
        tr.onclick = function(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
            document.querySelectorAll('#tableBody tr').forEach(r => r.classList.remove('selected'));
            this.classList.add('selected');
        };
        
        let html = '';
        if (isManageView) {
            html += `<td>${row._category || ''}</td>`;
            html += `
                <td>${row.line || ''}</td>
                <td>${row.target || ''}</td>
                <td>${row.point || ''}</td>
                <td>${row.cycle || ''}</td>
                <td>${row.nextDate || ''}</td>
                <td>${row.pauseDate || ''}</td>
            `;
            for (let i = 0; i < maxRounds; i++) {
                const r = (row.rounds || [])[i] || {};
                html += `<td>${r.date || ''}</td><td>${r.reason || ''}</td>`;
            }
        } else {
            html += `
                <td><input type="text" list="lineOptions" value="${row.line || ''}" onchange="updateField(${idx},'line',this.value)"></td>
                <td><input type="text" list="targetOptions" value="${row.target || ''}" onchange="updateField(${idx},'target',this.value)"></td>
                <td><input type="text" list="pointOptions" value="${row.point || ''}" onchange="updateField(${idx},'point',this.value)"></td>
                <td><input type="number" value="${row.cycle || ''}" onchange="updateField(${idx},'cycle',this.value)" style="width:70px;"></td>
                <td><strong>${row.nextDate || '-'}</strong></td>
                <td><input type="date" value="${row.pauseDate || ''}" onchange="updateField(${idx},'pauseDate',this.value)"></td>
            `;
            for (let i = 0; i < maxRounds; i++) {
                const r = (row.rounds || [])[i] || {};
                html += `
                    <td><input type="date" value="${r.date || ''}" onchange="updateRound(${idx},${i},'date',this.value)"></td>
                    <td><input type="text" list="reasonOptions" value="${r.reason || ''}" onchange="updateRound(${idx},${i},'reason',this.value)"></td>
                `;
            }
            html += `<td><button class="del-btn" onclick="deleteRow(${idx})">삭제</button></td>`;
        }
        
        tr.innerHTML = html;
        tbody.appendChild(tr);
    });
}

// 필드 업데이트
function updateField(idx, field, value) {
    currentData[idx][field] = value;
    currentData[idx].nextDate = calcNextDate(currentData[idx]);
    saveData(category, currentData);
    renderBody();
    updateDatalists();
}

// 회차 업데이트
function updateRound(idx, roundIdx, field, value) {
    if (!currentData[idx].rounds) currentData[idx].rounds = [];
    if (!currentData[idx].rounds[roundIdx]) currentData[idx].rounds[roundIdx] = {};
    currentData[idx].rounds[roundIdx][field] = value;
    currentData[idx].nextDate = calcNextDate(currentData[idx]);
    saveData(category, currentData);
    
    // 마지막 회차에 데이터 입력되면 다음 회차 자동 생성
    loadCurrentData();
    renderHeader();
    renderBody();
}

// 행 추가
function addNewRow() {
    currentData.push({ line:'', target:'', point:'', cycle:'', nextDate:'', pauseDate:'', rounds: [] });
    saveData(category, currentData);
    renderBody();
}

// 행 삭제
function deleteRow(idx) {
    if (confirm('이 행을 삭제하시겠습니까?')) {
        currentData.splice(idx, 1);
        saveData(category, currentData);
        loadCurrentData();
        renderHeader();
        renderBody();
    }
}

// 자동완성 datalist 업데이트
function updateDatalists() {
    const lines = [...new Set(currentData.map(r => r.line).filter(Boolean))];
    const targets = [...new Set(currentData.map(r => r.target).filter(Boolean))];
    const points = [...new Set(currentData.map(r => r.point).filter(Boolean))];
    
    document.getElementById('lineOptions').innerHTML = lines.map(v => `<option value="${v}">`).join('');
    document.getElementById('targetOptions').innerHTML = targets.map(v => `<option value="${v}">`).join('');
    document.getElementById('pointOptions').innerHTML = points.map(v => `<option value="${v}">`).join('');
    document.getElementById('lineList').innerHTML = lines.map(v => `<option value="${v}">`).join('');
    document.getElementById('targetList').innerHTML = targets.map(v => `<option value="${v}">`).join('');
    document.getElementById('pointList').innerHTML = points.map(v => `<option value="${v}">`).join('');
}

// 필터 적용
function applyFilter() {
    const fLine = document.getElementById('filterLine').value.toLowerCase();
    const fTarget = document.getElementById('filterTarget').value.toLowerCase();
    const fPoint = document.getElementById('filterPoint').value.toLowerCase();
    
    const filtered = currentData.filter(row => 
        (!fLine || (row.line || '').toLowerCase().includes(fLine)) &&
        (!fTarget || (row.target || '').toLowerCase().includes(fTarget)) &&
        (!fPoint || (row.point || '').toLowerCase().includes(fPoint))
    );
    renderBody(filtered);
}

function resetFilter() {
    document.getElementById('filterLine').value = '';
    document.getElementById('filterTarget').value = '';
    document.getElementById('filterPoint').value = '';
    renderBody();
}

// 초기 로드
loadCurrentData();
renderHeader();
renderBody();
updateDatalists();
