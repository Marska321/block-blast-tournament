const focusable =
  'button:not([disabled]),a[href],input:not([disabled]),select,textarea,[tabindex="0"]';
let top: HTMLElement | null = null;
const returnFocus = new WeakMap<HTMLElement, HTMLElement>();

export function installDialogs() {
  let openDialogs = new Set<HTMLElement>();
  function update() {
    const overlays = [
      ...document.querySelectorAll<HTMLElement>(".modal-overlay"),
    ];
    const active = overlays.filter((el) => el.classList.contains("active"));
    for (const opening of active) {
      if (
        !openDialogs.has(opening) &&
        document.activeElement instanceof HTMLElement
      )
        returnFocus.set(opening, document.activeElement);
    }
    openDialogs = new Set(active);
    const next =
      active
        .sort(
          (a, b) =>
            Number(getComputedStyle(a).zIndex || 0) -
            Number(getComputedStyle(b).zIndex || 0),
        )
        .at(-1) || null;
    for (const el of overlays) {
      const open = el.classList.contains("active");
      el.hidden = !open;
      el.inert = el !== next;
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", el === next ? "true" : "false");
      const heading = el.querySelector<HTMLElement>("h1,h2");
      if (heading) {
        heading.id ||= `${el.id || "dialog"}-title`;
        el.setAttribute("aria-labelledby", heading.id);
      }
      el.tabIndex = -1;
    }
    if (next !== top) {
      const previous = top;
      const restore =
        previous && !previous.classList.contains("active")
          ? returnFocus.get(previous)
          : null;
      top = next;
      for (const el of [...document.body.children])
        if (el instanceof HTMLElement && !el.matches("script,style"))
          el.inert = !!next && el !== next;
      if (next) {
        if (restore?.isConnected && next.contains(restore)) restore.focus();
        else (next.querySelector<HTMLElement>(focusable) || next).focus();
      } else if (restore?.isConnected) {
        if (restore.getClientRects().length && !restore.closest('[hidden],[inert]')) restore.focus();
        else (document.getElementById('play-menu-btn') || document.getElementById('gameCanvas'))?.focus();
      }
    } else if (next && !next.contains(document.activeElement))
      (next.querySelector<HTMLElement>(focusable) || next).focus();
  }
  new MutationObserver(update).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });
  document.addEventListener(
    "keydown",
    (e) => {
      if (!top) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        const close = top.querySelector<HTMLButtonElement>(
          'button[aria-label="Close"],button.close-x-btn',
        );
        if (close) close.click();
        else top.classList.remove("active");
        update();
        return;
      }
      if (e.key === "Tab") {
        const items = [...top.querySelectorAll<HTMLElement>(focusable)].filter(
          (el) =>
            !el.hidden && !el.closest("[hidden]") && el.getClientRects().length,
        );
        const first = items[0],
          last = items.at(-1);
        if (!first) {
          e.preventDefault();
          top.focus();
        } else if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === top)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    true,
  );
  update();
}

export function dialog(id: string, title: string) {
  document.getElementById(id)?.remove();
  const overlay = document.createElement("div");
  overlay.id = id;
  overlay.className = "modal-overlay active";
  overlay.style.zIndex = String(
    Math.max(
      100,
      ...[...document.querySelectorAll(".modal-overlay.active")].map(
        (el) => Number(getComputedStyle(el).zIndex) || 100,
      ),
    ) + 1,
  );
  const card = document.createElement("div");
  card.className = "modal";
  const heading = document.createElement("h2");
  heading.textContent = title;
  card.append(heading);
  const close = document.createElement("button");
  close.className = "modal-close-corner";
  close.textContent = "✕";
  close.setAttribute("aria-label", "Close");
  close.onclick = () => overlay.classList.remove("active");
  card.append(close);
  overlay.append(card);
  document.body.append(overlay);
  return { overlay, card };
}
export function text(tag: string, content: string, className = "") {
  const node = document.createElement(tag);
  node.textContent = content;
  node.className = className;
  return node;
}
