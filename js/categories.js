// Manage categories (name, color, order) and their emoji tasks; backup/restore.
import * as store from './store.js';
import { taskForm, categoryForm, closeSheet } from './ui.js';
import { dateKey, today, esc } from './util.js';

export function renderCategories(view) {
  const cats = store.getCategories();

  view.innerHTML = `
    <div class="page">
      <p class="hint">Tap ✏️ to rename or recolor a category, ↑↓ to reorder. Tap a task to edit, archive or delete it.</p>
      ${cats.map((c, i) => {
        const tasks = store.tasksIn(c.id, { includeArchived: true });
        return `
          <div class="card cat-card" style="--c:${c.color}">
            <div class="head">
              <span class="dot" style="background:${c.color};width:16px;height:16px"></span>
              <strong>${esc(c.name)}</strong>
              <button class="icon-btn" data-move="${c.id}" data-dir="-1" ${i === 0 ? 'disabled style="opacity:.3"' : ''} aria-label="Move up">↑</button>
              <button class="icon-btn" data-move="${c.id}" data-dir="1" ${i === cats.length - 1 ? 'disabled style="opacity:.3"' : ''} aria-label="Move down">↓</button>
              <button class="icon-btn" data-editcat="${c.id}" aria-label="Edit category">✏️</button>
            </div>
            <div class="task-chips">
              ${tasks.map((t) => `
                <button class="task-chip ${t.archived ? 'archived' : ''}" data-task="${t.id}">
                  <span class="emo">${t.emoji}</span>${esc(t.name)}
                </button>`).join('')}
              <button class="task-chip add" data-add="${c.id}">＋ task</button>
            </div>
          </div>`;
      }).join('')}
      ${cats.length ? '' : '<p class="empty">No categories yet — add your first one.</p>'}
      <button class="btn primary" data-act="newcat" style="width:100%">＋ New category</button>

      <div class="section-title">Data</div>
      <div class="card">
        <p class="hint" style="margin-top:0">Your data is saved on this device only. Export a backup to keep it safe or move it to another device.</p>
        <div class="btn-row" style="justify-content:flex-start">
          <button class="btn" data-act="export">⬇️ Export backup</button>
          <button class="btn" data-act="import">⬆️ Import backup</button>
          <button class="btn danger" data-act="reset">Reset…</button>
        </div>
        <input type="file" id="import-file" accept="application/json,.json" hidden>
      </div>
    </div>`;

  const back = () => closeSheet();
  view.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', () => {
    if (!b.disabled) store.moveCategory(b.dataset.move, Number(b.dataset.dir));
  }));
  view.querySelectorAll('[data-editcat]').forEach((b) => b.addEventListener('click', () =>
    categoryForm({ category: store.getCategory(b.dataset.editcat), onDone: back })));
  view.querySelectorAll('[data-task]').forEach((b) => b.addEventListener('click', () =>
    taskForm({ task: store.getTask(b.dataset.task), onDone: back })));
  view.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () =>
    taskForm({ categoryId: b.dataset.add, onDone: back })));
  view.querySelector('[data-act="newcat"]').addEventListener('click', () => categoryForm({ onDone: back }));

  view.querySelector('[data-act="export"]').addEventListener('click', () => {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `innerscore-backup-${dateKey(today())}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  const fileInput = view.querySelector('#import-file');
  view.querySelector('[data-act="import"]').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (!confirm('Importing replaces all current categories, tasks and history. Continue?')) return;
    try {
      store.importJSON(await file.text());
      alert('Backup imported.');
    } catch (e) {
      alert(`Could not import: ${e.message}`);
    }
  });
  view.querySelector('[data-act="reset"]').addEventListener('click', () => {
    if (!confirm('Erase ALL categories, tasks and history? Export a backup first if you want to keep them.')) return;
    store.resetAll(confirm('Start with the sample categories? (Cancel = start completely empty)'));
  });
}
