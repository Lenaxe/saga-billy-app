export function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 2200);
}

export function formatTime(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function openModal(innerHtml, { onMount } = {}) {
  const root = document.getElementById('modal-root');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal-box">${innerHtml}</div>`;
  root.appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  if (onMount) onMount(backdrop.querySelector('.modal-box'), close);
  return close;
}

export function confirmDialog(message, onConfirm, { danger = false, confirmLabel = 'Confirmer' } = {}) {
  openModal(`
    <h3>${escapeHtml(message)}</h3>
    <div class="modal-actions">
      <button class="btn" data-act="cancel">Annuler</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-accent'}" data-act="ok">${escapeHtml(confirmLabel)}</button>
    </div>
  `, {
    onMount(box, close) {
      box.querySelector('[data-act="cancel"]').onclick = close;
      box.querySelector('[data-act="ok"]').onclick = () => { close(); onConfirm(); };
    }
  });
}

export function promptDialog(title, { placeholder = '', value = '', multiline = false } = {}) {
  return new Promise((resolve) => {
    const fieldHtml = multiline
      ? `<textarea id="prompt-field" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>`
      : `<input id="prompt-field" type="text" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(value)}">`;
    openModal(`
      <h3>${escapeHtml(title)}</h3>
      ${fieldHtml}
      <div class="modal-actions">
        <button class="btn" data-act="cancel">Annuler</button>
        <button class="btn btn-accent" data-act="ok">OK</button>
      </div>
    `, {
      onMount(box, close) {
        const field = box.querySelector('#prompt-field');
        field.focus();
        const submit = () => { const v = field.value; close(); resolve(v); };
        box.querySelector('[data-act="cancel"]').onclick = () => { close(); resolve(null); };
        box.querySelector('[data-act="ok"]').onclick = submit;
        if (!multiline) {
          field.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
        }
      }
    });
  });
}
