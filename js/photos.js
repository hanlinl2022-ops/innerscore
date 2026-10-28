// Photo storage in IndexedDB (localStorage is too small for images).
// Photos are downscaled to JPEG before saving to keep storage and backups small.
import { uid } from './util.js';

const DB = 'innerscore-photos';
const STORE = 'photos';
const MAX_SIDE = 1600;
const urlCache = new Map();
let dbPromise;

function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const result = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(result?.result ?? result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

async function shrink(file) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    return await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.82));
  } catch {
    return file; // Format the browser can't decode: keep the original.
  }
}

// Saves an image file and returns its new photo id.
export async function addPhoto(file) {
  const blob = await shrink(file);
  const id = uid() + uid();
  await tx('readwrite', (s) => s.put(blob, id));
  navigator.storage?.persist?.(); // Ask the browser not to evict photos under storage pressure.
  return id;
}

export async function photoURL(id) {
  if (urlCache.has(id)) return urlCache.get(id);
  const blob = await tx('readonly', (s) => s.get(id));
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

export async function deletePhotos(ids) {
  if (!ids.length) return;
  await tx('readwrite', (s) => ids.forEach((id) => s.delete(id)));
  ids.forEach((id) => {
    if (urlCache.has(id)) URL.revokeObjectURL(urlCache.get(id));
    urlCache.delete(id);
  });
}

export async function clearPhotos() {
  await tx('readwrite', (s) => s.clear());
  urlCache.forEach((u) => URL.revokeObjectURL(u));
  urlCache.clear();
}

// Fills <img data-photo="id"> elements inside root with their stored images.
export function hydrate(root) {
  root.querySelectorAll('img[data-photo]').forEach(async (img) => {
    const url = await photoURL(img.dataset.photo);
    if (url) img.src = url;
  });
}

// ---------- backup ----------
const toDataURL = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

export async function exportPhotos(ids) {
  const out = {};
  for (const id of ids) {
    const blob = await tx('readonly', (s) => s.get(id));
    if (blob) out[id] = await toDataURL(blob);
  }
  return out;
}

export async function importPhotos(map) {
  await clearPhotos();
  for (const [id, dataURL] of Object.entries(map || {})) {
    const blob = await (await fetch(dataURL)).blob();
    await tx('readwrite', (s) => s.put(blob, id));
  }
}
