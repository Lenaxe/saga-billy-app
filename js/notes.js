import { getState, touch, exportAll, importAll } from './state.js';
import { showToast, confirmDialog } from './ui.js';

export function renderNotesView() {
  const state = getState();
  document.getElementById('notes-free').value = state.notes.free;
  document.getElementById('notes-rules').value = state.notes.rules;
}

export function initNotesView() {
  const state = getState();

  document.getElementById('notes-free').addEventListener('input', (e) => {
    state.notes.free = e.target.value;
    touch();
  });
  document.getElementById('notes-rules').addEventListener('input', (e) => {
    state.notes.rules = e.target.value;
    touch();
  });

  document.getElementById('export-btn').addEventListener('click', async () => {
    showToast('Préparation de l\'export...');
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `saga-billy-sauvegarde-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast('Export terminé');
  });

  const importInput = document.getElementById('import-file-input');
  document.getElementById('import-btn').addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', async () => {
    const file = importInput.files[0];
    importInput.value = '';
    if (!file) return;
    confirmDialog('Importer ce fichier remplacera TOUTES les données actuelles (personnage, photos, sauvegardes, notes). Continuer ?', async () => {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await importAll(data);
        renderNotesView();
        showToast('Import réussi — relance l\'appli si besoin');
      } catch (err) {
        showToast('Erreur import : fichier invalide');
      }
    }, { danger: true, confirmLabel: 'Importer' });
  });
}
