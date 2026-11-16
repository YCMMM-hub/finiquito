// Medición de audiencia sin cookies (GoatCounter). Solo en el sitio público (https, fuera de localhost).
// Eventos: calc_done, pdf_click, pdf_paid.
export const GOATCOUNTER = 'https://finiquito.goatcounter.com/count';

const enabled = () => {
  try { return GOATCOUNTER && location.protocol === 'https:' && !/^(localhost|127\.)/.test(location.hostname); } catch { return false; }
};

function send(params) {
  if (!enabled()) return;
  try {
    const url = `${GOATCOUNTER}?${params}&r=${encodeURIComponent(document.referrer)}`;
    if (navigator.sendBeacon) navigator.sendBeacon(url);
    else fetch(url, { method: 'POST', keepalive: true, mode: 'no-cors' });
  } catch { /* la medición nunca debe bloquear la herramienta */ }
}

export function track(event) {
  send(`p=${encodeURIComponent('/event/' + event)}&t=${encodeURIComponent(event)}&e=true`);
}

export function trackPageview() {
  try { send(`p=${encodeURIComponent(location.pathname)}`); } catch { /* idem */ }
}

trackPageview();
