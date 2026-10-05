// Comprueba que la solución de referencia de cada nivel alcanza el objetivo
// y que los errores típicos se detectan.
const fs = require('fs'), path = require('path');
for (const f of ['piezas', 'simulador', 'tablero', 'niveles']) require(path.join(__dirname, '..', 'js', f + '.js'));
const { NIVELES, TABLERO, conectores, aplicarSolucion } = Niveles;

function montar(nv, guion, mutar) {
  const tab = new Tablero(TABLERO.cols, TABLERO.filas);
  for (const c of conectores(nv)) tab.colocar(c);
  aplicarSolucion(tab, guion, nv);
  if (mutar) mutar(tab);
  return tab;
}

function evaluar(nv, tab) {
  const circ = Simulador.construir(tab.piezas, nv);
  const t0 = Date.now();
  const res = Simulador.simular(circ, nv, { muestras: 500 });
  const ms = Date.now() - t0;
  let pt = { coincidencia: 0, err: NaN };
  if (res.ok) {
    const obj = nv.objetivo(res.entradas, res.t, res.dt);
    pt = nv.puntuar ? nv.puntuar(res.salida, obj, res.t) : Simulador.puntuar(res.salida, obj, nv.ref);
  }
  return { circ, res, pt, ms };
}

let fallos = 0;
for (const nv of NIVELES) {
  const tab = montar(nv, nv.solucion);
  const { circ, res, pt, ms } = evaluar(nv, tab);
  const ok = res.ok && !res.errores.length && pt.coincidencia > 0.99 && !circ.sueltos.length;
  if (!ok) fallos++;
  console.log((ok ? 'OK    ' : 'FALLO ') + nv.numero.padEnd(5) + nv.id.padEnd(17) + (100 * pt.coincidencia).toFixed(2).padStart(7) + '%  ' + String(ms).padStart(4) + ' ms');
  for (const a of res.avisos) console.log('      ' + (a.clase || 'aviso') + ': ' + a.txt);
  for (const e of res.errores) console.log('      ERROR: ' + e.txt);
  if (circ.sueltos.length) console.log('      sueltos: ' + JSON.stringify(circ.sueltos));
}
console.log(fallos ? fallos + ' niveles fallan' : 'Todos los niveles OK');

// Casos negativos: el simulador debe comportarse como los componentes reales
console.log('--- casos negativos ---');
const nivel = id => NIVELES.find(n => n.id === id);
const quitar = (tipo, cond) => tab => { const p = tab.piezas.find(q => q.tipo === tipo && (!cond || cond(q))); tab.quitar(p.id); };
function probar(nombre, id, guion, mutar, espera) {
  const nv = nivel(id);
  const { res, pt } = evaluar(nv, montar(nv, guion || nv.solucion, mutar));
  const textos = res.errores.map(e => 'ERROR: ' + e.txt).concat(res.avisos.map(a => (a.clase || 'aviso') + ': ' + a.txt));
  const ok = espera(pt.coincidencia, textos.join(' | '));
  if (!ok) fallos++;
  console.log((ok ? 'OK    ' : 'FALLO ') + nombre.padEnd(46) + (100 * pt.coincidencia).toFixed(1).padStart(6) + '%');
  for (const t of textos) console.log('      ' + t);
}
const falla = (c) => c < 0.98;
probar('seguidor: cable directo (Rs/RL)', 'seguidor', [['w', [0, 6], [23, 6]]], null, falla);
probar('inversor con + y - intercambiados', 'inversor', null, tab => tab.espejo(tab.piezas.find(p => p.tipo === 'ao').id), (c, t) => falla(c) && /positiva/.test(t));
probar('no inversor con ganancia 30 (satura)', 'noinversor', null, tab => { tab.piezas.find(p => p.tipo === 'resistencia' && p.valor === 20e3).valor = 290e3; }, (c, t) => falla(c) && /satura/.test(t));
probar('salida del AO a tierra', 'seguidor', nivel('seguidor').solucion.concat([['gnd', 12, 7], ['w', [12, 6], [12, 7]]]), null, (c, t) => /Cortocircuito/.test(t));
probar('media onda con el diodo al revés', 'mediaonda', null, tab => tab.girar(tab.piezas.find(p => p.tipo === 'diodo').id) && tab.girar(tab.piezas.find(p => p.tipo === 'diodo').id), falla);
probar('puente con un diodo abierto (media onda)', 'puente', null, quitar('diodo'), falla);
const sinGnd = nivel('puente').solucion.filter(c => c[0] !== 'gnd' && !(c[0] === 'w' && c[1][0] === 9));
probar('puente unido al terminal de 0 V de la salida', 'puente', sinGnd.concat([['w', [9, 9], [9, 11], [21, 11], [21, 8], [23, 8]]]), null, (c, t) => c > 0.99 && !t);
probar('puente sin unir a tierra (RL sin retorno)', 'puente', nivel('puente').solucion.filter(c => c[0] !== 'gnd' && !(c[0] === 'w' && c[1][0] === 9)), null, (c, t) => falla(c) && /tierra/.test(t));
probar('regulador Zener con R = 1 kΩ (se corta)', 'reguladorzener', null, tab => { tab.piezas.find(p => p.tipo === 'resistencia').valor = 1e3; }, falla);
probar('regulador Zener con R = 47 Ω (potencia)', 'reguladorzener', null, tab => { tab.piezas.find(p => p.tipo === 'resistencia').valor = 47; }, (c, t) => /disipa/.test(t));
probar('emisor común con RB = 10 kΩ (satura antes)', 'ec', null, tab => { tab.piezas.find(p => p.tipo === 'resistencia' && p.valor === 20e3).valor = 10e3; }, falla);
probar('seguidor de emisor sustituido por un cable', 'seguidoremisor', [['w', [0, 6], [23, 6]]], null, (c, t) => /solo puede dar/.test(t));
probar('LED sin resistencia', 'led', [['p', 'led', 10, 6, 0], ['w', [0, 6], [10, 6]], ['w', [10, 6], [12, 6], [12, 8]], ['gnd', 12, 8]], null, (c, t) => /no tiene solución/.test(t));
probar('relé sin diodo volante', 'rele', null, quitar('diodo'), (c, t) => /ruptura/.test(t));
probar('relé con RB = 100 Ω (demasiada corriente)', 'rele', null, tab => { tab.piezas.find(p => p.tipo === 'resistencia').valor = 100; }, (c, t) => /solo puede dar/.test(t));
probar('motor con IRF530 (no es de nivel lógico)', 'motor', null, tab => { tab.piezas.find(p => p.tipo === 'nmos').par = { vth: 4, k: 0.25, ron: 0.16, vdss: 100 }; }, (c, t) => falla(c) && /zona activa/.test(t));
probar('lado alto sin R_EB (base al aire)', 'ladoalto', null, tab => { const r = tab.piezas.filter(p => p.tipo === 'resistencia' && p.r === 1)[0]; tab.quitar(r.id); }, (c, t) => /al aire/.test(t));
probar('comparador con las entradas cambiadas', 'comparador', null, tab => tab.espejo(tab.piezas.find(p => p.tipo === 'ao').id), falla);
probar('Schmitt sin histéresis (R2 quitada)', 'schmitt', null, quitar('resistencia', p => p.valor === 30e3), falla);
probar('limitador no inversor sin R en serie', 'limitadornoinv', nivel('limitadornoinv').solucion.map(c => c[0] === 'R' && c[1] === 6 ? ['w', [5, 5], [7, 5]] : c), null, (c, t) => /no tiene solución/.test(t));
probar('zona muerta no inversora sin R a masa', 'zonamuertanoinv', nivel('zonamuertanoinv').solucion.filter(c => !((c[0] === 'R' || c[0] === 'gnd') && c[1] === 9) && !(c[0] === 'w' && c[1][0] === 9)), null, falla);
probar('astable con C = 47 nF (periodo distinto)', 'astable', null, tab => { tab.piezas.find(p => p.tipo === 'condensador').valor = 47e-9; }, falla);
probar('motor sin diodo volante', 'motor', null, quitar('diodo'), (c, t) => /ruptura/.test(t));
// Niveles de diseño: un valor normalizado (E12) debe aprobar; uno muy alejado, no
const aprueba = id => c => c >= (nivel(id).umbral || 0.98);
const valorR = (v, cond) => tab => { tab.piezas.find(p => p.tipo === 'resistencia' && (!cond || cond(p))).valor = v; };
probar('LED con 330 Ω (E12)', 'led', null, valorR(330), aprueba('led'));
probar('LED con 270 Ω (E12)', 'led', null, valorR(270), aprueba('led'));
probar('LED con 1 kΩ', 'led', null, valorR(1e3), c => !aprueba('led')(c));
probar('fuente de corriente con R_E = 220 Ω (E12)', 'fuentecorriente', null, valorR(220, p => p.valor === 200), aprueba('fuentecorriente'));
probar('fuente de corriente con R_E = 180 Ω (E12)', 'fuentecorriente', null, valorR(180, p => p.valor === 200), aprueba('fuentecorriente'));
probar('fuente de corriente con R_E = 330 Ω', 'fuentecorriente', null, valorR(330, p => p.valor === 200), c => !aprueba('fuentecorriente')(c));
console.log(fallos ? fallos + ' comprobaciones fallan' : 'Todas las comprobaciones OK');
process.exitCode = fallos ? 1 : 0;
