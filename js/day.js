// Day editor sheet: tap an emoji to mark that task done/undone for the day,
// then add a note and photos to any completed task.
import * as store from './store.js';
import * as photos from './photos.js';
import { openSheet, closeSheet, refreshSheet, taskForm, categoryForm } from './ui.js';
import { dateKey, parseKey, addDays, longDate, esc } from './util.js';

export function openDay(key) {
  openSheet((el) => renderDay(el, key));
}

function thumbs(ids, max) {
  if (!ids.length) return '';
  return `<span class="thumbs">${ids.slice(0, max).map((id) => `<img data-photo="${id}" alt="">`).join('')}${
    ids.length > max ? `<span class="more">+${ids.length - max}</span>` : ''}</span>`;
}

function noteRow(key, t, color) {
  const n = store.getNote(key, t.id);
  return `
    <button class="note-row" data-note="${t.id}" style="--c:${color}">
      <span class="emo">${t.emoji}</span>
      <span class="note-body">
        ${n?.text ? `<span class="note-text">${esc(n.text)}</span>` : `<span class="hint">Add a note or photo for ${esc(t.name || t.emoji)}…</span>`}
        ${thumbs(n?.photos || [], 4)}
      </span>
      <span class="chev">›</span>
    </button>`;
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
      const doneTasks = tasks.filter((t) => done.includes(t.id));
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
          ${doneTasks.length ? `<div class="note-list">${doneTasks.map((t) => noteRow(key, t, c.color)).join('')}</div>` : ''}
        </div>`;
    }).join('')}
    <div class="btn-row">
      <button class="btn" data-act="newcat">＋ Category</button>
      <button class="btn primary" data-act="close">Done</button>
    </div>`;

  photos.hydrate(el);
  const reopen = () => openDay(key);
  el.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () =>
    openDay(dateKey(addDays(d, Number(b.dataset.nav))))));
  el.querySelectorAll('[data-task]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.task;
    const note = store.isDone(key, id) && store.getNote(key, id);
    if (note && !confirm('Un-mark this task? Its note and photos for this day will be deleted.')) return;
    store.toggleTask(key, id);
    renderDay(el, key);
  }));
  el.querySelectorAll('[data-note]').forEach((b) => b.addEventListener('click', () => openNote(key, b.dataset.note)));
  el.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () =>
    taskForm({ categoryId: b.dataset.add, onDone: reopen })));
  el.querySelector('[data-act="newcat"]').addEventListener('click', () => categoryForm({ onDone: reopen }));
  el.querySelector('[data-act="close"]').addEventListener('click', closeSheet);
}

// Note + photos editor for one completed task on one day.
// Photos are stored as soon as they're picked; unsaved additions are deleted on cancel.
function openNote(key, taskId) {
  const t = store.getTask(taskId);
  const c = store.getCategory(t.categoryId);
  const saved = store.getNote(key, taskId) || { text: '', photos: [] };
  const draft = { text: saved.text, photos: [...saved.photos] };
  const added = [];
  let busy = false;

  const discard = () => photos.deletePhotos(added);

  openSheet((el) => {
    el.innerHTML = `
      <div class="sheet-head">
        <button class="icon-btn" data-act="back" aria-label="Back">←</button>
        <h2><span style="font-size:1.4rem">${t.emoji}</span> ${esc(t.name || '')}</h2>
        <span style="width:40px"></span>
      </div>
      <p class="day-score"><span class="dot" style="display:inline-block;background:${c?.color}"></span>
        ${esc(c?.name || '')} · ${longDate(parseKey(key))}</p>
      <div class="field">
        <label for="f-note">Note</label>
        <textarea id="f-note" class="input note-input" rows="4"
          placeholder="What exactly? e.g. the album you listened to, who you had dinner with…">${esc(draft.text)}</textarea>
      </div>
      <div class="field">
        <label>Photos</label>
        <div class="photo-grid">
          ${draft.photos.map((id) => `
            <div class="photo">
              <img data-photo="${id}" alt="" data-view="${id}">
              <button class="photo-del" data-del="${id}" aria-label="Remove photo">✕</button>
            </div>`).join('')}
          <label class="photo add ${busy ? 'busy' : ''}">
            <input type="file" accept="image/*" multiple hidden id="f-photos">
            <span>${busy ? 'Adding…' : '＋<br>Add photos'}</span>
          </label>
        </div>
      </div>
      <div class="btn-row">
        <button class="btn" data-act="cancel">Cancel</button>
        <button class="btn primary" data-act="save">Save</button>
      </div>`;

    photos.hydrate(el);
    const textEl = el.querySelector('#f-note');
    textEl.addEventListener('input', () => { draft.text = textEl.value; });
    // Re-render in place, keeping the draft text and scroll position.
    const rerender = () => {
      draft.text = textEl.value;
      const scroll = el.scrollTop;
      refreshSheet();
      el.scrollTop = scroll;
    };

    el.querySelector('#f-photos').addEventListener('change', async (e) => {
      const files = [...e.target.files];
      if (!files.length) return;
      busy = true; rerender();
      try {
        for (const f of files) {
          const id = await photos.addPhoto(f);
          added.push(id);
          draft.photos.push(id);
        }
      } catch (err) {
        alert(`Could not add photo: ${err.message}`);
      }
      busy = false; rerender();
    });
    el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
      draft.photos = draft.photos.filter((id) => id !== b.dataset.del);
      rerender();
    }));
    el.querySelectorAll('[data-view]').forEach((img) => img.addEventListener('click', () => viewPhoto(img.dataset.view)));

    const cancel = () => { discard(); openDay(key); };
    el.querySelector('[data-act="back"]').addEventListener('click', cancel);
    el.querySelector('[data-act="cancel"]').addEventListener('click', cancel);
    el.querySelector('[data-act="save"]').addEventListener('click', () => {
      if (busy) return;
      const text = textEl.value.trim();
      // Photos removed in this edit (both previously saved and just-added) are deleted for good.
      const removed = [...saved.photos, ...added].filter((id) => !draft.photos.includes(id));
      store.setNote(key, taskId, { text, photos: draft.photos });
      photos.deletePhotos(removed);
      openDay(key);
    });
  }, { onClose: discard });
}

function viewPhoto(id) {
  const overlay = document.createElement('div');
  overlay.className = 'viewer';
  overlay.innerHTML = '<img alt=""><button class="icon-btn" aria-label="Close">✕</button>';
  document.body.appendChild(overlay);
  photos.photoURL(id).then((url) => { overlay.querySelector('img').src = url; });
  overlay.addEventListener('click', () => overlay.remove());
}
