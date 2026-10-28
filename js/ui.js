// Bottom-sheet modal + shared task/category forms.
import * as store from './store.js';
import { esc } from './util.js';

const backdrop = document.getElementById('sheet-backdrop');
const sheet = document.getElementById('sheet');
let currentRender = null;
let currentOnClose = null;

// render(el) fills the sheet; it is re-run by refreshSheet() after data changes.
// onClose runs only when the sheet is dismissed, not when another sheet replaces it.
export function openSheet(render, { onClose } = {}) {
  currentRender = render;
  currentOnClose = onClose || null;
  backdrop.hidden = false;
  render(sheet);
}

export function refreshSheet() {
  if (currentRender && !backdrop.hidden) currentRender(sheet);
}

export function closeSheet() {
  const onClose = currentOnClose;
  backdrop.hidden = true;
  currentRender = null;
  currentOnClose = null;
  onClose?.();
  sheet.innerHTML = '';
}

backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeSheet(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !backdrop.hidden) closeSheet(); });

const QUICK_EMOJIS = ['📚', '💻', '📝', '📖', '🧠', '🏃', '🏀', '🏋️', '🧘', '🚴', '🏊', '🎹', '🎸',
  '🎵', '🎨', '📷', '👫', '📞', '🎮', '🍳', '🧹', '💰', '🛌', '💧', '🌱', '✈️'];

// Emoji input: keep only the first grapheme so pasting/typing several emojis still yields one.
function firstGrapheme(s) {
  if (!s) return '';
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const it = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)[Symbol.iterator]();
    return it.next().value?.segment || '';
  }
  return Array.from(s)[0] || '';
}

export function taskForm({ task, categoryId, onDone }) {
  const cats = store.getCategories();
  let emoji = task?.emoji || '';
  openSheet((el) => {
    el.innerHTML = `
      <div class="sheet-head">
        <button class="icon-btn" data-act="back" aria-label="Back">←</button>
        <h2>${task ? 'Edit task' : 'New task'}</h2>
        <span style="width:40px"></span>
      </div>
      <div class="row">
        <div class="field">
          <label for="f-emoji">Emoji</label>
          <input id="f-emoji" class="input emoji" value="${esc(emoji)}" placeholder="🙂" autocomplete="off">
        </div>
        <div class="field grow">
          <label for="f-name">Name</label>
          <input id="f-name" class="input" value="${esc(task?.name || '')}" placeholder="e.g. Piano practice">
        </div>
      </div>
      <div class="field">
        <label>Quick pick</label>
        <div class="quick-emojis">${QUICK_EMOJIS.map((e) => `<button type="button" data-emoji="${e}">${e}</button>`).join('')}</div>
        <span class="hint">Or tap the emoji box and use your emoji keyboard.</span>
      </div>
      <div class="field">
        <label for="f-cat">Category</label>
        <select id="f-cat" class="input">
          ${cats.map((c) => `<option value="${c.id}" ${c.id === (task?.categoryId || categoryId) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="btn-row">
        ${task ? `<button class="btn" data-act="archive">${task.archived ? 'Restore' : 'Archive'}</button>
                  <button class="btn danger" data-act="delete">Delete</button>` : ''}
        <button class="btn primary" data-act="save">Save</button>
      </div>`;

    const emojiInput = el.querySelector('#f-emoji');
    emojiInput.addEventListener('input', () => {
      emoji = firstGrapheme(emojiInput.value.trim());
      emojiInput.value = emoji;
    });
    el.querySelectorAll('[data-emoji]').forEach((b) => b.addEventListener('click', () => {
      emoji = b.dataset.emoji;
      emojiInput.value = emoji;
    }));
    el.querySelector('[data-act="back"]').addEventListener('click', onDone);
    el.querySelector('[data-act="save"]').addEventListener('click', () => {
      const name = el.querySelector('#f-name').value.trim();
      const cat = el.querySelector('#f-cat').value;
      if (!emoji) { emojiInput.focus(); return; }
      if (task) store.updateTask(task.id, { emoji, name, categoryId: cat });
      else store.addTask(cat, emoji, name);
      onDone();
    });
    el.querySelector('[data-act="archive"]')?.addEventListener('click', () => {
      store.updateTask(task.id, { archived: !task.archived });
      onDone();
    });
    el.querySelector('[data-act="delete"]')?.addEventListener('click', () => {
      const n = store.taskUsage(task.id);
      const msg = n
        ? `Delete "${task.emoji} ${task.name}"? It is logged on ${n} day(s) and those entries will be removed. (Archive keeps history.)`
        : `Delete "${task.emoji} ${task.name}"?`;
      if (confirm(msg)) { store.deleteTask(task.id); onDone(); }
    });
    if (!task) emojiInput.focus();
  });
}

export function categoryForm({ category, onDone }) {
  let color = category?.color || store.PRESET_COLORS[store.getCategories().length % store.PRESET_COLORS.length];
  openSheet((el) => {
    el.innerHTML = `
      <div class="sheet-head">
        <button class="icon-btn" data-act="back" aria-label="Back">←</button>
        <h2>${category ? 'Edit category' : 'New category'}</h2>
        <span style="width:40px"></span>
      </div>
      <div class="field">
        <label for="f-cname">Name</label>
        <input id="f-cname" class="input" value="${esc(category?.name || '')}" placeholder="e.g. Health">
      </div>
      <div class="field">
        <label>Color</label>
        <div class="swatches">
          ${store.PRESET_COLORS.map((c) => `<button type="button" class="swatch ${c === color ? 'active' : ''}" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}
          <input type="color" id="f-color" value="${color}" title="Custom color">
        </div>
      </div>
      <div class="btn-row">
        ${category ? '<button class="btn danger" data-act="delete">Delete</button>' : ''}
        <button class="btn primary" data-act="save">Save</button>
      </div>`;

    const pick = (c) => {
      color = c;
      el.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('active', s.dataset.color === c));
      el.querySelector('#f-color').value = c;
    };
    el.querySelectorAll('.swatch').forEach((s) => s.addEventListener('click', () => pick(s.dataset.color)));
    el.querySelector('#f-color').addEventListener('input', (e) => pick(e.target.value));
    el.querySelector('[data-act="back"]').addEventListener('click', onDone);
    el.querySelector('[data-act="save"]').addEventListener('click', () => {
      const name = el.querySelector('#f-cname').value.trim();
      if (!name) { el.querySelector('#f-cname').focus(); return; }
      if (category) store.updateCategory(category.id, { name, color });
      else store.addCategory(name, color);
      onDone();
    });
    el.querySelector('[data-act="delete"]')?.addEventListener('click', () => {
      if (confirm(`Delete "${category.name}" and all its tasks and history? This cannot be undone.`)) {
        store.deleteCategory(category.id);
        onDone();
      }
    });
    if (!category) el.querySelector('#f-cname').focus();
  });
}
