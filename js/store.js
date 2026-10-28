// Data model + localStorage persistence.
//   categories: [{ id, name, color }]           (array order = display order)
//   tasks:      [{ id, categoryId, emoji, name, archived }]
//   log:        { "YYYY-MM-DD": [taskId, ...] }
//   notes:      { "YYYY-MM-DD": { taskId: { text, photos: [photoId] } } }   (photo blobs live in IndexedDB)
import { uid } from './util.js';
import * as photos from './photos.js';

const KEY = 'innerscore.v1';
const listeners = new Set();

export const PRESET_COLORS = [
  '#1a8cf0', '#33a35a', '#7b82d4', '#e8736c', '#f4b400', '#ff7f2a',
  '#e04f9d', '#16a5a5', '#8d6e63', '#616161',
];

function seed() {
  const cats = [
    { id: 'study', name: 'Study & Work', color: '#1a8cf0' },
    { id: 'sport', name: 'Sport & Health', color: '#33a35a' },
    { id: 'music', name: 'Music', color: '#7b82d4' },
    { id: 'social', name: 'Social & Fun', color: '#e8736c' },
  ];
  const t = (categoryId, emoji, name) => ({ id: uid(), categoryId, emoji, name, archived: false });
  const tasks = [
    t('study', '🏛️', 'Museum / history'), t('study', '📰', 'Read news'), t('study', '💻', 'Coding'),
    t('study', '📝', 'Writing'), t('study', '🔤', 'Language'), t('study', '📖', 'Reading'),
    t('sport', '🏀', 'Basketball'), t('sport', '🎾', 'Tennis'), t('sport', '🏋️', 'Gym'), t('sport', '🏠', 'Home workout'),
    t('music', '🎹', 'Piano'), t('music', '🎵', 'Music theory'), t('music', '🎤', 'Singing'), t('music', '🎧', 'Listening'),
    t('social', '👫', 'Friends'), t('social', '👨‍👩‍👧', 'Family'), t('social', '🎮', 'Gaming'),
    t('social', '🍱', 'Eating out'), t('social', '📞', 'Phone call'),
  ];
  return { categories: cats, tasks, log: {}, notes: {} };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && Array.isArray(d.categories) && Array.isArray(d.tasks) && d.log) return { notes: {}, ...d };
    }
  } catch { /* fall through to seed */ }
  return seed();
}

let state = load();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  listeners.forEach((fn) => fn());
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---------- reads ----------
export const getCategories = () => state.categories;
export const getCategory = (id) => state.categories.find((c) => c.id === id);
export const getTask = (id) => state.tasks.find((t) => t.id === id);
export const tasksIn = (categoryId, { includeArchived = false } = {}) =>
  state.tasks.filter((t) => t.categoryId === categoryId && (includeArchived || !t.archived));
export const doneOn = (key) => state.log[key] || [];
export const isDone = (key, taskId) => doneOn(key).includes(taskId);

// Completed tasks on a day grouped by category, in category order.
export function dayByCategory(key) {
  const done = doneOn(key).map(getTask).filter(Boolean);
  return state.categories
    .map((c) => ({ category: c, tasks: done.filter((t) => t.categoryId === c.id) }))
    .filter((g) => g.tasks.length);
}

export const getNote = (key, taskId) => state.notes[key]?.[taskId] || null;
export const hasNotes = (key) => !!state.notes[key];

// ---------- writes ----------
export function toggleTask(key, taskId) {
  const list = doneOn(key);
  const undoing = list.includes(taskId);
  const next = undoing ? list.filter((id) => id !== taskId) : [...list, taskId];
  if (next.length) state.log[key] = next; else delete state.log[key];
  if (undoing) dropNotes((k, tid) => k === key && tid === taskId);
  save();
}

// Saves the note for a logged task; an empty note is removed.
export function setNote(key, taskId, { text, photos: photoIds }) {
  const day = (state.notes[key] ||= {});
  if (text || photoIds.length) day[taskId] = { text, photos: photoIds };
  else delete day[taskId];
  if (!Object.keys(day).length) delete state.notes[key];
  save();
}

// Removes notes matching pred(dateKey, taskId) and deletes their photos. Caller saves.
function dropNotes(pred) {
  const gone = [];
  for (const [k, day] of Object.entries(state.notes)) {
    for (const [tid, n] of Object.entries(day)) {
      if (pred(k, tid)) { gone.push(...n.photos); delete day[tid]; }
    }
    if (!Object.keys(day).length) delete state.notes[k];
  }
  photos.deletePhotos(gone);
}

export function addCategory(name, color) {
  const c = { id: uid(), name, color };
  state.categories.push(c);
  save();
  return c;
}

export function updateCategory(id, patch) {
  Object.assign(getCategory(id), patch);
  save();
}

export function moveCategory(id, dir) {
  const i = state.categories.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= state.categories.length) return;
  [state.categories[i], state.categories[j]] = [state.categories[j], state.categories[i]];
  save();
}

// Removes the category, its tasks, and those tasks' log entries.
export function deleteCategory(id) {
  const taskIds = new Set(state.tasks.filter((t) => t.categoryId === id).map((t) => t.id));
  state.categories = state.categories.filter((c) => c.id !== id);
  state.tasks = state.tasks.filter((t) => !taskIds.has(t.id));
  for (const k of Object.keys(state.log)) {
    const next = state.log[k].filter((tid) => !taskIds.has(tid));
    if (next.length) state.log[k] = next; else delete state.log[k];
  }
  dropNotes((k, tid) => taskIds.has(tid));
  save();
}

export function addTask(categoryId, emoji, name) {
  const t = { id: uid(), categoryId, emoji, name, archived: false };
  state.tasks.push(t);
  save();
  return t;
}

export function updateTask(id, patch) {
  Object.assign(getTask(id), patch);
  save();
}

export function deleteTask(id) {
  state.tasks = state.tasks.filter((t) => t.id !== id);
  for (const k of Object.keys(state.log)) {
    const next = state.log[k].filter((tid) => tid !== id);
    if (next.length) state.log[k] = next; else delete state.log[k];
  }
  dropNotes((k, tid) => tid === id);
  save();
}

export const taskUsage = (id) => Object.values(state.log).filter((l) => l.includes(id)).length;

export const noteCount = () => Object.values(state.notes).reduce((n, day) => n + Object.keys(day).length, 0);

// ---------- backup ----------
// Backups embed photos as data URLs so a single file restores everything.
export async function exportJSON() {
  const ids = Object.values(state.notes).flatMap((day) => Object.values(day).flatMap((n) => n.photos));
  const photoData = await photos.exportPhotos(ids);
  return JSON.stringify({ app: 'InnerScore', version: 2, exportedAt: new Date().toISOString(), ...state, photoData });
}

export async function importJSON(text) {
  const d = JSON.parse(text);
  if (!Array.isArray(d.categories) || !Array.isArray(d.tasks) || typeof d.log !== 'object') {
    throw new Error('Not an InnerScore backup file');
  }
  await photos.importPhotos(d.photoData);
  state = { categories: d.categories, tasks: d.tasks, log: d.log, notes: d.notes || {} };
  save();
}

export async function resetAll(withSamples) {
  await photos.clearPhotos();
  state = withSamples ? seed() : { categories: [], tasks: [], log: {}, notes: {} };
  save();
}
