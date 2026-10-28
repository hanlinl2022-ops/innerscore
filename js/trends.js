// Weekly / monthly trends: stacked bars by category, comparisons, top emojis, streaks.
import * as store from './store.js';
import { MONTHS, dateKey, addDays, startOfWeek, today, shortDate, esc } from './util.js';

const ui = { mode: 'week', anchor: today() };

function periodOf(mode, anchor) {
  if (mode === 'week') {
    const start = startOfWeek(anchor);
    return { start, end: addDays(start, 6) };
  }
  return {
    start: new Date(anchor.getFullYear(), anchor.getMonth(), 1),
    end: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0),
  };
}

function shift(mode, anchor, n) {
  return mode === 'week'
    ? addDays(anchor, 7 * n)
    : new Date(anchor.getFullYear(), anchor.getMonth() + n, 1);
}

// Aggregates the log over [start, end] inclusive.
function summarize(start, end) {
  const byCat = {}, byTask = {}, perDay = [];
  let total = 0, activeDays = 0;
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    const key = dateKey(d);
    const day = { date: new Date(d), byCat: {}, total: 0 };
    for (const id of store.doneOn(key)) {
      const t = store.getTask(id);
      if (!t) continue;
      day.byCat[t.categoryId] = (day.byCat[t.categoryId] || 0) + 1;
      byCat[t.categoryId] = (byCat[t.categoryId] || 0) + 1;
      byTask[id] = (byTask[id] || 0) + 1;
      day.total++;
    }
    total += day.total;
    if (day.total) activeDays++;
    perDay.push(day);
  }
  return { total, byCat, byTask, activeDays, perDay, days: perDay.length };
}

function currentStreak() {
  let d = today();
  if (!store.doneOn(dateKey(d)).length) d = addDays(d, -1);
  let n = 0;
  while (store.doneOn(dateKey(d)).length) { n++; d = addDays(d, -1); }
  return n;
}

function delta(cur, prev) {
  if (!prev && !cur) return '<span class="delta flat">–</span>';
  if (!prev) return '<span class="delta up">new</span>';
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return '<span class="delta flat">±0%</span>';
  return `<span class="delta ${pct > 0 ? 'up' : 'down'}">${pct > 0 ? '↑' : '↓'} ${Math.abs(pct)}%</span>`;
}

// buckets: [{ label, byCat: {catId: n} }] → stacked bar SVG in category colors.
// Drawn at the card's real pixel width so labels stay readable on phones.
function stackedBars(buckets, cats, { width = 640, height = 200 } = {}) {
  const W = width, H = height, padL = 28, padB = 24, padT = 8;
  const max = Math.max(4, ...buckets.map((b) => cats.reduce((n, c) => n + (b.byCat[c.id] || 0), 0)));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const plotH = H - padB - padT, plotW = W - padL;
  const slot = plotW / buckets.length;
  const bw = Math.min(44, slot * 0.62);
  const y = (v) => padT + plotH - (v / top) * plotH;

  let svg = '';
  for (let v = 0; v <= top; v += step) {
    svg += `<line class="gridline" x1="${padL}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/>
            <text x="${padL - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  }
  buckets.forEach((b, i) => {
    const x = padL + slot * i + (slot - bw) / 2;
    let acc = 0;
    const segs = cats.filter((c) => b.byCat[c.id]);
    segs.forEach((c, si) => {
      const v = b.byCat[c.id];
      const y0 = y(acc), y1 = y(acc + v);
      const isTop = si === segs.length - 1;
      // Rounded top on the last segment only; 2px gap between segments.
      svg += isTop
        ? `<path d="${roundTop(x, y1, bw, y0 - y1 - (si ? 2 : 0), 4)}" fill="${c.color}"><title>${esc(c.name)}: ${v}</title></path>`
        : `<rect x="${x}" y="${y1}" width="${bw}" height="${Math.max(0, y0 - y1 - (si ? 2 : 0))}" fill="${c.color}"><title>${esc(c.name)}: ${v}</title></rect>`;
      acc += v;
    });
    svg += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${b.label}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img">${svg}</svg>`;
}

function roundTop(x, y, w, h, r) {
  h = Math.max(0, h);
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

function niceStep(max) {
  const raw = max / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw);
}

export function renderTrends(view, rerender) {
  const cats = store.getCategories();
  const { mode, anchor } = ui;
  const { start, end } = periodOf(mode, anchor);
  const prevP = periodOf(mode, shift(mode, anchor, -1));
  const cur = summarize(start, end);
  const isCurrent = dateKey(start) === dateKey(periodOf(mode, today()).start);

  // Count only elapsed days in the current period, and compare against the same
  // number of days at the start of the previous period ("so far" vs "so far").
  const elapsed = isCurrent ? Math.round((today() - start) / 864e5) + 1 : cur.days;
  const prevEnd = isCurrent ? new Date(Math.min(addDays(prevP.start, elapsed - 1), prevP.end)) : prevP.end;
  const prev = summarize(prevP.start, prevEnd);
  const vsLabel = isCurrent ? `vs same point last ${mode}` : `vs previous ${mode}`;
  const chartW = Math.max(280, view.clientWidth - 60);
  const avg = elapsed ? cur.total / elapsed : 0;

  const label = mode === 'week'
    ? `${shortDate(start)} – ${shortDate(end)}${end.getFullYear() !== today().getFullYear() ? `, ${end.getFullYear()}` : ''}`
    : `${MONTHS[start.getMonth()]} ${start.getFullYear()}`;

  // Main chart buckets: days of the week, or weeks of the month.
  let buckets;
  if (mode === 'week') {
    buckets = cur.perDay.map((d) => ({ label: 'SMTWTFS'[d.date.getDay()], byCat: d.byCat }));
  } else {
    buckets = [];
    let i = 0;
    while (i < cur.perDay.length) {
      const wkStart = cur.perDay[i].date;
      const bucket = { label: `${wkStart.getDate()}–`, byCat: {} };
      do {
        for (const [k, v] of Object.entries(cur.perDay[i].byCat)) bucket.byCat[k] = (bucket.byCat[k] || 0) + v;
        i++;
      } while (i < cur.perDay.length && cur.perDay[i].date.getDay() !== 0);
      bucket.label += cur.perDay[i - 1].date.getDate();
      buckets.push(bucket);
    }
  }

  // Long-term: last 12 weeks or 12 months ending at this period, stacked by category.
  const longBuckets = [];
  for (let n = 11; n >= 0; n--) {
    const p = periodOf(mode, shift(mode, anchor, -n));
    const s = summarize(p.start, p.end);
    longBuckets.push({
      label: mode === 'week' ? `${p.start.getMonth() + 1}/${p.start.getDate()}` : MONTHS[p.start.getMonth()].slice(0, 3),
      byCat: s.byCat,
    });
  }

  const topTasks = Object.entries(cur.byTask)
    .map(([id, n]) => ({ t: store.getTask(id), n }))
    .filter((x) => x.t)
    .sort((a, b) => b.n - a.n)
    .slice(0, 10);

  const maxCat = Math.max(1, ...cats.map((c) => cur.byCat[c.id] || 0));

  // Month heatmap (daily intensity), aligned to weekdays.
  let heat = '';
  if (mode === 'month') {
    const maxDay = Math.max(1, ...cur.perDay.map((d) => d.total));
    heat = '<div class="heat">' + 'SMTWTFS'.split('').map((w) => `<div style="background:none">${w}</div>`).join('')
      + '<div style="background:none"></div>'.repeat(start.getDay())
      + cur.perDay.map((d) => {
        const a = d.total / maxDay;
        return `<div title="${shortDate(d.date)}: ${d.total}" style="${d.total ? `background:color-mix(in srgb, var(--accent) ${Math.round(20 + a * 80)}%, transparent);color:${a > 0.5 ? 'var(--bg)' : 'var(--text)'}` : ''}">${d.date.getDate()}</div>`;
      }).join('')
      + '</div>';
  }

  view.innerHTML = `
    <div class="page">
      <div class="seg">
        <button data-mode="week" class="${mode === 'week' ? 'active' : ''}">Week</button>
        <button data-mode="month" class="${mode === 'month' ? 'active' : ''}">Month</button>
      </div>
      <div class="period-nav">
        <button class="icon-btn" data-shift="-1" aria-label="Previous">‹</button>
        <strong>${label}</strong>
        <button class="icon-btn" data-shift="1" aria-label="Next" ${isCurrent ? 'disabled style="opacity:.3"' : ''}>›</button>
      </div>

      <div class="stats">
        <div class="stat"><div class="v">${cur.total}</div><div class="l">tasks done</div>${delta(cur.total, prev.total)}</div>
        <div class="stat"><div class="v">${avg.toFixed(1)}</div><div class="l">per day</div><span class="hint">${cur.activeDays}/${elapsed} active days</span></div>
        <div class="stat"><div class="v">🔥 ${currentStreak()}</div><div class="l">day streak</div></div>
      </div>

      <div class="card chart">
        <h3>${mode === 'week' ? 'Daily' : 'Weekly'} completed tasks</h3>
        ${cur.total ? stackedBars(buckets, cats, { width: chartW }) : '<p class="empty">Nothing logged in this period yet.</p>'}
        <div class="legend">${cats.map((c) => `<span><i class="dot" style="background:${c.color}"></i>${esc(c.name)}</span>`).join('')}</div>
      </div>

      ${mode === 'month' ? `<div class="card"><h3>Daily activity</h3>${heat}</div>` : ''}

      <div class="card">
        <h3>By category <span class="hint">${vsLabel}</span></h3>
        ${cats.map((c) => {
          const n = cur.byCat[c.id] || 0;
          return `<div class="breakdown-row">
            <span><i class="dot" style="display:inline-block;background:${c.color}"></i> ${esc(c.name)}</span>
            <span class="n">${n}</span>
            ${delta(n, prev.byCat[c.id] || 0)}
            <div class="meter"><div style="width:${(n / maxCat) * 100}%;background:${c.color}"></div></div>
          </div>`;
        }).join('') || '<p class="empty">No categories yet.</p>'}
      </div>

      <div class="card">
        <h3>Top tasks</h3>
        ${topTasks.length ? `<div class="top-emojis">${topTasks.map(({ t, n }) => {
          const c = store.getCategory(t.categoryId);
          return `<div style="box-shadow:inset 3px 0 0 ${c?.color || 'transparent'}"><span class="emo">${t.emoji}</span>${esc(t.name)} <strong>×${n}</strong></div>`;
        }).join('')}</div>` : '<p class="hint">No tasks logged yet.</p>'}
      </div>

      <div class="card chart">
        <h3>Last 12 ${mode === 'week' ? 'weeks' : 'months'}</h3>
        ${stackedBars(longBuckets, cats, { width: chartW, height: 180 })}
      </div>
    </div>`;

  view.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    ui.mode = b.dataset.mode;
    ui.anchor = today();
    rerender();
  }));
  view.querySelectorAll('[data-shift]').forEach((b) => b.addEventListener('click', () => {
    if (b.disabled) return;
    ui.anchor = shift(ui.mode, ui.anchor, Number(b.dataset.shift));
    rerender();
  }));
}
