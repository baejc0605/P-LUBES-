/* =========================================================
   management.js
   - auth.js에서 checkLogin(), logout()을 관리한다고 가정
   - 관리(통합)뷰 저장/렌더링 로직 안정화
========================================================= */

const CATEGORIES = ['예비소성로', '본소성', '열처리', '혼합설비', '필터프레스', '진공건조기', '냉각기'];

const urlParams = new URLSearchParams(window.location.search);
const category = urlParams.get('category') || '예비소성로';
const isManageView = (category === '관리');

document.getElementById('pageTitle').textContent =
    isManageView ? '📋 관리 (통합 조회)' : `🛢️ 급유급지관리 - ${category}`;

if (isManageView) {
    const addBtn = document.getElementById('addRowBtn');
    if (addBtn) addBtn.style.display = 'none';
}

// ★ 관리 뷰인 경우 체크박스 필터 + 카테고리 필터 + 엑셀 내보내기 버튼 표시
if (isManageView) {
    const chkFilterEl = document.getElementById('checkFilterBox');
    if (chkFilterEl) chkFilterEl.style.display = 'flex';

    const catFilterEl = document.getElementById('filterCategoryBox');
    if (catFilterEl) catFilterEl.style.display = 'flex';

    const excelBtn = document.getElementById('excelExportBtn');
    if (excelBtn) excelBtn.style.display = 'inline-block';
}

// ===== 데이터 로드/저장 =====
function loadData(cat) {
    return JSON.parse(localStorage.getItem('equipment_' + cat) || '[]');
}
function saveData(cat, data) {
    localStorage.setItem('equipment_' + cat, JSON.stringify(data));
}
function loadChecklists() {
    return JSON.parse(localStorage.getItem('checklists') || '{}');
}
function getChecklistItems(cat, line, target, point) {
    const data = loadChecklists();
    if (!line || !target || !point) return [];
    return data[`${cat}|${line}|${target}|${point}`] || [];
}

/**
 * 관리뷰/일반뷰 모두에서 "현재 행"을 올바른 카테고리 저장소에 저장
 * - 일반뷰: 현재 category에 저장
 * - 관리뷰: row._category에 저장(핵심)
 */
function saveRow(row) {
    const cat = isManageView ? (row._category || '') : category;
    if (!cat) return;

    const data = loadData(cat);

    // row._category는 저장 데이터에는 없어도 되므로 제거한 복사본
    const rowToStore = { ...row };
    delete rowToStore._category;

    // 식별키가 없으므로(기존 구조 유지) 동일 조건(라인/대상/포인트) 기반으로 우선 매칭 시도
    // ※ 완전한 고유키가 필요하면 row에 id를 부여하는 방향이 최선이지만,
    //    현재 구조 유지 조건이 있어 "최소 침습"으로 처리합니다.
    const idx = data.findIndex(r =>
        (r.line || '') === (rowToStore.line || '') &&
        (r.target || '') === (rowToStore.target || '') &&
        (r.point || '') === (rowToStore.point || '') &&
        JSON.stringify(r.rounds || []) === JSON.stringify(rowToStore.rounds || [])
    );

    if (idx >= 0) data[idx] = rowToStore;
    else data.push(rowToStore);

    saveData(cat, data);
}

/**
 * 특정 인덱스의 row를 해당 카테고리 저장소에 "정확히 같은 인덱스"로 저장하고 싶을 때
 * - 일반뷰에서는 index 기반으로 안전
 * - 관리뷰에서는 currentData의 idx가 카테고리별 배열 idx와 다르므로 사용하면 위험
 * -> 따라서 일반뷰 전용으로만 사용
 */
function saveCurrentDataNormalView() {
    if (isManageView) return;
    saveData(category, currentData);
}

let currentData = [];
let maxRounds = 1;

function loadCurrentData() {
    if (isManageView) {
        currentData = [];
        CATEGORIES.forEach(cat => {
            const d = loadData(cat);
            d.forEach(row => currentData.push({ ...row, _category: cat }));
        });
    } else {
        currentData = loadData(category);
    }

    maxRounds = 1;
    currentData.forEach(row => {
        const rounds = row.rounds || [];
        let lastFilledIdx = -1;
        rounds.forEach((r, i) => {
            if (r && (r.date || r.reason || (r.checks && Object.keys(r.checks).length))) lastFilledIdx = i;
        });
        const need = lastFilledIdx + 2; // 다음 회차 1칸 더
        if (need > maxRounds) maxRounds = need;
    });
}

// ===== 주기 파싱/계산 =====
function parseCycle(cycleStr) {
    if (!cycleStr) return null;
    const s = String(cycleStr).trim().toUpperCase();
    const match = s.match(/^(\d+)\s*([DMY])$/);
    if (!match) return null;
    return { num: parseInt(match[1]), unit: match[2] };
}
function validateCycle(cycleStr) {
    if (!cycleStr) return true;
    return parseCycle(cycleStr) !== null;
}
function addCycle(date, cycle) {
    const result = new Date(date);
    if (cycle.unit === 'D') result.setDate(result.getDate() + cycle.num);
    else if (cycle.unit === 'M') result.setMonth(result.getMonth() + cycle.num);
    else if (cycle.unit === 'Y') result.setFullYear(result.getFullYear() + cycle.num);
    return result;
}
function daysBetween(d1, d2) {
    const ms = new Date(d2) - new Date(d1);
    return Math.round(ms / (1000 * 60 * 60 * 24));
}

// ===== 차회수리일자 계산 =====
function calcNextDate(row) {
    const cycle = parseCycle(row.cycle);
    const rounds = row.rounds || [];
    const cat = row._category || category;

    let lastRound = null;
    for (let i = rounds.length - 1; i >= 0; i--) {
        if (rounds[i] && rounds[i].date) {
            lastRound = rounds[i];
            break;
        }
    }
    if (!lastRound) return { date: '', locked: false };

    const items = getChecklistItems(cat, row.line, row.target, row.point);
    const checks = lastRound.checks || {};
    const hasUnchecked = items.some(item => !checks[item]);

    if (items.length > 0 && hasUnchecked) {
        return { date: lastRound.date, locked: true };
    }

    if (!cycle) return { date: '', locked: false };

    const baseDate = new Date(lastRound.date);
    let nextDate = addCycle(baseDate, cycle);

    // 휴지 반영: 예정일이 휴지 기간과 겹치면 휴지 일수만큼 연장
    if (row.pauseStart && row.pauseEnd) {
        const pStart = new Date(row.pauseStart);
        const pEnd = new Date(row.pauseEnd);

        if (pStart <= pEnd) {
            if (pEnd >= baseDate && pStart <= nextDate) {
                const overlapStart = pStart < baseDate ? baseDate : pStart;
                const overlapEnd = pEnd;
                const pauseDays = daysBetween(overlapStart, overlapEnd) + 1;
                nextDate.setDate(nextDate.getDate() + pauseDays);
            }
        }
    }

    return { date: nextDate.toISOString().split('T')[0], locked: false };
}

function refreshNextDate(row) {
    const result = calcNextDate(row);
    row.nextDate = result.date;
    row.nextDateLocked = result.locked;
}

// ===== 취소선 판단 =====
function isStrikethrough(rounds, roundIdx, item) {
    const r = rounds[roundIdx];
    if (!r || !r.checks || r.checks[item]) return false;
    for (let i = roundIdx + 1; i < rounds.length; i++) {
        if (rounds[i] && rounds[i].checks && rounds[i].checks[item]) return true;
    }
    return false;
}

// ===== 체크박스 필터 판단 =====
function passCheckFilter(row) {
    if (!isManageView) return true;
    const mode = document.getElementById('filterCheck')?.value || 'all';
    if (mode === 'all') return true;

    const cat = row._category || category;
    const items = getChecklistItems(cat, row.line, row.target, row.point);
    if (items.length === 0) return mode === 'all';

    const rounds = row.rounds || [];
    let lastRound = null;
    for (let i = rounds.length - 1; i >= 0; i--) {
        if (rounds[i] && rounds[i].date) {
            lastRound = rounds[i];
            break;
        }
    }
    if (!lastRound) return false;

    const checks = lastRound.checks || {};
    const allChecked = items.every(item => checks[item]);
    const hasUnchecked = items.some(item => !checks[item]);

    if (mode === 'complete') return allChecked;
    if (mode === 'incomplete') return hasUnchecked;
    return true;
}

// ===== 렌더링: 헤더 =====
function renderHeader() {
    const thead = document.getElementById('tableHeader');
    let html = '';
    if (isManageView) html += '<th>카테고리</th>';
    html += `
        <th>라인</th>
        <th>대상</th>
        <th>점검/급지 포인트</th>
        <th>주기<br><small>(1D/1M/1Y)</small></th>
        <th>차회수리일자</th>
        <th>휴지 (시작 ~ 종료)</th>
    `;
    for (let i = 1; i <= maxRounds; i++) {
        html += `
            <th style="background:#243b6e;">${i}회차 일자</th>
            <th style="background:#243b6e;">${i}회차 사유</th>
            <th style="background:#243b6e;">${i}회차 체크박스</th>
        `;
    }
    if (!isManageView) html += '<th>작업</th>';
    thead.innerHTML = html;
}

// ===== 렌더링: 바디 =====
function renderBody(filterData = null) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    let data = filterData || currentData;

    if (isManageView) {
        data = data.filter(passCheckFilter);
    }

    if (data.length === 0) {
        const colspan = 6 + (isManageView ? 1 : 0) + (maxRounds * 3) + (isManageView ? 0 : 1);
        tbody.innerHTML = `<tr><td colspan="${colspan}" style="padding:30px;color:#999;">표시할 데이터가 없습니다.</td></tr>`;
        return;
    }

    data.forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.dataset.idx = idx;
        tr.onclick = function (e) {
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'LABEL' || tag === 'SELECT' || tag === 'A') return;
            document.querySelectorAll('#tableBody tr').forEach(r => r.classList.remove('selected'));
            this.classList.add('selected');
        };

        const rowCat = row._category || category;
        const items = getChecklistItems(rowCat, row.line, row.target, row.point);
        const rounds = row.rounds || [];

        let html = '';

        if (isManageView) {
            html += `<td>${row._category || ''}</td>`;
            const pauseStr = (row.pauseStart || row.pauseEnd)
                ? `${row.pauseStart || '?'} ~ ${row.pauseEnd || '?'}`
                : '';
            const nextClass = row.nextDateLocked ? 'next-date-display locked' : 'next-date-display';
            html += `
                <td>${row.line || ''}</td>
                <td>${row.target || ''}</td>
                <td>${row.point || ''}</td>
                <td>${row.cycle || ''}</td>
                <td><span class="${nextClass}">${row.nextDate || '-'}${row.nextDateLocked ? ' 🔒' : ''}</span></td>
                <td>${pauseStr}</td>
            `;
            for (let i = 0; i < maxRounds; i++) {
                const r = rounds[i] || {};
                const checks = r.checks || {};
                const chkHtml = items.length === 0
                    ? '<span style="color:#999;font-size:11px;">-</span>'
                    : items.map(item => {
                        const isChecked = !!checks[item];
                        const strike = isStrikethrough(rounds, i, item);
                        const cls = strike ? 'chk-tag unchecked strike' : (isChecked ? 'chk-tag checked' : 'chk-tag unchecked');
                        const icon = isChecked ? '✓' : '✗';
                        return `<span class="${cls}">${icon} ${item}</span>`;
                    }).join(' ');
                html += `
                    <td>${r.date || ''}</td>
                    <td>${r.reason || ''}</td>
                    <td>${chkHtml}</td>
                `;
            }
        } else {
            const cycleValid = validateCycle(row.cycle);
            const nextClass = row.nextDateLocked ? 'next-date-display locked' : 'next-date-display';
            const nextTitle = row.nextDateLocked ? '체크박스 미체크 항목이 있어 마지막 회차 일자로 고정됨' : '';

            html += `
                <td><input type="text" list="lineOptions" value="${row.line || ''}" placeholder="라인" onchange="updateField(${idx},'line',this.value)"></td>
                <td><input type="text" list="targetOptions" value="${row.target || ''}" placeholder="대상" onchange="updateField(${idx},'target',this.value)"></td>
                <td><input type="text" list="pointOptions" value="${row.point || ''}" placeholder="포인트" onchange="updateField(${idx},'point',this.value)"></td>
                <td><input type="text" list="cycleOptions" value="${row.cycle || ''}" placeholder="예:7D,1M"
                    class="${!cycleValid ? 'invalid-input' : ''}"
                    onchange="updateCycle(${idx}, this)" style="min-width:80px;max-width:100px;"></td>
                <td><span class="${nextClass}" title="${nextTitle}">${row.nextDate || '-'}${row.nextDateLocked ? ' 🔒' : ''}</span></td>
                <td>
                    <div class="pause-cell">
                        <input type="date" value="${row.pauseStart || ''}" onchange="updateField(${idx},'pauseStart',this.value)" title="휴지 시작일">
                        <span class="pause-sep">~</span>
                        <input type="date" value="${row.pauseEnd || ''}" onchange="updateField(${idx},'pauseEnd',this.value)" title="휴지 종료일">
                    </div>
                </td>
            `;

            for (let i = 0; i < maxRounds; i++) {
                const r = rounds[i] || {};
                const checks = r.checks || {};

                let chkCellHtml = '';
                if (items.length === 0) {
                    if (row.line && row.target && row.point) {
                        const url = `checklist.html?category=${encodeURIComponent(rowCat)}&line=${encodeURIComponent(row.line)}&target=${encodeURIComponent(row.target)}&point=${encodeURIComponent(row.point)}`;
                        chkCellHtml = `<div style="font-size:11px;color:#999;padding:5px;line-height:1.5;">
                            ※ 체크박스 미등록<br>
                            <a href="${url}" style="color:#2a5298;font-weight:bold;text-decoration:underline;">📌 항목 등록하기</a>
                        </div>`;
                    } else {
                        chkCellHtml = `<div style="font-size:11px;color:#999;padding:5px;">
                            ※ 라인/대상/포인트<br>먼저 입력
                        </div>`;
                    }
                } else {
                    chkCellHtml = '<div class="checkbox-list">' + items.map(item => {
                        const safeId = `chk_${idx}_${i}_${item.replace(/[^a-zA-Z0-9가-힣]/g, '_')}`;
                        const safeItem = item.replace(/'/g, "\\'");
                        const strike = isStrikethrough(rounds, i, item);
                        const labelStyle = strike ? 'text-decoration:line-through;color:#999;' : '';
                        return `
                            <div class="checkbox-item">
                                <input type="checkbox" id="${safeId}"
                                    ${checks[item] ? 'checked' : ''}
                                    onchange="updateCheck(${idx},${i},'${safeItem}',this.checked)">
                                <label for="${safeId}" style="${labelStyle}">${item}${strike ? ' <span style="font-size:9px;color:#28a745;">(후속완료)</span>' : ''}</label>
                            </div>
                        `;
                    }).join('') + '</div>';
                }

                html += `
                    <td><input type="date" value="${r.date || ''}" onchange="updateRound(${idx},${i},'date',this.value)"></td>
                    <td><input type="text" list="reasonOptions" value="${r.reason || ''}" placeholder="정기/돌발" onchange="updateRound(${idx},${i},'reason',this.value)"></td>
                    <td>${chkCellHtml}</td>
                `;
            }

            html += `<td><button class="del-btn" onclick="deleteRow(${idx})">삭제</button></td>`;
        }

        tr.innerHTML = html;
        tbody.appendChild(tr);
    });
}

// ===== 업데이트 함수들 =====
function updateCycle(idx, inputEl) {
    const value = inputEl.value.trim().toUpperCase();
    if (value && !validateCycle(value)) {
        alert('주기 형식이 올바르지 않습니다.\n\n올바른 예시:\n • 7D (7일)\n • 1M (1개월)\n • 1Y (1년)');
        inputEl.value = currentData[idx].cycle || '';
        inputEl.focus();
        return;
    }
    currentData[idx].cycle = value;
    refreshNextDate(currentData[idx]);

    // 저장
    saveCurrentDataNormalView();

    renderBody();
    updateDatalists();
}

function updateField(idx, field, value) {
    currentData[idx][field] = value;
    refreshNextDate(currentData[idx]);

    // 저장
    saveCurrentDataNormalView();

    renderBody();
    updateDatalists();
}

function updateRound(idx, roundIdx, field, value) {
    if (!currentData[idx].rounds) currentData[idx].rounds = [];
    if (!currentData[idx].rounds[roundIdx]) currentData[idx].rounds[roundIdx] = {};
    currentData[idx].rounds[roundIdx][field] = value;
    refreshNextDate(currentData[idx]);

    // 저장
    saveCurrentDataNormalView();

    // 회차 늘어날 수 있으니 재계산
    loadCurrentData();
    renderHeader();
    renderBody();
}

function updateCheck(idx, roundIdx, item, checked) {
    if (!currentData[idx].rounds) currentData[idx].rounds = [];
    if (!currentData[idx].rounds[roundIdx]) currentData[idx].rounds[roundIdx] = {};
    if (!currentData[idx].rounds[roundIdx].checks) currentData[idx].rounds[roundIdx].checks = {};
    currentData[idx].rounds[roundIdx].checks[item] = checked;
    refreshNextDate(currentData[idx]);

    // 저장
    saveCurrentDataNormalView();

    renderBody();
}

function addNewRow() {
    if (isManageView) return; // 관리뷰에서는 행 추가 숨김이지만 안전장치
    currentData.push({ line: '', target: '', point: '', cycle: '', nextDate: '', nextDateLocked: false, pauseStart: '', pauseEnd: '', rounds: [] });
    saveData(category, currentData);
    renderBody();
    updateDatalists();
}

function deleteRow(idx) {
    if (confirm('이 행을 삭제하시겠습니까?')) {
        if (isManageView) {
            // 관리뷰에서는 해당 row의 카테고리 저장소에서 제거해야 함
            const row = currentData[idx];
            const cat = row?._category;
            if (cat) {
                const data = loadData(cat);

                // 관리뷰는 원본 배열 index를 모름 -> 가장 근접하게 매칭해서 제거(최소 침습)
                const rowToRemove = { ...row };
                delete rowToRemove._category;

                const removeIdx = data.findIndex(r =>
                    (r.line || '') === (rowToRemove.line || '') &&
                    (r.target || '') === (rowToRemove.target || '') &&
                    (r.point || '') === (rowToRemove.point || '') &&
                    JSON.stringify(r.rounds || []) === JSON.stringify(rowToRemove.rounds || [])
                );

                if (removeIdx >= 0) {
                    data.splice(removeIdx, 1);
                    saveData(cat, data);
                }
            }
            // 화면 데이터 재로딩
            loadCurrentData();
            currentData.forEach(r => refreshNextDate(r));
            renderHeader();
            renderBody();
            updateDatalists();
        } else {
            currentData.splice(idx, 1);
            saveData(category, currentData);
            loadCurrentData();
            renderHeader();
            renderBody();
            updateDatalists();
        }
    }
}

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

    const defaultCycles = ['1D', '3D', '7D', '14D', '1M', '3M', '6M', '1Y'];
    const allCycles = [...new Set([...defaultCycles, ...cycles])];
    const cycleOptEl = document.getElementById('cycleOptions');
    if (cycleOptEl) cycleOptEl.innerHTML = allCycles.map(v => `<option value="${v}">`).join('');
}

// ===== 필터 =====
function applyFilter() {
    const fCat = isManageView ? (document.getElementById('filterCategory')?.value || '') : '';
    const fLine = document.getElementById('filterLine').value.toLowerCase();
    const fTarget = document.getElementById('filterTarget').value.toLowerCase();
    const fPoint = document.getElementById('filterPoint').value.toLowerCase();

    const filtered = currentData.filter(row =>
        (!fCat || (row._category || '') === fCat) &&
        (!fLine || (row.line || '').toLowerCase().includes(fLine)) &&
        (!fTarget || (row.target || '').toLowerCase().includes(fTarget)) &&
        (!fPoint || (row.point || '').toLowerCase().includes(fPoint))
    );
    renderBody(filtered);
}

function resetFilter() {
    if (isManageView) {
        const catEl = document.getElementById('filterCategory');
        if (catEl) catEl.value = '';
    }
    document.getElementById('filterLine').value = '';
    document.getElementById('filterTarget').value = '';
    document.getElementById('filterPoint').value = '';
    const cf = document.getElementById('filterCheck');
    if (cf) cf.value = 'all';
    renderBody();
}

function applyCheckFilter() {
    renderBody();
}

// ===== ★ 엑셀 내보내기 =====
function getCheckStatus(rounds, roundIdx, item) {
    const r = rounds[roundIdx];
    const checks = (r && r.checks) || {};

    if (checks[item]) return '완료';

    for (let i = roundIdx + 1; i < rounds.length; i++) {
        if (rounds[i] && rounds[i].checks && rounds[i].checks[item]) {
            return '후속완료';
        }
    }
    return '미실시';
}

function exportToExcel() {
    if (typeof XLSX === 'undefined') {
        alert('엑셀 라이브러리 로딩에 실패했습니다. 페이지를 새로고침 후 다시 시도해주세요.');
        return;
    }

    const fCat = document.getElementById('filterCategory')?.value || '';
    const fLine = (document.getElementById('filterLine')?.value || '').toLowerCase();
    const fTarget = (document.getElementById('filterTarget')?.value || '').toLowerCase();
    const fPoint = (document.getElementById('filterPoint')?.value || '').toLowerCase();

    const filteredData = currentData
        .filter(row =>
            (!fCat || (row._category || '') === fCat) &&
            (!fLine || (row.line || '').toLowerCase().includes(fLine)) &&
            (!fTarget || (row.target || '').toLowerCase().includes(fTarget)) &&
            (!fPoint || (row.point || '').toLowerCase().includes(fPoint))
        )
        .filter(passCheckFilter);

    if (filteredData.length === 0) {
        alert('내보낼 데이터가 없습니다.');
        return;
    }

    const header = [
        '카테고리', '라인', '대상', '점검/급지 포인트', '주기', '차회수리일자', '차회수리상태', '휴지 시작', '휴지 종료'
    ];
    for (let i = 1; i <= maxRounds; i++) {
        header.push(`${i}회차 일자`);
        header.push(`${i}회차 사유`);
        header.push(`${i}회차 체크상태`);
    }

    const aoa = [header];

    filteredData.forEach(row => {
        const rowCat = row._category || category;
        const items = getChecklistItems(rowCat, row.line, row.target, row.point);
        const rounds = row.rounds || [];

        const arr = [
            row._category || '',
            row.line || '',
            row.target || '',
            row.point || '',
            row.cycle || '',
            row.nextDate || '',
            row.nextDateLocked ? '🔒 마지막회차 고정' : '정상',
            row.pauseStart || '',
            row.pauseEnd || ''
        ];

        for (let i = 0; i < maxRounds; i++) {
            const r = rounds[i] || {};
            arr.push(r.date || '');
            arr.push(r.reason || '');

            if (items.length === 0) {
                arr.push('');
            } else {
                const statusStr = items.map(item => {
                    const status = getCheckStatus(rounds, i, item);
                    return `${item}(${status})`;
                }).join(', ');
                arr.push(statusStr);
            }
        }

        aoa.push(arr);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    const colWidths = header.map((h, i) => {
        let maxLen = h.length;
        aoa.forEach(row => {
            const cell = String(row[i] || '');
            if (cell.length > maxLen) maxLen = cell.length;
        });
        return { wch: Math.min(Math.max(maxLen + 2, 10), 60) };
    });
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, '설비관리 통합');

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const fileName = `설비관리_통합조회_${yyyy}${mm}${dd}_${hh}${mi}.xlsx`;

    XLSX.writeFile(wb, fileName);

    alert(`✅ 엑셀 파일이 다운로드되었습니다!\n\n📁 파일명: ${fileName}\n📊 총 ${filteredData.length}건`);
}

// ===== 초기 로드 =====
loadCurrentData();
currentData.forEach(row => refreshNextDate(row));

// 일반뷰에서는 nextDate 계산 결과 저장(기존 동작 유지)
if (!isManageView) saveData(category, currentData);

renderHeader();
renderBody();
updateDatalists();

// ★ 카테고리 드롭다운 변경 시 자동 필터 적용 (관리 뷰)
if (isManageView) {
    const catSel = document.getElementById('filterCategory');
    if (catSel) {
        catSel.addEventListener('change', applyFilter);
    }
}
