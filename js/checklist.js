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

// 체크리스트 저장소: { "라인|대상|포인트": ["항목1", "항목2", ...] }
function loadChecklists() {
    return JSON.parse(localStorage.getItem('checklists') || '{}');
}
function saveChecklists(obj) {
    localStorage.setItem('checklists', JSON.stringify(obj));
}

function makeKey(line, target, point) {
    return `${line}|${target}|${point}`;
}
function parseKey(key) {
    const [line, target, point] = key.split('|');
    return { line, target, point };
}

// 목록 렌더링
function renderList() {
    const data = loadChecklists();
    const tbody = document.getElementById('checklistBody');
    tbody.innerHTML = '';
    
    const keys = Object.keys(data);
    if (keys.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="padding:20px;color:#999;">등록된 체크박스 항목이 없습니다.</td></tr>';
        return;
    }
    
    keys.forEach(key => {
        const { line, target, point } = parseKey(key);
        const items = data[key];
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${line}</td>
            <td>${target}</td>
            <td>${point}</td>
            <td>${items.map(i => `<span class="chk-tag">${i}</span>`).join('')}</td>
            <td>
                <button class="edit-btn" onclick="editChecklist('${key}')">수정</button>
                <button class="del-btn" onclick="deleteChecklist('${key}')">삭제</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 신규 등록
function addChecklist() {
    const line = document.getElementById('newLine').value.trim();
    const target = document.getElementById('newTarget').value.trim();
    const point = document.getElementById('newPoint').value.trim();
    const itemsStr = document.getElementById('newItems').value.trim();
    
    if (!line || !target || !point) {
        alert('라인, 대상, 점검/급지 포인트를 모두 입력해주세요.');
        return;
    }
    if (!itemsStr) {
        alert('체크박스 항목을 입력해주세요. (콤마로 구분)');
        return;
    }
    
    const items = itemsStr.split(',').map(s => s.trim()).filter(Boolean);
    if (items.length === 0) {
        alert('유효한 체크박스 항목이 없습니다.');
        return;
    }
    
    const data = loadChecklists();
    const key = makeKey(line, target, point);
    
    if (data[key]) {
        if (!confirm(`이미 등록된 조합입니다.\n(${line} / ${target} / ${point})\n\n덮어쓰시겠습니까?`)) return;
    }
    
    data[key] = items;
    saveChecklists(data);
    
    // 입력 필드 초기화
    document.getElementById('newLine').value = '';
    document.getElementById('newTarget').value = '';
    document.getElementById('newPoint').value = '';
    document.getElementById('newItems').value = '';
    
    alert('등록되었습니다.');
    renderList();
}

// 수정
function editChecklist(key) {
    const data = loadChecklists();
    const items = data[key];
    if (!items) return;
    
    const current = items.join(', ');
    const newItemsStr = prompt('체크박스 항목을 수정하세요. (콤마로 구분)', current);
    if (newItemsStr === null) return;
    
    const newItems = newItemsStr.split(',').map(s => s.trim()).filter(Boolean);
    if (newItems.length === 0) {
        alert('최소 1개 이상의 항목이 필요합니다.');
        return;
    }
    
    data[key] = newItems;
    saveChecklists(data);
    alert('수정되었습니다.');
    renderList();
}

// 삭제
function deleteChecklist(key) {
    const { line, target, point } = parseKey(key);
    if (!confirm(`정말 삭제하시겠습니까?\n\n라인: ${line}\n대상: ${target}\n포인트: ${point}`)) return;
    
    const data = loadChecklists();
    delete data[key];
    saveChecklists(data);
    renderList();
}

renderList();
