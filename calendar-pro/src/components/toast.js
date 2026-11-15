/**
 * toast.js — Geçici bilgilendirme mesajları (isteğe bağlı eylem butonu, ör. "Geri al").
 */
let stack = null;

function ensureStack() {
  if (!stack || !stack.isConnected) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    stack.setAttribute('role', 'status');
    stack.setAttribute('aria-live', 'polite');
    document.body.appendChild(stack);
  }
  return stack;
}

/**
 * @param {string} message
 * @param {{type?: 'info'|'success'|'error'|'warning', duration?: number, action?: {label: string, onClick: Function}, dismissible?: boolean}} options
 *   duration: ms cinsinden; 0 → kendiliğinden kapanmaz (kullanıcı kapatır). dismissible: sağda × kapatma düğmesi gösterir.
 * @returns {Function} kapatma fonksiyonu
 */
export function toast(message, { type = 'info', duration = 3200, action, dismissible = false } = {}) {
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;

  const dot = document.createElement('span');
  dot.className = 'toast-dot';
  const text = document.createElement('span');
  text.className = 'toast-msg';
  text.textContent = message;
  el.append(dot, text);

  let timer = null;
  const dismiss = () => {
    clearTimeout(timer);
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 250);
  };

  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-action';
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      action.onClick();
      dismiss();
    });
    el.appendChild(btn);
  }

  if (dismissible) {
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-close';
    close.setAttribute('aria-label', 'Kapat');
    close.textContent = '×';
    close.addEventListener('click', dismiss);
    el.appendChild(close);
  }

  ensureStack().appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  if (duration > 0) timer = setTimeout(dismiss, duration);
  return dismiss;
}
