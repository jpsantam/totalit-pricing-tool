/* ===== feedback widget — mailto, no backend required ===== */
(function () {
  const fab = document.getElementById('fb-fab');
  const panel = document.getElementById('fb-panel');
  const closeBtn = document.getElementById('fb-close');
  const sendBtn = document.getElementById('fb-send');
  const text = document.getElementById('fb-text');
  const status = document.getElementById('fb-status');

  fab.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) text.focus();
  });
  closeBtn.addEventListener('click', () => { panel.hidden = true; });

  sendBtn.addEventListener('click', () => {
    const msg = text.value.trim();
    if (!msg) { text.focus(); return; }
    const body = `${msg}\n\n---\nSent from: ${location.href}`;
    const mailto = 'mailto:john-patrick.santa-maria@ironbridgesg.com'
      + `?subject=${encodeURIComponent('totalIT pricing tool feedback')}`
      + `&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    status.hidden = false;
    status.textContent = 'Opening your email client — hit send there to submit.';
  });
})();
