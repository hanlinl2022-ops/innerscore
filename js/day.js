// Day editor sheet: tap an emoji to mark that task done/undone for the day.
import * as store from './store.js';
import { openSheet, closeSheet, taskForm, categoryForm } from './ui.js';
import { dateKey, parseKey, addDays, longDate, esc } from './util.js';

export function openDay(key) {
  openSheet((el) => renderDay(el, key));
}

function renderDay(el, key) {
  const d = parseKey(key);
  const cats = store.getCategories();
  const done = store.doneOn(key);

  el.innerHTML = `
    <div class="sheet-head">
      <button class="icon-btn" data-nav="-1" aria-label="Previous day">‹</button>
      <h2>${longDate(d)}</h2>
      <button class="icon-btn" data-nav="1" aria-label="Next day">›</button>
    </div>
    <p class="day-score">${done.length ? `⭐ ${done.length} task${done.length === 1 ? '' : 's'} done` : 'Tap an emoji to log a completed task'}</p>
    ${cats.length ? '' : '<p class="empty">No categories yet.</p>'}
    ${cats.map((c) => {
      // Show archived tasks only if they were logged that day, so history stays editable.
      const tasks = store.tasksIn(c.id, { includeArchived: true })
        .filter((t) => !t.archived || done.includes(t.id));
      return `
        <div class="cat-block">
          <div class="cat-title"><span class="dot" style="background:${c.color}"></span>${esc(c.name)}</div>
          <div class="task-chips">
            ${tasks.map((t) => `
              <button class="task-chip ${done.includes(t.id) ? 'done' : ''}" style="--c:${c.color}" data-task="${t.id}"
                aria-pressed="${done.includes(t.id)}">
                <span class="emo">${t.emoji}</span>${esc(t.name)}
              </button>`).join('')}
            <button class="task-chip add" data-add="${c.id}">＋ task</button>
          </div>
        </div>`;
    }).join('')}
    <div class="btn-row">
      <button class="btn" data-act="newcat">＋ Category</button>
      <button class="btn primary" data-act="close">Done</button>
    </div>`;

  const reopen = () => openDay(key);
  el.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () =>
    openDay(dateKey(addDays(d, Number(b.dataset.nav))))));
  el.querySelectorAll('[data-task]').forEach((b) => b.addEventListener('click', () => {
    store.toggleTask(key, b.dataset.task);
    renderDay(el, key);
  }));
  el.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () =>
    taskForm({ categoryId: b.dataset.add, onDone: reopen })));
  el.querySelector('[data-act="newcat"]').addEventListener('click', () => categoryForm({ onDone: reopen }));
  el.querySelector('[data-act="close"]').addEventListener('click', closeSheet);
}
