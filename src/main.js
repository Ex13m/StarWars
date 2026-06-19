// Bootstrap entry point.
//
// For now this wires the briefing shell + the "What's New" overlay. The gameplay
// slice (core/Game.js) mounts here once it lands — see the ENGAGE handler TODO.

import { GAME_VERSION } from './version.js';
import { WhatsNew } from './ui/WhatsNew.js';
import { AudioEngine } from './audio/AudioEngine.js';

let game = null;

async function engage() {
  const briefing = document.getElementById('briefing');
  const gameRoot = document.getElementById('game-root');

  // Audio must start from this user gesture (autoplay policy).
  const audio = new AudioEngine();
  audio.preload();
  audio.unlock();
  audio.setMusic('combat');

  if (briefing) briefing.style.display = 'none';
  if (gameRoot) gameRoot.hidden = false;

  // Defer-load the WebGL slice so the briefing stays light until "В БОЙ".
  const { Game } = await import('./core/Game.js');
  game = new Game(gameRoot, audio);
  await game.start();
}

function boot() {
  // Stamp the build version into the briefing footer.
  for (const node of document.querySelectorAll('[data-version]')) {
    node.textContent = `v${GAME_VERSION}`;
  }

  const whatsNew = new WhatsNew();

  // On launch / "при обновлении": auto-surface ONLY updates newer than what the
  // player last saw. Does nothing if there is nothing new.
  whatsNew.show();

  // Manual re-open of the full patch-notes list.
  const notesBtn = document.querySelector('[data-action="patch-notes"]');
  if (notesBtn) {
    notesBtn.addEventListener('click', () => whatsNew.show({ force: true }));
  }

  // ENGAGE — enter the battle (starts the flight-feel slice).
  const engageBtn = document.querySelector('[data-action="engage"]');
  if (engageBtn) {
    engageBtn.addEventListener('click', () => {
      engageBtn.disabled = true;
      engage().catch((err) => {
        console.error('[STARWARS] failed to start:', err);
        const briefing = document.getElementById('briefing');
        if (briefing) briefing.style.display = '';
        engageBtn.disabled = false;
      });
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
