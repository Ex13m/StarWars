// Bootstrap entry point.
//
// For now this wires the briefing shell + the "What's New" overlay. The gameplay
// slice (core/Game.js) mounts here once it lands — see the ENGAGE handler TODO.

import { GAME_VERSION } from './version.js';
import { WhatsNew } from './ui/WhatsNew.js';

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

  // ENGAGE — entry into the battle. Gameplay slice not wired yet.
  const engage = document.querySelector('[data-action="engage"]');
  if (engage) {
    engage.addEventListener('click', () => {
      // TODO: import('./core/Game.js') and start the run once the slice is built.
      console.info('[STARWARS] ENGAGE — gameplay slice not wired yet.');
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
