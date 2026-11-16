import { liquidacion, comparar, eur, nDias, diasPreaviso, TIPOS, AVISO_LEGAL } from './calc.js';
import { CONFIG, hasLicense, activate } from './license.js';
import { renderInforme } from './pdf.js';
import { track } from './track.js';

const $ = id => document.getElementById(id);
const form = $('calc');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let last = null; // { input, res, cmp }

// ---------- formulario dinámico ----------
function syncTipo() {
  const t = $('tipo').value;
  $('f-objetivo').classList.toggle('hidden', t !== 'objetivo');
  $('f-temporal').classList.toggle('hidden', t !== 'fin_temporal');
}
function prorrateadas() { return form.querySelector('input[name=prorrateadas]:checked').value === 'si'; }
function renderPagas() {
  $('f-pagas').classList.toggle('hidden', prorrateadas());
  const n = Math.min(4, Math.max(1, parseInt($('numPagas').value, 10) || 2));
  const box = $('pagas');
  const prev = [...box.querySelectorAll('.paga')].map(el => ({
    importe: el.querySelector('[data-k=importe]').value, mes: el.querySelector('[data-k=mes]').value, devengo: el.querySelector('[data-k=devengo]').value,
  }));
  const defMes = n === 2 ? ['6', '12'] : [];
  box.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const p = prev[i] || { importe: '', mes: defMes[i] || '', devengo: '' };
    const div = document.createElement('div');
    div.className = 'paga';
    div.innerHTML = `
      <div class="row three">
        <div><label for="pgImp${i}">Paga ${i + 1}: importe bruto (€) <span class="hint">Vacío = un salario mensual</span></label>
          <input id="pgImp${i}" data-k="importe" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(p.importe)}"></div>
        <div><label for="pgMes${i}">Mes en que se cobra <span class="hint">${defMes[i] ? 'Por defecto: ' + MESES[defMes[i] - 1] : 'Indícalo'}</span></label>
          <select id="pgMes${i}" data-k="mes"><option value="">Elige…</option>${MESES.map((m, k) => `<option value="${k + 1}"${String(k + 1) === p.mes ? ' selected' : ''}>${m}</option>`).join('')}</select></div>
        <div><label for="pgDev${i}">Periodo de devengo <span class="hint">Lo indica tu convenio</span></label>
          <select id="pgDev${i}" data-k="devengo"><option value="">Elige…</option>
            <option value="anual"${p.devengo === 'anual' ? ' selected' : ''}>Anual (12 meses)</option>
            <option value="semestral"${p.devengo === 'semestral' ? ' selected' : ''}>Semestral (6 meses)</option></select></div>
      </div>`;
    box.appendChild(div);
  }
}

function leerInput() {
  const v = id => $(id).value.trim();
  const numOrNull = id => (v(id) === '' ? null : Number(v(id)));
  const input = {
    tipo: v('tipo'), inicio: v('inicio'), fin: v('fin'),
    salario_mensual: Number(v('mensual')), pagas_prorrateadas: prorrateadas(),
    mes_pendiente: $('mesPendiente').checked,
    vacaciones_dias_anuales: Number(v('vacDias') || 30), vacaciones_unidad: v('vacUnidad'),
    vacaciones_disfrutadas: Number(v('vacTomadas') || 0),
  };
  if (v('anual')) input.salario_anual = Number(v('anual'));
  if (v('especial')) input.caso_especial = v('especial');
  if (input.tipo === 'fin_temporal') input.temporal_formativo_o_sustitucion = $('formativo').checked;
  const errores = [];
  // Preaviso: vacío o inválido en el despido objetivo → error claro, nunca 0 silencioso (B4).
  // En el fin de contrato temporal el campo es opcional: vacío = no indicado (B3).
  const preTxt = input.tipo === 'objetivo' ? v('preaviso') : input.tipo === 'fin_temporal' ? v('preavisoTemp') : '';
  if (input.tipo === 'objetivo' || preTxt !== '') {
    try { input.preaviso_dias_dados = diasPreaviso(preTxt); } catch (err) { errores.push(err.message); }
  }
  if (!input.inicio || !input.fin) errores.push('Indica las fechas de inicio y fin.');
  if (!input.caso_especial && !(input.salario_mensual > 0)) errores.push('Indica tu salario bruto mensual.');
  if (!input.pagas_prorrateadas) {
    input.pagas = [...$('pagas').querySelectorAll('.paga')].map((el, i) => {
      const imp = el.querySelector('[data-k=importe]').value;
      const mes = el.querySelector('[data-k=mes]').value;
      const dev = el.querySelector('[data-k=devengo]').value;
      if (!mes) errores.push(`Paga ${i + 1}: indica el mes en que se cobra.`);
      if (!dev) errores.push(`Paga ${i + 1}: indica si se devenga en 12 o en 6 meses (consulta tu convenio).`);
      return { nombre: `Paga extra ${i + 1} (${mes ? MESES[mes - 1] : '?'})`, importe: imp === '' ? input.salario_mensual : Number(imp), mes_pago: Number(mes), devengo: dev };
    });
  }
  const oferta = {
    total: numOrNull('ofTotal'),
    lineas: { dias_mes: numOrNull('ofDias'), vacaciones: numOrNull('ofVac'), pagas: numOrNull('ofPagas'), indemnizacion: numOrNull('ofInd') },
  };
  const hayOferta = oferta.total != null || Object.values(oferta.lineas).some(x => x != null);
  return { input, oferta: hayOferta ? oferta : null, errores };
}

// ---------- resultado ----------
function renderResultado(input, res, cmp) {
  const body = $('resBody');
  if (res.fuera_de_alcance) {
    body.innerHTML = `<h2 style="margin-top:0">Caso fuera del alcance de la herramienta</h2><p>${esc(res.avisos[0])}</p>`;
    $('paywall').classList.add('hidden');
    return;
  }
  $('paywall').classList.remove('hidden');
  const a = res.antiguedad;
  let html = `<p class="sub">${esc(TIPOS[input.tipo])} · antigüedad ${a.texto} (${nDias(a.dias)})</p>
    <p class="total">${eur(res.total)}</p>
    <p class="sub">Finiquito ${eur(res.total_finiquito)} + indemnización ${eur(res.total_indemnizacion)} · importes brutos</p>
    <div class="table-scroll"><table class="res"><thead><tr><th>Concepto</th><th class="num">Importe</th></tr></thead><tbody>`;
  for (const l of res.lineas) {
    html += `<tr><td>${esc(l.concepto)}<span class="formula">${esc(l.formula)} · <a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.base_legal)}</a></span></td><td class="num">${eur(l.importe)}</td></tr>`;
  }
  html += `</tbody></table></div>`;
  if (cmp && cmp.total_oferta != null) {
    const d = cmp.diferencia_total;
    const cls = d > 0.005 ? 'neg' : 'pos';
    const txt = d > 0.005 ? `Según esta estimación, la propuesta es <strong>${eur(d)} inferior</strong> a lo calculado.`
      : d < -0.005 ? `La propuesta es ${eur(-d)} superior a lo calculado.` : 'La propuesta coincide con lo calculado.';
    html += `<h3>Comparación con la propuesta de la empresa</h3><p class="gap ${cls}">Te ofrecen ${eur(cmp.total_oferta)}. ${txt}</p><p class="sub">El informe en PDF detalla la diferencia línea a línea y los plazos para reclamar.</p>`;
  }
  html += `<h3>Avisos</h3><ul class="avisos">${res.avisos.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
  body.innerHTML = html;
}

form.addEventListener('submit', e => {
  e.preventDefault();
  const { input, oferta, errores } = leerInput();
  $('formError').textContent = '';
  if (errores.length) { $('formError').textContent = errores.join(' '); return; }
  try {
    const res = liquidacion(input);
    const cmp = res.fuera_de_alcance ? null : comparar(res, oferta);
    last = { input, res, cmp, oferta };
    renderResultado(input, res, cmp);
    $('resultado').classList.remove('hidden');
    $('resultado').scrollIntoView({ behavior: 'smooth', block: 'start' });
    track('calc_done');
  } catch (err) {
    $('formError').textContent = err.message;
  }
});

// ---------- paywall ----------
async function syncLicense() {
  const ok = await hasLicense();
  $('pwLocked').classList.toggle('hidden', ok);
  $('pwUnlocked').classList.toggle('hidden', !ok);
}
$('price').textContent = CONFIG.price;
// Consentimiento expreso a la ejecución inmediata y pérdida del desistimiento (art. 103.m TRLGDCU): sin él no se compra.
function syncBuy() { $('buyBtn').disabled = !CONFIG.checkoutUrl || !$('consent').checked; }
if (!CONFIG.checkoutUrl) {
  $('buyBtn').textContent = 'Próximamente';
  $('buyNote').textContent = 'El pago aún no está disponible.';
}
$('consent').addEventListener('change', syncBuy);
syncBuy();
$('buyBtn').addEventListener('click', () => {
  if (!CONFIG.checkoutUrl || !$('consent').checked) return;
  track('pdf_click');
  window.open(CONFIG.checkoutUrl, '_blank', 'noopener');
});
$('activateBtn').addEventListener('click', async () => {
  const ok = await activate($('code').value);
  $('codeMsg').textContent = ok ? 'Código válido: informe desbloqueado.' : 'Código no válido. Revisa que lo has copiado completo.';
  $('codeMsg').className = ok ? '' : 'error';
  if (ok) { track('pdf_paid'); syncLicense(); }
});
$('pdfBtn').addEventListener('click', async () => {
  if (!last || !(await hasLicense())) return;
  renderInforme($('informe'), last, AVISO_LEGAL);
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
});

// ---------- arranque ----------
$('tipo').addEventListener('change', syncTipo);
form.querySelectorAll('input[name=prorrateadas]').forEach(r => r.addEventListener('change', renderPagas));
$('numPagas').addEventListener('change', renderPagas);
try {
  const t = new URLSearchParams(location.search).get('tipo');
  if (t && TIPOS[t]) $('tipo').value = t;
} catch { /* sin parámetros */ }
syncTipo();
renderPagas();
syncLicense();
