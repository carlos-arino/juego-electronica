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
probar('astable con C = 47 nF (periodo distinto)', 'astable', null, tab => { tab.piezas.find(p => p.tipo === 'condensador').valor = 47e-9; }, falla);
console.log(fallos ? fallos + ' comprobaciones fallan' : 'Todas las comprobaciones OK');
process.exitCode = fallos ? 1 : 0;
