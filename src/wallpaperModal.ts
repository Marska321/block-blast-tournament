import { wallpaperManager, WALLPAPER_PRESETS, isWallpaperUnlocked } from "./wallpaper";
import { getBlockStyle, BLOCK_STYLE_PRESETS } from "./gameFunctions";
import { levelProgress } from "./levels";
import { authManager } from "./auth";
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
      <div class="modal-badge wallpaper-badge">🎨 UNLOCKABLE THEMES</div>
      <h2 class="modal-title">Themes & Progression</h2>
      <p class="pretourney-subtitle">Unlock authentic board backgrounds and personalize your arena as you reach high-score milestones.</p>

      <div id="wallpaperStatusToast" class="wallpaper-status-toast" style="display: none;"></div>

      <!-- Dynamic Block Skin Status Card (Replaces manual skin picker) -->
      <div class="wallpaper-section-title">🧱 IN-GAME BLOCK SKIN EVOLUTION</div>
      <div class="dynamic-skin-info-card" id="dynamicSkinInfoCard">
        <div class="dynamic-skin-status-row">
          <div class="chip-preview-circle active-skin-preview" id="activeSkinPreviewCircle" style="background: #3b82f6;">
            <span class="chip-icon" id="activeSkinIcon">💎</span>
          </div>
          <div class="dynamic-skin-text">
            <div class="dynamic-skin-heading">
              <span>Active Skin: <strong id="activeSkinName">3D Gem Bevel</strong></span>
              <span class="dynamic-skin-tag">DYNAMIC</span>
            </div>
            <p class="dynamic-skin-desc">
              All games start with authentic 3D Gem Bevel. As you blast combos and reach milestone scores, your tiles randomly evolve in real time!
            </p>
          </div>
        </div>
      </div>

      <!-- Preset Themes Grid (Unlockable) -->
      <div class="wallpaper-section-title" style="margin-top: 14px;">✨ POPULAR BOARD THEMES</div>
      <div id="wallpaperPresetsGrid" class="wallpaper-presets-grid"></div>

      <!-- Personalized Custom Photo Section (Exclusive to Verified Competitors) -->
      <div class="wallpaper-section-title" style="margin-top: 14px;">📸 PERSONALIZED WALLPAPER</div>
      <div class="wallpaper-custom-card" id="customWallpaperContainer">
        <!-- Verified vs Unverified content rendered dynamically -->
        <input type="file" id="wallpaperFileInput" accept="image/*" style="display: none;" />

        <div id="wallpaperVerifiedLockBox" class="verified-wallpaper-locked" style="display: none;">
          <div class="verified-lock-header">
            <span class="lock-big-icon">🔒</span>
            <div class="verified-lock-info">
              <strong>EXCLUSIVE TO VERIFIED COMPETITORS</strong>
              <p>Personalized photo wallpapers are reserved for verified tournament contenders.</p>
            </div>
          </div>
          <button id="openVerifyFromWallpaperBtn" class="modal-button verify-unlock-btn">
            ☑️ Get Verified to Unlock Custom Wallpaper
          </button>
        </div>

        <div id="wallpaperUploadPrompt" class="upload-prompt-row" style="display: none;">
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
  // 1. Dynamic Block Skin Status Preview (Updates display without clickable manual overrides)
  const activeSkin = getBlockStyle();
  const activeSkinPreset = BLOCK_STYLE_PRESETS.find((p) => p.id === activeSkin) || BLOCK_STYLE_PRESETS[0];
  const activeSkinNameEl = document.getElementById("activeSkinName");
  const activeSkinIconEl = document.getElementById("activeSkinIcon");
  const activeSkinPreviewCircleEl = document.getElementById("activeSkinPreviewCircle");

  if (activeSkinNameEl) activeSkinNameEl.textContent = activeSkinPreset.name;
  if (activeSkinIconEl) activeSkinIconEl.textContent = activeSkinPreset.icon;
  if (activeSkinPreviewCircleEl) activeSkinPreviewCircleEl.style.background = activeSkinPreset.previewColor;

  // 2. Render Wallpaper & Theme Presets with Milestone Unlock Status
  const gridEl = document.getElementById("wallpaperPresetsGrid");
  const activeId = wallpaperManager.getCurrentThemeId();
  const highestLevel = levelProgress.getHighestUnlocked();

  if (gridEl) {
    gridEl.innerHTML = WALLPAPER_PRESETS.map((preset) => {
      const isSelected = activeId === preset.id;
      const isUnlocked = isWallpaperUnlocked(preset, highestLevel);
      return `
        <div class="wallpaper-chip ${isSelected ? "selected" : ""} ${!isUnlocked ? "locked" : ""}" 
             data-theme-id="${preset.id}" 
             data-unlocked="${isUnlocked ? "true" : "false"}"
             title="${isUnlocked ? preset.name : preset.unlockRequirementText}">
          <div class="chip-preview-circle" style="background: ${isUnlocked ? preset.previewGradient : "#1e293b"}">
            <span class="chip-icon">${isUnlocked ? preset.icon : "🔒"}</span>
          </div>
          <div class="chip-theme-details">
            <span class="chip-name">${preset.name}</span>
            ${
              !isUnlocked
                ? `<span class="chip-lock-desc">${preset.unlockRequirementText}</span>`
                : ""
            }
          </div>
          ${isSelected && isUnlocked ? '<span class="chip-check">✓</span>' : ""}
          ${!isUnlocked ? '<span class="chip-lock-badge">🔒</span>' : ""}
        </div>
      `;
    }).join("");

    // Bind click to each chip
    gridEl.querySelectorAll("[data-theme-id]").forEach((el) => {
      el.addEventListener("click", () => {
        const isUnlocked = el.getAttribute("data-unlocked") === "true";
        const tid = el.getAttribute("data-theme-id");
        const preset = WALLPAPER_PRESETS.find((p) => p.id === tid);

        if (!isUnlocked) {
          showToast(`🔒 Locked! ${preset ? preset.unlockRequirementText : "Reach milestones to unlock"}`);
          return;
        }

        if (tid) {
          wallpaperManager.setTheme(tid);
          renderWallpaperModal();
          showToast(`✨ ${preset ? preset.name : "Theme"} applied live!`);
        }
      });
    });
  }

  // 3. Personalized Custom Photo Section (Exclusive to Verified Competitors)
  const isVerified = authManager.isWhatsAppVerified();
  const lockBox = document.getElementById("wallpaperVerifiedLockBox");
  const uploadPrompt = document.getElementById("wallpaperUploadPrompt");
  const activeCustomRow = document.getElementById("wallpaperActiveCustomRow");
  const customThumb = document.getElementById("customWallpaperThumb") as HTMLImageElement;
  const dimSlider = document.getElementById("wallpaperDimSlider") as HTMLInputElement;
  const dimValEl = document.getElementById("wallpaperDimValue");
  const customImg = wallpaperManager.getCustomImageData();

  const openVerifyBtn = document.getElementById("openVerifyFromWallpaperBtn");
  if (openVerifyBtn) {
    openVerifyBtn.onclick = () => {
      hideWallpaperModal();
      authManager.show();
    };
  }

  if (!isVerified) {
    // Competitor is unverified: locked behind verification
    if (lockBox) lockBox.style.display = "flex";
    if (uploadPrompt) uploadPrompt.style.display = "none";
    if (activeCustomRow) activeCustomRow.style.display = "none";
  } else {
    // Verified competitor: full access to personal wallpapers
    if (lockBox) lockBox.style.display = "none";
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

