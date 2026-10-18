import { getState, touch, uid } from './state.js';
import { escapeHtml, formatTime, confirmDialog } from './ui.js';
import { getPrimaryTotal, getSecondaryTotal } from './character.js';
import { detectClasse } from './billyData.js';
import { rollDice } from './dice.js';

const ENEMY_BOX_MAX = 20;

function boxesHtml(current, max) {
  return Array.from({ length: max }, (_, i) =>
    `<button type="button" class="stat-box ${i < current ? 'filled' : ''}" data-act="box" data-index="${i}"></button>`
  ).join('');
}

function enemyStatRowHtml(stat) {
  const max = Math.max(0, Number(stat.max) || 0);
  const current = Math.max(0, Math.min(Number(stat.current) || 0, max));
  const boxes = max
    ? boxesHtml(current, Math.min(max, ENEMY_BOX_MAX))
    : '<span class="stat-box-hint">Appuie sur + pour ajouter des cases</span>';
  return `
    <div class="stat-row" data-id="${stat.id}">
      <div class="stat-row-top">
        <input type="text" class="stat-name" value="${escapeHtml(stat.name)}" data-field="name" placeholder="Nom">
        <div class="stat-max-ctrl">
          <button class="mini-btn" data-act="max-dec">-</button>
          <span class="stat-max-value">${current}/${max}</span>
          <button class="mini-btn" data-act="max-inc">+</button>
        </div>
        <button class="remove-btn" data-act="remove">✕</button>
      </div>
      <div class="stat-boxes">${boxes}</div>
    </div>`;
}

function renderEnemyStats() {
  const state = getState();
  const el = document.getElementById('enemy-stats-list');
  const stats = state.combat.enemyStats;
  el.innerHTML = stats.length
    ? stats.map(enemyStatRowHtml).join('')
    : '<div class="empty-hint">Aucune caractéristique. Ajoute-en une.</div>';
}

function renderCombatLog() {
  const state = getState();
  const el = document.getElementById('combat-log');
  const log = state.combat.log;
  el.innerHTML = log.length ? log.map(l => `
    <div class="combat-log-row"><span class="cl-time">${formatTime(l.time)}</span>${escapeHtml(l.text)}</div>
  `).join('') : '<div class="empty-hint">Aucune action encore.</div>';
}

function addLog(text) {
  const state = getState();
  state.combat.log.push({ id: uid(), time: Date.now(), text });
  touch();
  renderCombatLog();
}

function resolveBillyTurn() {
  const state = getState();
  const adr = getPrimaryTotal('adresse');
  const classe = detectClasse(state.character.classeItems);

  const atk = rollDice(1, 6, 0);
  let atkMsg = `🗡️ Jet d'attaque : ${atk.total} — consulte la Table des situations pour les dégâts.`;
  if (classe === 'guerrier') atkMsg += ' (Guerrier : +1 DÉGÂTS à cette attaque)';
  if (classe === 'debrouillard') atkMsg += ' (Débrouillard : tu peux relancer ce dé une fois si tu veux)';
  addLog(atkMsg);

  if (adr < 2) {
    addLog(`ADRESSE ${adr} < 2 : un seul jet ce tour, pas de phase d'esquive.`);
    return;
  }

  const dodge = rollDice(1, 6, 0);
  if (dodge.total <= adr) {
    addLog(`🛡️ Jet d'esquive : ${dodge.total} (≤ ADRESSE ${adr}) → Esquive totale, aucun dégât subi ce tour.`);
    if (dodge.total === 1) {
      const crit = getSecondaryTotal('critique');
      addLog(`💥 CONTRE-ATTAQUE CRITIQUE ! Dégâts = dégâts MAX de la situation + CRITIQUE (${crit}), appliqués en ignorant l'armure adverse.`);
    }
  } else {
    let failMsg = `🛡️ Jet d'esquive : ${dodge.total} (> ADRESSE ${adr}) → Échec, tu subis les dégâts normaux de l'attaque adverse.`;
    if (classe === 'paysan') failMsg += ' (Paysan : jamais plus de 3 PV perdus ce tour)';
    addLog(failMsg);
  }
}

export function renderCombatView() {
  const state = getState();
  document.getElementById('enemy-name').value = state.combat.enemyName;
  document.getElementById('combat-formula').value = state.combat.formula;
  renderEnemyStats();
  renderCombatLog();
}

export function initCombatView() {
  const state = getState();

  document.getElementById('enemy-name').addEventListener('input', (e) => {
    state.combat.enemyName = e.target.value;
    touch();
  });

  document.getElementById('combat-formula').addEventListener('input', (e) => {
    state.combat.formula = e.target.value;
    touch();
  });

  document.getElementById('add-enemy-stat-btn').addEventListener('click', () => {
    state.combat.enemyStats.push({ id: uid(), name: '', current: 0, max: 10 });
    touch();
    renderEnemyStats();
  });

  const list = document.getElementById('enemy-stats-list');
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const row = btn.closest('.stat-row');
    const stat = state.combat.enemyStats.find(s => s.id === row.dataset.id);
    if (!stat) return;
    if (btn.dataset.act === 'box') {
      const index = Number(btn.dataset.index);
      stat.current = (stat.current === index + 1) ? index : index + 1;
    }
    if (btn.dataset.act === 'max-inc') stat.max = (Number(stat.max) || 0) + 1;
    if (btn.dataset.act === 'max-dec') {
      stat.max = Math.max(0, (Number(stat.max) || 0) - 1);
      stat.current = Math.min(stat.current, stat.max);
    }
    if (btn.dataset.act === 'remove') {
      state.combat.enemyStats = state.combat.enemyStats.filter(s => s.id !== row.dataset.id);
      touch();
      renderEnemyStats();
      return;
    }
    touch();
    renderEnemyStats();
  });

  list.addEventListener('input', (e) => {
    const row = e.target.closest('.stat-row');
    if (!row) return;
    const stat = state.combat.enemyStats.find(s => s.id === row.dataset.id);
    if (!stat) return;
    if (e.target.dataset.field === 'name') {
      stat.name = e.target.value;
      touch();
    }
  });

  function doRoll(label) {
    const count = Math.max(1, state.dice.count || 1);
    const type = state.dice.type || 6;
    const modifier = state.dice.modifier || 0;
    const { rolls, total } = rollDice(count, type, modifier);
    document.getElementById('combat-roll-result').innerHTML = `
      <div class="total">${total}</div>
      <div class="breakdown">${label} — ${count}d${type}${modifier ? (modifier > 0 ? '+' + modifier : modifier) : ''} → [${rolls.join(', ')}]</div>
    `;
    addLog(`${label} : ${total} (${rolls.join(', ')})`);
  }

  document.getElementById('roll-player-btn').addEventListener('click', () => doRoll('Jet Joueur'));
  document.getElementById('roll-enemy-btn').addEventListener('click', () => doRoll('Jet Ennemi'));
  document.getElementById('billy-turn-btn').addEventListener('click', resolveBillyTurn);

  document.getElementById('add-combat-note-btn').addEventListener('click', () => {
    const input = document.getElementById('combat-note-input');
    const text = input.value.trim();
    if (!text) return;
    addLog(text);
    input.value = '';
  });
  document.getElementById('combat-note-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('add-combat-note-btn').click();
  });

  document.getElementById('reset-combat-btn').addEventListener('click', () => {
    confirmDialog('Démarrer un nouveau combat ? L\'ennemi et le journal actuels seront effacés.', () => {
      state.combat = { enemyName: '', enemyStats: [], formula: state.combat.formula, log: [] };
      touch();
      renderCombatView();
    }, { danger: true, confirmLabel: 'Nouveau combat' });
  });
}
