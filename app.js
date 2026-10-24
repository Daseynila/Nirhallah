// Nirhalla Art Studio - Client Application

// Minecraft Map Color Palette (RGB approximate values for 50 base colors)
const MINECRAFT_PALETTE = [
  [0, 0, 0], [127, 178, 56], [247, 233, 163], [199, 199, 199], [255, 0, 0],
  [160, 160, 255], [167, 167, 167], [0, 124, 0], [255, 255, 255], [164, 168, 184],
  [151, 109, 77], [112, 112, 112], [64, 64, 255], [143, 119, 72], [255, 252, 245],
  [216, 127, 51], [178, 76, 216], [102, 153, 216], [229, 229, 51], [127, 204, 25],
  [242, 127, 165], [76, 76, 76], [153, 153, 153], [76, 127, 153], [127, 63, 178],
  [51, 76, 178], [102, 76, 51], [102, 127, 51], [153, 51, 51], [25, 25, 25],
  [250, 238, 77], [92, 219, 213], [74, 128, 255], [0, 217, 58], [129, 86, 49],
  [112, 2, 0], [209, 177, 161], [159, 82, 36], [149, 87, 108], [112, 108, 138],
  [186, 133, 36], [103, 117, 53], [160, 77, 78], [57, 41, 35], [135, 107, 98],
  [87, 92, 92], [122, 73, 88], [76, 62, 92], [76, 50, 35], [51, 76, 76]
];

// Expand with 4 Minecraft lighting shades (180, 220, 255, 135)
const FULL_PALETTE = [];
MINECRAFT_PALETTE.forEach(([r, g, b]) => {
  [180, 220, 255, 135].forEach(multiplier => {
    const factor = multiplier / 255.0;
    FULL_PALETTE.push([
      Math.floor(r * factor),
      Math.floor(g * factor),
      Math.floor(b * factor)
    ]);
  });
});

// App State
let currentImage = null;
let currentWidthBlocks = 1;
let currentHeightBlocks = 1;

// Elements
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const sizeSelector = document.getElementById('sizeSelector');
const ditherToggle = document.getElementById('ditherToggle');
const gridToggle = document.getElementById('gridToggle');
const generateBtn = document.getElementById('generateBtn');
const canvasWrapper = document.getElementById('canvasWrapper');
const emptyState = document.getElementById('emptyState');
const wallScene = document.getElementById('wallScene');
const mainCanvas = document.getElementById('mainCanvas');
const gridOverlay = document.getElementById('gridOverlay');
const infoBar = document.getElementById('infoBar');
const infoBlocks = document.getElementById('infoBlocks');
const infoMaps = document.getElementById('infoMaps');
const infoResolution = document.getElementById('infoResolution');
const resultModal = document.getElementById('resultModal');
const resultCode = document.getElementById('resultCode');
const commandInput = document.getElementById('commandInput');
const copyCmdBtn = document.getElementById('copyCmdBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const viewWallBtn = document.getElementById('viewWallBtn');
const viewPureBtn = document.getElementById('viewPureBtn');

// Initialize Drag & Drop
['dragenter', 'dragover'].forEach(eventName => {
  dropzone.addEventListener(eventName, e => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach(eventName => {
  dropzone.addEventListener(eventName, e => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  });
});

dropzone.addEventListener('drop', e => {
  const dt = e.dataTransfer;
  const files = dt.files;
  if (files.length > 0) handleFile(files[0]);
});

fileInput.addEventListener('change', e => {
  if (e.target.files.length > 0) handleFile(e.target.files[0]);
});

// Clipboard Paste (Ctrl+V)
window.addEventListener('paste', e => {
  const items = (e.clipboardData || e.originalEvent.clipboardData).items;
  for (let index in items) {
    const item = items[index];
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      handleFile(item.getAsFile());
      break;
    }
  }
});

function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Пожалуйста, выберите изображение (PNG, JPG, WEBP).');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      currentImage = img;
      renderPreview();
      generateBtn.disabled = false;
      emptyState.style.display = 'none';
      wallScene.style.display = 'flex';
      infoBar.style.display = 'flex';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// Size Buttons
sizeSelector.addEventListener('click', e => {
  const btn = e.target.closest('.size-btn');
  if (!btn) return;
  document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentWidthBlocks = parseInt(btn.dataset.w);
  currentHeightBlocks = parseInt(btn.dataset.h);
  if (currentImage) renderPreview();
});

// Toggles
ditherToggle.addEventListener('change', () => {
  if (currentImage) renderPreview();
});

gridToggle.addEventListener('change', () => {
  gridOverlay.style.display = gridToggle.checked ? 'block' : 'none';
});

// View Toggles
viewWallBtn.addEventListener('click', () => {
  viewWallBtn.classList.add('active');
  viewPureBtn.classList.remove('active');
  wallScene.style.backgroundImage = "linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), radial-gradient(#303642 1px, transparent 1px)";
});

viewPureBtn.addEventListener('click', () => {
  viewPureBtn.classList.add('active');
  viewWallBtn.classList.remove('active');
  wallScene.style.backgroundImage = "none";
});

// Render Preview on Canvas with Floyd-Steinberg Dithering
function renderPreview() {
  if (!currentImage) return;

  const targetWidth = currentWidthBlocks * 128;
  const targetHeight = currentHeightBlocks * 128;

  mainCanvas.width = targetWidth;
  mainCanvas.height = targetHeight;
  const ctx = mainCanvas.getContext('2d');

  // Scale and crop image to fill target aspect ratio
  const imgRatio = currentImage.width / currentImage.height;
  const targetRatio = targetWidth / targetHeight;
  let sx, sy, sWidth, sHeight;

  if (imgRatio > targetRatio) {
    sHeight = currentImage.height;
    sWidth = currentImage.height * targetRatio;
    sx = (currentImage.width - sWidth) / 2;
    sy = 0;
  } else {
    sWidth = currentImage.width;
    sHeight = currentImage.width / targetRatio;
    sx = 0;
    sy = (currentImage.height - sHeight) / 2;
  }

  ctx.drawImage(currentImage, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);

  // Apply Dithering if enabled
  if (ditherToggle.checked) {
    const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    applyFloydSteinberg(imgData.data, targetWidth, targetHeight);
    ctx.putImageData(imgData, 0, 0);
  }

  // Draw Grid Overlay
  renderGridOverlay(targetWidth, targetHeight);

  // Update Info Bar
  infoBlocks.textContent = `${currentWidthBlocks} × ${currentHeightBlocks} блоков`;
  infoMaps.textContent = `${currentWidthBlocks * currentHeightBlocks} карт`;
  infoResolution.textContent = `${targetWidth} × ${targetHeight} px`;
}

// Find nearest color in Minecraft palette
function findNearestPaletteColor(r, g, b) {
  let bestDist = Infinity;
  let bestColor = FULL_PALETTE[0];
  for (let i = 0; i < FULL_PALETTE.length; i++) {
    const pal = FULL_PALETTE[i];
    // Perceptually weighted Euclidean color distance
    const dr = r - pal[0];
    const dg = g - pal[1];
    const db = b - pal[2];
    const dist = dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114;
    if (dist < bestDist) {
      bestDist = dist;
      bestColor = pal;
    }
  }
  return bestColor;
}

// Floyd-Steinberg Error Diffusion Algorithm
function applyFloydSteinberg(data, width, height) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const oldR = data[idx];
      const oldG = data[idx + 1];
      const oldB = data[idx + 2];

      const nearest = findNearestPaletteColor(oldR, oldG, oldB);
      data[idx] = nearest[0];
      data[idx + 1] = nearest[1];
      data[idx + 2] = nearest[2];

      const errR = oldR - nearest[0];
      const errG = oldG - nearest[1];
      const errB = oldB - nearest[2];

      function distributeError(ox, oy, factor) {
        const nx = x + ox;
        const ny = y + oy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = (ny * width + nx) * 4;
          data[nIdx] = Math.min(255, Math.max(0, data[nIdx] + errR * factor));
          data[nIdx + 1] = Math.min(255, Math.max(0, data[nIdx + 1] + errG * factor));
          data[nIdx + 2] = Math.min(255, Math.max(0, data[nIdx + 2] + errB * factor));
        }
      }

      distributeError(1, 0, 7 / 16);
      distributeError(-1, 1, 3 / 16);
      distributeError(0, 1, 5 / 16);
      distributeError(1, 1, 1 / 16);
    }
  }
}

// Draw block grid overlay
function renderGridOverlay(width, height) {
  gridOverlay.innerHTML = '';
  if (!gridToggle.checked) return;

  const colWidthPct = 100 / currentWidthBlocks;
  const rowHeightPct = 100 / currentHeightBlocks;

  for (let r = 0; r < currentHeightBlocks; r++) {
    for (let c = 0; c < currentWidthBlocks; c++) {
      const cell = document.createElement('div');
      cell.style.position = 'absolute';
      cell.style.left = `${c * colWidthPct}%`;
      cell.style.top = `${r * rowHeightPct}%`;
      cell.style.width = `${colWidthPct}%`;
      cell.style.height = `${rowHeightPct}%`;
      cell.style.border = '1px dashed rgba(255, 255, 255, 0.4)';
      cell.style.boxSizing = 'border-box';
      gridOverlay.appendChild(cell);
    }
  }
}

// Generate Art Code Action (Real Cloud Upload with Offline Fallback)
generateBtn.addEventListener('click', async () => {
  const originalText = generateBtn.textContent;
  generateBtn.disabled = true;
  generateBtn.textContent = '⏳ Сохранение в облако nirhalla.online...';

  const dataUrl = mainCanvas.toDataURL('image/png');
  let code = null;

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: dataUrl,
        width: currentWidthBlocks,
        height: currentHeightBlocks
      })
    });

    if (res.ok) {
      const data = await res.json();
      code = data.code;
    } else {
      console.warn("Server responded with error:", res.status);
    }
  } catch (err) {
    console.warn("Network request failed (running in offline/local preview mode):", err);
  }

  // Fallback for offline testing or direct file preview
  if (!code) {
    code = Math.floor(1000 + Math.random() * 9000);
    // Store in localStorage for testing
    try {
      localStorage.setItem('art_' + code, JSON.stringify({
        code,
        image: dataUrl,
        width: currentWidthBlocks,
        height: currentHeightBlocks
      }));
    } catch(e) {}
  }

  resultCode.textContent = code;
  commandInput.value = `/art ${code}`;
  resultModal.style.display = 'flex';

  generateBtn.disabled = false;
  generateBtn.textContent = originalText;
  
  // Refresh gallery count
  loadGallery(false);
});

// Copy Command
copyCmdBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(commandInput.value).then(() => {
    copyCmdBtn.textContent = '✅ Скопировано!';
    setTimeout(() => {
      copyCmdBtn.textContent = '📋 Скопировать';
    }, 2000);
  });
});

// Close Modal
closeModalBtn.addEventListener('click', () => {
  resultModal.style.display = 'none';
});

resultModal.addEventListener('click', e => {
  if (e.target === resultModal) resultModal.style.display = 'none';
});

// ==========================================
// GALLERY & NAVIGATION TABS
// ==========================================
const tabEditorBtn = document.getElementById('tabEditorBtn');
const tabGalleryBtn = document.getElementById('tabGalleryBtn');
const editorView = document.getElementById('editorView');
const galleryView = document.getElementById('galleryView');
const galleryGrid = document.getElementById('galleryGrid');
const galleryEmpty = document.getElementById('galleryEmpty');
const galleryLoading = document.getElementById('galleryLoading');
const gallerySearchInput = document.getElementById('gallerySearchInput');
const refreshGalleryBtn = document.getElementById('refreshGalleryBtn');
const galleryCountBadge = document.getElementById('galleryCountBadge');

let cachedGalleryItems = [];

// Tab Switchers
tabEditorBtn.addEventListener('click', () => {
  tabEditorBtn.classList.add('active');
  tabGalleryBtn.classList.remove('active');
  editorView.style.display = 'block';
  galleryView.style.display = 'none';
});

tabGalleryBtn.addEventListener('click', () => {
  tabGalleryBtn.classList.add('active');
  tabEditorBtn.classList.remove('active');
  editorView.style.display = 'none';
  galleryView.style.display = 'flex';
  loadGallery();
});

refreshGalleryBtn.addEventListener('click', () => {
  loadGallery(true);
});

gallerySearchInput.addEventListener('input', () => {
  renderGalleryGrid();
});

// Load Gallery from Server / LocalStorage
async function loadGallery(showSpinner = true) {
  if (showSpinner) {
    galleryLoading.style.display = 'flex';
    galleryEmpty.style.display = 'none';
    galleryGrid.style.display = 'none';
  }

  let serverItems = [];

  try {
    const res = await fetch('/api/list');
    if (res.ok) {
      const data = await res.json();
      if (data.items && Array.isArray(data.items)) {
        serverItems = data.items;
      }
    }
  } catch (err) {
    console.warn("Could not fetch remote gallery:", err);
  }

  // Also include any items stored locally in localStorage
  const localMap = new Map();
  serverItems.forEach(item => localMap.set(String(item.code), item));

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('art_')) {
      try {
        const item = JSON.parse(localStorage.getItem(key));
        if (item && item.code && !localMap.has(String(item.code))) {
          localMap.set(String(item.code), item);
        }
      } catch (e) {}
    }
  }

  cachedGalleryItems = Array.from(localMap.values());
  cachedGalleryItems.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  galleryCountBadge.textContent = cachedGalleryItems.length;

  galleryLoading.style.display = 'none';
  renderGalleryGrid();
}

// Render Gallery Grid with Filter
function renderGalleryGrid() {
  galleryGrid.innerHTML = '';
  const query = (gallerySearchInput.value || '').trim().toLowerCase();

  const filtered = cachedGalleryItems.filter(item => {
    if (!query) return true;
    return String(item.code).toLowerCase().includes(query);
  });

  if (filtered.length === 0) {
    galleryEmpty.style.display = 'block';
    galleryGrid.style.display = 'none';
    return;
  }

  galleryEmpty.style.display = 'none';
  galleryGrid.style.display = 'grid';

  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'art-card';

    const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }) : 'Недавно';

    card.innerHTML = `
      <div class="art-card-thumb-wrap">
        <img class="art-card-thumb" src="${item.image}" alt="Холст #${item.code}">
      </div>
      <div class="art-card-body">
        <div class="art-card-header">
          <span class="art-card-code">#${item.code}</span>
          <span class="art-card-badge">${item.width} × ${item.height} блока</span>
        </div>
        <div class="art-card-meta">
          <span>${item.width * item.height} карт в наборе</span>
          <span>${dateStr}</span>
        </div>
        <div class="art-card-actions">
          <button class="btn-copy" data-code="${item.code}">
            📋 /art ${item.code}
          </button>
          <button class="btn-delete" data-code="${item.code}" title="Удалить холст">
            🗑️
          </button>
        </div>
      </div>
    `;

    // Copy Button Action
    const copyBtn = card.querySelector('.btn-copy');
    copyBtn.addEventListener('click', () => {
      const cmd = `/art ${item.code}`;
      navigator.clipboard.writeText(cmd).then(() => {
        copyBtn.textContent = '✅ Скопировано!';
        setTimeout(() => {
          copyBtn.textContent = `📋 ${cmd}`;
        }, 1500);
      });
    });

    // Delete Button Action
    const delBtn = card.querySelector('.btn-delete');
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Удалить холст #${item.code} из базы данных сайта?`)) return;

      try {
        await fetch(`/api/delete?code=${item.code}`, { method: 'POST' });
      } catch (e) {}

      localStorage.removeItem('art_' + item.code);
      cachedGalleryItems = cachedGalleryItems.filter(it => String(it.code) !== String(item.code));
      galleryCountBadge.textContent = cachedGalleryItems.length;
      renderGalleryGrid();
    });

    galleryGrid.appendChild(card);
  });
}

// Initial count fetch in background
loadGallery(false);

