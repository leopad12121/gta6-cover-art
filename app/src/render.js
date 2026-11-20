// Vice Cover Studio — canvas renderer.
// Draws a GTA-style poster cover: sunset sky, striped sun, skyline and palm
// silhouettes, diagonal photo panels with per-photo colour grades, halftone
// dots, grain, and bold condensed caption lettering. No network, no assets
// beyond the photos the user loads or the bundled samples.

/** Deterministic pseudo-random generator so every render is stable. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const INK = '#160829';      // near-black violet used for silhouettes and outlines
const SKYLINE = '#220d3d';  // skyline silhouette, a touch lighter than the palms

// The photo panels start below a sky band at the top of the cover, so the
// sunset sky, striped sun and skyline stay visible instead of being hidden
// behind full-bleed panels.
const TOP_BAND = 0.13;

/** Panel polygons for each layout, in normalised [0..1] coordinates. */
export function panelPolygons(layout) {
  if (layout === 'duo') {
    return [
      [[0, TOP_BAND], [0.56, TOP_BAND], [0.44, 1], [0, 1]],
      [[0.56, TOP_BAND], [1, TOP_BAND], [1, 1], [0.44, 1]],
    ];
  }
  if (layout === 'hero') {
    return [[[0, TOP_BAND], [1, TOP_BAND], [1, 1], [0, 1]]];
  }
  // diagonal: three slanted bands, the classic cover look.
  return [
    [[0, TOP_BAND], [0.58, TOP_BAND], [0.36, 1], [0, 1]],
    [[0.58, TOP_BAND], [0.88, TOP_BAND], [0.66, 1], [0.36, 1]],
    [[0.88, TOP_BAND], [1, TOP_BAND], [1, 1], [0.66, 1]],
  ];
}

export function panelCount(layout) {
  return panelPolygons(layout).length;
}

function polyPath(ctx, pts, W, H) {
  ctx.beginPath();
  pts.forEach(([nx, ny], i) => {
    const x = nx * W, y = ny * H;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

function drawSky(ctx, W, H, grade) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  if (grade === 'neon') {
    g.addColorStop(0, '#12002e');
    g.addColorStop(0.38, '#5b0a6e');
    g.addColorStop(0.62, '#c2187f');
    g.addColorStop(0.82, '#ff4d6d');
    g.addColorStop(1, '#ff9a3d');
  } else if (grade === 'noir') {
    g.addColorStop(0, '#0b0b10');
    g.addColorStop(0.5, '#23232e');
    g.addColorStop(0.8, '#4a4a58');
    g.addColorStop(1, '#8a8a96');
  } else {
    g.addColorStop(0, '#2a0a4e');
    g.addColorStop(0.35, '#7a1e6e');
    g.addColorStop(0.6, '#e33e6d');
    g.addColorStop(0.8, '#ff7a3d');
    g.addColorStop(1, '#ffc23d');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Striped retro sun, rendered on its own canvas so the stripes are true cut-outs.
 *  It lives in the top sky band, above the photo panels. */
function drawSun(ctx, W, H, grade) {
  const cx = W * 0.72, cy = H * (TOP_BAND / 2), r = Math.min(W, H) * 0.058;
  const sun = document.createElement('canvas');
  sun.width = Math.ceil(r * 2) + 4;
  sun.height = Math.ceil(r * 2) + 4;
  const s = sun.getContext('2d');
  const g = s.createLinearGradient(0, 0, 0, sun.height);
  if (grade === 'noir') {
    g.addColorStop(0, '#f2f2f2'); g.addColorStop(1, '#9a9aa2');
  } else if (grade === 'neon') {
    g.addColorStop(0, '#ffe95e'); g.addColorStop(0.55, '#ff5e8a'); g.addColorStop(1, '#b14bff');
  } else {
    g.addColorStop(0, '#fff3a0'); g.addColorStop(0.5, '#ffb03d'); g.addColorStop(1, '#ff5e3d');
  }
  s.fillStyle = g;
  s.beginPath();
  s.arc(sun.width / 2, sun.height / 2, r, 0, Math.PI * 2);
  s.fill();
  // Cut horizontal stripes across the lower half, thicker toward the bottom.
  s.globalCompositeOperation = 'destination-out';
  let y = sun.height / 2 + r * 0.08;
  let thick = Math.max(2, r * 0.03);
  while (y < sun.height / 2 + r) {
    s.fillRect(0, y, sun.width, thick);
    y += thick + Math.max(4, r * 0.09);
    thick *= 1.45;
  }
  s.globalCompositeOperation = 'source-over';
  ctx.drawImage(sun, cx - sun.width / 2, cy - sun.height / 2);
}

/** Skyline silhouette rising from the bottom edge of the top sky band, so the
 *  towers peek out above the photo panels. */
function drawSkyline(ctx, W, H, rand) {
  const base = H * TOP_BAND;
  ctx.fillStyle = SKYLINE;
  let x = 0;
  while (x < W) {
    const bw = W * (0.04 + rand() * 0.05);
    const bh = H * (0.02 + rand() * 0.075);
    const top = base - bh;
    ctx.fillRect(x, top, bw, bh);
    // Rooftop antenna on some towers.
    if (rand() < 0.35) {
      ctx.fillRect(x + bw / 2 - 1, top - H * 0.02, 2, H * 0.02);
      ctx.beginPath();
      ctx.arc(x + bw / 2, top - H * 0.022, Math.max(1.5, W * 0.0016), 0, Math.PI * 2);
      ctx.fillStyle = '#ff5e7a';
      ctx.fill();
      ctx.fillStyle = SKYLINE;
    }
    // A few lit windows.
    const cols = Math.max(1, Math.floor(bw / (W * 0.012)));
    const rows = Math.max(1, Math.floor(bh / (H * 0.03)));
    for (let c = 0; c < cols; c++) {
      for (let r2 = 0; r2 < rows; r2++) {
        if (rand() < 0.22) {
          ctx.fillStyle = 'rgba(255, 209, 102, 0.85)';
          ctx.fillRect(x + bw * 0.14 + c * W * 0.012, top + bh * 0.12 + r2 * H * 0.03, W * 0.005, H * 0.012);
        }
      }
    }
    ctx.fillStyle = SKYLINE;
    x += bw + W * 0.004;
  }
}

/** One palm silhouette: curved trunk, crown of drooping fronds. */
function drawPalm(ctx, x, y, h, lean, flip) {
  const s = flip ? -1 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, 1);
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineCap = 'round';
  // Trunk, bending with the lean. Thick enough to read as a silhouette.
  ctx.lineWidth = Math.max(3, h * 0.032);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(lean * h * 0.12, -h * 0.55, lean * h * 0.22, -h);
  ctx.stroke();
  const cx = lean * h * 0.22, cy = -h;
  // Fronds: long drooping arcs fanning from the crown.
  ctx.lineWidth = Math.max(2.5, h * 0.024);
  const fronds = 9;
  for (let i = 0; i < fronds; i++) {
    const a = (-Math.PI * 0.06) - (i / (fronds - 1)) * Math.PI * 0.88;
    const len = h * (0.5 + (i % 3) * 0.06);
    const ex = cx + Math.cos(a) * len;
    const ey = cy + Math.sin(a) * len * 0.55 + len * 0.36;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(cx + Math.cos(a) * len * 0.55, cy + Math.sin(a) * len * 0.4 - len * 0.12, ex, ey);
    ctx.stroke();
  }
  // Coconut cluster.
  ctx.beginPath();
  ctx.arc(cx - h * 0.015, cy + h * 0.03, h * 0.022, 0, Math.PI * 2);
  ctx.arc(cx + h * 0.02, cy + h * 0.035, h * 0.02, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function gradeFilter(grade) {
  if (grade === 'neon') return 'saturate(1.55) contrast(1.12) hue-rotate(-14deg) brightness(1.02)';
  if (grade === 'noir') return 'grayscale(1) contrast(1.28) brightness(0.94)';
  return 'saturate(1.35) contrast(1.07) brightness(1.02) sepia(0.16)';
}

function drawGradeTint(ctx, pts, W, H, grade) {
  ctx.save();
  polyPath(ctx, pts, W, H);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, W, H);
  if (grade === 'neon') {
    ctx.globalCompositeOperation = 'overlay';
    g.addColorStop(0, 'rgba(255, 46, 136, 0.28)');
    g.addColorStop(1, 'rgba(46, 230, 214, 0.30)');
  } else if (grade === 'noir') {
    ctx.globalCompositeOperation = 'soft-light';
    g.addColorStop(0, 'rgba(255,255,255,0.10)');
    g.addColorStop(1, 'rgba(0,0,0,0.28)');
  } else {
    ctx.globalCompositeOperation = 'soft-light';
    g.addColorStop(0, 'rgba(255, 150, 60, 0.30)');
    g.addColorStop(1, 'rgba(255, 46, 120, 0.26)');
  }
  ctx.fillStyle = g;
  const bb = bboxOf(pts, W, H);
  ctx.fillRect(bb.x, bb.y, bb.w, bb.h);
  ctx.restore();
}

function bboxOf(pts, W, H) {
  const xs = pts.map(([nx]) => nx * W);
  const ys = pts.map(([, ny]) => ny * H);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Cover-fit draw of one photo inside a panel polygon, with pan/zoom. */
function drawPanelPhoto(ctx, pts, W, H, img, panel) {
  const bb = bboxOf(pts, W, H);
  const zoom = panel.zoom || 1;
  const scale = Math.max(bb.w / img.naturalWidth, bb.h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  // Focal point (0..1): where the user wants the photo centred.
  let dx = bb.x + bb.w / 2 - (panel.x ?? 0.5) * dw;
  let dy = bb.y + bb.h / 2 - (panel.y ?? 0.5) * dh;
  dx = Math.min(bb.x, Math.max(bb.x + bb.w - dw, dx));
  dy = Math.min(bb.y, Math.max(bb.y + bb.h - dh, dy));
  ctx.save();
  polyPath(ctx, pts, W, H);
  ctx.clip();
  ctx.filter = gradeFilter(panel.grade);
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.filter = 'none';
  ctx.restore();
  drawGradeTint(ctx, pts, W, H, panel.grade);
}

function drawPanelPlaceholder(ctx, pts, W, H) {
  const bb = bboxOf(pts, W, H);
  ctx.save();
  polyPath(ctx, pts, W, H);
  ctx.clip();
  const g = ctx.createLinearGradient(bb.x, bb.y, bb.x + bb.w, bb.y + bb.h);
  g.addColorStop(0, '#3d1458');
  g.addColorStop(1, '#12081f');
  ctx.fillStyle = g;
  ctx.fillRect(bb.x, bb.y, bb.w, bb.h);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `${Math.max(14, W * 0.016)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ADD A PHOTO', bb.x + bb.w / 2, bb.y + bb.h / 2);
  ctx.restore();
}

function drawHalftone(ctx, W, H, rand) {
  const top = H * 0.72;
  ctx.save();
  for (let y = top; y < H; y += Math.max(8, H * 0.018)) {
    const t = (y - top) / (H - top);
    for (let x = 0; x < W; x += Math.max(8, W * 0.012)) {
      const r = Math.max(0.6, (0.6 + t * 2.2) * (W / 1600));
      ctx.fillStyle = `rgba(255,255,255,${0.05 + t * 0.07})`;
      ctx.beginPath();
      ctx.arc(x + (rand() - 0.5) * 2, y + (rand() - 0.5) * 2, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawGrain(ctx, W, H, rand) {
  ctx.save();
  const n = Math.floor((W * H) / 900);
  for (let i = 0; i < n; i++) {
    const v = rand() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${0.02 + rand() * 0.03})`;
    ctx.fillRect(rand() * W, rand() * H, 1.4, 1.4);
  }
  ctx.restore();
}

function fitCaption(ctx, text, maxWidth, startSize) {
  let size = startSize;
  ctx.font = `${size}px Anton, sans-serif`;
  while (size > 20 && ctx.measureText(text).width > maxWidth) {
    size *= 0.92;
    ctx.font = `${size}px Anton, sans-serif`;
  }
  return size;
}

function drawCaption(ctx, W, H, state) {
  const caption = (state.caption || '').toUpperCase().trim() || 'SUNSET HEIST';
  const sub = (state.subcaption || '').trim();
  const anchorX = W * 0.055;
  const baseY = H * 0.86;
  ctx.save();
  ctx.translate(anchorX, baseY);
  ctx.rotate(-0.035);
  // Legibility wash behind the lettering.
  const wash = ctx.createLinearGradient(0, -H * 0.1, 0, H * 0.1);
  wash.addColorStop(0, 'rgba(10,4,20,0)');
  wash.addColorStop(0.5, 'rgba(10,4,20,0.42)');
  wash.addColorStop(1, 'rgba(10,4,20,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(-W * 0.05, -H * 0.1, W * 0.98, H * 0.2);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const size = fitCaption(ctx, caption, W * 0.9, W * 0.115);
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = size * 0.07;
  ctx.shadowOffsetY = size * 0.045;
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.lineWidth = Math.max(3, size * 0.13);
  ctx.strokeStyle = INK;
  ctx.strokeText(caption, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(caption, 0, 0);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  if (sub) {
    const subSize = Math.max(12, W * 0.021);
    ctx.font = `400 ${subSize}px Anton, sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.max(3, W * 0.006)}px`;
    ctx.lineWidth = Math.max(2, subSize * 0.16);
    ctx.strokeStyle = INK;
    ctx.strokeText(sub.toUpperCase(), 2, size * 0.42);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(sub.toUpperCase(), 2, size * 0.42);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  ctx.restore();
}

/**
 * Render the whole cover.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} W - output width in px
 * @param {number} H - output height in px
 * @param {object} state - { layout, grade, caption, subcaption, panels: [{photo, x, y, zoom}] }
 * @param {Map<string, HTMLImageElement>} images - photo key -> loaded image
 */
export function renderCover(ctx, W, H, state, images) {
  const rand = mulberry32(20261120);
  const grade = state.grade || 'sunset';
  ctx.clearRect(0, 0, W, H);
  drawSky(ctx, W, H, grade);
  drawSun(ctx, W, H, grade);
  drawSkyline(ctx, W, H, rand);

  const polys = panelPolygons(state.layout || 'diagonal');
  const gap = Math.max(3, W * 0.006);
  polys.forEach((pts, i) => {
    const panel = state.panels[i] || { photo: null, x: 0.5, y: 0.5, zoom: 1 };
    const img = panel.photo ? images.get(panel.photo) : null;
    if (img && img.naturalWidth > 0) {
      drawPanelPhoto(ctx, pts, W, H, img, { ...panel, grade });
    } else {
      drawPanelPlaceholder(ctx, pts, W, H);
    }
  });

  // White divider lines along the shared diagonal edges.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = gap;
  ctx.lineCap = 'round';
  if (polys.length > 1) {
    for (let i = 0; i < polys.length - 1; i++) {
      const a = polys[i][1], b = polys[i][3];
      ctx.beginPath();
      ctx.moveTo(a[0] * W, a[1] * H);
      ctx.lineTo(b[0] * W, b[1] * H);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Palm silhouettes framing the bottom corners, in front of the panels.
  drawPalm(ctx, W * 0.02, H * 1.01, H * 0.46, 0.35, false);
  drawPalm(ctx, W * 0.965, H * 1.01, H * 0.38, -0.15, true);

  drawHalftone(ctx, W, H, rand);
  drawGrain(ctx, W, H, rand);

  // Poster frame.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(3, W * 0.007);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);
  ctx.restore();

  drawCaption(ctx, W, H, state);
}
