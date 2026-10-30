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
let currentTier = "standard";
let currentFitMode = "cover"; // 'cover' (default: smart edge crop, NO distortion), 'contain', 'stretch'
let activeCategoryFilter = "all";
let cachedGalleryItems = [];

// Elements - Editor
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const tierNotice = document.getElementById('tierNotice');
const fitSelector = document.getElementById('fitSelector');
const artTitleInput = document.getElementById('artTitleInput');
const artCategorySelect = document.getElementById('artCategorySelect');
const ditherToggle = document.getElementById('ditherToggle');
const gridToggle = document.getElementById('gridToggle');
const tokenInput = document.getElementById('tokenInput');
const generateBtn = document.getElementById('generateBtn');

// Elements - Preview
const canvasWrapper = document.getElementById('canvasWrapper');
const emptyState = document.getElementById('emptyState');
const wallScene = document.getElementById('wallScene');
const frameContainer = document.getElementById('frameContainer');
const mainCanvas = document.getElementById('mainCanvas');
const gridOverlay = document.getElementById('gridOverlay');
const infoBar = document.getElementById('infoBar');
const infoBlocks = document.getElementById('infoBlocks');
const infoMaps = document.getElementById('infoMaps');
const infoTier = document.getElementById('infoTier');
const infoResolution = document.getElementById('infoResolution');
const viewWallBtn = document.getElementById('viewWallBtn');
const viewPureBtn = document.getElementById('viewPureBtn');

// Elements - Result Modal
const resultModal = document.getElementById('resultModal');
const resultCode = document.getElementById('resultCode');
const commandInput = document.getElementById('commandInput');
const copyCmdBtn = document.getElementById('copyCmdBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const duplicateNotice = document.getElementById('duplicateNotice');
const modalBadge = document.getElementById('modalBadge');
const modalCanvasReqText = document.getElementById('modalCanvasReqText');

// Elements - Navigation & Gallery
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
const categoryFilterBar = document.getElementById('categoryFilterBar');

// Elements - Staff Authentication & Dashboard
const staffLoginBtn = document.getElementById('staffLoginBtn');
const staffLoggedBox = document.getElementById('staffLoggedBox');
const staffUserPill = document.getElementById('staffUserPill');
const openStaffPanelBtn = document.getElementById('openStaffPanelBtn');
const staffLogoutBtn = document.getElementById('staffLogoutBtn');

const staffLoginModal = document.getElementById('staffLoginModal');
const closeStaffLoginModal = document.getElementById('closeStaffLoginModal');
const staffLoginForm = document.getElementById('staffLoginForm');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const doLoginBtn = document.getElementById('doLoginBtn');

const staffPanelModal = document.getElementById('staffPanelModal');
const closeStaffPanelModal = document.getElementById('closeStaffPanelModal');
const dashRoleBadge = document.getElementById('dashRoleBadge');
const tabDashTokens = document.getElementById('tabDashTokens');
const tabDashMods = document.getElementById('tabDashMods');
const tabDashAudit = document.getElementById('tabDashAudit');
const paneDashTokens = document.getElementById('paneDashTokens');
const paneDashMods = document.getElementById('paneDashMods');
const paneDashAudit = document.getElementById('paneDashAudit');

// Elements - Tokens Form & Table
const newTokenTier = document.getElementById('newTokenTier');
const newTokenPlayer = document.getElementById('newTokenPlayer');
const btnCreateTokenAction = document.getElementById('btnCreateTokenAction');
const btnRefreshTokens = document.getElementById('btnRefreshTokens');
const tokensTableBody = document.getElementById('tokensTableBody');

// Elements - Mods Form & Table
const newModUsername = document.getElementById('newModUsername');
const newModPassword = document.getElementById('newModPassword');
const btnCreateModAction = document.getElementById('btnCreateModAction');
const btnRefreshMods = document.getElementById('btnRefreshMods');
const modsTableBody = document.getElementById('modsTableBody');

// Elements - Audit Log Table
const btnRefreshAudit = document.getElementById('btnRefreshAudit');
const auditTableBody = document.getElementById('auditTableBody');

// ==========================================
// 1. DRAG & DROP / FILE INPUT
// ==========================================
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
    alert('Пожалуйста, выберите файл изображения (PNG, JPG, WEBP).');
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      currentImage = img;
      emptyState.style.display = 'none';
      wallScene.style.display = 'block';
      infoBar.style.display = 'flex';
      generateBtn.disabled = false;

      // Smart auto-orientation detection & recommendation
      detectAndSuggestOrientation(img);

      renderCanvas();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ==========================================
// 2. SIZE SELECTOR & ORIENTATION FILTER LOGIC
// ==========================================
function setupSizeSelectors() {
  const allSizeBtns = document.querySelectorAll('.size-btn');
  const orientTabs = document.querySelectorAll('.orient-tab');

  orientTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      orientTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const orient = tab.dataset.orient || 'all';
      filterSizesByOrientation(orient, true);
    });
  });

  allSizeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      allSizeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentWidthBlocks = parseInt(btn.dataset.w);
      currentHeightBlocks = parseInt(btn.dataset.h);
      currentTier = btn.dataset.tier || "standard";

      updateSizeInfo();
      if (currentImage) renderCanvas();
    });
  });
}

function filterSizesByOrientation(orient, autoSelectIfHidden = false) {
  const allSizeBtns = document.querySelectorAll('.size-btn');
  let hasActiveVisible = false;
  let firstVisible = null;

  allSizeBtns.forEach(btn => {
    const btnOrient = btn.dataset.orient;
    const isVisible = (orient === 'all' || btnOrient === orient);
    if (isVisible) {
      btn.style.display = 'flex';
      if (!firstVisible) firstVisible = btn;
      if (btn.classList.contains('active')) hasActiveVisible = true;
    } else {
      btn.style.display = 'none';
    }
  });

  // Hide empty groups if all buttons in that group are hidden
  ['sizeSelectorStandard', 'sizeSelectorGrand'].forEach(id => {
    const container = document.getElementById(id);
    if (container) {
      const prevTitle = container.previousElementSibling;
      const count = Array.from(container.querySelectorAll('.size-btn')).filter(b => b.style.display !== 'none').length;
      if (count === 0) {
        container.style.display = 'none';
        if (prevTitle && prevTitle.classList.contains('size-group-title')) prevTitle.style.display = 'none';
      } else {
        container.style.display = 'grid';
        if (prevTitle && prevTitle.classList.contains('size-group-title')) prevTitle.style.display = 'block';
      }
    }
  });

  if (!hasActiveVisible && firstVisible && autoSelectIfHidden) {
    allSizeBtns.forEach(b => b.classList.remove('active'));
    firstVisible.classList.add('active');
    currentWidthBlocks = parseInt(firstVisible.dataset.w);
    currentHeightBlocks = parseInt(firstVisible.dataset.h);
    currentTier = firstVisible.dataset.tier || "standard";
    updateSizeInfo();
    if (currentImage) renderCanvas();
  }
}

function detectAndSuggestOrientation(img) {
  const aspect = img.width / img.height;
  const orientTabs = document.querySelectorAll('.orient-tab');
  const autoNotice = document.getElementById('autoOrientNotice');
  let targetOrient = 'all';
  let noticeMsg = '';

  if (aspect <= 0.85) {
    targetOrient = 'vertical';
    noticeMsg = `📱 <strong>Распознан телефонный / портретный формат (${img.width}×${img.height})!</strong> Автоматически выбрана вертикальная сетка холстов (растягивается вверх и вниз без обрезки).`;
  } else if (aspect >= 1.25) {
    targetOrient = 'horizontal';
    noticeMsg = `🖥️ <strong>Распознан мониторный / альбомный формат (${img.width}×${img.height})!</strong> Выбраны горизонтальные холсты.`;
  } else {
    targetOrient = 'square';
    noticeMsg = `⬛ <strong>Распознан квадратный формат (${img.width}×${img.height})!</strong> Выбраны квадратные холсты.`;
  }

  // Switch active tab
  orientTabs.forEach(t => {
    if (t.dataset.orient === targetOrient) t.classList.add('active');
    else t.classList.remove('active');
  });

  filterSizesByOrientation(targetOrient, false);
  selectBestSizeForImage(img, targetOrient);

  if (autoNotice) {
    autoNotice.innerHTML = noticeMsg;
    autoNotice.style.display = 'block';
  }
}

function selectBestSizeForImage(img, orient) {
  const allSizeBtns = document.querySelectorAll('.size-btn');
  const visibleBtns = Array.from(allSizeBtns).filter(b => b.style.display !== 'none');
  if (visibleBtns.length === 0) return;

  const imgAspect = img.width / img.height;
  let bestBtn = visibleBtns[0];
  let minDiff = Infinity;

  visibleBtns.forEach(btn => {
    const w = parseInt(btn.dataset.w);
    const h = parseInt(btn.dataset.h);
    const btnAspect = (w * 128) / (h * 128);
    const diff = Math.abs(btnAspect - imgAspect);
    if (diff < minDiff) {
      minDiff = diff;
      bestBtn = btn;
    }
  });

  allSizeBtns.forEach(b => b.classList.remove('active'));
  bestBtn.classList.add('active');
  currentWidthBlocks = parseInt(bestBtn.dataset.w);
  currentHeightBlocks = parseInt(bestBtn.dataset.h);
  currentTier = bestBtn.dataset.tier || "standard";
  updateSizeInfo();
}

function updateSizeInfo() {
  const isGrand = (currentTier === "grand" || currentWidthBlocks > 3 || currentHeightBlocks > 3 || (currentWidthBlocks * currentHeightBlocks > 6));
  
  infoBlocks.textContent = `${currentWidthBlocks} × ${currentHeightBlocks} блоков`;
  infoMaps.textContent = `${currentWidthBlocks * currentHeightBlocks} карт`;
  infoTier.textContent = isGrand ? "👑 Великий" : "🖼️ Стандарт";
  infoTier.style.color = isGrand ? "#d8b4fe" : "#93c5fd";
  infoResolution.textContent = `${currentWidthBlocks * 128} × ${currentHeightBlocks * 128} px`;

  if (tierNotice) {
    if (isGrand) {
      tierNotice.className = "tier-warning-notice grand-alert";
      tierNotice.innerHTML = "👑 Для этого размера требуется токен <strong>«Великий холст Нирхаллы»</strong> (монументальный, до 8×5 / 5×8).";
    } else {
      tierNotice.className = "tier-warning-notice";
      tierNotice.innerHTML = "ℹ️ Для этого размера требуется токен <strong>«Имперский чистый холст»</strong> (до 6 блоков).";
    }
  }
}
setupSizeSelectors();

// ==========================================
// 3. FIT MODE SELECTOR (COVER / CONTAIN / STRETCH)
// ==========================================
if (fitSelector) {
  const fitBtns = fitSelector.querySelectorAll('.fit-btn');
  fitBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      fitBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFitMode = btn.dataset.fit || 'cover';
      if (currentImage) renderCanvas();
    });
  });
}

// Draw Image onto Canvas with Smart Fitting Modes
function drawImageToCanvas(ctx, img, targetW, targetH, mode = 'cover') {
  ctx.clearRect(0, 0, targetW, targetH);

  if (mode === 'stretch') {
    // Direct stretch
    ctx.drawImage(img, 0, 0, targetW, targetH);
    return;
  }

  const imgW = img.width;
  const imgH = img.height;
  const imgRatio = imgW / imgH;
  const targetRatio = targetW / targetH;

  if (mode === 'cover') {
    // ✂️ УМНОЕ ЗАПОЛНЕНИЕ (КАК БЫЛО РАНЬШЕ):
    // Сохраняет 100% исходных пропорций без растяжения лиц/объектов!
    // Симметрично центрирует и обрезает выступающие края, холст заполнен полностью.
    let sx, sy, sW, sH;
    if (imgRatio > targetRatio) {
      // Исходник шире холста: режем лишнее слева и справа
      sH = imgH;
      sW = imgH * targetRatio;
      sx = (imgW - sW) / 2;
      sy = 0;
    } else {
      // Исходник выше холста: режем лишнее сверху и снизу
      sW = imgW;
      sH = imgW / targetRatio;
      sx = 0;
      sy = (imgH - sH) / 2;
    }
    ctx.drawImage(img, sx, sy, sW, sH, 0, 0, targetW, targetH);
  } else if (mode === 'contain') {
    // 🖼️ ВПИСАТЬ ЦЕЛИКОМ (100% картинки без обрезки)
    ctx.fillStyle = '#181920';
    ctx.fillRect(0, 0, targetW, targetH);

    let dx, dy, dW, dH;
    if (imgRatio > targetRatio) {
      dW = targetW;
      dH = targetW / imgRatio;
      dx = 0;
      dy = (targetH - dH) / 2;
    } else {
      dH = targetH;
      dW = targetH * imgRatio;
      dx = (targetW - dW) / 2;
      dy = 0;
    }
    ctx.drawImage(img, 0, 0, imgW, imgH, dx, dy, dW, dH);
  }
}

// ==========================================
// 4. CANVAS RENDERING & DITHERING
// ==========================================
ditherToggle.addEventListener('change', () => {
  if (currentImage) renderCanvas();
});

gridToggle.addEventListener('change', () => {
  if (currentImage) renderCanvas();
});

function renderCanvas() {
  if (!currentImage) return;

  const targetW = currentWidthBlocks * 128;
  const targetH = currentHeightBlocks * 128;

  mainCanvas.width = targetW;
  mainCanvas.height = targetH;

  // Рассчитываем пропорциональный размер предпросмотра на стене,
  // чтобы картина всегда выглядела четко и красиво в деревянной рамке
  const maxDisplayW = 540;
  const maxDisplayH = 420;
  const aspect = targetW / targetH;
  let dispW, dispH;
  if (aspect > maxDisplayW / maxDisplayH) {
    dispW = maxDisplayW;
    dispH = maxDisplayW / aspect;
  } else {
    dispH = maxDisplayH;
    dispW = maxDisplayH * aspect;
  }

  const dispWRounded = Math.round(dispW);
  const dispHRounded = Math.round(dispH);

  if (frameContainer) {
    frameContainer.style.width = `${dispWRounded}px`;
    frameContainer.style.height = `${dispHRounded}px`;
  }
  mainCanvas.style.width = `${dispWRounded}px`;
  mainCanvas.style.height = `${dispHRounded}px`;

  const ctx = mainCanvas.getContext('2d');
  drawImageToCanvas(ctx, currentImage, targetW, targetH, currentFitMode);

  if (ditherToggle.checked) {
    applyFloydSteinbergDithering(ctx, targetW, targetH);
  }

  renderGridOverlay();
}

function findClosestColor(r, g, b) {
  let minDistance = Infinity;
  let closest = FULL_PALETTE[0];

  for (let i = 0; i < FULL_PALETTE.length; i++) {
    const pal = FULL_PALETTE[i];
    const dr = r - pal[0];
    const dg = g - pal[1];
    const db = b - pal[2];
    const dist = dr * dr * 2 + dg * dg * 4 + db * db * 3;
    if (dist < minDistance) {
      minDistance = dist;
      closest = pal;
      if (dist === 0) break;
    }
  }
  return closest;
}

function applyFloydSteinbergDithering(ctx, width, height) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const oldR = data[idx];
      const oldG = data[idx + 1];
      const oldB = data[idx + 2];

      const [newR, newG, newB] = findClosestColor(oldR, oldG, oldB);

      data[idx] = newR;
      data[idx + 1] = newG;
      data[idx + 2] = newB;

      const errR = oldR - newR;
      const errG = oldG - newG;
      const errB = oldB - newB;

      const distributeError = (dx, dy, factor) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny < height) {
          const nIdx = (ny * width + nx) * 4;
          data[nIdx] = Math.min(255, Math.max(0, data[nIdx] + errR * factor));
          data[nIdx + 1] = Math.min(255, Math.max(0, data[nIdx + 1] + errG * factor));
          data[nIdx + 2] = Math.min(255, Math.max(0, data[nIdx + 2] + errB * factor));
        }
      };

      distributeError(1, 0, 7 / 16);
      distributeError(-1, 1, 3 / 16);
      distributeError(0, 1, 5 / 16);
      distributeError(1, 1, 1 / 16);
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

function renderGridOverlay() {
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

viewWallBtn.addEventListener('click', () => {
  viewWallBtn.classList.add('active');
  viewPureBtn.classList.remove('active');
  wallScene.style.background = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'64\' height=\'64\' fill=\'%23141720\'><rect width=\'64\' height=\'64\' fill=\'%231a1e29\'/><rect width=\'30\' height=\'30\' fill=\'%231f2430\'/><rect x=\'32\' y=\'32\' width=\'30\' height=\'30\' fill=\'%231f2430\'/></svg>") repeat';
});

viewPureBtn.addEventListener('click', () => {
  viewPureBtn.classList.add('active');
  viewWallBtn.classList.remove('active');
  wallScene.style.background = 'transparent';
});

// ==========================================
// 4. UPLOAD / PUBLISH LOGIC
// ==========================================
generateBtn.addEventListener('click', async () => {
  if (generateBtn.disabled) return;

  const originalText = generateBtn.textContent;
  generateBtn.disabled = true;
  generateBtn.textContent = '⏳ Сохранение в облако nirhalla.online...';

  const dataUrl = mainCanvas.toDataURL('image/png');
  const enteredToken = tokenInput ? tokenInput.value.trim() : '';
  const title = (artTitleInput ? artTitleInput.value.trim() : '');
  const category = (artCategorySelect ? artCategorySelect.value : 'art');

  const session = getStoredSession();
  const sessionToken = session ? session.token : '';

  let code = null;
  let isDuplicate = false;
  let isGrand = (currentWidthBlocks > 3 || currentHeightBlocks > 3 || (currentWidthBlocks * currentHeightBlocks > 6));

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': sessionToken
      },
      body: JSON.stringify({
        image: dataUrl,
        width: currentWidthBlocks,
        height: currentHeightBlocks,
        token: enteredToken,
        title,
        category,
        sessionToken
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert('❌ Ошибка публикации:\n' + (data.error || 'Требуется действительный Токен загрузки!'));
      generateBtn.disabled = false;
      generateBtn.textContent = originalText;
      return;
    }

    code = data.code;
    isDuplicate = Boolean(data.isDuplicate);
    if (data.tier === 'grand') isGrand = true;
  } catch (err) {
    console.warn("Network request failed:", err);
    alert('Ошибка соединения с сервером при загрузке картины.');
    generateBtn.disabled = false;
    generateBtn.textContent = originalText;
    return;
  }

  resultCode.textContent = code;
  commandInput.value = `/art ${code}`;

  if (duplicateNotice) {
    duplicateNotice.style.display = isDuplicate ? 'block' : 'none';
  }
  if (modalBadge) {
    modalBadge.textContent = isDuplicate ? 'АРТ УЖЕ В БАЗЕ' : 'ГОТОВО К УСТАНОВКЕ';
    modalBadge.style.background = isDuplicate ? 'rgba(59, 130, 246, 0.25)' : 'rgba(245, 158, 11, 0.2)';
    modalBadge.style.color = isDuplicate ? '#93c5fd' : 'var(--accent-gold)';
  }
  if (modalCanvasReqText) {
    modalCanvasReqText.textContent = isGrand ? '«Великий холст Нирхаллы»' : '«Имперский чистый холст»';
  }

  resultModal.style.display = 'flex';

  // Cooldown
  let cooldownSec = 4;
  generateBtn.textContent = `⏳ Подождите (${cooldownSec}с)...`;
  const cooldownInterval = setInterval(() => {
    cooldownSec--;
    if (cooldownSec <= 0) {
      clearInterval(cooldownInterval);
      generateBtn.disabled = false;
      generateBtn.textContent = originalText;
    } else {
      generateBtn.textContent = `⏳ Подождите (${cooldownSec}с)...`;
    }
  }, 1000);

  loadGallery(false);
});

copyCmdBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(commandInput.value).then(() => {
    copyCmdBtn.textContent = '✅ Скопировано!';
    setTimeout(() => {
      copyCmdBtn.textContent = '📋 Скопировать';
    }, 2000);
  });
});

closeModalBtn.addEventListener('click', () => {
  resultModal.style.display = 'none';
});

resultModal.addEventListener('click', e => {
  if (e.target === resultModal) resultModal.style.display = 'none';
});

// ==========================================
// 5. STAFF AUTHENTICATION (Niral + Mods)
// ==========================================
function getStoredSession() {
  try {
    const raw = sessionStorage.getItem('nirhalla_session') || localStorage.getItem('nirhalla_session');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setStoredSession(session) {
  if (session) {
    sessionStorage.setItem('nirhalla_session', JSON.stringify(session));
    localStorage.setItem('nirhalla_session', JSON.stringify(session));
  } else {
    sessionStorage.removeItem('nirhalla_session');
    localStorage.removeItem('nirhalla_session');
  }
  updateStaffUI();
}

function updateStaffUI() {
  const session = getStoredSession();
  if (session && session.token) {
    if (staffLoginBtn) staffLoginBtn.style.display = 'none';
    if (staffLoggedBox) staffLoggedBox.style.display = 'flex';
    if (staffUserPill) {
      staffUserPill.textContent = `${session.role === 'admin' ? '👑' : '🛡️'} ${session.username}`;
    }
    if (dashRoleBadge) {
      dashRoleBadge.textContent = session.role === 'admin' ? 'Владелец Niral' : `Модератор ${session.username}`;
    }
    // Show Admin tabs only for Niral
    const isAdmin = (session.role === 'admin');
    if (tabDashMods) tabDashMods.style.display = isAdmin ? 'block' : 'none';
    if (tabDashAudit) tabDashAudit.style.display = isAdmin ? 'block' : 'none';
  } else {
    if (staffLoginBtn) staffLoginBtn.style.display = 'inline-flex';
    if (staffLoggedBox) staffLoggedBox.style.display = 'none';
  }
}

async function verifySavedSession() {
  const session = getStoredSession();
  if (!session || !session.token) return;

  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify_session', sessionToken: session.token })
    });
    const data = await res.json();
    if (!res.ok || !data.valid) {
      setStoredSession(null);
    }
  } catch (e) {
    console.warn("Session verification offline or failed:", e);
  }
}

if (staffLoginBtn) {
  staffLoginBtn.addEventListener('click', () => {
    staffLoginModal.style.display = 'flex';
    loginUsername.focus();
  });
}

if (closeStaffLoginModal) {
  closeStaffLoginModal.addEventListener('click', () => {
    staffLoginModal.style.display = 'none';
  });
}

staffLoginModal.addEventListener('click', e => {
  if (e.target === staffLoginModal) staffLoginModal.style.display = 'none';
});

if (staffLoginForm) {
  staffLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = loginUsername.value.trim();
    const password = loginPassword.value;

    if (!username || !password) {
      alert('Введите логин и пароль!');
      return;
    }

    doLoginBtn.disabled = true;
    doLoginBtn.textContent = '⏳ Авторизация...';

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username, password })
      });

      const data = await res.json();
      doLoginBtn.disabled = false;
      doLoginBtn.textContent = 'Войти в систему';

      if (!res.ok || !data.success) {
        alert('❌ Ошибка входа: ' + (data.error || 'Неверный логин или пароль'));
        return;
      }

      setStoredSession({
        token: data.sessionToken,
        username: data.username,
        role: data.role
      });

      staffLoginModal.style.display = 'none';
      alert(`✅ ${data.message}`);

      // Refresh gallery to show audit badges for staff
      loadGallery(false);
      openStaffPanel();
    } catch (err) {
      doLoginBtn.disabled = false;
      doLoginBtn.textContent = 'Войти в систему';
      alert('Ошибка соединения с сервером при входе.');
    }
  });
}

if (staffLogoutBtn) {
  staffLogoutBtn.addEventListener('click', async () => {
    if (!confirm('Выйти из панели персонала?')) return;
    const session = getStoredSession();
    if (session && session.token) {
      try {
        await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'logout', sessionToken: session.token })
        });
      } catch (e) {}
    }
    setStoredSession(null);
    staffPanelModal.style.display = 'none';
    loadGallery(false);
  });
}

// ==========================================
// 6. STAFF DASHBOARD MODAL & TABS
// ==========================================
function openStaffPanel() {
  staffPanelModal.style.display = 'flex';
  switchDashTab('tokens');
  loadTokensTable();
}

if (openStaffPanelBtn) {
  openStaffPanelBtn.addEventListener('click', openStaffPanel);
}

if (closeStaffPanelModal) {
  closeStaffPanelModal.addEventListener('click', () => {
    staffPanelModal.style.display = 'none';
  });
}

staffPanelModal.addEventListener('click', e => {
  if (e.target === staffPanelModal) staffPanelModal.style.display = 'none';
});

function switchDashTab(tabName) {
  tabDashTokens.classList.toggle('active', tabName === 'tokens');
  tabDashMods.classList.toggle('active', tabName === 'mods');
  tabDashAudit.classList.toggle('active', tabName === 'audit');

  paneDashTokens.classList.toggle('active', tabName === 'tokens');
  paneDashMods.classList.toggle('active', tabName === 'mods');
  paneDashAudit.classList.toggle('active', tabName === 'audit');

  if (tabName === 'tokens') loadTokensTable();
  if (tabName === 'mods') loadModsTable();
  if (tabName === 'audit') loadAuditTable();
}

tabDashTokens.addEventListener('click', () => switchDashTab('tokens'));
tabDashMods.addEventListener('click', () => switchDashTab('mods'));
tabDashAudit.addEventListener('click', () => switchDashTab('audit'));

// 6.1 TOKENS MANAGEMENT
async function loadTokensTable() {
  const session = getStoredSession();
  if (!session) return;

  tokensTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Загрузка токенов...</td></tr>';

  try {
    const res = await fetch('/api/tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': session.token
      },
      body: JSON.stringify({ action: 'list', sessionToken: session.token })
    });

    const data = await res.json();
    if (!res.ok) {
      tokensTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">${data.error || 'Ошибка загрузки'}</td></tr>`;
      return;
    }

    if (!data.tokens || data.tokens.length === 0) {
      tokensTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Нет активных токенов. Выпустите новый токен выше.</td></tr>';
      return;
    }

    tokensTableBody.innerHTML = '';
    data.tokens.forEach(t => {
      const tr = document.createElement('tr');
      const isGrand = (t.tier === 'grand');
      const dateStr = t.createdAt ? new Date(t.createdAt).toLocaleDateString('ru-RU', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      }) : 'Недавно';

      tr.innerHTML = `
        <td><span class="token-code-text" title="Нажмите, чтобы скопировать">🎫 ${t.token}</span></td>
        <td><span class="art-card-tier-badge ${isGrand ? 'grand' : 'standard'}">${isGrand ? '👑 Великий (до 8х5)' : '🖼️ Стандарт (до 3х2)'}</span></td>
        <td><strong>${escapeHtml(t.targetPlayer || 'Не указан')}</strong></td>
        <td>${escapeHtml(t.issuedBy || 'Админ')}</td>
        <td>${dateStr}</td>
        <td><button class="btn btn-danger-soft btn-sm btn-del-token" data-tok="${t.token}">Удалить</button></td>
      `;

      // Copy token on click
      tr.querySelector('.token-code-text').addEventListener('click', () => {
        navigator.clipboard.writeText(t.token).then(() => {
          alert(`✅ Токен ${t.token} скопирован в буфер обмена! Передайте его игроку ${t.targetPlayer || ''}.`);
        });
      });

      // Delete token
      tr.querySelector('.btn-del-token').addEventListener('click', async () => {
        if (!confirm(`Удалить неиспользованный токен ${t.token}?`)) return;
        await fetch('/api/tokens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Session-Token': session.token },
          body: JSON.stringify({ action: 'delete', token: t.token, sessionToken: session.token })
        });
        loadTokensTable();
      });

      tokensTableBody.appendChild(tr);
    });
  } catch (err) {
    tokensTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Ошибка соединения с сервером</td></tr>';
  }
}

if (btnCreateTokenAction) {
  btnCreateTokenAction.addEventListener('click', async () => {
    const session = getStoredSession();
    if (!session) return;

    const tier = newTokenTier.value;
    const targetPlayer = newTokenPlayer.value.trim();

    btnCreateTokenAction.disabled = true;
    btnCreateTokenAction.textContent = '⏳ Выпуск...';

    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': session.token
        },
        body: JSON.stringify({ action: 'create', tier, targetPlayer, sessionToken: session.token })
      });

      const data = await res.json();
      btnCreateTokenAction.disabled = false;
      btnCreateTokenAction.textContent = '✨ Выпустить токен';

      if (res.ok && data.token) {
        navigator.clipboard.writeText(data.token);
        newTokenPlayer.value = '';
        alert(`🎉 Токен ${data.token} успешно создан и скопирован в буфер!\n\nТип: ${tier === 'grand' ? 'Великий (до 8х5)' : 'Стандартный (до 3х2)'}\nИгрок: ${data.targetPlayer}\n\nПередайте его игроку для загрузки.`);
        loadTokensTable();
      } else {
        alert('Ошибка: ' + (data.error || 'Не удалось выпустить токен'));
      }
    } catch (e) {
      btnCreateTokenAction.disabled = false;
      btnCreateTokenAction.textContent = '✨ Выпустить токен';
      alert('Ошибка соединения с сервером.');
    }
  });
}

if (btnRefreshTokens) {
  btnRefreshTokens.addEventListener('click', loadTokensTable);
}

// 6.2 MODERATORS MANAGEMENT & IP MONITORING (Admin Only)
async function loadModsTable() {
  const session = getStoredSession();
  if (!session || session.role !== 'admin') return;

  modsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Загрузка модераторов...</td></tr>';

  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': session.token
      },
      body: JSON.stringify({ action: 'list_mods', sessionToken: session.token })
    });

    const data = await res.json();
    if (!res.ok) {
      modsTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">${data.error || 'Ошибка доступа'}</td></tr>`;
      return;
    }

    if (!data.mods || data.mods.length === 0) {
      modsTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Модераторы еще не добавлены. Создайте аккаунт выше.</td></tr>';
      return;
    }

    modsTableBody.innerHTML = '';
    data.mods.forEach(m => {
      const tr = document.createElement('tr');
      const isBlocked = (m.status === 'blocked');
      const ipCount = (m.knownIPs && m.knownIPs.length > 0) ? m.knownIPs.length : (m.ipChangeCount || 0);

      // Safe vs Suspicious IP badge
      let ipBadgeHtml = '';
      if (ipCount <= 1) {
        ipBadgeHtml = `<span class="ip-badge-safe">🟢 1 IP (Безопасно)</span>`;
      } else {
        ipBadgeHtml = `<span class="ip-badge-warn" title="Аккаунт использовался с разных IP! Проверьте передачу пароля третьим лицам">⚠️ ${ipCount} IP (Внимание!)</span>`;
      }

      const ipListStr = (m.knownIPs && m.knownIPs.length > 0) ? m.knownIPs.join(', ') : (m.lastIP || 'Еще не входил');
      const lastLoginStr = m.lastLogin ? new Date(m.lastLogin).toLocaleDateString('ru-RU', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      }) : 'Никогда';

      tr.innerHTML = `
        <td><strong>🛡️ ${escapeHtml(m.username)}</strong></td>
        <td><span class="${isBlocked ? 'status-blocked' : 'status-active'}">${isBlocked ? '🛑 Заблокирован' : '✅ Активен'}</span></td>
        <td>${ipBadgeHtml}</td>
        <td><small style="font-family: monospace; color: var(--text-muted);">${escapeHtml(ipListStr)}</small></td>
        <td>${lastLoginStr}</td>
        <td>
          <button class="btn btn-sm btn-secondary btn-toggle-mod" data-user="${m.username}">
            ${isBlocked ? 'Разморозить' : 'Заморозить'}
          </button>
          <button class="btn btn-sm btn-danger-soft btn-del-mod" data-user="${m.username}">
            Удалить
          </button>
        </td>
      `;

      // Toggle Freeze
      tr.querySelector('.btn-toggle-mod').addEventListener('click', async () => {
        await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Session-Token': session.token },
          body: JSON.stringify({ action: 'toggle_mod', modUsername: m.username, sessionToken: session.token })
        });
        loadModsTable();
      });

      // Delete Mod
      tr.querySelector('.btn-del-mod').addEventListener('click', async () => {
        if (!confirm(`Удалить модератора ${m.username}? Он больше не сможет входить.`)) return;
        await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Session-Token': session.token },
          body: JSON.stringify({ action: 'delete_mod', modUsername: m.username, sessionToken: session.token })
        });
        loadModsTable();
      });

      modsTableBody.appendChild(tr);
    });
  } catch (err) {
    modsTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Ошибка соединения с сервером</td></tr>';
  }
}

if (btnCreateModAction) {
  btnCreateModAction.addEventListener('click', async () => {
    const session = getStoredSession();
    if (!session || session.role !== 'admin') return;

    const modUsername = newModUsername.value.trim();
    const modPassword = newModPassword.value.trim();

    if (!modUsername || !modPassword) {
      alert('Введите логин и пароль нового модератора!');
      return;
    }

    btnCreateModAction.disabled = true;
    btnCreateModAction.textContent = '⏳ Создание...';

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': session.token
        },
        body: JSON.stringify({ action: 'create_mod', modUsername, modPassword, sessionToken: session.token })
      });

      const data = await res.json();
      btnCreateModAction.disabled = false;
      btnCreateModAction.textContent = '➕ Добавить';

      if (res.ok && data.success) {
        newModUsername.value = '';
        newModPassword.value = '';
        alert(`✅ ${data.message}`);
        loadModsTable();
      } else {
        alert('Ошибка: ' + (data.error || 'Не удалось создать модератора'));
      }
    } catch (e) {
      btnCreateModAction.disabled = false;
      btnCreateModAction.textContent = '➕ Добавить';
      alert('Ошибка соединения с сервером.');
    }
  });
}

if (btnRefreshMods) {
  btnRefreshMods.addEventListener('click', loadModsTable);
}

// 6.3 AUDIT LOG (Admin Only)
async function loadAuditTable() {
  const session = getStoredSession();
  if (!session || session.role !== 'admin') return;

  auditTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Загрузка журнала...</td></tr>';

  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': session.token
      },
      body: JSON.stringify({ action: 'get_audit_log', sessionToken: session.token })
    });

    const data = await res.json();
    if (!res.ok) {
      auditTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">${data.error || 'Ошибка доступа'}</td></tr>`;
      return;
    }

    if (!data.logs || data.logs.length === 0) {
      auditTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Журнал безопасности пуст.</td></tr>';
      return;
    }

    auditTableBody.innerHTML = '';
    data.logs.forEach(l => {
      const tr = document.createElement('tr');
      const timeStr = l.timestamp ? new Date(l.timestamp).toLocaleDateString('ru-RU', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
      }) : '—';

      let typeBadge = l.type;
      if (l.type === 'ADMIN_LOGIN') typeBadge = '👑 Админ Вход';
      else if (l.type === 'MOD_LOGIN') typeBadge = '🛡️ Модер Вход';
      else if (l.type === 'MOD_NEW_IP') typeBadge = '⚠️ НОВЫЙ IP';
      else if (l.type === 'FAILED_LOGIN') typeBadge = '❌ Ошибка Входа';
      else if (l.type === 'ART_UPLOAD') typeBadge = '🖼️ Загрузка Арта';
      else if (l.type === 'ART_DELETE') typeBadge = '🗑️ Удаление';
      else if (l.type === 'CREATE_TOKEN') typeBadge = '🎫 Токен';

      tr.innerHTML = `
        <td style="white-space: nowrap;"><small>${timeStr}</small></td>
        <td><strong>${typeBadge}</strong></td>
        <td>${escapeHtml(l.username || '—')}</td>
        <td><code style="color: #93c5fd;">${escapeHtml(l.ip || '—')}</code></td>
        <td>${escapeHtml(l.text || '')}</td>
      `;

      auditTableBody.appendChild(tr);
    });
  } catch (err) {
    auditTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Ошибка загрузки журнала</td></tr>';
  }
}

if (btnRefreshAudit) {
  btnRefreshAudit.addEventListener('click', loadAuditTable);
}

// ==========================================
// 7. GALLERY & CATEGORIES
// ==========================================
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

// Category pills listener
if (categoryFilterBar) {
  const catPills = categoryFilterBar.querySelectorAll('.cat-pill');
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeCategoryFilter = pill.dataset.cat || 'all';
      renderGalleryGrid();
    });
  });
}

// Load Gallery from Server
async function loadGallery(showSpinner = true) {
  if (showSpinner) {
    galleryLoading.style.display = 'flex';
    galleryEmpty.style.display = 'none';
    galleryGrid.style.display = 'none';
  }

  const session = getStoredSession();
  const sessionToken = session ? session.token : '';

  let serverItems = [];

  try {
    const res = await fetch('/api/list', {
      headers: {
        'X-Session-Token': sessionToken
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.items && Array.isArray(data.items)) {
        serverItems = data.items;
      }
    }
  } catch (err) {
    console.warn("Could not fetch remote gallery:", err);
  }

  // Also include any items stored locally in localStorage (for offline/preview)
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

function getCategoryName(cat) {
  switch (cat) {
    case 'nirhalla': return '🏛️ Нирхалла';
    case 'landscape': return '🌄 Пейзажи';
    case 'memes': return '😂 Мемы';
    case 'interior': return '🪧 Интерьер';
    case 'art': default: return '🎨 Арт';
  }
}

// Render Gallery Grid with Search and Category Filter
function renderGalleryGrid() {
  galleryGrid.innerHTML = '';
  const query = (gallerySearchInput.value || '').trim().toLowerCase();
  const session = getStoredSession();
  const isStaff = Boolean(session && session.token);

  const filtered = cachedGalleryItems.filter(item => {
    // Category match
    if (activeCategoryFilter !== 'all') {
      const itemCat = item.category || 'art';
      if (itemCat !== activeCategoryFilter) return false;
    }

    // Query match (code, title, author, targetPlayer)
    if (!query) return true;
    const matchCode = String(item.code).toLowerCase().includes(query);
    const matchTitle = (item.title || '').toLowerCase().includes(query);
    const matchPlayer = (item.audit && item.audit.targetPlayer ? item.audit.targetPlayer.toLowerCase().includes(query) : false);

    return matchCode || matchTitle || matchPlayer;
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

    const isGrand = (item.tier === 'grand' || item.width > 3 || item.height > 3 || (item.width * item.height > 6));
    const catName = getCategoryName(item.category);
    const thumbSrc = item.imageUrl || item.image || `/api/get?code=${item.code}&format=png`;

    const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }) : 'Недавно';

    // Staff Audit Box
    let auditHtml = '';
    if (isStaff && item.audit) {
      auditHtml = `
        <div class="art-audit-box">
          <div class="art-audit-row">
            <span class="art-audit-label">👤 Игрок:</span>
            <span class="art-audit-val">${escapeHtml(item.audit.targetPlayer || 'Не указан')}</span>
          </div>
          <div class="art-audit-row">
            <span class="art-audit-label">🌐 IP автора:</span>
            <span class="art-audit-val">${escapeHtml(item.audit.uploaderIP || 'Скрыт')}</span>
          </div>
          <div class="art-audit-row">
            <span class="art-audit-label">🎫 Токен:</span>
            <span class="art-audit-val">${escapeHtml(item.audit.usedToken || '—')} (от ${escapeHtml(item.audit.tokenIssuedBy || 'Админ')})</span>
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="art-card-thumb-wrap">
        <img class="art-card-thumb" src="${thumbSrc}" alt="Холст #${item.code}" loading="lazy">
      </div>
      <div class="art-card-body">
        <div class="art-card-header">
          <span class="art-card-code">#${item.code}</span>
          <div style="display: flex; gap: 0.35rem; align-items: center;">
            <span class="art-card-category-tag">${catName}</span>
            <span class="art-card-tier-badge ${isGrand ? 'grand' : 'standard'}">${isGrand ? '👑 Великий' : '🖼️ Стандарт'}</span>
          </div>
        </div>
        <div class="art-card-title">${escapeHtml(item.title || `Холст #${item.code}`)}</div>
        <div class="art-card-meta">
          <span>${item.width} × ${item.height} блока (${item.width * item.height} карт)</span>
          <span>${dateStr}</span>
        </div>
        ${auditHtml}
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

    // Copy Button
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

    // Delete Button
    const delBtn = card.querySelector('.btn-delete');
    delBtn.addEventListener('click', async () => {
      const currentSession = getStoredSession();
      if (!currentSession) {
        staffLoginModal.style.display = 'flex';
        alert('🔒 Для удаления картин требуется войти под аккаунтом персонала.');
        return;
      }

      if (!confirm(`Вы уверены, что хотите удалить холст #${item.code} из базы данных сервера?`)) return;

      try {
        const res = await fetch(`/api/delete?code=${item.code}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': currentSession.token
          },
          body: JSON.stringify({ code: item.code, sessionToken: currentSession.token })
        });

        if (res.status === 403) {
          alert('❌ Ошибка: Сессия истекла или недостаточно прав!');
          setStoredSession(null);
          return;
        }

        if (!res.ok) {
          alert('Ошибка удаления: ' + res.statusText);
          return;
        }

        alert(`✅ Холст #${item.code} успешно удален из базы!`);
        localStorage.removeItem('art_' + item.code);
        cachedGalleryItems = cachedGalleryItems.filter(it => String(it.code) !== String(item.code));
        galleryCountBadge.textContent = cachedGalleryItems.length;
        renderGalleryGrid();
      } catch (e) {
        alert('Ошибка соединения с сервером при удалении.');
      }
    });

    galleryGrid.appendChild(card);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Initial session check and gallery load
updateStaffUI();
verifySavedSession();
loadGallery(false);
