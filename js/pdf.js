// «Informe de liquidación»: se genera en el navegador como hoja de impresión (window.print → Guardar como PDF).
import { eur, num, nDias, TIPOS, BOE } from './calc.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fecha = iso => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

const CHECKLIST = [
  'Comprueba que la fecha de baja y la antigüedad del documento coinciden con tu contrato y tu vida laboral.',
  'Revisa que el salario de los días del último mes, las vacaciones pendientes y las pagas extra aparecen por separado.',
  'Si te despiden, distingue en el documento la indemnización del resto del finiquito: tributan de forma distinta.',
  'Pide la propuesta del documento de liquidación por escrito: la empresa debe entregarla al comunicar la extinción (art. 49.2 ET).',
  'Puedes pedir que un representante legal de los trabajadores esté presente en la firma; el recibo debe reflejar si lo estuvo o no (art. 49.2 ET).',
  'Si no estás de acuerdo con los importes, puedes escribir «no conforme» junto a tu firma para dejar constancia de que solo acusas recibo; su efecto concreto depende del caso.',
  'Guarda una copia firmada del documento y de tus últimas nóminas.',
  'No dejes pasar los plazos: 20 días hábiles para impugnar un despido y 1 año para reclamar cantidades (art. 59 ET).',
];

export function renderInforme(el, { input, res, cmp }, aviso) {
  const a = res.antiguedad;
  const despido = ['improcedente', 'objetivo', 'disciplinario_procedente', 'fin_temporal'].includes(input.tipo);
  const datos = [
    ['Motivo de la extinción', TIPOS[input.tipo]],
    ['Inicio del contrato', fecha(input.inicio)],
    ['Último día de contrato', fecha(input.fin)],
    ['Antigüedad', `${a.texto} (${nDias(a.dias)}; mes empezado = mes entero)`],
    ['Salario bruto mensual', eur(input.salario_mensual)],
    ['Pagas extra', input.pagas_prorrateadas ? 'Prorrateadas en la nómina' : (input.pagas || []).map(p => `${p.nombre}: ${eur(p.importe)}, devengo ${p.devengo}`).join(' · ')],
    ['Salario anual de referencia', `${eur(res.salarios.anual)}${input.salario_anual ? ' (indicado por ti)' : ' (12 mensualidades + pagas)'}`],
    ['Salario diario (indemnización)', `${num(res.salarios.dia_indemnizacion, 4)} € = salario anual / 365`],
    ['Salario diario (días y vacaciones)', `${num(res.salarios.dia_ordinario, 4)} € = salario mensual × 12 / 365`],
    ['Vacaciones', `${input.vacaciones_dias_anuales} días ${input.vacaciones_unidad || 'naturales'} al año; ${num(input.vacaciones_disfrutadas || 0)} ya disfrutados`],
  ];
  if (input.tipo === 'objetivo') datos.push(['Preaviso recibido', `${nDias(input.preaviso_dias_dados ?? 15)} (mínimo legal 15)`]);
  if (input.tipo === 'fin_temporal' && input.preaviso_dias_dados != null) datos.push(['Preaviso recibido', `${nDias(input.preaviso_dias_dados)} (mínimo legal 15 si el contrato dura más de un año)`]);
  if (input.tipo === 'fin_temporal') datos.push(['Contrato formativo o de sustitución', input.temporal_formativo_o_sustitucion ? 'Sí' : 'No']);

  let h = `<h1>Informe de liquidación</h1>
  <p>Estimación del finiquito y de la indemnización según el Estatuto de los Trabajadores (texto consolidado del BOE). Generado el ${fecha(new Date().toISOString().slice(0, 10))}.</p>
  <p class="disclaimer">${esc(aviso)}</p>
  <h2>1. Datos introducidos</h2><table>${datos.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>
  <h2>2. Cálculo línea a línea</h2>
  <table><thead><tr><th>Concepto, fórmula y base legal</th><th class="num">Importe bruto</th></tr></thead><tbody>
  ${res.lineas.map(l => `<tr><td><strong>${esc(l.concepto)}</strong><span class="formula">${esc(l.formula)}</span><span class="formula">${esc(l.base_legal)} — <span class="url">${esc(l.url)}</span></span></td><td class="num">${eur(l.importe)}</td></tr>`).join('')}
  <tr><td><strong>Total estimado</strong> (finiquito ${eur(res.total_finiquito)} + indemnización ${eur(res.total_indemnizacion)})</td><td class="num"><strong>${eur(res.total)}</strong></td></tr>
  </tbody></table>`;

  h += `<h2>3. Comparación con la propuesta de la empresa</h2>`;
  if (cmp && (cmp.lineas.length || cmp.total_oferta != null)) {
    h += `<table><thead><tr><th>Concepto</th><th class="num">Calculado</th><th class="num">Ofrecido</th><th class="num">Diferencia</th></tr></thead><tbody>`;
    for (const l of cmp.lineas) h += `<tr><td>${esc(l.concepto)}</td><td class="num">${eur(l.calculado)}</td><td class="num">${eur(l.ofrecido)}</td><td class="num">${eur(l.diferencia)}</td></tr>`;
    if (cmp.total_oferta != null) h += `<tr><td><strong>Total</strong></td><td class="num">${eur(res.total)}</td><td class="num">${eur(cmp.total_oferta)}</td><td class="num"><strong>${eur(cmp.diferencia_total)}</strong></td></tr>`;
    h += `</tbody></table>`;
    const faltan = cmp.lineas.filter(l => l.diferencia > 0.005);
    h += faltan.length || (cmp.diferencia_total ?? 0) > 0.005
      ? `<p><strong>Diferencias a favor de la persona trabajadora detectadas:</strong> ${faltan.map(l => `${esc(l.concepto)} (${eur(l.diferencia)})`).join('; ') || 'en el total'}. Pide a la empresa que te explique cada diferencia antes de firmar. Una diferencia puede deberse a un criterio distinto (convenio, salario diario ÷30, conceptos variables), no necesariamente a un error.</p>`
      : `<p>No se detectan importes ofrecidos inferiores a la estimación.</p>`;
  } else {
    h += `<p>No has indicado la propuesta de la empresa. Puedes repetir el cálculo con sus importes para obtener la comparación línea a línea.</p>`;
  }

  h += `<h2>4. Plazos para reclamar</h2><ul>
    ${despido ? `<li><strong>20 días hábiles</strong> desde el día siguiente al despido o a la extinción del contrato temporal para presentar la demanda; es un plazo de caducidad. La presentación de la solicitud de conciliación ante el servicio público de mediación (SMAC o el equivalente de tu comunidad autónoma) lo interrumpe (art. 59.3 ET — ${BOE.a59}).</li>` : ''}
    <li><strong>1 año</strong> para reclamar cantidades (salarios, vacaciones, pagas) desde que pudieron exigirse (art. 59.1 y 59.2 ET — ${BOE.a59}).</li>
    <li>Antes de la demanda suele ser obligatoria la papeleta de conciliación. Un abogado laboralista o un sindicato puede confirmarte los plazos exactos de tu caso.</li></ul>`;

  h += `<h2>5. Antes de firmar el finiquito</h2><ol>${CHECKLIST.map(c => `<li>${esc(c)}</li>`).join('')}</ol>`;

  h += `<h2>6. Información fiscal</h2><p>Según el art. 7.e de la Ley 35/2006 del IRPF, la indemnización por despido está exenta en la cuantía obligatoria fijada por el Estatuto de los Trabajadores, con un límite de 180.000 €; no lo está la que se fija solo por convenio, pacto o contrato. El resto del finiquito (salario, vacaciones, pagas) tributa como rendimiento del trabajo. Confirma tu situación con la Agencia Tributaria o un asesor (${BOE.irpf7}).</p>`;

  h += `<h2>7. Avisos y criterio de cálculo</h2><ul>${res.avisos.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
  <p class="disclaimer">${esc(aviso)}</p>`;
  el.innerHTML = h;
}
