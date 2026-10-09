export class ComboBar {
  private container: HTMLElement | null = null;
  private labelEl: HTMLElement | null = null;
  private fillEl: HTMLElement | null = null;

  constructor() {
    this.container = document.getElementById("combo-bar-container");
    this.labelEl = document.getElementById("combo-label");
    this.fillEl = document.getElementById("combo-fill");
  }

  public update(combo: number) {
    if (!this.container || !this.labelEl || !this.fillEl) return;

    if (combo <= 0) {
      this.container.classList.remove("active", "pulse");
      this.fillEl.style.width = "0%";
      this.labelEl.textContent = "COMBO 0";
    } else {
      this.container.classList.add("active");
      if (combo >= 3) {
        this.container.classList.add("pulse");
      } else {
        this.container.classList.remove("pulse");
      }

      this.labelEl.textContent = `COMBO ×${combo}`;
      const fillPercent = Math.min(100, combo * 20);
      this.fillEl.style.width = `${fillPercent}%`;
    }
  }

  public reset() {
    this.update(0);
  }
}

export const comboBar = new ComboBar();
