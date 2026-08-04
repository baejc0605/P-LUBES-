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

if (isManageView) document.getElementById('addRowBtn').style.display = 'none';

// 데이터 로드/저장
function loadData(cat) {
    return JSON.parse(localStorage.getItem('equipment_' + cat) || '[]');
}
function saveData(cat, data) {
    localStorage.setItem('equipment_' + cat, JSON.stringify(data));
}

let currentData = [];
let maxRounds = 1;

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
    maxRounds = 1;
    currentData.forEach(row => {
        const rounds = row.rounds || [];
        let lastFilledIdx = -1;
        rounds.forEach((r, i) => {
            if (r && (r.date || r.reason)) lastFilledIdx = i;
        });
        const need = lastFilledIdx + 2;
        if (need > maxRounds) maxRounds = need;
    });
}

// ★ 주기 문자열 파싱 ("7D", "1M", "1Y" 등) → { num, unit }
function parseCycle(cycleStr) {
    if (!cycleStr) return null;
    const s = String(cycleStr).trim().toUpperCase();
    const match = s.match(/^(\d+)\s*([DMY])$/);
    if (!match) return null;
    return { num: parseInt(match[1]), unit: match[2] };
}

// ★ 주기 유효성 검사
function validateCycle(cycleStr) {
    if (!cycleStr) return true; // 빈 값은 허용
    return parseCycle(cycleStr) !== null;
}

// ★ 날짜에 주기 더하기
function addCycle(date, cycle) {
    const result = new Date(date);
    if (cycle.unit === 'D') {
        result.setDate(result.getDate() + cycle.num);
    } else if (cycle.unit === 'M') {
        result.setMonth(result.getMonth() + cycle.num);
    } else if (cycle.unit === 'Y') {
        result.setFullYear(result.getFullYear() + cycle.num);
    }
    return result;
}

// 차회수리일자 계산
function calcNextDate(row) {
    const cycle = parseCycle(row.cycle);
    if (!cycle) return '';
    
    const rounds = row.rounds || [];
    let baseDate = null;
    for (let i = rounds.length - 1; i >= 0; i--) {
        if (rounds[i] && rounds[i].date) {
            baseDate = new Date(rounds[i].date);
            break;
        }
    }
    if (!baseDate) return '';
    
    let nextDate = addCycle(baseDate, cycle);
    
    // 휴지 기간이 예정일에 걸치면 휴지 종료일 다음날로 조정
    if (row.pauseStart && row.pauseEnd) {
        const pStart = new Date(row.pauseStart);
        const pEnd = new Date(row.pauseEnd);
        if (nextDate >= pStart && nextDate <= pEnd) {
            nextDate = new Date(pEnd);
            nextDate.setDate(nextDate.getDate() + 1);
        }
    }
    
    return nextDate.toISOString().split('T')[0];
}

// 테이블 헤더
function renderHeader() {
    const thead = document.getElementById('tableHeader');
    let html = '';
    if (isManageView) html += '<th>카테고리</th>';
    html += `
        <th>라인</th><th>대상</th><th>점검/급지 포인트</th>
        <th>주기<br><small>(1D/1M/1Y)</small></th>
        <th>차회수리일자</th><th>휴지 (시작 ~ 종료)</th>
    `;
    for (let i = 1; i <= maxRounds; i++) {
        html += `<th>${i}회차 일자</th><th>${i}회차 사유</th>`;
    }
    if (!isManageView) html += '<th>작업</th>';
    thead.innerHTML = html;
}

// 테이블 바디
function renderBody(filterData = null) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    const data = filterData || currentData;
    
    data.forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.dataset.idx = idx;
        tr.onclick = function(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') return;
            document.querySelectorAll('#tableBody tr').forEach(r => r.classList.remove('selected'));
            this.classList.add('selected');
        };
        
        let html = '';
        if (isManageView) {
            html += `<td>${row._category || ''}</td>`;
            const pauseStr = (row.pauseStart || row.pauseEnd) 
                ? `${row.pauseStart || '?'} ~ ${row.pauseEnd || '?'}` : '';
            html += `
                <td>${row.line || ''}</td>
                <td>${row.target || ''}</td>
                <td>${row.point || ''}</td>
                <td>${row.cycle || ''}</td>
                <td><span class="next-date-display">${row.nextDate || '-'}</span></td>
                <td>${pauseStr}</td>
            `;
            for (let i = 0; i < maxRounds; i++) {
                const r = (row.rounds || [])[i] || {};
                html += `<td>${r.date || ''}</td><td>${r.reason || ''}</td>`;
            }
        } else {
            const cycleValid = validateCycle(row.cycle);
            html += `
                <td><input type="text" list="lineOptions" value="${row.line || ''}" placeholder="라인" onchange="updateField(${idx},'line',this.value)"></td>
                <td><input type="text" list="targetOptions" value="${row.target || ''}" placeholder="대상" onchange="updateField(${idx},'target',this.value)"></td>
                <td><input type="text" list="pointOptions" value="${row.point || ''}" placeholder="포인트" onchange="updateField(${idx},'point',this.value)"></td>
                <td><input type="text" list="cycleOptions" value="${row.cycle || ''}" placeholder="예:7D,1M,1Y" 
                    class="${!cycleValid ? 'invalid-input' : ''}" 
                    onchange="updateCycle(${idx}, this)" style="min-width:80px;max-width:100px;"></td>
                <td><span class="next-date-display">${row.nextDate || '-'}</span></td>
                <td>
                    <div class="pause-cell">
                        <input type="date" value="${row.pauseStart || ''}" onchange="updateField(${idx},'pauseStart',this.value)" title="휴지 시작일">
                        <span class="pause-sep">~</span>
                        <input type="date" value="${row.pauseEnd || ''}" onchange="updateField(${idx},'pauseEnd',this.value)" title="휴지 종료일">
                    </div>
                </td>
            `;
            for (let i = 0; i < maxRounds; i++) {
                const r = (row.rounds || [])[i] || {};
                html += `
                    <td><input type="date" value="${r.date || ''}" onchange="updateRound(${idx},${i},'date',this.value)"></td>
                    <td><input type="text" list="reasonOptions" value="${r.reason || ''}" placeholder="정기/돌발" onchange="updateRound(${idx},${i},'reason',this.value)"></td>
                `;
            }
            html += `<td><button class="del-btn" onclick="deleteRow(${idx})">삭제</button></td>`;
        }
        
        tr.innerHTML = html;
        tbody.appendChild(tr);
    });
}

// ★ 주기 업데이트 (유효성 검사 포함)
function updateCycle(idx, inputEl) {
    const value = inputEl.value.trim().toUpperCase();
    if (value && !validateCycle(value)) {
        alert('주기 형식이 올바르지 않습니다.\n\n올바른 예시:\n • 7D (7일)\n • 1M (1개월)\n • 1Y (1년)\n • 3M (3개월)');
        inputEl.value = currentData[idx].cycle || '';
        inputEl.focus();
        return;
    }
    currentData[idx].cycle = value;
    currentData[idx].nextDate = calcNextDate(currentData[idx]);
    saveData(category, currentData);
    renderBody();
    updateDatalists();
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
    
    loadCurrentData();
    renderHeader();
    renderBody();
}

// 행 추가
function addNewRow() {
    currentData.push({ line:'', target:'', point:'', cycle:'', nextDate:'', pauseStart:'', pauseEnd:'', rounds: [] });
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

// datalist 업데이트
function updateDatalists() {
    const lines = [...new Set(currentData.map(r => r.line).filter(Boolean))];
    const targets = [...new Set(currentData.map(r => r.target).filter(Boolean))];
    const points = [...new Set(currentData.map(r => r.point).filter(Boolean))];
    const cycles = [...new Set(currentData.map(r => r.cycle).filter(Boolean))];
    
    document.getElementById('lineOptions').innerHTML = lines.map(v => `<option value="${v}">`).join('');
    document.getElementById('targetOptions').innerHTML = targets.map(v => `<option value="${v}">`).join('');
    document.getElementById('pointOptions').innerHTML = points.map(v => `<option value="${v}">`).join('');
    document.getElementById('lineList').innerHTML = lines.map(v => `<option value="${v}">`).join('');
    document.getElementById('targetList').innerHTML = targets.map(v => `<option value="${v}">`).join('');
    document.getElementById('pointList').innerHTML = points.map(v => `<option value="${v}">`).join('');
    
    // 주기 자동완성 (기본 예시 + 기존 입력값)
    const defaultCycles = ['1D', '3D', '7D', '14D', '1M', '3M', '6M', '1Y'];
    const allCycles = [...new Set([...defaultCycles, ...cycles])];
    const cycleOptEl = document.getElementById('cycleOptions');
    if (cycleOptEl) cycleOptEl.innerHTML = allCycles.map(v => `<option value="${v}">`).join('');
}

// 필터
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
