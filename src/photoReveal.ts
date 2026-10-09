export type PhotoRevealMode = "unmask" | "all-glass" | "classic";

const STORAGE_MODE = "bb_photo_reveal_mode";
const STORAGE_UNLOCKED = "bb_photo_reveal_unlocked";

export function getPhotoRevealMode(): PhotoRevealMode {
  const saved = localStorage.getItem(STORAGE_MODE) as PhotoRevealMode;
  if (saved === "unmask" || saved === "all-glass" || saved === "classic") {
    return saved;
  }
  return "unmask"; // Option A is the default
}

export function setPhotoRevealMode(mode: PhotoRevealMode) {
  localStorage.setItem(STORAGE_MODE, mode);
}

export function isPhotoRevealUnlocked(): boolean {
  return localStorage.getItem(STORAGE_UNLOCKED) === "true";
}

export function unlockPhotoReveal(): boolean {
  if (!isPhotoRevealUnlocked()) {
    localStorage.setItem(STORAGE_UNLOCKED, "true");
    return true;
  }
  return false;
}
