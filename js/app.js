import { loadState, flushAutosave } from './state.js';
import { renderCharacterView, initCharacterView } from './character.js';
import { initDiceView } from './dice.js';
import { renderCombatView, initCombatView } from './combat.js';
import { renderNotesView, initNotesView } from './notes.js';

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const views = document.querySelectorAll('.view');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.view;
      tabBtns.forEach(b => b.classList.toggle('active', b === btn));
      views.forEach(v => v.classList.toggle('active', v.dataset.view === target));
      if (target === 'character') renderCharacterView();
      if (target === 'combat') renderCombatView();
      if (target === 'notes') renderNotesView();
    });
  });
}

function initSegmented() {
  document.querySelectorAll('.segmented').forEach(group => {
    group.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b === btn));
        const parent = group.parentElement;
        parent.querySelectorAll('.seg-panel').forEach(p => {
          p.classList.toggle('active', p.dataset.segPanel === btn.dataset.seg);
        });
      });
    });
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
}

async function main() {
  await loadState();
  initTabs();
  initSegmented();
  initCharacterView();
  initDiceView();
  initCombatView();
  initNotesView();
  renderCharacterView();
  registerServiceWorker();

  window.addEventListener('pagehide', () => { flushAutosave(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAutosave();
  });
}

main();
