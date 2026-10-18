import { getState, touch, uid, saveToSlot, loadFromSlot, listSaves, deleteSaveSlot, defaultState } from './state.js';
import { escapeHtml, formatTime, showToast, promptDialog, confirmDialog } from './ui.js';
import { ITEMS, CATEGORY_LABELS, CLASSES, detectClasse, classeBonusFor, materielBonusFor } from './billyData.js';

const BONUS_MAX = 15;
const PRIMARY_KEYS = ['habilite', 'adresse', 'endurance', 'chance'];

function boxesHtml(current, max, role) {
  return Array.from({ length: max }, (_, i) =>
    `<button type="button" class="stat-box ${i < current ? 'filled' : ''}" data-act="box" data-role="${role}" data-index="${i}"></button>`
  ).join('');
}

function toggledValue(current, index) {
  return current === index + 1 ? index : index + 1;
}

// ---------- Items picker & classe ----------

function renderItemsPicker() {
  const state = getState();
  const selected = state.character.classeItems;
  document.getElementById('items-count').textContent = `${selected.length}/3`;

  const byCategory = { armes: [], equipements: [], outils: [] };
  Object.entries(ITEMS).forEach(([key, item]) => byCategory[item.category].push([key, item]));

  const el = document.getElementById('items-picker');
  el.innerHTML = Object.entries(byCategory).map(([cat, items]) => `
    <div class="item-category">
      <div class="item-category-label">${CATEGORY_LABELS[cat]}</div>
      <div class="item-chips">
        ${items.map(([key, item]) => `
          <button type="button" class="item-chip ${selected.includes(key) ? 'selected' : ''}" data-item="${key}">
            ${escapeHtml(item.label)}
            ${item.note ? `<span class="item-note">${escapeHtml(item.note)}</span>` : ''}
          </button>
        `).join('')}
      </div>
    </div>
  `).join('');

  const classe = detectClasse(selected);
  const readout = document.getElementById('classe-readout');
  if (selected.length < 3) {
    readout.innerHTML = `<span class="empty-hint">Choisis ${3 - selected.length} objet(s) de plus pour déterminer ta classe.</span>`;
  } else if (classe) {
    const c = CLASSES[classe];
    readout.innerHTML = `<div class="classe-name">Classe : ${escapeHtml(c.label)}</div><div class="classe-power">${escapeHtml(c.power)}</div>`;
  } else {
    readout.innerHTML = `<span class="empty-hint">Classe indéterminée.</span>`;
  }
}

function toggleItem(key) {
  const state = getState();
  const selected = state.character.classeItems;
  if (selected.includes(key)) {
    state.character.classeItems = selected.filter(k => k !== key);
  } else {
    if (selected.length >= 3) {
      showToast('Tu as déjà choisi 3 objets — désélectionnes-en un d\'abord.');
      return;
    }
    const hasArc = selected.includes('arc') || key === 'arc';
    const armesCount = selected.filter(k => ITEMS[k].category === 'armes').length + (ITEMS[key].category === 'armes' ? 1 : 0);
    if (hasArc && armesCount >= 2) {
      showToast('L\'Arc demande les deux mains : impossible avec une autre arme équipée.');
      return;
    }
    state.character.classeItems = [...selected, key];
  }
  touch();
  renderItemsPicker();
  renderPrimaryStats();
  renderSecondary();
}

// ---------- Primary stats (HABILITÉ / ADRESSE / ENDURANCE / CHANCE) ----------

function primaryTotal(statKey) {
  const state = getState();
  const stat = state.character.primary[statKey];
  const carac = classeBonusFor(state.character.classeItems, statKey);
  const materiel = materielBonusFor(state.character.classeItems, statKey);
  const sum = (stat.base || 0) + carac + materiel + (stat.bonus || 0);
  return { carac, materiel, sum: stat.cap ? Math.min(sum, stat.cap) : sum, raw: sum };
}

function renderPrimaryStats() {
  const state = getState();
  PRIMARY_KEYS.forEach(key => {
    const card = document.querySelector(`.primary-stat-card[data-stat="${key}"]`);
    if (!card) return;
    const stat = state.character.primary[key];
    const { carac, materiel, sum } = primaryTotal(key);
    card.querySelector('[data-role="base"]').textContent = stat.base;
    card.querySelector('[data-role="carac"]').textContent = carac >= 0 ? `+${carac}` : carac;
    card.querySelector('[data-role="materiel"]').textContent = materiel >= 0 ? `+${materiel}` : materiel;
    card.querySelector('[data-role="total"]').textContent = sum;
    card.querySelector('[data-role="bonus-boxes"]').innerHTML = boxesHtml(stat.bonus || 0, BONUS_MAX, `primary:${key}`);
  });
}

// ---------- Secondary stats (DÉGÂTS / ARMURE / CRITIQUE / PV MAX) ----------

function renderSecondary() {
  const state = getState();
  const sec = state.character.secondary;
  ['degats', 'armure', 'critique'].forEach(key => {
    const row = document.querySelector(`.secondary-row[data-sec="${key}"]`);
    if (!row) return;
    const equip = materielBonusFor(state.character.classeItems, key);
    row.querySelector('[data-role="val"]').textContent = sec[key];
    const total = sec[key] + equip;
    row.querySelector('[data-role="total"]').textContent = `= ${total} (${sec[key]} manuel + ${equip} équip.)`;
  });

  document.querySelector('[data-role="pvMaxBase"]').textContent = sec.pvMaxBase;
  document.querySelector('[data-role="pvmax-bonus-boxes"]').innerHTML = boxesHtml(sec.pvMaxBonus || 0, BONUS_MAX, 'pvmax');
  document.querySelector('[data-role="pvmax-total"]').textContent = pvMaxTotal();
}

function pvMaxTotal() {
  const sec = getState().character.secondary;
  return (sec.pvMaxBase || 0) + (sec.pvMaxBonus || 0);
}

function chanceTotal() {
  return primaryTotal('chance').sum;
}

// ---------- Suivi en jeu (PV / Chance actuels) ----------

function renderSuivi() {
  const state = getState();
  const pvMax = Math.max(0, pvMaxTotal());
  const chaMax = Math.max(0, chanceTotal());
  state.character.suiviPV = Math.min(state.character.suiviPV, pvMax);
  state.character.suiviChance = Math.min(state.character.suiviChance, chaMax);

  document.querySelector('[data-role="suivi-pv-label"]').textContent = `(${state.character.suiviPV}/${pvMax})`;
  document.getElementById('suivi-pv-boxes').innerHTML = boxesHtml(state.character.suiviPV, pvMax, 'suiviPV');

  document.querySelector('[data-role="suivi-chance-label"]').textContent = `(${state.character.suiviChance}/${chaMax})`;
  document.getElementById('suivi-chance-boxes').innerHTML = boxesHtml(state.character.suiviChance, chaMax, 'suiviChance');
}

// ---------- Gloire & Richesse ----------

function renderGloireRichesse() {
  const state = getState();
  document.getElementById('gloire-max-value').textContent = state.character.gloireMax ?? 15;
  document.getElementById('richesse-max-value').textContent = state.character.richesseMax ?? 15;
  document.getElementById('gloire-boxes').innerHTML = boxesHtml(state.character.gloire, state.character.gloireMax ?? 15, 'gloire');
  document.getElementById('richesse-boxes').innerHTML = boxesHtml(state.character.richesse, state.character.richesseMax ?? 15, 'richesse');
}

// ---------- Lists: Matériel / Objets récupérés / Mots-clés ----------

function renderNamedList(containerId, list) {
  const el = document.getElementById(containerId);
  el.innerHTML = list.length ? list.map(it => `
    <div class="item-row" data-id="${it.id}">
      <input type="text" value="${escapeHtml(it.name)}" data-field="name" placeholder="Nom de l'objet">
      <div class="item-qty">
        <button class="mini-btn" data-act="item-dec">-</button>
        <span class="item-qty-value">${it.qty}</span>
        <button class="mini-btn" data-act="item-inc">+</button>
      </div>
      <button class="remove-btn" data-act="item-remove">✕</button>
    </div>`).join('') : '<div class="empty-hint">Vide pour le moment.</div>';
}

function renderKeywords() {
  const state = getState();
  const el = document.getElementById('keywords-list');
  const kws = state.character.keywords;
  el.innerHTML = kws.length ? kws.map(k => `
    <span class="keyword-chip" data-id="${k.id}">${escapeHtml(k.text)}<button data-act="kw-remove">✕</button></span>
  `).join('') : '<div class="empty-hint">Aucun mot-clé.</div>';
}

// ---------- Saves ----------

async function renderSaves() {
  const el = document.getElementById('saves-list');
  const saves = await listSaves();
  const rows = saves.map(s => `
    <div class="save-row" data-slot="${s.slotId}">
      <div class="save-info">
        <div class="save-name">${escapeHtml(s.name)}</div>
        <div class="save-time">${formatTime(s.timestamp)}</div>
      </div>
      <div class="save-actions">
        <button class="btn btn-small" data-act="load-save">Charger</button>
        <button class="btn btn-small" data-act="overwrite-save">Écraser</button>
        <button class="btn btn-small btn-danger" data-act="delete-save">✕</button>
      </div>
    </div>`).join('');
  el.innerHTML = `
    <div class="save-row">
      <div class="save-info"><div class="save-name">Nouvelle sauvegarde</div></div>
      <div class="save-actions"><button class="btn btn-small btn-accent" data-act="new-save">+ Créer</button></div>
    </div>
    ${rows || '<div class="empty-hint">Aucune sauvegarde pour le moment.</div>'}
  `;
}

// ---------- Top-level render ----------

export function renderCharacterView() {
  const state = getState();
  document.getElementById('caractere-text').value = state.character.caractere;
  document.getElementById('notes-aventure-text').value = state.character.notesAventure;
  renderItemsPicker();
  renderPrimaryStats();
  renderSecondary();
  renderSuivi();
  renderGloireRichesse();
  renderNamedList('inventory-list', state.character.materiel);
  renderNamedList('found-list', state.character.objetsRecuperes);
  renderKeywords();
  renderSaves();
}

function renderAllDerived() {
  renderPrimaryStats();
  renderSecondary();
  renderSuivi();
}

// ---------- Init / event wiring ----------

export function initCharacterView() {
  document.getElementById('caractere-text').addEventListener('input', (e) => {
    getState().character.caractere = e.target.value;
    touch();
  });
  document.getElementById('notes-aventure-text').addEventListener('input', (e) => {
    getState().character.notesAventure = e.target.value;
    touch();
  });

  document.getElementById('items-picker').addEventListener('click', (e) => {
    const chip = e.target.closest('.item-chip');
    if (!chip) return;
    toggleItem(chip.dataset.item);
  });

  document.getElementById('reset-character-btn').addEventListener('click', () => {
    confirmDialog('Repartir sur une feuille vierge ? Tout le personnage actuel sera remplacé (les sauvegardes existantes restent intactes).', () => {
      const state = getState();
      const fresh = defaultState().character;
      Object.keys(fresh).forEach(key => { state.character[key] = fresh[key]; });
      touch();
      renderCharacterView();
    }, { danger: true, confirmLabel: 'Repartir à zéro' });
  });

  // Primary stat Base steppers + bonus boxes
  document.querySelectorAll('.primary-stat-card').forEach(card => {
    const statKey = card.dataset.stat;
    card.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const state = getState();
      const stat = state.character.primary[statKey];
      if (btn.dataset.field === 'base') {
        stat.base = Math.max(0, (stat.base || 0) + Number(btn.dataset.delta));
        touch();
        renderPrimaryStats();
        renderSuivi();
      }
      if (btn.dataset.act === 'box') {
        const index = Number(btn.dataset.index);
        stat.bonus = toggledValue(stat.bonus || 0, index);
        touch();
        renderPrimaryStats();
        renderSuivi();
      }
    });
  });

  // Secondary stat steppers
  document.querySelectorAll('.secondary-row').forEach(row => {
    const secKey = row.dataset.sec;
    row.addEventListener('click', (e) => {
      const btn = e.target.closest('.mini-btn');
      if (!btn) return;
      const state = getState();
      state.character.secondary[secKey] = Math.max(0, (state.character.secondary[secKey] || 0) + Number(btn.dataset.delta));
      touch();
      renderSecondary();
    });
  });

  document.querySelector('.pvmax-block').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const state = getState();
    const sec = state.character.secondary;
    if (btn.dataset.sec === 'pvMaxBase') {
      sec.pvMaxBase = Math.max(0, (sec.pvMaxBase || 0) + Number(btn.dataset.delta));
    }
    if (btn.dataset.act === 'box') {
      const index = Number(btn.dataset.index);
      sec.pvMaxBonus = toggledValue(sec.pvMaxBonus || 0, index);
    }
    touch();
    renderSecondary();
    renderSuivi();
  });

  document.getElementById('suivi-pv-boxes').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act="box"]');
    if (!btn) return;
    const state = getState();
    state.character.suiviPV = toggledValue(state.character.suiviPV, Number(btn.dataset.index));
    touch();
    renderSuivi();
  });

  document.getElementById('suivi-chance-boxes').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act="box"]');
    if (!btn) return;
    const state = getState();
    state.character.suiviChance = toggledValue(state.character.suiviChance, Number(btn.dataset.index));
    touch();
    renderSuivi();
  });

  document.getElementById('gloire-boxes').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act="box"]');
    if (!btn) return;
    const state = getState();
    state.character.gloire = toggledValue(state.character.gloire, Number(btn.dataset.index));
    touch();
    renderGloireRichesse();
  });
  document.getElementById('richesse-boxes').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act="box"]');
    if (!btn) return;
    const state = getState();
    state.character.richesse = toggledValue(state.character.richesse, Number(btn.dataset.index));
    touch();
    renderGloireRichesse();
  });
  document.getElementById('gloire-max-inc').addEventListener('click', () => {
    const state = getState();
    state.character.gloireMax = (state.character.gloireMax ?? 15) + 1;
    touch();
    renderGloireRichesse();
  });
  document.getElementById('gloire-max-dec').addEventListener('click', () => {
    const state = getState();
    state.character.gloireMax = Math.max(state.character.gloire, (state.character.gloireMax ?? 15) - 1);
    touch();
    renderGloireRichesse();
  });
  document.getElementById('richesse-max-inc').addEventListener('click', () => {
    const state = getState();
    state.character.richesseMax = (state.character.richesseMax ?? 15) + 1;
    touch();
    renderGloireRichesse();
  });
  document.getElementById('richesse-max-dec').addEventListener('click', () => {
    const state = getState();
    state.character.richesseMax = Math.max(state.character.richesse, (state.character.richesseMax ?? 15) - 1);
    touch();
    renderGloireRichesse();
  });

  function wireNamedList(containerId, listKey) {
    const el = document.getElementById(containerId);
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const row = btn.closest('.item-row');
      const id = row.dataset.id;
      const state = getState();
      const item = state.character[listKey].find(i => i.id === id);
      if (!item) return;
      if (btn.dataset.act === 'item-inc') item.qty++;
      if (btn.dataset.act === 'item-dec') item.qty = Math.max(0, item.qty - 1);
      if (btn.dataset.act === 'item-remove') {
        state.character[listKey] = state.character[listKey].filter(i => i.id !== id);
        touch();
        renderNamedList(containerId, state.character[listKey]);
        return;
      }
      touch();
      row.querySelector('.item-qty-value').textContent = item.qty;
    });
    el.addEventListener('input', (e) => {
      const row = e.target.closest('.item-row');
      if (!row) return;
      const state = getState();
      const item = state.character[listKey].find(i => i.id === row.dataset.id);
      if (item && e.target.dataset.field === 'name') {
        item.name = e.target.value;
        touch();
      }
    });
  }
  wireNamedList('inventory-list', 'materiel');
  wireNamedList('found-list', 'objetsRecuperes');

  document.getElementById('add-item-btn').addEventListener('click', () => {
    const state = getState();
    state.character.materiel.push({ id: uid(), name: '', qty: 1 });
    touch();
    renderNamedList('inventory-list', state.character.materiel);
  });
  document.getElementById('add-found-btn').addEventListener('click', () => {
    const state = getState();
    state.character.objetsRecuperes.push({ id: uid(), name: '', qty: 1 });
    touch();
    renderNamedList('found-list', state.character.objetsRecuperes);
  });

  document.getElementById('add-keyword-btn').addEventListener('click', async () => {
    const text = await promptDialog('Nouveau mot-clé / code à retenir');
    if (!text) return;
    const state = getState();
    state.character.keywords.push({ id: uid(), text });
    touch();
    renderKeywords();
  });
  document.getElementById('keywords-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act="kw-remove"]');
    if (!btn) return;
    const chip = btn.closest('.keyword-chip');
    const state = getState();
    state.character.keywords = state.character.keywords.filter(k => k.id !== chip.dataset.id);
    touch();
    renderKeywords();
  });

  document.getElementById('death-btn').addEventListener('click', () => {
    confirmDialog('Recharger la dernière sauvegarde ? La progression non sauvegardée sera perdue.', async () => {
      const saves = await listSaves();
      if (!saves.length) { showToast('Aucune sauvegarde disponible'); return; }
      await loadFromSlot(saves[0].slotId);
      renderCharacterView();
      showToast('Dernière sauvegarde rechargée');
    }, { danger: true, confirmLabel: 'Recharger' });
  });

  document.getElementById('saves-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'new-save') {
      const name = await promptDialog('Nom de la sauvegarde', { placeholder: 'Ex: Avant le donjon', value: `Sauvegarde ${formatTime(Date.now())}` });
      if (!name) return;
      await saveToSlot(uid(), name);
      renderSaves();
      showToast('Sauvegarde créée');
      return;
    }
    const row = btn.closest('.save-row');
    const slotId = row.dataset.slot;
    if (act === 'load-save') {
      confirmDialog('Charger cette sauvegarde ? La progression actuelle non sauvegardée sera perdue.', async () => {
        await loadFromSlot(slotId);
        renderCharacterView();
        showToast('Sauvegarde chargée');
      });
    }
    if (act === 'overwrite-save') {
      confirmDialog('Écraser cette sauvegarde avec l\'état actuel ?', async () => {
        const saves = await listSaves();
        const existing = saves.find(s => s.slotId === slotId);
        await saveToSlot(slotId, existing ? existing.name : 'Sauvegarde');
        renderSaves();
        showToast('Sauvegarde mise à jour');
      });
    }
    if (act === 'delete-save') {
      confirmDialog('Supprimer définitivement cette sauvegarde ?', async () => {
        await deleteSaveSlot(slotId);
        renderSaves();
        showToast('Sauvegarde supprimée');
      }, { danger: true, confirmLabel: 'Supprimer' });
    }
  });
}

export function getPrimaryTotal(statKey) {
  return primaryTotal(statKey).sum;
}

export function getSecondaryTotal(statKey) {
  const state = getState();
  return (state.character.secondary[statKey] || 0) + materielBonusFor(state.character.classeItems, statKey);
}
