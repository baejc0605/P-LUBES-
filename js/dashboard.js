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

// ===== 데이터 로드 =====
function loadAllData() {
    const all = [];
    CATEGORIES.forEach(cat => {
        const d = JSON.parse(localStorage.getItem('equipment_' + cat) || '[]');
        d.forEach(row => all.push({...row, _category: cat}));
    });
    return all;
}

// ===== 유틸 =====
function toDateStr(d) {
    return d.toISOString().split('T')[0];
}
function parseDate(str) {
    if (!str) return null;
    return new Date(str + 'T00:00:00');
}
function daysDiff(d1, d2) {
    return Math.round((d2 - d1) / (1000*60*60*24));
}

// ===== 상태 판정 =====
function getStatus(nextDateStr, today) {
    const nd = parseDate(nextDateStr);
    if (!nd) return null;
    const diff = daysDiff(today, nd);
    if (diff < 0) return 'urgent';    // 지연
    if (diff <= 7) return 'urgent';   // D-7 이내
    return 'normal';
}

// ===== 요약 카드 업데이트 =====
function updateSummary(allData, today) {
    const thisMonth = today.getMonth();
    const thisYear = today.getFullYear();
    
    let urgent = 0, warning = 0, normal = 0, total = 0;
    
    allData.forEach(row => {
        if (!row.nextDate) return;
        total++;
        const nd = parseDate(row.nextDate);
        if (!nd) return;
        
        const diff = daysDiff(today, nd);
        if (diff <= 7) urgent++;
        else if (nd.getMonth() === thisMonth && nd.getFullYear() === thisYear) warning++;
        else normal++;
    });
    
    document.getElementById('cardUrgent').textContent = urgent;
    document.getElementById('cardWarning').textContent = warning;
    document.getElementById('cardNormal').textContent = normal;
    document.getElementById('cardTotal').textContent = total;
}

// ===== 긴급 목록 =====
function renderUrgentList(allData, today) {
    const list = allData
        .filter(row => {
            if (!row.nextDate) return false;
            const nd = parseDate(row.nextDate);
            return nd && daysDiff(today, nd) <= 7;
        })
        .sort((a,b) => parseDate(a.nextDate) - parseDate(b.nextDate));
    
    const box = document.getElementById('urgentList');
    if (list.length === 0) {
        box.innerHTML = '<div style="padding:20px;color:#999;text-align:center;">🎉 지연/임박 작업이 없습니다.</div>';
        return;
    }
    
    let html = '<table class="urgent-table"><thead><tr><th>D-day</th><th>카테고리</th><th>라인</th><th>대상</th><th>포인트</th><th>차회수리일자</th></tr></thead><tbody>';
    list.forEach(row => {
        const nd = parseDate(row.nextDate);
        const diff = daysDiff(today, nd);
        let ddayText, ddayClass;
        if (diff < 0) { ddayText = `D+${-diff} 지연`; ddayClass = 'dday-urgent'; }
        else if (diff === 0) { ddayText = 'D-DAY'; ddayClass = 'dday-urgent'; }
        else { ddayText = `D-${diff}`; ddayClass = diff <= 3 ? 'dday-urgent' : 'dday-warning'; }
        
        html += `<tr>
            <td><span class="dday-badge ${ddayClass}">${ddayText}</span></td>
            <td>${row._category}</td>
            <td>${row.line || '-'}</td>
            <td>${row.target || '-'}</td>
            <td>${row.point || '-'}</td>
            <td>${row.nextDate}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    box.innerHTML = html;
}

// ===== ★ 캘린더 =====
let currentYear, currentMonth; // 표시 중인 월
const today = new Date();
today.setHours(0,0,0,0);
currentYear = today.getFullYear();
currentMonth = today.getMonth();

function changeMonth(delta) {
    currentMonth += delta;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    else if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
}
function goToday() {
    currentYear = today.getFullYear();
    currentMonth = today.getMonth();
    renderCalendar();
}

function renderCalendar() {
    document.getElementById('calendarTitle').textContent = `${currentYear}년 ${currentMonth + 1}월`;
    
    const allData = loadAllData();
    
    // 날짜별 이벤트 맵 구성 ({YYYY-MM-DD: [row, row, ...]})
    const eventsByDate = {};
    allData.forEach(row => {
        if (!row.nextDate) return;
        if (!eventsByDate[row.nextDate]) eventsByDate[row.nextDate] = [];
        eventsByDate[row.nextDate].push(row);
    });
    
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startWeekday = firstDay.getDay(); // 0=일요일
    const daysInMonth = lastDay.getDate();
    
    // 이전 달 마지막 날짜들
    const prevLastDay = new Date(currentYear, currentMonth, 0).getDate();
    
    const grid = document.getElementById('calendarGrid');
    let html = '';
    
    // 요일 헤더
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    weekdays.forEach((w, i) => {
        const cls = i === 0 ? 'cal-weekday sunday' : (i === 6 ? 'cal-weekday saturday' : 'cal-weekday');
        html += `<div class="${cls}">${w}</div>`;
    });
    
    // 이전 달 회색 날짜
    for (let i = startWeekday - 1; i >= 0; i--) {
        html += `<div class="cal-day other-month"><div class="cal-day-num">${prevLastDay - i}</div></div>`;
    }
    
    // 이번 달 날짜
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const dateObj = new Date(currentYear, currentMonth, day);
        const weekday = dateObj.getDay();
        
        const isToday = dateObj.getTime() === today.getTime();
        const events = eventsByDate[dateStr] || [];
        
        let classes = 'cal-day';
        if (isToday) classes += ' today';
        if (weekday === 0) classes += ' sunday';
        if (weekday === 6) classes += ' saturday';
        if (events.length > 0) classes += ' has-events';
        
        // 이벤트 배지 생성 (최대 3개 + 나머지 카운트)
        let badgesHtml = '';
        const maxShow = 3;
        events.slice(0, maxShow).forEach(ev => {
            const diff = daysDiff(today, dateObj);
            let badgeClass = 'ev-badge';
            if (diff < 0 || diff <= 7) badgeClass += ' urgent';
            else if (dateObj.getMonth() === today.getMonth() && dateObj.getFullYear() === today.getFullYear()) badgeClass += ' warning';
            else badgeClass += ' normal';
            
            const label = `${ev._category} / ${ev.line || '?'} / ${ev.target || '?'}`;
            badgesHtml += `<div class="${badgeClass}" title="${label} / ${ev.point || ''}">${ev._category.substring(0,2)} ${ev.target || ''}</div>`;
        });
        if (events.length > maxShow) {
            badgesHtml += `<div class="ev-badge more">+${events.length - maxShow}개 더</div>`;
        }
        
        const onclick = events.length > 0 ? `onclick="showDayDetail('${dateStr}', event)"` : '';
        
        html += `<div class="${classes}" ${onclick}>
            <div class="cal-day-num">${day}${isToday ? ' <span class="today-label">TODAY</span>' : ''}</div>
            <div class="cal-events">${badgesHtml}</div>
        </div>`;
    }
    
    // 다음 달 회색 날짜 (7의 배수로 맞추기)
    const totalCells = startWeekday + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
        html += `<div class="cal-day other-month"><div class="cal-day-num">${i}</div></div>`;
    }
    
    grid.innerHTML = html;
}

// ===== 날짜 클릭 상세 =====
function showDayDetail(dateStr, event) {
    const allData = loadAllData();
    const events = allData.filter(r => r.nextDate === dateStr);
    if (events.length === 0) return;
    
    const popover = document.getElementById('dayPopover');
    document.getElementById('popoverDate').textContent = `📅 ${dateStr} 예정 작업 (${events.length}건)`;
    
    let bodyHtml = '<table class="popover-table"><thead><tr><th>카테고리</th><th>라인</th><th>대상</th><th>포인트</th><th>주기</th><th>이동</th></tr></thead><tbody>';
    events.forEach(ev => {
        bodyHtml += `<tr>
            <td>${ev._category}</td>
            <td>${ev.line || '-'}</td>
            <td>${ev.target || '-'}</td>
            <td>${ev.point || '-'}</td>
            <td>${ev.cycle || '-'}</td>
            <td><a href="management.html?category=${encodeURIComponent(ev._category)}" class="goto-link">이동 →</a></td>
        </tr>`;
    });
    bodyHtml += '</tbody></table>';
    document.getElementById('popoverBody').innerHTML = bodyHtml;
    
    popover.style.display = 'block';
    // 화면 중앙에 표시
    popover.style.top = (window.scrollY + 100) + 'px';
    
    event.stopPropagation();
}
function closePopover() {
    document.getElementById('dayPopover').style.display = 'none';
}
// 팝오버 외부 클릭 시 닫기
document.addEventListener('click', function(e) {
    const popover = document.getElementById('dayPopover');
    if (popover.style.display === 'block' && !popover.contains(e.target) && !e.target.closest('.cal-day')) {
        closePopover();
    }
});

// ===== 초기 로드 =====
function init() {
    const allData = loadAllData();
    updateSummary(allData, today);
    renderUrgentList(allData, today);
    renderCalendar();
}
init();
