import { LEVEL_DATA, WORLD_THEMES, levelProgress } from "./levels";

let levelSelectEl: HTMLElement | null = null;

export function showLevelSelect({
  onSelectLevel,
  onClose,
}: {
  onSelectLevel: (levelNum: number) => void;
  onClose: () => void;
}) {
  if (!levelSelectEl) {
    levelSelectEl = document.createElement("div");
    levelSelectEl.className = "modal-overlay level-select-overlay";
    levelSelectEl.id = "levelSelectModal";
    document.body.appendChild(levelSelectEl);
  }

  const highestUnlocked = levelProgress.getHighestUnlocked();
  const totalStars = levelProgress.getTotalStars();
  const maxStars = LEVEL_DATA.length * 3;

  // Group levels by world
  const worlds: { [worldIdx: number]: typeof LEVEL_DATA } = {};
  LEVEL_DATA.forEach((lvl) => {
    if (!worlds[lvl.worldIndex]) worlds[lvl.worldIndex] = [];
    worlds[lvl.worldIndex].push(lvl);
  });

  let worldsHTML = "";
  Object.keys(worlds).forEach((wKey) => {
    const wIdx = parseInt(wKey, 10);
    const theme = WORLD_THEMES[wIdx];
    const levelsInWorld = worlds[wIdx];

    const worldLevelsHTML = levelsInWorld
      .map((lvl) => {
        const isUnlocked = lvl.level <= highestUnlocked;
        const progress = levelProgress.getLevelProgress(lvl.level);
        const stars = progress.stars || 0;

        let starsHTML = "";
        for (let s = 1; s <= 3; s++) {
          starsHTML += `<span class="star-icon ${s <= stars ? "filled" : "empty"}">★</span>`;
        }

        if (isUnlocked) {
          return `
            <button class="level-card unlocked ${lvl.level === highestUnlocked ? "current" : ""}" data-level="${lvl.level}">
              <span class="level-card-number">${lvl.level}</span>
              <div class="level-card-stars">${starsHTML}</div>
            </button>
          `;
        } else {
          return `
            <div class="level-card locked">
              <span class="lock-icon">🔒</span>
              <span class="level-card-number">${lvl.level}</span>
            </div>
          `;
        }
      })
      .join("");

    worldsHTML += `
      <div class="world-section" style="border-left: 4px solid ${theme.accentColor}">
        <div class="world-header">
          <span class="world-name" style="color: ${theme.accentColor}">World ${wIdx + 1}: ${theme.name}</span>
        </div>
        <div class="world-grid">
          ${worldLevelsHTML}
        </div>
      </div>
    `;
  });

  levelSelectEl.innerHTML = `
    <div class="modal level-select-modal">
      <div class="level-select-header">
        <div class="level-select-title-group">
          <h2 class="level-select-title">🗺️ Adventure Mode</h2>
          <div class="stars-counter">⭐ ${totalStars} / ${maxStars}</div>
        </div>
        <button id="levelSelectCloseBtn" class="close-x-btn" aria-label="Close">✕</button>
      </div>

      <div class="worlds-scroll-container">
        ${worldsHTML}
      </div>
    </div>
  `;

  document.getElementById("levelSelectCloseBtn")?.addEventListener("click", () => {
    hideLevelSelect();
    onClose();
  });

  levelSelectEl.querySelectorAll(".level-card.unlocked").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lvlStr = (btn as HTMLElement).getAttribute("data-level");
      if (lvlStr) {
        hideLevelSelect();
        onSelectLevel(parseInt(lvlStr, 10));
      }
    });
  });

  levelSelectEl.classList.add("active");
}

export function hideLevelSelect() {
  if (!levelSelectEl) return;
  levelSelectEl.classList.remove("active");
}
