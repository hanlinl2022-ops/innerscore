// App shell: tab routing, top bar, re-render on data changes.
import * as store from './store.js';
import { refreshSheet } from './ui.js';
import { renderCalendar } from './calendar.js';
import { renderTrends } from './trends.js';
import { renderCategories } from './categories.js';
import { openDay } from './day.js';
import { MONTHS, dateKey, today } from './util.js';

const view = document.getElementById('view');
const title = document.getElementById('title');
const actions = document.getElementById('topbar-actions');
const fab = document.getElementById('fab');

const now = today();
const app = { tab: 'calendar', year: now.getFullYear(), month: now.getMonth() };

function setMonth(year, month) {
  const d = new Date(year, month, 1);
  app.year = d.getFullYear();
  app.month = d.getMonth();
  render();
}

function render() {
  document.querySelectorAll('.tabbar button').forEach((b) =>
    b.classList.toggle('active', b.dataset.tab === app.tab));
  fab.hidden = app.tab !== 'calendar';
  actions.innerHTML = '';

  if (app.tab === 'calendar') {
    title.textContent = `${MONTHS[app.month]}${app.year !== now.getFullYear() ? ` ${app.year}` : ''}`;
    actions.innerHTML = `
      <button class="icon-btn" data-m="-1" aria-label="Previous month">‹</button>
      <button class="icon-btn" data-m="0" aria-label="Today" title="Today" style="font-size:.8rem;font-weight:700;border:2px solid currentColor;border-radius:8px;width:32px;height:30px;margin:5px 4px">${now.getDate()}</button>
      <button class="icon-btn" data-m="1" aria-label="Next month">›</button>`;
    actions.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => {
      const m = Number(b.dataset.m);
      if (m === 0) setMonth(now.getFullYear(), now.getMonth());
      else setMonth(app.year, app.month + m);
    }));
    renderCalendar(view, app, setMonth);
  } else if (app.tab === 'trends') {
    title.textContent = 'Trends';
    renderTrends(view, render);
  } else {
    title.textContent = 'Categories';
    renderCategories(view);
  }
}

document.querySelectorAll('.tabbar button').forEach((b) => b.addEventListener('click', () => {
  app.tab = b.dataset.tab;
  window.scrollTo(0, 0);
  render();
}));
fab.addEventListener('click', () => openDay(dateKey(today())));

store.subscribe(() => { render(); refreshSheet(); });
render();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
