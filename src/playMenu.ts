import { dialog, text } from './dialogs';
import { CASUAL_ONLY } from './launch';
import './playMenu.css';

export function initPlayMenu() {
  if (!CASUAL_ONLY) return;
  document.body.classList.add('focused-play');
  const tools = document.createElement('div'); tools.className = 'play-menu-tools';
  const sections: [string, string[]][] = [
    ['Play', ['mode-classic-btn', 'mode-levels-btn', 'level-restart-btn', 'leaderboard-btn']],
    ['Make it yours', ['wallpaper-btn', 'theme-btn', 'mute-btn']],
    ['From Playables', ['updates-btn', 'landing-info-btn', 'mode-tourney-btn']],
  ];
  const labels: Record<string, string> = {
    'mode-classic-btn': 'New Classic game', 'mode-levels-btn': 'Choose a level',
    'leaderboard-btn': 'Rankings & progress', 'wallpaper-btn': 'Wallpaper & block styles',
    'updates-btn': 'Announcements & notifications', 'landing-info-btn': 'Home & about',
    'level-restart-btn': 'Restart current level',
  };
  for (const [title, ids] of sections) {
    tools.append(text('h3', title));
    const group = document.createElement('div'); group.className = 'play-menu-group'; group.dataset.section = title;
    for (const id of ids) {
      const control = document.getElementById(id) as HTMLButtonElement | null;
      if (!control) continue;
      if (labels[id]) { control.textContent = labels[id]; control.setAttribute('aria-label', labels[id]); }
      control.className = 'modal-secondary-button';
      control.addEventListener('click', () => {
        if (id !== 'mute-btn' && id !== 'theme-btn') document.getElementById('playMenu')?.classList.remove('active');
      });
      group.append(control);
    }
    tools.append(group);
  }
  const accessibility = text('button', 'Keyboard & accessible board controls', 'modal-secondary-button');
  const controls = document.getElementById('keyboard-controls') as HTMLDetailsElement;
  controls.hidden = true;
  accessibility.onclick = () => {
    document.getElementById('playMenu')?.classList.remove('active');
    controls.hidden = false; controls.open = true;
    controls.querySelector<HTMLElement>('summary')?.focus();
  };
  controls.addEventListener('toggle', () => { if (!controls.open) controls.hidden = true; });
  const finish = text('button', 'Finish this run', 'modal-secondary-button');
  finish.onclick = () => {
    document.getElementById('playMenu')?.classList.remove('active');
    document.getElementById('end-run-btn')?.click();
  };
  tools.append(accessibility, finish);
  const menu = text('button', '☰', 'hud-btn play-menu-button') as HTMLButtonElement;
  menu.id = 'play-menu-btn'; menu.setAttribute('aria-label', 'Game menu'); menu.setAttribute('aria-haspopup', 'dialog');
  document.querySelector('.hud-top-row')?.append(menu);
  menu.onclick = () => {
    const restart = tools.querySelector<HTMLElement>('#level-restart-btn');
    if (restart) restart.hidden = document.getElementById('level-hud')?.style.display === 'none';
    tools.remove();
    const { card, overlay } = dialog('playMenu', 'Take a breather.');
    card.classList.add('play-menu-card');
    const resume = text('button', 'Back to the board', 'modal-button');
    resume.onclick = () => overlay.classList.remove('active');
    card.append(resume, tools);
  };
  // Retain original controls and listeners in a hidden, inert dialog until opened.
  const { overlay, card } = dialog('playMenu', 'Take a breather.');
  card.append(tools); overlay.classList.remove('active');
}
