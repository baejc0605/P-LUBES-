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

// 데이터 구조: [{ category, line, target, point, items:[...] }, ...]
function loadRows() {
    return JSON.parse(localStorage.getItem('checklist_rows') || '[]');
}
function saveRows(rows) {
    localStorage.setItem('checklist_rows', JSON.stringify(rows));
    // management.js에서 사용할 조회용 맵도 함께 저장
    const map = {};
    rows.forEach(r => {
        if (r.category && r.line && r.target && r.point && r.items && r.items.length > 0) {
            const key = `${r.category}|${r.line}|${r.target}|${r.point}`;
            map[key] = r.items;
        }
    });
    localStorage.setItem('checklists', JSON.stringify(map));
}

let rows = loadRows();

// 행 추가
function addRow() {
    const filterCat = document.getElementById('filterCategory').value;
    rows.push({
        category: filterCat || '예비소성로',
        line: '',
        target: '',
        point: '',
        items: []
    });
    saveRows(rows);
    renderList();
}

// 행 삭제
function deleteRow(idx) {
    if (!confirm('이 행을 삭제하시겠습니까?')) return;
    rows.splice(idx, 1);
    saveRows(rows);
    renderList();
}

// 필드 업데이트
function updateField(idx, field, value) {
    if (field === 'items') {
        rows[idx].items = value.split(',').map(s => s.trim()).filter(Boolean);
    } else {
        rows[idx][field] = value;
    }
    saveRows(rows);
}

// 전체 저장 (알림용)
function saveAll() {
    saveRows(rows);
    alert('✅ 저장되었습니다. 이제 해당 보조메뉴에 접속하시면 회차란에 체크박스가 표시됩니다.');
}

// 목록 렌더링
function renderList() {
    const tbody = document.getElementById('checklistBody');
    const filterCat = document.getElementById('filterCategory').value;
    tbody.innerHTML = '';
    
    // 필터링 및 원본 인덱스 매핑
    const filteredRows = [];
    rows.forEach((r, origIdx) => {
        if (!filterCat || r.category === filterCat) {
            filteredRows.push({ row: r, origIdx });
        }
    });
    
    if (filteredRows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:20px;color:#999;">등록된 항목이 없습니다. [➕ 행 추가] 버튼을 눌러 시작하세요.</td></tr>';
        return;
    }
    
    filteredRows.forEach(({ row, origIdx }) => {
        const tr = document.createElement('tr');
        
        // 카테고리 select 옵션 만들기
        const catOptions = CATEGORIES.map(c => 
            `<option value="${c}" ${row.category === c ? 'selected' : ''}>${c}</option>`
        ).join('');
        
        tr.innerHTML = `
            <td>
                <select onchange="updateField(${origIdx}, 'category', this.value); renderList();" 
                    style="padding:7px;border:1px solid #bbb;border-radius:4px;background:#f0f0f0;width:100%;">
                    ${catOptions}
                </select>
            </td>
            <td><input type="text" value="${row.line || ''}" placeholder="예: 1라인" 
                oninput="updateField(${origIdx}, 'line', this.value)"></td>
            <td><input type="text" value="${row.target || ''}" placeholder="예: 충진기" 
                oninput="updateField(${origIdx}, 'target', this.value)"></td>
            <td><input type="text" value="${row.point || ''}" placeholder="예: 베어링" 
                oninput="updateField(${origIdx}, 'point', this.value)"></td>
            <td><input type="text" value="${(row.items || []).join(', ')}" 
                placeholder="예: 상부, 하부" 
                oninput="updateField(${origIdx}, 'items', this.value)"
                style="min-width:250px;"></td>
            <td>
                <button class="del-btn" onclick="deleteRow(${origIdx})">삭제</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 초기 로드
renderList();
