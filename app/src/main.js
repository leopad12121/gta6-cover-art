// Vice Cover Studio — editor UI.
// Owns the state, photo library, panel selection, drag-to-pan, zoom, layout /
// grade / caption controls, preview rendering and PNG export. All local: the
// only files ever fetched are the app's own samples and font.

import { renderCover, panelCount } from './render.js';

const SIZES = {
  '1920x1080': [1920, 1080],
  '1080x1350': [1080, 1350],
  '1080x1080': [1080, 1080],
};

const SAMPLES = [
  { key: 'portrait', label: 'Portrait', src: 'samples/portrait.jpg' },
  { key: 'boulevard', label: 'Boulevard', src: 'samples/boulevard.jpg' },
  { key: 'pier', label: 'Pier', src: 'samples/pier.jpg' },
];

const state = {
  layout: 'diagonal',
  grade: 'sunset',
  caption: 'SUNSET HEIST',
  subcaption: 'VICE CITY · 2026',
  size: '1920x1080',
  selectedPanel: 0,
  selectedPhoto: 'portrait',
  panels: [
    { photo: 'portrait', x: 0.5, y: 0.42, zoom: 1 },
    { photo: 'boulevard', x: 0.5, y: 0.5, zoom: 1 },
    { photo: 'pier', x: 0.5, y: 0.5, zoom: 1 },
  ],
};

const images = new Map(); // photo key -> HTMLImageElement
const photos = new Map(); // photo key -> { key, label, src }
let uploadCount = 0;
let fontReady = false;

const $ = (sel) => document.querySelector(sel);
const canvas = $('#preview');
const ctx = canvas.getContext('2d');

function loadImage(key, src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { images.set(key, img); resolve(true); };
    img.onerror = () => { resolve(false); };
    img.src = src;
  });
}

function render() {
  const [w, h] = SIZES[state.size];
  // Preview canvas keeps the export aspect ratio.
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  renderCover(ctx, w, h, state, images);
}

function renderSoon() {
  requestAnimationFrame(render);
}

// ---------------------------------------------------------------- photo library

function rebuildStrip() {
  const strip = $('#photoStrip');
  strip.innerHTML = '';
  for (const [key, photo] of photos) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'photo-thumb' + (state.selectedPhoto === key ? ' is-active' : '');
    btn.dataset.photo = key;
    const img = document.createElement('img');
    img.src = photo.src;
    img.alt = photo.label;
    const label = document.createElement('span');
    label.textContent = photo.label;
    btn.append(img, label);
    btn.addEventListener('click', () => {
      state.selectedPhoto = key;
      state.panels[state.selectedPanel].photo = key;
      rebuildStrip();
      renderSoon();
    });
    strip.appendChild(btn);
  }
}

function addPhoto(key, label, src) {
  photos.set(key, { key, label, src });
  return loadImage(key, src);
}

async function initPhotos() {
  for (const s of SAMPLES) {
    await addPhoto(s.key, s.label, s.src);
  }
  rebuildStrip();
}

function handleFiles(files) {
  const list = [...files].filter((f) => f.type.startsWith('image/'));
  if (!list.length) return;
  let done = 0;
  for (const file of list) {
    const reader = new FileReader();
    reader.onload = async () => {
      uploadCount += 1;
      const key = `upload${uploadCount}`;
      const label = file.name.replace(/\.[^.]+$/, '').slice(0, 18) || 'Upload';
      await addPhoto(key, label, String(reader.result));
      state.selectedPhoto = key;
      state.panels[state.selectedPanel].photo = key;
      rebuildStrip();
      renderSoon();
      done += 1;
    };
    reader.readAsDataURL(file);
  }
}

// ---------------------------------------------------------------- panel picking & panning

function pickPanelAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const nx = (clientX - rect.left) / rect.width;
  const ny = (clientY - rect.top) / rect.height;
  // Clicks in the top sky band (above the panels) keep the current panel.
  if (ny < 0.13) return state.selectedPanel;
  // Panels are diagonal bands: a point belongs to the band whose x-range at
  // that y contains it. y is remapped into panel-local coordinates.
  const py = (ny - 0.13) / 0.87;
  const polys = {
    diagonal: [
      (y) => [0, 0.58 - 0.22 * y],
      (y) => [0.58 - 0.22 * y, 0.88 - 0.22 * y],
      (y) => [0.88 - 0.22 * y, 1],
    ],
    duo: [
      (y) => [0, 0.56 - 0.12 * y],
      (y) => [0.56 - 0.12 * y, 1],
    ],
    hero: [(y) => [0, 1]],
  }[state.layout];
  for (let i = 0; i < polys.length; i++) {
    const [lo, hi] = polys[i](py);
    if (nx >= lo && nx <= hi) return i;
  }
  return 0;
}

function syncPanelUI() {
  const count = panelCount(state.layout);
  document.querySelectorAll('.panel-chip').forEach((chip) => {
    const i = Number(chip.dataset.panel);
    chip.disabled = i >= count;
    chip.classList.toggle('is-active', i === state.selectedPanel);
  });
  const panel = state.panels[state.selectedPanel];
  const zoom = $('#zoomRange');
  zoom.value = String(Math.round((panel.zoom || 1) * 100));
  $('#zoomVal').textContent = `${Math.round((panel.zoom || 1) * 100)}%`;
  state.selectedPhoto = panel.photo;
  rebuildStrip();
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const i = pickPanelAt(e.clientX, e.clientY);
  state.selectedPanel = i;
  syncPanelUI();
  const panel = state.panels[i];
  drag = { x: e.clientX, y: e.clientY, px: panel.x, py: panel.y };
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const rect = canvas.getBoundingClientRect();
  const panel = state.panels[state.selectedPanel];
  // Dragging right moves the photo right (focal point follows the pointer).
  const dx = (e.clientX - drag.x) / rect.width;
  const dy = (e.clientY - drag.y) / rect.height;
  panel.x = Math.min(1, Math.max(0, drag.px - dx));
  panel.y = Math.min(1, Math.max(0, drag.py - dy));
  renderSoon();
});

canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointercancel', () => { drag = null; });

// ---------------------------------------------------------------- controls

document.querySelectorAll('.panel-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    state.selectedPanel = Number(chip.dataset.panel);
    syncPanelUI();
  });
});

$('#resetPanBtn').addEventListener('click', () => {
  const panel = state.panels[state.selectedPanel];
  panel.x = 0.5; panel.y = 0.5; panel.zoom = 1;
  syncPanelUI();
  renderSoon();
});

$('#zoomRange').addEventListener('input', (e) => {
  const panel = state.panels[state.selectedPanel];
  panel.zoom = Number(e.target.value) / 100;
  $('#zoomVal').textContent = `${e.target.value}%`;
  renderSoon();
});

function bindSeg(id, key, apply) {
  $(id).addEventListener('click', (e) => {
    const btn = e.target.closest('[data-' + key + ']');
    if (!btn) return;
    $(id).querySelectorAll('.seg-btn').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    apply(btn.dataset[key]);
    renderSoon();
  });
}

bindSeg('#layoutSeg', 'layout', (v) => {
  state.layout = v;
  if (state.selectedPanel >= panelCount(v)) state.selectedPanel = 0;
  syncPanelUI();
});
bindSeg('#gradeSeg', 'grade', (v) => { state.grade = v; });
bindSeg('#sizeSeg', 'size', (v) => { state.size = v; });

$('#captionInput').addEventListener('input', (e) => {
  state.caption = e.target.value;
  renderSoon();
});
$('#subInput').addEventListener('input', (e) => {
  state.subcaption = e.target.value;
  renderSoon();
});

$('#fillAllBtn').addEventListener('click', () => {
  const key = state.selectedPhoto;
  const count = panelCount(state.layout);
  for (let i = 0; i < count; i++) state.panels[i].photo = key;
  renderSoon();
});

$('#fileInput').addEventListener('change', (e) => {
  handleFiles(e.target.files);
  e.target.value = '';
});

const dropZone = $('#dropZone');
['dragenter', 'dragover'].forEach((ev) => dropZone.addEventListener(ev, (e) => {
  e.preventDefault();
  dropZone.classList.add('dragging');
}));
['dragleave', 'drop'].forEach((ev) => dropZone.addEventListener(ev, (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragging');
}));
dropZone.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));

// ---------------------------------------------------------------- export

async function exportPNG() {
  const [w, h] = SIZES[state.size];
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const octx = off.getContext('2d');
  renderCover(octx, w, h, state, images);
  return new Promise((resolve) => {
    off.toBlob((blob) => resolve(blob), 'image/png');
  });
}

async function downloadExport() {
  const blob = await exportPNG();
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vice-cover-${state.size}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

$('#exportBtn').addEventListener('click', downloadExport);
$('#exportBtn2').addEventListener('click', downloadExport);

// ---------------------------------------------------------------- boot

// Test/driver hooks: the app's own export, layout, grade and caption paths,
// callable from automation without touching internals.
window.__vice = {
  state,
  images,
  render,
  exportPNG,
  setCaption(text) { state.caption = text; $('#captionInput').value = text; render(); },
  setSubcaption(text) { state.subcaption = text; $('#subInput').value = text; render(); },
  setLayout(v) { state.layout = v; render(); },
  setGrade(v) { state.grade = v; render(); },
  setSize(v) { state.size = v; render(); },
  setPanelPhoto(i, key) { state.panels[i].photo = key; render(); },
  get fontReady() { return fontReady; },
};

async function boot() {
  try {
    await document.fonts.load('100px Anton');
    await document.fonts.ready;
    fontReady = document.fonts.check('100px Anton');
  } catch {
    fontReady = false;
  }
  await initPhotos();
  syncPanelUI();
  render();
}

boot();
