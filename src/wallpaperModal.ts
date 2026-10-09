import { wallpaperManager, WALLPAPER_PRESETS } from "./wallpaper";
import {
  BLOCK_STYLE_PRESETS,
  getBlockStyle,
  setBlockStyle,
  BlockStyle,
} from "./gameFunctions";
import {
  getPhotoRevealMode,
  setPhotoRevealMode,
  isPhotoRevealUnlocked,
  PhotoRevealMode,
} from "./photoReveal";

let modalEl: HTMLElement | null = null;
let toastTimeout: any = null;

function showToast(message: string) {
  const toastEl = document.getElementById("wallpaperStatusToast");
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.style.display = "flex";
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    if (toastEl) toastEl.style.display = "none";
  }, 3500);
}

export function createWallpaperModal() {
  if (modalEl) return;

  modalEl = document.createElement("div");
  modalEl.className = "modal-overlay";
  modalEl.id = "wallpaperModal";

  modalEl.innerHTML = `
    <div class="modal wallpaper-modal">
      <button class="modal-close-corner" id="closeWallpaperBtn" aria-label="Close">✕</button>
      <div class="modal-badge wallpaper-badge">🎨 CUSTOMIZE LOOK & FEEL</div>
      <h2 class="modal-title">Themes & Block Skins</h2>
      <p class="pretourney-subtitle">Choose authentic block skins, board themes, or custom photos (Tournament mode uses official Sponsor Wallpaper)</p>

      <div id="wallpaperStatusToast" class="wallpaper-status-toast" style="display: none;"></div>

      <!-- Block Skin Styles -->
      <div class="wallpaper-section-title">🧱 BLOCK SKINS & TEXTURES</div>
      <div id="blockStylesGrid" class="wallpaper-presets-grid" style="margin-bottom: 16px;"></div>

      <!-- Preset Themes Grid -->
      <div class="wallpaper-section-title">✨ POPULAR BOARD THEMES</div>
      <div id="wallpaperPresetsGrid" class="wallpaper-presets-grid"></div>

      <!-- Custom Photo Section -->
      <div class="wallpaper-section-title" style="margin-top: 14px;">📸 CUSTOM PHOTO WALLPAPER</div>
      <div class="wallpaper-custom-card">
        <input type="file" id="wallpaperFileInput" accept="image/*" style="display: none;" />
        
        <div id="wallpaperUploadPrompt" class="upload-prompt-row">
          <button id="uploadWallpaperBtn" class="modal-button upload-photo-btn">
            📷 Upload Photo from Device
          </button>
          <span class="upload-hint">100% private • Stored locally in your browser</span>
        </div>

        <div id="wallpaperActiveCustomRow" class="active-custom-row" style="display: none;">
          <div class="custom-thumb-wrap">
            <img id="customWallpaperThumb" class="custom-wallpaper-thumb" alt="Custom Preview" />
          </div>
          <div class="custom-controls-wrap">
            <div class="dimming-slider-row">
              <label for="wallpaperDimSlider">Background Dim: <strong id="wallpaperDimValue">35%</strong></label>
              <input type="range" id="wallpaperDimSlider" min="10" max="75" value="35" />
            </div>
            <button id="removeCustomWallpaperBtn" class="remove-photo-btn">
              🗑️ Remove Photo
            </button>
          </div>
        </div>
      </div>

      <!-- Photo Reveal & Glass Board Section (Option A & C) -->
      <div class="wallpaper-section-title" style="margin-top: 14px;">🖼️ PHOTO REVEAL & GLASS BOARD</div>
      <div id="photoRevealCard" class="wallpaper-custom-card" style="margin-bottom: 8px;"></div>

      <!-- Prominent Apply & Close Action -->
      <div style="margin-top: 16px; width: 100%;">
        <button id="applyAndCloseWallpaperBtn" class="modal-button apply-wallpaper-btn">
          ✓ Done & Apply Background
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);

  // Setup listeners
  document.getElementById("closeWallpaperBtn")?.addEventListener("click", () => {
    hideWallpaperModal();
  });

  document.getElementById("applyAndCloseWallpaperBtn")?.addEventListener("click", () => {
    hideWallpaperModal();
  });

  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) {
      hideWallpaperModal();
    }
  });

  const fileInput = document.getElementById("wallpaperFileInput") as HTMLInputElement;
  const uploadBtn = document.getElementById("uploadWallpaperBtn");

  uploadBtn?.addEventListener("click", () => {
    fileInput?.click();
  });

  fileInput?.addEventListener("change", async (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files && files[0]) {
      if (uploadBtn) {
        uploadBtn.textContent = "⏳ Applying photo...";
        uploadBtn.setAttribute("disabled", "true");
      }
      const ok = await wallpaperManager.setCustomPhoto(files[0]);
      if (uploadBtn) {
        uploadBtn.textContent = "📷 Upload Photo from Device";
        uploadBtn.removeAttribute("disabled");
      }
      fileInput.value = "";
      if (ok) {
        renderWallpaperModal();
        showToast("✨ Custom photo wallpaper applied live!");
      } else {
        alert("Unable to process photo. Please try a different image.");
      }
    }
  });

  document.getElementById("removeCustomWallpaperBtn")?.addEventListener("click", () => {
    wallpaperManager.removeCustomPhoto();
    renderWallpaperModal();
    showToast("Reset to Classic Navy theme");
  });

  const dimSlider = document.getElementById("wallpaperDimSlider") as HTMLInputElement;
  dimSlider?.addEventListener("input", (e) => {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    const dimValEl = document.getElementById("wallpaperDimValue");
    if (dimValEl) dimValEl.textContent = `${val}%`;
    wallpaperManager.setDimming(val / 100);
  });
}

function renderWallpaperModal() {
  // 1. Render Block Skin Presets
  const blockGridEl = document.getElementById("blockStylesGrid");
  const currentBlockStyle = getBlockStyle();

  if (blockGridEl) {
    blockGridEl.innerHTML = BLOCK_STYLE_PRESETS.map((preset) => {
      const isSelected = currentBlockStyle === preset.id;
      return `
        <div class="wallpaper-chip ${isSelected ? "selected" : ""}" data-block-style="${preset.id}" title="${preset.desc}">
          <div class="chip-preview-circle" style="background: ${preset.previewColor}">
            <span class="chip-icon">${preset.icon}</span>
          </div>
          <div style="display: flex; flex-direction: column; text-align: left; overflow: hidden; line-height: 1.2;">
            <span class="chip-name" style="font-weight: 700; font-size: 0.8rem;">${preset.name}</span>
            <span style="font-size: 0.62rem; color: #94a3b8; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${preset.desc}</span>
          </div>
          ${isSelected ? '<span class="chip-check">✓</span>' : ""}
        </div>
      `;
    }).join("");

    blockGridEl.querySelectorAll("[data-block-style]").forEach((el) => {
      el.addEventListener("click", () => {
        const sid = el.getAttribute("data-block-style") as BlockStyle;
        if (sid) {
          setBlockStyle(sid);
          renderWallpaperModal();
          const p = BLOCK_STYLE_PRESETS.find((preset) => preset.id === sid);
          showToast(`🧱 ${p ? p.name : "Skin"} applied!`);
        }
      });
    });
  }

  // 2. Render Wallpaper & Theme Presets
  const gridEl = document.getElementById("wallpaperPresetsGrid");
  const activeId = wallpaperManager.getCurrentThemeId();
  const customImg = wallpaperManager.getCustomImageData();

  if (gridEl) {
    gridEl.innerHTML = WALLPAPER_PRESETS.map((preset) => {
      const isSelected = activeId === preset.id;
      return `
        <div class="wallpaper-chip ${isSelected ? "selected" : ""}" data-theme-id="${preset.id}">
          <div class="chip-preview-circle" style="background: ${preset.previewGradient}">
            <span class="chip-icon">${preset.icon}</span>
          </div>
          <span class="chip-name">${preset.name}</span>
          ${isSelected ? '<span class="chip-check">✓</span>' : ""}
        </div>
      `;
    }).join("");

    // Bind click to each chip
    gridEl.querySelectorAll("[data-theme-id]").forEach((el) => {
      el.addEventListener("click", () => {
        const tid = el.getAttribute("data-theme-id");
        if (tid) {
          wallpaperManager.setTheme(tid);
          renderWallpaperModal();
          const p = WALLPAPER_PRESETS.find((preset) => preset.id === tid);
          showToast(`✨ ${p ? p.name : "Theme"} applied live!`);
        }
      });
    });
  }

  // Custom photo status row
  const uploadPrompt = document.getElementById("wallpaperUploadPrompt");
  const activeCustomRow = document.getElementById("wallpaperActiveCustomRow");
  const customThumb = document.getElementById("customWallpaperThumb") as HTMLImageElement;
  const dimSlider = document.getElementById("wallpaperDimSlider") as HTMLInputElement;
  const dimValEl = document.getElementById("wallpaperDimValue");

  if (customImg) {
    if (uploadPrompt) uploadPrompt.style.display = "none";
    if (activeCustomRow) activeCustomRow.style.display = "flex";
    if (customThumb) customThumb.src = customImg;
    const dimPercent = Math.round(wallpaperManager.getDimming() * 100);
    if (dimSlider) dimSlider.value = String(dimPercent);
    if (dimValEl) dimValEl.textContent = `${dimPercent}%`;
  } else {
    if (uploadPrompt) uploadPrompt.style.display = "flex";
    if (activeCustomRow) activeCustomRow.style.display = "none";
  }

  // 3. Render Photo Reveal & Glass Board Section
  const revealCard = document.getElementById("photoRevealCard");
  const isUnlocked = isPhotoRevealUnlocked();
  const currentRevealMode = getPhotoRevealMode();

  if (revealCard) {
    if (!isUnlocked) {
      revealCard.innerHTML = `
        <div class="reveal-locked-row" style="display: flex; align-items: center; gap: 10px; padding: 4px;">
          <span style="font-size: 1.4rem;">🔒</span>
          <div style="text-align: left;">
            <div style="font-weight: 700; font-size: 0.8rem; color: #e2e8f0;">Photo Glass Controls</div>
            <div style="font-size: 0.68rem; color: #94a3b8; line-height: 1.35; margin-top: 2px;">
              Line unmasking is active! Reach a <strong>5x Combo Streak</strong> or <strong>100% Photo Reveal</strong> to unlock full glass controls!
            </div>
          </div>
        </div>
      `;
    } else {
      revealCard.innerHTML = `
        <div style="text-align: left; width: 100%;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-weight: 800; font-size: 0.7rem; color: #a78bfa; letter-spacing: 0.06em;">✨ MILESTONE UNLOCKED</span>
            <button id="resetRevealBtn" class="remove-photo-btn" style="padding: 2px 8px; font-size: 0.68rem; margin: 0;">
              🔄 Re-cover Board
            </button>
          </div>
          <div class="reveal-mode-pills" style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button class="reveal-pill ${currentRevealMode === "unmask" ? "active" : ""}" data-reveal-mode="unmask">
              ✨ Line Reveal (Default)
            </button>
            <button class="reveal-pill ${currentRevealMode === "all-glass" ? "active" : ""}" data-reveal-mode="all-glass">
              🪟 Full Glass Board
            </button>
            <button class="reveal-pill ${currentRevealMode === "classic" ? "active" : ""}" data-reveal-mode="classic">
              ⬛ Classic Solid
            </button>
          </div>
        </div>
      `;

      revealCard.querySelectorAll("[data-reveal-mode]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const mode = btn.getAttribute("data-reveal-mode") as PhotoRevealMode;
          if (mode) {
            setPhotoRevealMode(mode);
            renderWallpaperModal();
            showToast(`✨ ${mode === "all-glass" ? "Full Glass" : mode === "unmask" ? "Line Reveal" : "Classic Solid"} applied!`);
          }
        });
      });

      document.getElementById("resetRevealBtn")?.addEventListener("click", () => {
        (window as any).resetPhotoRevealProgress?.();
        showToast("🔄 Board covered — ready to reveal again!");
      });
    }
  }
}

export function showWallpaperModal() {
  createWallpaperModal();
  renderWallpaperModal();
  if (!modalEl) return;
  modalEl.classList.add("active");
}

export function hideWallpaperModal() {
  if (!modalEl) return;
  modalEl.classList.remove("active");
}

