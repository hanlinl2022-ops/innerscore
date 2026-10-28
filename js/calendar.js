// Month grid: one colored bar per category per day, holding that day's emojis.
import * as store from './store.js';
import { openDay } from './day.js';
import { MONTHS, WEEKDAYS, dateKey, addDays, startOfWeek, today, textOn, esc } from './util.js';

export function renderCalendar(view, { year, month }, setMonth) {
  const todayKey = dateKey(today());
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const start = startOfWeek(first);
  const end = addDays(startOfWeek(last), 6);

  const cells = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const key = dateKey(d);
    const groups = store.dayByCategory(key);
    const total = groups.reduce((n, g) => n + g.tasks.length, 0);
    cells.push(`
      <button class="cell ${d.getMonth() !== month ? 'other' : ''} ${key === todayKey ? 'today' : ''}" data-day="${key}"
        aria-label="${d.toDateString()}, ${total} done">
        <span class="num">${d.getDate()}</span>
        ${groups.map((g) => `
          <div class="bar" style="background:${g.category.color};color:${textOn(g.category.color)}"
            title="${esc(g.category.name)}: ${esc(g.tasks.map((t) => t.name || t.emoji).join(', '))}">
            ${g.tasks.map((t) => t.emoji).join('')}
          </div>`).join('')}
        ${total ? `<span class="count">${total}</span>` : ''}
      </button>`);
  }

  view.innerHTML = `
    <div class="chips" id="chips">
      ${MONTHS.map((m, i) => `<button class="chip ${i === month ? 'active' : ''}" data-month="${i}">${m.slice(0, 3)}</button>`).join('')}
    </div>
    <div class="weekdays">${WEEKDAYS.map((w) => `<div>${w}</div>`).join('')}</div>
    <div class="grid">${cells.join('')}</div>`;

  view.querySelectorAll('[data-month]').forEach((b) => b.addEventListener('click', () =>
    setMonth(year, Number(b.dataset.month))));
  view.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => openDay(b.dataset.day)));
  const chips = view.querySelector('#chips'), active = chips.querySelector('.chip.active');
  requestAnimationFrame(() => {
    chips.scrollLeft = active.offsetLeft - (chips.clientWidth - active.offsetWidth) / 2;
  });
}
