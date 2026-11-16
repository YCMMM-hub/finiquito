// Motor de cálculo del finiquito y la indemnización (España, Estatuto de los Trabajadores).
// Módulo ES puro: sin DOM, sin dependencias. Fechas en UTC con formato 'AAAA-MM-DD'.
// Cada línea lleva su fórmula en claro y su base legal (sirve para el PDF y para la auditoría).
// Texto legal verificado sobre el BOE consolidado (RDLeg 2/2015) el 2026-11-16.

const ET = 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-11430';
export const BOE = {
  a14: `${ET}#a14`, a31: `${ET}#a31`, a38: `${ET}#a38`, a49: `${ET}#a49`, a51: `${ET}#a51`,
  a53: `${ET}#a53`, a55: `${ET}#a55`, a56: `${ET}#a56`, a59: `${ET}#a59`,
  dt8: `${ET}#dtoctava`, dt11: `${ET}#dtundecima`,
  irpf7: 'https://www.boe.es/buscar/act.php?id=BOE-A-2006-20764#a7',
};

export const TIPOS = {
  improcedente: 'Despido improcedente',
  objetivo: 'Despido objetivo o colectivo',
  disciplinario_procedente: 'Despido disciplinario procedente',
  fin_temporal: 'Fin de contrato temporal',
  dimision: 'Baja voluntaria (dimisión)',
  periodo_prueba: 'No superar el periodo de prueba',
};

export const FUERA_DE_ALCANCE = {
  hogar: 'Empleada o empleado de hogar: régimen especial (RD 1620/2011) con reglas de indemnización propias.',
  fijo_discontinuo: 'Fijo discontinuo: la antigüedad se computa de forma específica según los periodos trabajados.',
  alta_direccion: 'Alta dirección: relación laboral especial con indemnizaciones pactadas o propias (RD 1382/1985).',
  nulidad: 'Despido nulo: implica readmisión y salarios de tramitación, no una indemnización calculable aquí.',
  tramitacion: 'Salarios de tramitación: dependen de la sentencia y de la opción por la readmisión.',
  ere_acuerdo: 'ERE con acuerdo superior al mínimo legal: la cuantía la fija el acuerdo, no la ley.',
  incapacidad: 'Incapacidad permanente: la extinción sigue reglas propias (art. 49.1.e ET y Seguridad Social).',
};

export const AVISO_LEGAL = 'Herramienta de estimación. No es asesoramiento jurídico. En caso de conflicto, consulta a un abogado laboralista o a un sindicato.';

const DAY = 86400000;
const REFORMA_2012 = '2012-02-12';

// ---------- fechas ----------
export function parseFecha(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`Fecha no válida: ${s}`);
  const [y, m, d] = s.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) throw new Error(`Fecha no válida: ${s}`);
  return t;
}
const fmt = t => new Date(t).toISOString().slice(0, 10);
const addDays = (t, n) => t + n * DAY;
const ymd = t => { const d = new Date(t); return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]; };

/** Días naturales entre a y b, ambos incluidos (0 si b < a). */
export function diasInclusive(a, b) {
  const ta = typeof a === 'string' ? parseFecha(a) : a;
  const tb = typeof b === 'string' ? parseFecha(b) : b;
  return tb < ta ? 0 : Math.round((tb - ta) / DAY) + 1;
}

/**
 * Meses de servicio entre a y b (ambos incluidos), contando el mes empezado como mes entero
 * (criterio de «prorrateo por meses»). 0 si el tramo está vacío.
 */
export function mesesCompletosOEmpezados(a, b) {
  const ta = typeof a === 'string' ? parseFecha(a) : a;
  const tb = typeof b === 'string' ? parseFecha(b) : b;
  if (tb < ta) return 0;
  const [y1, m1, d1] = ymd(ta);
  const [y2, m2, d2] = ymd(addDays(tb, 1)); // fin exclusivo
  let meses = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) meses -= 1;           // el último mes no se ha completado...
  if (d2 !== d1) meses += 1;         // ...pero un mes empezado cuenta como entero
  return Math.max(meses, 0);
}

/** Antigüedad legible y en meses (mes empezado = mes entero). */
export function antiguedad(inicio, fin) {
  const ta = parseFecha(inicio), tb = parseFecha(fin);
  if (tb < ta) throw new Error('La fecha de fin es anterior a la de inicio.');
  const meses = mesesCompletosOEmpezados(ta, tb);
  const anios = Math.floor(meses / 12), mesesResto = meses % 12;
  const texto = `${anios} ${anios === 1 ? 'año' : 'años'} y ${mesesResto} ${mesesResto === 1 ? 'mes' : 'meses'}`;
  return { dias: diasInclusive(ta, tb), meses, anios, mesesResto, texto };
}

export const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
const eur = x => r2(x).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
/** «1 día» / «2 días», «1 mes» / «3 meses» (B7). */
export const nDias = n => `${n} ${n === 1 ? 'día' : 'días'}`;
export const nMeses = n => `${n} ${n === 1 ? 'mes' : 'meses'}`;
const num = (x, d = 2) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString('es-ES', { maximumFractionDigits: d });

// ---------- salarios de referencia ----------
export function salarios(input) {
  const mensual = Number(input.salario_mensual) || 0;
  const pagas = input.pagas_prorrateadas ? [] : (input.pagas || []);
  const anualCalculado = mensual * 12 + pagas.reduce((s, p) => s + (Number(p.importe) || 0), 0);
  const anual = Number(input.salario_anual) > 0 ? Number(input.salario_anual) : anualCalculado;
  return {
    mensual,
    anual,
    dia_indemnizacion: anual / 365,
    dia_ordinario: mensual * 12 / 365,
  };
}

// ---------- finiquito ----------
function periodoPaga(paga, tFin) {
  // La paga se cobra al final de su mes de pago. Periodo de devengo: los 12 (anual) o 6 (semestral)
  // meses que terminan el último día de ese mes. Se busca el periodo que contiene la fecha de fin.
  const mesPago = Number(paga.mes_pago);
  const meses = paga.devengo === 'semestral' ? 6 : 12;
  const [yf] = ymd(tFin);
  for (const y of [yf, yf + 1]) {
    const finPeriodo = Date.UTC(y, mesPago, 0);             // último día del mes de pago
    const iniPeriodo = Date.UTC(y, mesPago - meses, 1);      // primer día del periodo
    if (tFin >= iniPeriodo && tFin <= finPeriodo) return { iniPeriodo, finPeriodo };
  }
  return null; // la fecha de fin cae fuera de cualquier periodo de devengo (paga semestral)
}

/** Días de preaviso dados por la empresa: entero ≥ 0, o error claro (B4). */
export function diasPreaviso(v) {
  const n = typeof v === 'string' ? (v.trim() === '' ? NaN : Number(v)) : v;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) throw new Error('Indica los días de preaviso que te dio la empresa: un número entero de 0 a 15 (0 si no te avisaron).');
  return n;
}

/** Contrato de duración superior a un año: el último día es posterior al día anterior al primer aniversario. */
export function temporalMasDeUnAnio(tIni, tFin) {
  const [y, m, d] = ymd(tIni);
  return tFin >= Date.UTC(y + 1, m - 1, d); // 01/01/2025 → 31/12/2025 = 1 año justo (no); → 01/01/2026 = 1 año y 1 día (sí)
}

export function finiquito(input) {
  const s = salarios(input);
  const tIni = parseFecha(input.inicio), tFin = parseFecha(input.fin);
  const lineas = [], avisos = [];

  // 1. Días trabajados del mes
  if (input.mes_pendiente !== false) {
    const [y, m] = ymd(tFin);
    const desde = Math.max(Date.UTC(y, m - 1, 1), tIni);
    const dias = diasInclusive(desde, tFin);
    lineas.push({
      id: 'dias_mes', concepto: 'Salario de los días trabajados del último mes',
      formula: `${nDias(dias)} × ${num(s.dia_ordinario, 4)} €/día (salario mensual × 12 / 365)`,
      importe: r2(dias * s.dia_ordinario), base_legal: 'Salario devengado y no pagado (liquidación, art. 49.2 ET)', url: BOE.a49,
    });
  }

  // 2. Vacaciones no disfrutadas
  const anuales = input.vacaciones_dias_anuales ?? 30;
  const laborables = input.vacaciones_unidad === 'laborables';
  if (laborables && anuales * 7 / 5 < 30) avisos.push(`${anuales} días laborables equivalen a menos de 30 días naturales, el mínimo del art. 38.1 ET.`);
  if (!laborables && anuales < 30) avisos.push(`${anuales} días naturales es inferior al mínimo legal de 30 días naturales (art. 38.1 ET).`);
  const [yFin] = ymd(tFin);
  const diasAnio = diasInclusive(Math.max(Date.UTC(yFin, 0, 1), tIni), tFin);
  const devengadas = anuales * diasAnio / 365;
  const disfrutadas = Number(input.vacaciones_disfrutadas) || 0;
  let pendientes = devengadas - disfrutadas;
  if (pendientes < 0) {
    avisos.push(`Has disfrutado ${num(disfrutadas)} días de vacaciones y solo habías generado ${num(devengadas)}: la herramienta pone 0 €. Revisa si tu empresa descuenta el exceso y si tu convenio lo permite.`);
    pendientes = 0;
  }
  const factor = laborables ? 7 / 5 : 1;
  lineas.push({
    id: 'vacaciones', concepto: 'Vacaciones generadas y no disfrutadas',
    formula: `(${anuales} días ${laborables ? 'laborables' : 'naturales'} × ${nDias(diasAnio)} trabajados en ${yFin} / 365 = ${num(devengadas)}) − ${num(disfrutadas)} disfrutados = ${num(pendientes)} días${laborables ? ' × 7/5 (equivalencia laborable → natural)' : ''} × ${num(s.dia_ordinario, 4)} €/día`,
    importe: r2(pendientes * factor * s.dia_ordinario), base_legal: 'Art. 38.1 ET', url: BOE.a38,
  });

  // 3. Pagas extraordinarias no prorrateadas
  if (!input.pagas_prorrateadas) {
    (input.pagas || []).forEach((p, i) => {
      const per = periodoPaga(p, tFin);
      const nombre = p.nombre || `Paga extraordinaria ${i + 1}`;
      if (!per) {
        lineas.push({ id: `paga_${i}`, concepto: `${nombre} (parte proporcional)`, formula: `La fecha de fin no cae en el periodo de devengo ${p.devengo} de esta paga: nada pendiente`, importe: 0, base_legal: 'Art. 31 ET', url: BOE.a31 });
        return;
      }
      const desde = Math.max(per.iniPeriodo, tIni);
      const devengados = diasInclusive(desde, tFin);
      const periodo = diasInclusive(per.iniPeriodo, per.finPeriodo);
      if (ymd(tFin)[1] === Number(p.mes_pago)) avisos.push(`Tu contrato termina en el mes de cobro de «${nombre}»: si ya la has cobrado en la nómina de ese mes, réstala del total.`);
      lineas.push({
        id: `paga_${i}`, concepto: `${nombre} (parte proporcional)`,
        formula: `${num(p.importe)} € × ${nDias(devengados)} devengados desde ${fmt(desde)} / ${periodo} días del periodo ${fmt(per.iniPeriodo)} – ${fmt(per.finPeriodo)}`,
        importe: r2(p.importe * devengados / periodo), base_legal: 'Art. 31 ET', url: BOE.a31,
      });
    });
  }

  // 4. Preaviso no respetado (despido objetivo)
  if (input.tipo === 'objetivo') {
    // Sin dato (null/undefined) se supone el preaviso legal completo; un valor vacío o no numérico es un error (B4).
    const dados = input.preaviso_dias_dados == null ? 15 : Math.min(15, diasPreaviso(input.preaviso_dias_dados));
    const faltan = 15 - dados;
    if (faltan > 0) lineas.push({
      id: 'preaviso', concepto: 'Salarios del preaviso no concedido',
      formula: `(15 − ${dados}) días = ${nDias(faltan)} × ${num(s.dia_ordinario, 4)} €/día`,
      importe: r2(faltan * s.dia_ordinario), base_legal: 'Art. 53.1.c y 53.4 ET', url: BOE.a53,
    });
  }

  // 4 bis. Preaviso de 15 días de los contratos temporales de más de un año (art. 49.1.c ET) (B3)
  if (input.tipo === 'fin_temporal' && temporalMasDeUnAnio(tIni, tFin)) {
    if (input.preaviso_dias_dados == null || input.preaviso_dias_dados === '') {
      avisos.push('Tu contrato temporal dura más de un año: la empresa debía avisarte del fin con al menos 15 días de antelación (art. 49.1.c ET). Si no lo hizo, indica los días de preaviso que te dio para calcular los salarios de los días no preavisados.');
    } else {
      const dados = Math.min(15, diasPreaviso(input.preaviso_dias_dados));
      const faltan = 15 - dados;
      if (faltan > 0) {
        lineas.push({
          id: 'preaviso', concepto: 'Salarios del preaviso no respetado',
          formula: `(15 − ${dados}) días = ${nDias(faltan)} × ${num(s.dia_ordinario, 4)} €/día`,
          importe: r2(faltan * s.dia_ordinario), base_legal: 'Art. 49.1.c ET', url: BOE.a49,
        });
        avisos.push('El art. 49.1.c ET obliga a preavisar 15 días el fin de un contrato temporal de más de un año, pero no fija la consecuencia del incumplimiento: la herramienta aplica el criterio habitual (salarios de los días no preavisados). Tu convenio puede fijar otra regla.');
      }
    }
  }

  // 5. Dimisión: no se descuenta preaviso automáticamente
  if (input.tipo === 'dimision') avisos.push('En la baja voluntaria tu convenio puede prever un preaviso cuyo incumplimiento se descuenta del finiquito (art. 49.1.d ET). La herramienta no lo descuenta.');

  return { lineas, avisos, salarios: s };
}

// ---------- indemnización ----------
export function tasaFinTemporal(inicio) {
  // DT 8ª ET: calendario según la fecha de celebración del contrato (se toma la fecha de inicio).
  const t = parseFecha(inicio);
  if (t < parseFecha('2001-03-04')) return { dias: 0, nota: 'Contrato celebrado antes del 4 de marzo de 2001: sin indemnización por fin de contrato (DT 8ª.2 ET).' };
  if (t <= parseFecha('2011-12-31')) return { dias: 8 };
  if (t < parseFecha('2013-01-01')) return { dias: 9 };
  if (t < parseFecha('2014-01-01')) return { dias: 10 };
  if (t < parseFecha('2015-01-01')) return { dias: 11 };
  return { dias: 12 };
}

/** Días de indemnización por despido improcedente con transición de 2012 (DT 11ª ET). */
export function diasImprocedente(inicio, fin) {
  const tIni = parseFecha(inicio), tFin = parseFecha(fin), tRef = parseFecha(REFORMA_2012);
  if (tIni >= tRef) {
    const m = mesesCompletosOEmpezados(tIni, tFin);
    const d = 33 * m / 12;
    return { m1: 0, m2: m, d1: 0, d2: d, tope: 720, dias: Math.min(d, 720), topeAplicado: d > 720, transicion: false };
  }
  const m1 = mesesCompletosOEmpezados(tIni, Math.min(tFin, tRef - DAY));
  const m2 = tFin >= tRef ? mesesCompletosOEmpezados(tRef, tFin) : 0;
  const d1 = 45 * m1 / 12, d2 = 33 * m2 / 12;
  const tope = d1 > 720 ? Math.min(d1, 1260) : 720;
  return { m1, m2, d1, d2, tope, dias: Math.min(d1 + d2, tope), topeAplicado: d1 + d2 > tope, transicion: true };
}

export function indemnizacion(input) {
  const s = salarios(input);
  const { tipo } = input;
  const avisos = [];
  const base = { id: 'indemnizacion', concepto: 'Indemnización' };
  const sd = num(s.dia_indemnizacion, 4);

  if (tipo === 'improcedente') {
    const r = diasImprocedente(input.inicio, input.fin);
    const formula = r.transicion
      ? `45 días × ${nMeses(r.m1)} / 12 = ${num(r.d1)} días (hasta el 11/02/2012) + 33 días × ${nMeses(r.m2)} / 12 = ${num(r.d2)} días (desde el 12/02/2012) = ${num(r.d1 + r.d2)} días; tope ${num(r.tope)} días${r.topeAplicado ? ' (aplicado)' : ''} → ${num(r.dias)} días × ${sd} €/día`
      : `33 días × ${nMeses(r.m2)} / 12 = ${num(r.d2)} días; tope 720 días (24 mensualidades)${r.topeAplicado ? ' (aplicado)' : ''} → ${num(r.dias)} días × ${sd} €/día`;
    if (r.transicion && r.d1 > 1260) avisos.push('El tramo anterior al 12/02/2012 supera 42 mensualidades: se aplica el máximo absoluto de 1260 días (DT 11ª.2 ET).');
    return { linea: { ...base, concepto: 'Indemnización por despido improcedente', formula, dias: r.dias, detalle: r, importe: r2(r.dias * s.dia_indemnizacion), base_legal: r.transicion ? 'Art. 56.1 y DT 11ª ET' : 'Art. 56.1 ET', url: r.transicion ? BOE.dt11 : BOE.a56 }, avisos };
  }
  if (tipo === 'objetivo') {
    const m = mesesCompletosOEmpezados(parseFecha(input.inicio), parseFecha(input.fin));
    const d = 20 * m / 12, dias = Math.min(d, 360);
    if (parseFecha(input.inicio) < parseFecha(REFORMA_2012)) avisos.push('Si tu contrato era «de fomento de la contratación indefinida» anterior al 12/02/2012, la indemnización por causas objetivas sigue su normativa de origen (DT 11ª.3 ET).');
    return { linea: { ...base, concepto: 'Indemnización por despido objetivo', formula: `20 días × ${nMeses(m)} / 12 = ${num(d)} días; tope 360 días (12 mensualidades)${d > 360 ? ' (aplicado)' : ''} → ${num(dias)} días × ${sd} €/día`, dias, importe: r2(dias * s.dia_indemnizacion), base_legal: 'Art. 53.1.b ET (y art. 51.4 ET en el despido colectivo)', url: BOE.a53 }, avisos };
  }
  if (tipo === 'fin_temporal') {
    if (input.temporal_formativo_o_sustitucion) return { linea: { ...base, concepto: 'Indemnización por fin de contrato', formula: 'Contrato formativo o de sustitución: sin indemnización', dias: 0, importe: 0, base_legal: 'Art. 49.1.c ET', url: BOE.a49 }, avisos };
    const tasa = tasaFinTemporal(input.inicio);
    if (tasa.nota) avisos.push(tasa.nota);
    const ds = diasInclusive(input.inicio, input.fin);
    const dias = tasa.dias * ds / 365;
    return { linea: { ...base, concepto: 'Indemnización por fin de contrato temporal', formula: `${tasa.dias} días × ${nDias(ds)} de servicio / 365 = ${num(dias, 4)} días × ${sd} €/día`, dias, importe: r2(dias * s.dia_indemnizacion), base_legal: tasa.dias === 12 ? 'Art. 49.1.c ET' : 'Art. 49.1.c y DT 8ª ET', url: tasa.dias === 12 ? BOE.a49 : BOE.dt8 }, avisos };
  }
  const ceros = {
    disciplinario_procedente: ['Despido disciplinario procedente: sin indemnización', 'Art. 55.7 ET', BOE.a55],
    dimision: ['Baja voluntaria: sin indemnización', 'Art. 49.1.d ET', BOE.a49],
    periodo_prueba: ['Extinción durante el periodo de prueba: sin indemnización', 'Art. 14.2 ET', BOE.a14],
  };
  if (!ceros[tipo]) throw new Error(`Tipo de extinción no reconocido: ${tipo}`);
  const [formula, base_legal, url] = ceros[tipo];
  return { linea: { ...base, formula, dias: 0, importe: 0, base_legal, url }, avisos };
}

// ---------- liquidación completa ----------
export function liquidacion(input) {
  if (input.caso_especial) {
    const msg = FUERA_DE_ALCANCE[input.caso_especial];
    if (!msg) throw new Error(`Caso especial no reconocido: ${input.caso_especial}`);
    return { fuera_de_alcance: true, lineas: [], total: 0, avisos: [`${msg} Esta herramienta no lo calcula: consulta a un abogado o sindicato.`] };
  }
  const ant = antiguedad(input.inicio, input.fin);
  if (!(Number(input.salario_mensual) > 0)) throw new Error('Indica el salario bruto mensual.');
  const f = finiquito(input);
  const ind = indemnizacion(input);
  const lineas = [...f.lineas, ind.linea];
  const total = r2(lineas.reduce((acc, l) => acc + l.importe, 0));
  const avisos = [...f.avisos, ...ind.avisos,
    'Criterio de cálculo: salario diario = salario anual / 365 (indemnización) y salario mensual × 12 / 365 (días y vacaciones). Tu convenio o la jurisprudencia pueden aplicar otro (p. ej. ÷30).'];
  return {
    antiguedad: ant, salarios: f.salarios, lineas, total,
    total_finiquito: r2(f.lineas.reduce((a, l) => a + l.importe, 0)),
    total_indemnizacion: ind.linea.importe,
    avisos, fuera_de_alcance: false,
  };
}

/** Compara la liquidación calculada con la propuesta de la empresa (total y, si existe, línea a línea). */
export function comparar(res, oferta) {
  if (!oferta) return null;
  const out = { lineas: [], total_oferta: null, diferencia_total: null };
  if (oferta.lineas) {
    for (const l of res.lineas) {
      if (oferta.lineas[l.id] == null || oferta.lineas[l.id] === '') continue;
      const ofrecido = Number(oferta.lineas[l.id]);
      out.lineas.push({ id: l.id, concepto: l.concepto, calculado: l.importe, ofrecido, diferencia: r2(l.importe - ofrecido) });
    }
    // Pagas extra: la empresa suele dar un solo importe para todas las pagas
    const pagas = res.lineas.filter(l => l.id.startsWith('paga_'));
    if (pagas.length && oferta.lineas.pagas != null && oferta.lineas.pagas !== '') {
      const calculado = r2(pagas.reduce((a, l) => a + l.importe, 0)), ofrecido = Number(oferta.lineas.pagas);
      out.lineas.push({ id: 'pagas', concepto: 'Pagas extraordinarias (parte proporcional, total)', calculado, ofrecido, diferencia: r2(calculado - ofrecido) });
    }
  }
  if (oferta.total != null && oferta.total !== '') {
    out.total_oferta = Number(oferta.total);
    out.diferencia_total = r2(res.total - out.total_oferta);
  }
  return out;
}

export { eur, num, fmt };
