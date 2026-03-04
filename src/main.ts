const NS = 'http://www.w3.org/2000/svg';

const STAT_KEYS = ['strength', 'speed', 'endurance', 'agility', 'flexibility'] as const;
type StatKey = typeof STAT_KEYS[number];

interface Point { x: number; y: number; }

// 드럼 피커 상수
const ITEM_H = 42;
const START_YEAR = 1930;

// 현재 선택된 생년월일 (모듈 상태)
let currentBirthdate = '';

// ---- 진입점 ----

function init(): void {
  loadData();
  setupEditable();
  setupUnitInputs();
  setupAgePicker();
  setupBloodPicker();
  initStatBars();
  requestAnimationFrame(() => requestAnimationFrame(drawConnections));
  window.addEventListener('resize', drawConnections);
}

// ---- 데이터 저장/불러오기 ----

function getData(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem('typeonea') ?? '{}');
  } catch {
    return {};
  }
}

function saveData(): void {
  const data = getData();

  const nameEl = document.querySelector<HTMLElement>('[data-key="name"]');
  if (nameEl) data['name'] = nameEl.textContent ?? '';

  if (currentBirthdate) data['birthdate'] = currentBirthdate;

  const heightEl = document.querySelector<HTMLInputElement>('#height-input');
  if (heightEl && heightEl.value) data['height'] = heightEl.value;

  const weightEl = document.querySelector<HTMLInputElement>('#weight-input');
  if (weightEl && weightEl.value) data['weight'] = weightEl.value;

  const bloodEl = document.getElementById('blood-selected');
  const bloodText = bloodEl?.textContent ?? '';
  if (bloodText && bloodText !== '—') data['blood'] = bloodText;

  for (const key of STAT_KEYS) {
    const el = document.querySelector<HTMLElement>(`.stat-num[data-key="${key}"]`);
    if (el) data[key] = el.textContent ?? '';
  }

  localStorage.setItem('typeonea', JSON.stringify(data));
}

function loadData(): void {
  const data = getData();

  if (data['name']) {
    const el = document.querySelector<HTMLElement>('[data-key="name"]');
    if (el) el.textContent = data['name'];
  }

  if (data['birthdate']) {
    currentBirthdate = data['birthdate'];
    showAgeResult(data['birthdate']);
  }

  const heightEl = document.querySelector<HTMLInputElement>('#height-input');
  if (heightEl && data['height']) heightEl.value = data['height'];

  const weightEl = document.querySelector<HTMLInputElement>('#weight-input');
  if (weightEl && data['weight']) weightEl.value = data['weight'];

  if (data['blood']) setBloodType(data['blood'], false);

  for (const key of STAT_KEYS) {
    const raw = data[key];
    const val = raw !== undefined ? Number(raw) : 50;
    const el = document.querySelector<HTMLElement>(`.stat-num[data-key="${key}"]`);
    if (el) el.textContent = String(val);
    updateBar(key, val);
  }

  updateCharLabel();
}

// ---- Contenteditable 필드 (이름, 스탯) ----

function setupEditable(): void {
  document.querySelectorAll<HTMLElement>('[contenteditable]').forEach(el => {
    el.addEventListener('blur', () => {
      const key = el.dataset.key ?? '';

      if ((STAT_KEYS as readonly string[]).includes(key)) {
        const raw = parseInt(el.textContent ?? '0', 10);
        const clamped = isNaN(raw) ? 0 : Math.min(100, Math.max(0, raw));
        el.textContent = String(clamped);
        updateBar(key as StatKey, clamped);
      }

      if (key === 'name') updateCharLabel();
      saveData();
    });

    el.addEventListener('keydown', (e: Event) => {
      if ((e as KeyboardEvent).key === 'Enter') {
        e.preventDefault();
        el.blur();
      }
    });
  });
}

// ---- 단위 인풋 (키/몸무게) ----

function setupUnitInputs(): void {
  document.querySelectorAll<HTMLInputElement>('.unit-input').forEach(input => {
    input.addEventListener('blur', () => saveData());
    input.addEventListener('keydown', (e: Event) => {
      if ((e as KeyboardEvent).key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
    });
  });
}

// ---- 스탯 바 ----

function initStatBars(): void {
  for (const key of STAT_KEYS) {
    const el = document.querySelector<HTMLElement>(`.stat-num[data-key="${key}"]`);
    if (el) updateBar(key, parseInt(el.textContent ?? '50', 10));
  }
}

function updateBar(key: string, value: number): void {
  const row = document.querySelector(`[data-stat="${key}"]`);
  if (!row) return;
  const fill = row.querySelector<HTMLElement>('.stat-bar__fill');
  if (fill) fill.style.width = `${value}%`;
}

// ---- 캐릭터 라벨 ----

function updateCharLabel(): void {
  const nameEl = document.querySelector<HTMLElement>('[data-key="name"]');
  const labelEl = document.getElementById('char-label');
  if (!nameEl || !labelEl) return;
  const name = nameEl.textContent?.trim() ?? '';
  labelEl.textContent = name && name !== '—' ? name.toUpperCase() : 'PLAYER';
}

// ---- 드럼 피커 헬퍼 ----

const years = Array.from(
  { length: new Date().getFullYear() - START_YEAR + 1 },
  (_, i) => String(START_YEAR + i)
);

const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

function getDays(year: number, month: number): string[] {
  const count = new Date(year, month, 0).getDate();
  return Array.from({ length: count }, (_, i) => String(i + 1).padStart(2, '0'));
}

function buildCol(el: HTMLElement, items: string[], targetIndex: number): void {
  el.innerHTML = '';

  const topSpacer = document.createElement('div');
  topSpacer.className = 'picker-spacer';
  el.appendChild(topSpacer);

  for (const item of items) {
    const div = document.createElement('div');
    div.className = 'picker-item';
    div.textContent = item;
    el.appendChild(div);
  }

  const botSpacer = document.createElement('div');
  botSpacer.className = 'picker-spacer';
  el.appendChild(botSpacer);

  el.scrollTop = targetIndex * ITEM_H;
}

function getIndex(el: HTMLElement): number {
  return Math.round(el.scrollTop / ITEM_H);
}

// ---- 날짜 피커 ----

function setupAgePicker(): void {
  const overlay = document.getElementById('picker-overlay')!;
  const ageBtn = document.getElementById('age-btn')!;
  const colYear = document.getElementById('col-year')!;
  const colMonth = document.getElementById('col-month')!;
  const colDay = document.getElementById('col-day')!;
  const confirmBtn = document.getElementById('picker-confirm')!;

  function openPicker(): void {
    let targetYear = 1990, targetMonth = 1, targetDay = 1;

    if (currentBirthdate) {
      const parts = currentBirthdate.split('.');
      if (parts.length === 3) {
        targetYear = parseInt(parts[0], 10);
        targetMonth = parseInt(parts[1], 10);
        targetDay = parseInt(parts[2], 10);
      }
    }

    const yearIndex = targetYear - START_YEAR;
    const monthIndex = targetMonth - 1;
    const days = getDays(targetYear, targetMonth);
    const dayIndex = Math.min(targetDay - 1, days.length - 1);

    overlay.classList.add('is-open');

    // Set after overlay is visible to ensure scrollTop applies correctly
    requestAnimationFrame(() => {
      buildCol(colYear, years, yearIndex);
      buildCol(colMonth, months, monthIndex);
      buildCol(colDay, days, dayIndex);
    });
  }

  let yearDebounce: ReturnType<typeof setTimeout> | null = null;
  let monthDebounce: ReturnType<typeof setTimeout> | null = null;

  function rebuildDays(): void {
    const y = START_YEAR + getIndex(colYear);
    const m = getIndex(colMonth) + 1;
    const currentDayIdx = getIndex(colDay);
    const days = getDays(y, m);
    const newDayIdx = Math.min(currentDayIdx, days.length - 1);
    buildCol(colDay, days, newDayIdx);
  }

  colYear.addEventListener('scroll', () => {
    if (yearDebounce) clearTimeout(yearDebounce);
    yearDebounce = setTimeout(rebuildDays, 200);
  });

  colMonth.addEventListener('scroll', () => {
    if (monthDebounce) clearTimeout(monthDebounce);
    monthDebounce = setTimeout(rebuildDays, 200);
  });

  ageBtn.addEventListener('click', openPicker);

  confirmBtn.addEventListener('click', () => {
    const y = START_YEAR + getIndex(colYear);
    const m = getIndex(colMonth) + 1;
    const d = getIndex(colDay) + 1;

    currentBirthdate = `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
    showAgeResult(currentBirthdate);
    saveData();
    overlay.classList.remove('is-open');
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('is-open');
  });
}

function calcAge(birthdate: string): number {
  const parts = birthdate.split('.');
  if (parts.length !== 3) return 0;
  const by = parseInt(parts[0], 10);
  const bm = parseInt(parts[1], 10);
  const bd = parseInt(parts[2], 10);
  const today = new Date();
  let age = today.getFullYear() - by;
  const dm = today.getMonth() + 1 - bm;
  if (dm < 0 || (dm === 0 && today.getDate() < bd)) age--;
  return age;
}

function showAgeResult(birthdate: string): void {
  const birthdateEl = document.getElementById('age-birthdate')!;
  const ageValueEl = document.getElementById('age-value')!;
  birthdateEl.textContent = birthdate;
  ageValueEl.textContent = `${calcAge(birthdate)}살`;
}

// ---- 혈액형 피커 ----

function setupBloodPicker(): void {
  const overlay = document.getElementById('blood-overlay')!;
  const bloodBtn = document.getElementById('blood-btn')!;

  bloodBtn.addEventListener('click', () => {
    overlay.classList.add('is-open');
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('is-open');
  });

  document.querySelectorAll<HTMLElement>('.blood-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const value = btn.dataset.blood ?? '';
      setBloodType(value, true);
      overlay.classList.remove('is-open');
    });
  });
}

function setBloodType(value: string, save: boolean): void {
  const el = document.getElementById('blood-selected');
  if (el) el.textContent = value;

  document.querySelectorAll<HTMLElement>('.blood-option').forEach(btn => {
    btn.classList.toggle('is-selected', btn.dataset.blood === value);
  });

  if (save) saveData();
}

// ---- SVG 연결선 그리기 ----

function drawConnections(): void {
  const svg = document.getElementById('connections');
  const character = document.getElementById('character');
  const panelProfile = document.getElementById('panel-profile');
  const panelStats = document.getElementById('panel-stats');

  if (!svg || !character || !panelProfile || !panelStats) return;

  svg.innerHTML = '';

  const defs = svgEl('defs');
  const filter = svgEl('filter');
  filter.setAttribute('id', 'line-glow');
  filter.setAttribute('x', '-60%');
  filter.setAttribute('y', '-60%');
  filter.setAttribute('width', '220%');
  filter.setAttribute('height', '220%');

  const blur = svgEl('feGaussianBlur');
  blur.setAttribute('in', 'SourceGraphic');
  blur.setAttribute('stdDeviation', '2.8');
  blur.setAttribute('result', 'blurred');

  const merge = svgEl('feMerge');
  for (const inVal of ['blurred', 'SourceGraphic']) {
    const node = svgEl('feMergeNode');
    node.setAttribute('in', inVal);
    merge.appendChild(node);
  }

  filter.appendChild(blur);
  filter.appendChild(merge);
  defs.appendChild(filter);
  svg.appendChild(defs);

  const cRect = character.getBoundingClientRect();
  const cx = cRect.left + cRect.width / 2;
  const cy = cRect.top + cRect.height / 2;
  const ringR = 46;

  for (const panel of [panelProfile, panelStats]) {
    const pRect = panel.getBoundingClientRect();
    const tx = pRect.left;
    const ty = pRect.top + pRect.height / 2;

    const angle = Math.atan2(ty - cy, tx - cx);
    const from: Point = {
      x: cx + ringR * Math.cos(angle),
      y: cy + ringR * Math.sin(angle),
    };
    const to: Point = { x: tx, y: ty };

    drawLine(svg, from, to);
  }
}

function drawLine(svg: Element, from: Point, to: Point): void {
  const midX = from.x + (to.x - from.x) * 0.5;
  const d = [
    `M ${fmt(from.x)} ${fmt(from.y)}`,
    `C ${fmt(midX)} ${fmt(from.y)},`,
    `${fmt(midX)} ${fmt(to.y)},`,
    `${fmt(to.x)} ${fmt(to.y)}`,
  ].join(' ');

  const glow = svgEl('path');
  glow.setAttribute('d', d);
  glow.setAttribute('fill', 'none');
  glow.setAttribute('stroke', 'rgba(59,130,246,0.28)');
  glow.setAttribute('stroke-width', '6');
  glow.setAttribute('stroke-linecap', 'round');
  glow.setAttribute('filter', 'url(#line-glow)');
  svg.appendChild(glow);

  const line = svgEl('path');
  line.setAttribute('d', d);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', 'rgba(59,130,246,0.62)');
  line.setAttribute('stroke-width', '1.5');
  line.setAttribute('stroke-dasharray', '6 4');
  line.setAttribute('stroke-linecap', 'round');
  svg.appendChild(line);

  for (const pt of [from, to]) {
    const dot = svgEl('circle');
    dot.setAttribute('cx', fmt(pt.x));
    dot.setAttribute('cy', fmt(pt.y));
    dot.setAttribute('r', '3');
    dot.setAttribute('fill', '#3b82f6');
    dot.setAttribute('filter', 'url(#line-glow)');
    svg.appendChild(dot);
  }
}

function svgEl(tag: string): Element {
  return document.createElementNS(NS, tag);
}

function fmt(n: number): string {
  return n.toFixed(1);
}

init();
