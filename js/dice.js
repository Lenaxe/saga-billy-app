import { getState, touch, uid } from './state.js';
import { formatTime, confirmDialog } from './ui.js';

export function rollDice(count, type, modifier) {
  const rolls = [];
  for (let i = 0; i < count; i++) {
    rolls.push(1 + Math.floor(Math.random() * type));
  }
  const total = rolls.reduce((a, b) => a + b, 0) + modifier;
  return { rolls, total };
}

function formulaLabel(count, type, modifier) {
  const mod = modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : '';
  return `${count}d${type}${mod}`;
}

function renderResult(targetId, formula, rolls, total) {
  const el = document.getElementById(targetId);
  el.innerHTML = `
    <div class="total">${total}</div>
    <div class="breakdown">${formula} → [${rolls.join(', ')}]</div>
  `;
}

export function renderDiceHistory() {
  const state = getState();
  const el = document.getElementById('dice-history');
  const hist = [...state.dice.history].reverse();
  el.innerHTML = hist.length ? hist.map(h => `
    <div class="dice-history-row">
      <span>${h.formula} → [${h.rolls.join(', ')}]</span>
      <span><span class="dh-total">${h.total}</span> <span class="dh-time">${formatTime(h.time)}</span></span>
    </div>`).join('') : '<div class="empty-hint">Aucun jet encore.</div>';
}

export function initDiceView() {
  const state = getState();
  document.getElementById('dice-count').value = state.dice.count;
  document.getElementById('dice-type').value = state.dice.type;
  document.getElementById('dice-modifier').value = state.dice.modifier;
  renderDiceHistory();

  const rollBtn = document.getElementById('roll-btn');
  rollBtn.addEventListener('click', () => {
    const count = Math.max(1, Math.min(20, Number(document.getElementById('dice-count').value) || 1));
    const type = Number(document.getElementById('dice-type').value);
    const modifier = Number(document.getElementById('dice-modifier').value) || 0;
    state.dice.count = count;
    state.dice.type = type;
    state.dice.modifier = modifier;

    rollBtn.classList.remove('rolling');
    requestAnimationFrame(() => rollBtn.classList.add('rolling'));

    const { rolls, total } = rollDice(count, type, modifier);
    const formula = formulaLabel(count, type, modifier);
    setTimeout(() => {
      renderResult('dice-result', formula, rolls, total);
    }, 150);

    state.dice.history.push({ id: uid(), time: Date.now(), formula, rolls, total });
    if (state.dice.history.length > 20) state.dice.history = state.dice.history.slice(-20);
    touch();
    renderDiceHistory();
  });

  document.getElementById('clear-dice-history-btn').addEventListener('click', () => {
    confirmDialog('Effacer tout l\'historique des jets ?', () => {
      state.dice.history = [];
      touch();
      renderDiceHistory();
    }, { danger: true, confirmLabel: 'Effacer' });
  });
}
