// Comprueba que la solución de referencia de cada nivel alcanza el objetivo.
const vm = require('vm'), fs = require('fs'), path = require('path');
const ctx = { console, Math, Float64Array, Float32Array, Int8Array, Int32Array, Map, Set, Array, Object, Number, String, JSON };
vm.createContext(ctx);
for (const f of ['piezas', 'simulador', 'tablero', 'niveles'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), ctx, { filename: f });
vm.runInContext(`{
  const { NIVELES, TABLERO, conectores, aplicarSolucion } = Niveles;
  let fallos = 0;
  for (const nv of NIVELES) {
    const tab = new Tablero(TABLERO.cols, TABLERO.filas);
    for (const c of conectores(nv)) tab.colocar(c);
    aplicarSolucion(tab, nv.solucion);
    const circ = Simulador.construir(tab.piezas, nv);
    const t0 = Date.now();
    const res = Simulador.simular(circ, nv);
    const ms = Date.now() - t0;
    let pt = { coincidencia: 0, err: NaN };
    if (res.ok) pt = Simulador.puntuar(res.salida, nv.objetivo(res.entradas, res.t, res.dt));
    const ok = res.ok && pt.coincidencia > 0.99;
    if (!ok) fallos++;
    console.log((ok ? 'OK  ' : 'FALLO ') + nv.id.padEnd(16) + ' coincidencia ' + (100 * pt.coincidencia).toFixed(2) + '%  err ' + pt.err.toFixed(4) + ' V  ' + ms + ' ms  piezas ' + tab.piezas.length);
    for (const a of res.avisos) console.log('      aviso: ' + a.txt);
    for (const e of res.errores) console.log('      ERROR: ' + e.txt);
    if (circ.sueltos.length) console.log('      sueltos: ' + JSON.stringify(circ.sueltos));
  }
  console.log(fallos ? fallos + ' niveles fallan' : 'Todos los niveles OK');
}`, ctx);

// Casos negativos: el simulador debe comportarse como el AO real
vm.runInContext(`{
  const { NIVELES, TABLERO, conectores, aplicarSolucion } = Niveles;
  const nivel = id => NIVELES.find(n => n.id === id);
  function probar(nombre, id, guion, mutar) {
    const nv = nivel(id);
    const tab = new Tablero(TABLERO.cols, TABLERO.filas);
    for (const c of conectores(nv)) tab.colocar(c);
    aplicarSolucion(tab, guion);
    if (mutar) mutar(tab);
    const circ = Simulador.construir(tab.piezas, nv);
    const res = Simulador.simular(circ, nv);
    const pt = res.ok ? Simulador.puntuar(res.salida, nv.objetivo(res.entradas, res.t, res.dt)) : { coincidencia: 0 };
    let mx = 0; if (res.ok) for (const v of res.salida) mx = Math.max(mx, Math.abs(v));
    console.log(nombre.padEnd(44) + (100 * pt.coincidencia).toFixed(1).padStart(6) + '%  |vo|max ' + mx.toFixed(2) + ' V');
    for (const a of res.avisos) console.log('      aviso: ' + a.txt);
    for (const e of res.errores) console.log('      ERROR: ' + e.txt);
  }
  console.log('--- casos negativos ---');
  probar('seguidor: cable directo (Rs/RL)', 'seguidor', [['w', [0, 6], [23, 6]]]);
  probar('inversor con + y - intercambiados', 'inversor', nivel('inversor').solucion,
    tab => tab.espejo(tab.piezas.find(p => p.tipo === 'ao').id));
  probar('no inversor con ganancia 30 (satura)', 'noinversor', nivel('noinversor').solucion,
    tab => { tab.piezas.find(p => p.tipo === 'resistencia' && p.valor === 20e3).valor = 290e3; });
  probar('inversor sin realimentación (comparador)', 'inversor', nivel('inversor').solucion,
    tab => tab.quitar(tab.piezas.find(p => p.tipo === 'resistencia' && p.valor === 20e3).id));
  probar('salida del AO a tierra', 'seguidor', nivel('seguidor').solucion.concat([['gnd', 12, 7], ['w', [12, 6], [12, 7]]]));
}`, ctx);
