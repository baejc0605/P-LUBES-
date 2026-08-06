/* =========================================================
   checklist.js
   - 로그인 체크/로그아웃은 auth.js에서 처리 (checkLogin(), logout())
   - 이 파일에서는 체크박스 항목 CRUD만 담당
========================================================= */

const CATEGORIES = ['예비소성로', '본소성', '열처리', '혼합설비', '필터프레스', '진공건조기', '냉각기'];

// ===== 데이터 로드/저장 =====
function loadRows() {
    return JSON.parse(localStorage.getItem('checklist_rows') || '[]');
}

function saveRows(rowsData) {
    localStorage.setItem('checklist_rows', JSON.stringify(rowsData));

    // management.js가 참조할 조회용 맵(checklists)
    const map = {};
    rowsData.forEach(r => {
        if (r.category && r.line && r.target && r.point && r.items && r.items.length > 0) {
            const key = `${r.category}|${r.line}|${r.target}|${r.point}`;
            map[key] = r.items;
        }
    });
    localStorage.setItem('checklists', JSON.stringify(map));
}

let rows = loadRows();

// ===== URL 파라미터로 자동 행 추가 =====
// management.html에서 "항목 등록하기" 링크 클릭 시 넘어오는 데이터 처리
(function handleAutoAdd() {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('category');
    const line = params.get('line');
    const target = params.get('target');
    const point = params.get('point');

    if (cat && line && target && point) {
        const exists = rows.some(r =>
            r.category === cat && r.line === line &&
            r.target === target && r.point === point
        );

        if (!exists) {
            rows.unshift({
                category: cat,
                line: line,
                target: target,
                point: point,
                items: []
            });
            saveRows(rows);

            setTimeout(() => {
                alert(
                    `✅ 새 행이 추가되었습니다.\n\n` +
                    `카테고리: ${cat}\n라인: ${line}\n대상: ${target}\n포인트: ${point}\n\n` +
                    `체크박스 항목만 입력하시면 됩니다.`
                );
                const catEl = document.getElementById('filterCategory');
                if (catEl) catEl.value = cat;

                renderList();

                const firstItemInput = document.querySelector('#checklistBody tr:first-child input.items-input');
                if (firstItemInput) {
                    firstItemInput.focus();
                    firstItemInput.style.background = '#fff9c4';
                }
            }, 100);
        } else {
            setTimeout(() => {
                alert(
                    `ℹ️ 이미 등록된 조합입니다.\n\n` +
                    `카테고리: ${cat}\n라인: ${line}\n대상: ${target}\n포인트: ${point}`
                );
                const catEl = document.getElementById('filterCategory');
                if (catEl) catEl.value = cat;
                renderList();
            }, 100);
        }

        // URL 파라미터 제거(새로고침 시 중복 방지)
        window.history.replaceState({}, '', 'checklist.html');
    }
})();

// ===== 행 추가 =====
function addRow() {
    const filterCat = document.getElementById('filterCategory')?.value;
    rows.unshift({
        category: filterCat || '예비소성로',
        line: '',
        target: '',
        point: '',
        items: []
    });
    saveRows(rows);
    renderList();
}

// ===== 행 삭제 =====
function deleteRow(idx) {
    if (!confirm('이 행을 삭제하시겠습니까?')) return;
    rows.splice(idx, 1);
    saveRows(rows);
    renderList();
}

// ===== 필드 업데이트 (실시간 저장) =====
function updateField(idx, field, value) {
    if (!rows[idx]) return;

    if (field === 'items') {
        rows[idx].items = value.split(',').map(s => s.trim()).filter(Boolean);
    } else {
        rows[idx][field] = value;
    }

    saveRows(rows);
    showSaveStatus();
}

// ===== 저장 상태 배지 =====
function showSaveStatus() {
    const badge = document.getElementById('saveStatus');
    if (!badge) return;

    badge.textContent = '✅ 자동 저장됨 · ' + new Date().toLocaleTimeString();
    badge.style.opacity = '1';

    clearTimeout(window._saveTimer);
    window._saveTimer = setTimeout(() => {
        badge.style.opacity = '0.5';
    }, 2000);
}

// ===== 전체 저장 (수동) =====
function saveAll() {
    saveRows(rows);
    const validCount = rows.filter(r => r.category && r.line && r.target && r.point && r.items && r.items.length > 0).length;
    alert(
        `✅ 저장 완료\n\n` +
        `전체 ${rows.length}개 행 중 유효한 항목: ${validCount}개\n\n` +
        `(유효 조건: 카테고리/라인/대상/포인트/체크박스항목 모두 입력)`
    );
}

// ===== 목록 렌더링 =====
function renderList() {
    const tbody = document.getElementById('checklistBody');
    const filterCat = document.getElementById('filterCategory')?.value || '';
    if (!tbody) return;

    tbody.innerHTML = '';

    const filteredRows = [];
    rows.forEach((r, origIdx) => {
        if (!filterCat || r.category === filterCat) {
            filteredRows.push({ row: r, origIdx });
        }
    });

    if (filteredRows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:30px;color:#999;">등록된 항목이 없습니다. [➕ 행 추가] 버튼을 눌러 시작하세요.</td></tr>';
        return;
    }

    filteredRows.forEach(({ row, origIdx }) => {
        const tr = document.createElement('tr');

        const catOptions = CATEGORIES.map(c =>
            `<option value="${c}" ${row.category === c ? 'selected' : ''}>${c}</option>`
        ).join('');

        const isValid = row.category && row.line && row.target && row.point && row.items && row.items.length > 0;

        tr.innerHTML = `
            <td>
                <select onchange="updateField(${origIdx}, 'category', this.value); renderList();">
                    ${catOptions}
                </select>
            </td>
            <td><input type="text" value="${row.line || ''}" placeholder="예: 1라인"
                oninput="updateField(${origIdx}, 'line', this.value)"></td>
            <td><input type="text" value="${row.target || ''}" placeholder="예: 충진기"
                oninput="updateField(${origIdx}, 'target', this.value)"></td>
            <td><input type="text" value="${row.point || ''}" placeholder="예: 베어링"
                oninput="updateField(${origIdx}, 'point', this.value)"></td>
            <td><input type="text" class="items-input" value="${(row.items || []).join(', ')}"
                placeholder="예: 상부, 하부"
                oninput="updateField(${origIdx}, 'items', this.value)"
                style="min-width:250px;"></td>
            <td>
                <span style="color:${isValid ? '#28a745' : '#dc3545'};font-size:11px;display:block;margin-bottom:5px;">
                    ${isValid ? '✅ 유효' : '⚠️ 미완성'}
                </span>
                <button class="del-btn" type="button" onclick="deleteRow(${origIdx})">삭제</button>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

// 초기 로드
renderList();
