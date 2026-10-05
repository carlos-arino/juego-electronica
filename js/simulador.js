/* ==========================================================================
   Simulador: del tablero a la lista de nudos y análisis temporal (MNA).

   Elementos lineales: resistencias, condensadores y bobinas (Euler
   implícito), fuentes de tensión (referidas a tierra o flotantes).

   Dispositivos no lineales con los modelos por tramos de los apuntes:
   - Diodo y LED: OFF (abierto) / ON (fuente Vγ).
   - Zener: OFF / ON (Vγ) / Z (avalancha, fuente Vz invertida).
   - BJT NPN y PNP: corte / activa (VBE = 0,7 V, IC = β·IB) /
     saturación (VCE = VCE,sat) / ruptura (VCE = VCEO).
   - MOSFET canal N y P: corte / activa (I = k(VGS−VTH)²) /
     óhmica (RDS,on) / ruptura (VDS = VDSS).
   El estado de cada dispositivo se busca como en clase: suponer,
   resolver, comprobar las condiciones y cambiar el que no las cumple.

   AO ideal: la salida es una fuente de tensión que se elige para que
   v+ = v- (zona lineal, sólo si el equilibrio es estable) o queda en ±Vsat.
   ========================================================================== */
(function (G) {
  'use strict';
  const P = G.Piezas;

  const GMIN = 1e-12;
  const EV = 1e-6, EI = 1e-9;

  /* ---------- Unión-búsqueda ---------- */
  function UF() { this.p = new Map(); }
  UF.prototype.find = function (a) {
    if (!this.p.has(a)) this.p.set(a, a);
    let r = a;
    while (this.p.get(r) !== r) r = this.p.get(r);
    while (this.p.get(a) !== r) { const n = this.p.get(a); this.p.set(a, r); a = n; }
    return r;
  };
  UF.prototype.union = function (a, b) {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.p.set(ra, rb);
  };

  /* ---------- Álgebra lineal densa ---------- */
  function luFactor(A, n) {
    const piv = new Int32Array(n);
    let maxAbs = 0;
    for (let i = 0; i < n * n; i++) maxAbs = Math.max(maxAbs, Math.abs(A[i]));
    const tol = Math.max(maxAbs, 1) * 1e-13;
    for (let k = 0; k < n; k++) {
      let p = k, mx = Math.abs(A[k * n + k]);
      for (let i = k + 1; i < n; i++) {
        const v = Math.abs(A[i * n + k]);
        if (v > mx) { mx = v; p = i; }
      }
      if (mx < tol) return null;
      piv[k] = p;
      if (p !== k) for (let j = 0; j < n; j++) {
        const t = A[k * n + j]; A[k * n + j] = A[p * n + j]; A[p * n + j] = t;
      }
      const d = A[k * n + k];
      for (let i = k + 1; i < n; i++) {
        const f = (A[i * n + k] /= d);
        if (f !== 0) for (let j = k + 1; j < n; j++) A[i * n + j] -= f * A[k * n + j];
      }
    }
    return { A, piv, n };
  }

  function luSolve(lu, b) {
    const { A, piv, n } = lu;
    const x = Float64Array.from(b);
    // Las filas se intercambian completas (también los multiplicadores de L):
    // primero se aplica toda la permutación y después la sustitución.
    for (let k = 0; k < n; k++) {
      const p = piv[k];
      if (p !== k) { const t = x[k]; x[k] = x[p]; x[p] = t; }
    }
    for (let k = 0; k < n; k++) {
      const xk = x[k];
      if (xk !== 0) for (let i = k + 1; i < n; i++) x[i] -= A[i * n + k] * xk;
    }
    for (let i = n - 1; i >= 0; i--) {
      let s = x[i];
      for (let j = i + 1; j < n; j++) s -= A[i * n + j] * x[j];
      x[i] = s / A[i * n + i];
    }
    return x;
  }

  /* Sistema pequeño (matriz como array de arrays). Devuelve null si es singular. */
  function resolverPequeno(M, b) {
    const n = b.length;
    const A = M.map((f, i) => f.slice().concat([b[i]]));
    for (let k = 0; k < n; k++) {
      let p = k;
      for (let i = k + 1; i < n; i++) if (Math.abs(A[i][k]) > Math.abs(A[p][k])) p = i;
      if (Math.abs(A[p][k]) < 1e-9) return null;
      [A[k], A[p]] = [A[p], A[k]];
      for (let i = k + 1; i < n; i++) {
        const f = A[i][k] / A[k][k];
        for (let j = k; j <= n; j++) A[i][j] -= f * A[k][j];
      }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = A[i][n];
      for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j];
      x[i] = s / A[i][i];
    }
    return x;
  }

  /* ¿Todos los autovalores de M tienen parte real negativa? (Faddeev–LeVerrier + Routh) */
  function esHurwitz(M) {
    const n = M.length;
    if (n === 0) return true;
    if (n === 1) return M[0][0] < -1e-9;
    const c = new Array(n + 1).fill(0);
    c[n] = 1;
    let Mk = M.map(f => f.map(() => 0));
    for (let k = 1; k <= n; k++) {
      const AM = M.map((fila, i) => fila.map((_, j) => {
        let s = 0;
        for (let l = 0; l < n; l++) s += M[i][l] * Mk[l][j];
        return s;
      }));
      for (let i = 0; i < n; i++) AM[i][i] += c[n - k + 1];
      Mk = AM;
      let tr = 0;
      for (let i = 0; i < n; i++) {
        let s = 0;
        for (let l = 0; l < n; l++) s += M[i][l] * Mk[l][i];
        tr += s;
      }
      c[n - k] = -tr / k;
    }
    const coef = [];
    for (let k = n; k >= 0; k--) coef.push(c[k]);
    if (coef.some(v => v <= 1e-12)) return false;
    let f1 = coef.filter((_, i) => i % 2 === 0);
    let f2 = coef.filter((_, i) => i % 2 === 1);
    const primera = [f1[0], f2[0]];
    for (let paso = 0; paso < n - 1; paso++) {
      const nueva = [];
      for (let i = 0; i < f1.length - 1; i++) {
        const a = f1[i + 1] || 0, b = f2[i + 1] || 0;
        nueva.push((f2[0] * a - f1[0] * b) / f2[0]);
      }
      f1 = f2; f2 = nueva.length ? nueva : [0];
      primera.push(f2[0]);
    }
    return primera.every(v => v > 1e-12);
  }

  /* ---------- Dispositivos ---------- */
  const NUM_RAMAS = { diodo: 1, led: 1, zener: 1, npn: 2, pnp: 2, nmos: 1, pmos: 1 };
  const NUM_ESTADOS = { diodo: 2, led: 2, zener: 3, npn: 4, pnp: 4, nmos: 4, pmos: 4 };
  const NOMBRES_ESTADO = {
    diodo: ['OFF', 'ON'], led: ['OFF', 'ON'], zener: ['OFF', 'ON', 'Z'],
    npn: ['corte', 'activa', 'saturación', 'ruptura'], pnp: ['corte', 'activa', 'saturación', 'ruptura'],
    nmos: ['corte', 'activa', 'óhmica', 'ruptura'], pmos: ['corte', 'activa', 'óhmica', 'ruptura']
  };
  const ETIQUETAS_NODO = { diodo: ['a', 'k'], led: ['a', 'k'], zener: ['a', 'k'], npn: ['b', 'c', 'e'], pnp: ['b', 'c', 'e'], nmos: ['g', 'd', 's'], pmos: ['g', 'd', 's'] };

  /* ---------- Construcción de la lista de nudos ---------- */
  function construir(piezas, nivel) {
    const uf = new UF();
    const cuenta = new Map();      // borde -> número de puertos
    const posBorde = new Map();    // borde -> punto medio (para marcar extremos sueltos)
    const GND = 'GND';
    uf.find(GND);

    const opcionales = new Set();  // bordes de puertos que pueden quedar sin conectar
    for (const p of piezas) {
      for (const q of P.puertos(p)) {
        const k = P.claveBorde(q.cx, q.cy, q.d);
        uf.union(p.id + ':' + q.n, k);
        cuenta.set(k, (cuenta.get(k) || 0) + 1);
        posBorde.set(k, [q.cx + 0.5 + P.DX[q.d] * 0.5, q.cy + 0.5 + P.DY[q.d] * 0.5]);
        if (q.gnd) uf.union(p.id + ':' + q.n, GND);
        if (q.opcional) opcionales.add(k);
      }
    }

    // Numeración de nudos (0 = tierra)
    const indice = new Map();
    indice.set(uf.find(GND), 0);
    let N = 1;
    const nudo = (clave) => {
      const r = uf.find(clave);
      if (!indice.has(r)) indice.set(r, N++);
      return indice.get(r);
    };
    for (const p of piezas) for (const q of P.TIPOS[p.tipo].puertos) nudo(p.id + ':' + q.n);

    const R = [], C = [], L = [], fuentes = [], aos = [], disp = [];
    let nudoSalida = -1;
    const avisos = [], errores = [];
    let nD = 0, nQ = 0;
    const entradas = nivel.entradas || [];

    for (const p of piezas) {
      const t = p.tipo, nd = (e) => nudo(p.id + ':' + e);
      if (t === 'resistencia') R.push({ a: nd('a'), b: nd('b'), R: Math.max(p.valor || 1, 1e-3), id: p.id });
      else if (t === 'lampara') R.push({ a: nd('a'), b: nd('b'), R: Math.max(p.valor || 1, 1e-3), id: p.id, carga: t });
      else if (t === 'bobina' || t === 'motor') {
        const m = N++;
        R.push({ a: nd('a'), b: m, R: Math.max(p.valor || 1, 1e-3), id: p.id, carga: t });
        L.push({ a: m, b: nd('b'), L: Math.max(P.parDe(p).L || 1e-3, 1e-9), id: p.id });
      }
      else if (t === 'condensador') C.push({ a: nd('a'), b: nd('b'), C: Math.max(p.valor || 1e-12, 1e-15), id: p.id });
      else if (t === 'fuente') fuentes.push({ n: nd('a'), m: 0, tipo: 'dc', V: p.valor || 0, id: p.id });
      else if (t === 'ao') aos.push({ p: nd('p'), n: nd('n'), o: nd('o'), id: p.id, nombre: 'AO' + (aos.length + 1) });
      else if (t === 'entrada') {
        const ent = entradas[p.k];
        const nc = nd('a');
        if (ent && ent.Rs > 0) {
          const ni = N++;
          fuentes.push({ n: ni, m: 0, tipo: 'ent', k: p.k, id: p.id });
          R.push({ a: ni, b: nc, R: ent.Rs, id: p.id, interna: true });
        } else fuentes.push({ n: nc, m: 0, tipo: 'ent', k: p.k, id: p.id });
      } else if (t === 'secundario') fuentes.push({ n: nd('a'), m: nd('b'), tipo: 'ent', k: p.k, id: p.id });
      else if (P.TIPOS[t].salida) {
        nudoSalida = nd('a');
        if (nivel.RL > 0) R.push({ a: nudoSalida, b: 0, R: nivel.RL, id: p.id, interna: true, RL: true });
      } else if (NUM_RAMAS[t]) {
        const esQ = /npn|pnp|mos/.test(t);
        const nombre = esQ ? 'Q' + (++nQ) : 'D' + (++nD);
        const nodos = {};
        for (const e of ETIQUETAS_NODO[t]) nodos[e] = nd(e);
        disp.push({ tipo: t, id: p.id, nombre, par: P.parDe(p), nodos });
      }
    }

    const nudoDe = (id, etiqueta) => {
      const r = uf.find(id + ':' + etiqueta);
      return indice.has(r) ? indice.get(r) : -1;
    };

    // Extremos sueltos
    // (los terminales opcionales sin conectar se marcan, pero no cuentan como sueltos)
    const sueltos = [], libres = [];
    for (const [k, n] of cuenta) if (n === 1) (opcionales.has(k) ? libres : sueltos).push(posBorde.get(k));
    for (const p of piezas) if (p.tipo === 'extremo') sueltos.push([p.x + 0.5, p.y + 0.5]);

    // Fuentes de tensión ideales (AO incluidos)
    const todas = fuentes.map(f => ({ ...f }));
    for (const a of aos) todas.push({ n: a.o, m: 0, tipo: 'ao', id: a.id, nombre: a.nombre });

    // Cortocircuitos evidentes entre fuentes
    const visto = new Map();
    const desc = (f) => f.tipo === 'ao' ? 'la salida de ' + f.nombre
      : f.tipo === 'ent' ? (entradas[f.k] && entradas[f.k].tipo === 'flotante' ? 'el secundario ' : 'la entrada ') + (entradas[f.k] ? entradas[f.k].nombre : '')
      : 'una fuente de ' + P.formatearValor(f.V, 'V');
    for (const f of todas) {
      const clave = Math.min(f.n, f.m) + ',' + Math.max(f.n, f.m);
      if (f.n === f.m) errores.push({ txt: 'Cortocircuito: ' + desc(f) + (f.m === 0 ? ' está unida directamente a tierra.' : ' tiene sus dos terminales unidos.'), id: f.id });
      else if (visto.has(clave)) errores.push({ txt: 'Cortocircuito: ' + desc(f) + ' está unida directamente a ' + desc(visto.get(clave)) + '.', id: f.id });
      else visto.set(clave, f);
    }

    // Nudos al aire: sin camino de continua a una fuente o a tierra.
    // Los diodos cuentan como camino; los transistores no (pueden estar cortados).
    const ady = Array.from({ length: N }, () => []);
    const unir = (a, b) => { ady[a].push(b); ady[b].push(a); };
    for (const r of R) unir(r.a, r.b);
    for (const l of L) unir(l.a, l.b);
    for (const f of todas) if (f.m) unir(f.n, f.m);
    for (const d of disp) if (d.nodos.a !== undefined) unir(d.nodos.a, d.nodos.k);
    const alcanzado = new Uint8Array(N);
    const cola = [0];
    alcanzado[0] = 1;
    for (const f of todas) if (!f.m && !alcanzado[f.n]) { alcanzado[f.n] = 1; cola.push(f.n); }
    while (cola.length) {
      const u = cola.pop();
      for (const v of ady[u]) if (!alcanzado[v]) { alcanzado[v] = 1; cola.push(v); }
    }
    for (const a of aos) {
      if (!alcanzado[a.p]) avisos.push({ txt: 'La entrada + de ' + a.nombre + ' está al aire (no llega a ninguna tensión).', id: a.id });
      if (!alcanzado[a.n]) avisos.push({ txt: 'La entrada − de ' + a.nombre + ' está al aire (no llega a ninguna tensión).', id: a.id });
    }
    for (const d of disp) {
      if (d.nodos.b !== undefined && !alcanzado[d.nodos.b]) avisos.push({ txt: `La base de ${d.nombre} puede quedar al aire: conviene una resistencia entre base y emisor para asegurar el corte.`, id: d.id });
      if (d.nodos.g !== undefined && !alcanzado[d.nodos.g]) avisos.push({ txt: `La puerta de ${d.nombre} puede quedar al aire: conviene una resistencia entre puerta y fuente para asegurar el corte.`, id: d.id });
    }
    if (nudoSalida < 0 && !nivel.sinSalida) errores.push({ txt: 'No hay conector de salida.' });
    else if (nudoSalida >= 0 && !alcanzado[nudoSalida]) avisos.push({ txt: 'La salida vo no está conectada a nada que fije su tensión.' });

    // Secundario flotante sin ningún punto a tierra: la carga RL (de vo a
    // tierra) no tiene camino de vuelta y vo se queda en 0 V.
    if (nudoSalida >= 0 && nivel.RL > 0) {
      const ady2 = Array.from({ length: N }, () => []);
      const unir2 = (a, b) => { ady2[a].push(b); ady2[b].push(a); };
      for (const r of R) if (!r.RL) unir2(r.a, r.b);
      for (const l of L) unir2(l.a, l.b);
      for (const c of C) unir2(c.a, c.b);
      for (const f of todas) if (f.m) unir2(f.n, f.m);
      for (const d of disp) {
        const [n0, ...resto] = Object.values(d.nodos);
        for (const n of resto) unir2(n0, n);
      }
      for (const f of fuentes) {
        if (f.tipo !== 'ent' || !f.m) continue;
        const isla = new Uint8Array(N);
        const pila = [f.n];
        isla[f.n] = 1;
        while (pila.length) {
          const u = pila.pop();
          for (const v of ady2[u]) if (!isla[v]) { isla[v] = 1; pila.push(v); }
        }
        if (isla[nudoSalida] && !isla[0] && !todas.some(g => !g.m && isla[g.n])) {
          avisos.push({ txt: 'Ningún punto del circuito del secundario está unido a tierra. La carga RL va de vo a tierra, así que su corriente no tiene por dónde volver al secundario y vo se queda en 0 V. Une a tierra el punto del circuito al que debe volver la corriente de la carga.', id: f.id });
        }
      }
    }

    return { N, R, C, L, fuentes: todas, aos, disp, nudoSalida, nudoDe, sueltos, libres, avisos, errores, uf, indice };
  }

  /* ---------- Simulación temporal ---------- */
  function simular(circ, nivel, opciones) {
    const ns = (opciones && opciones.muestras) || 500;
    const tmax = nivel.tmax;           // en ms
    const dt = tmax / (ns - 1);        // ms
    const dts = dt * 1e-3;             // s
    const Vsat = nivel.Vsat || 12;
    const t = new Float64Array(ns);
    for (let i = 0; i < ns; i++) t[i] = i * dt;

    const entradas = (nivel.entradas || []).map(e => {
      const a = new Float64Array(ns);
      for (let i = 0; i < ns; i++) a[i] = e.f(t[i]);
      return a;
    });

    const res = { t, dt, entradas, V: null, salida: null, sat: [], disp: [], cargas: [], iEnt: [], ok: false, avisos: circ.avisos.slice(), errores: circ.errores.slice() };
    if (circ.errores.length) return res;

    const nN = circ.N - 1, F = circ.fuentes, M = F.length, D = circ.disp;
    let nb = 0;
    const rama = D.map(d => { const o = nN + M + nb; nb += NUM_RAMAS[d.tipo]; return o; });
    const n = nN + M + nb;
    const r = (nodo) => nodo - 1;   // fila de un nudo (−1 para tierra)
    const volt = (x, nodo) => nodo > 0 ? x[nodo - 1] : 0;
    const add = (A, i, j, v) => { if (i >= 0 && j >= 0) A[i * n + j] += v; };
    const conductancia = (A, a, b, g) => { add(A, r(a), r(a), g); add(A, r(b), r(b), g); add(A, r(a), r(b), -g); add(A, r(b), r(a), -g); };
    const fuenteV = (A, fila, p, m) => { add(A, r(p), fila, 1); add(A, r(m), fila, -1); add(A, fila, r(p), 1); add(A, fila, r(m), -1); };

    // Parte constante de la matriz
    const A0 = new Float64Array(n * n);
    for (let i = 0; i < nN; i++) A0[i * n + i] += GMIN;
    for (const e of circ.R) conductancia(A0, e.a, e.b, 1 / e.R);
    const gC = circ.C.map(c => c.C / dts);
    circ.C.forEach((c, k) => conductancia(A0, c.a, c.b, gC[k]));
    const gL = circ.L.map(l => dts / l.L);
    circ.L.forEach((l, k) => conductancia(A0, l.a, l.b, gL[k]));
    F.forEach((f, k) => fuenteV(A0, nN + k, f.n, f.m));

    /* Estampa los dispositivos según su estado. lin[i]: VGS (o VSG) de
       linealización de los MOSFET en zona activa. */
    function estampar(est, lin) {
      const A = A0.slice(), bD = new Float64Array(n);
      D.forEach((d, i) => {
        const e = est[i], q = d.par, o = rama[i], nd = d.nodos;
        const fuente = (fila, p, m, V) => { fuenteV(A, fila, p, m); bD[fila] = V; };
        const anular = (fila) => { A[fila * n + fila] = 1; };
        switch (d.tipo) {
          case 'diodo': case 'led':
            if (e === 1) fuente(o, nd.a, nd.k, q.vg); else anular(o);
            break;
          case 'zener':
            if (e === 1) fuente(o, nd.a, nd.k, q.vg);
            else if (e === 2) fuente(o, nd.k, nd.a, q.vz);
            else anular(o);
            break;
          case 'npn': case 'pnp': {
            const pnp = d.tipo === 'pnp';
            if (e === 1 || e === 2) { if (pnp) fuente(o, nd.e, nd.b, q.vbe); else fuente(o, nd.b, nd.e, q.vbe); }
            else anular(o);
            if (e === 1) {
              // Fuente de corriente β·IB entre colector y emisor
              const [desde, hacia] = pnp ? [nd.e, nd.c] : [nd.c, nd.e];
              add(A, r(desde), o, q.beta); add(A, r(hacia), o, -q.beta);
              anular(o + 1);
            } else if (e === 2 || e === 3) {
              const V = e === 2 ? q.vcesat : q.vceo;
              if (pnp) fuente(o + 1, nd.e, nd.c, V); else fuente(o + 1, nd.c, nd.e, V);
            } else anular(o + 1);
            break;
          }
          case 'nmos': case 'pmos': {
            const pm = d.tipo === 'pmos';
            const [desde, hacia] = pm ? [nd.s, nd.d] : [nd.d, nd.s];
            if (e === 1) {
              const v0 = Math.max(lin ? lin[i] : q.vth + 1, q.vth + 1e-4);
              const ov = v0 - q.vth, gm = 2 * q.k * ov, I0 = q.k * ov * ov - gm * v0;
              const [cp, cm] = pm ? [nd.s, nd.g] : [nd.g, nd.s];
              add(A, r(desde), r(cp), gm); add(A, r(desde), r(cm), -gm);
              add(A, r(hacia), r(cp), -gm); add(A, r(hacia), r(cm), gm);
              if (r(desde) >= 0) bD[r(desde)] -= I0;
              if (r(hacia) >= 0) bD[r(hacia)] += I0;
              anular(o);
            } else if (e === 2) {
              conductancia(A, desde, hacia, 1 / q.ron);
              anular(o);
            } else if (e === 3) fuente(o, desde, hacia, q.vdss);
            else anular(o);
            break;
          }
        }
      });
      return { A, bD };
    }

    // Operacionales
    const aos = circ.aos, na = aos.length;
    const filaAO = aos.map(a => nN + F.findIndex(f => f.tipo === 'ao' && f.id === a.id));
    let estPrevAO = aos.map(() => 0), voPrev = aos.map(() => 0);
    const combosAO = [];
    if (na > 0 && na <= 7) {
      for (let c = 0; c < Math.pow(3, na); c++) {
        const e = [];
        let q = c;
        for (let k = 0; k < na; k++) { e.push([0, 1, -1][q % 3]); q = Math.floor(q / 3); }
        combosAO.push(e);
      }
    }

    const cache = new Map();
    function configurar(est, lin) {
      const clave = lin ? null : est.join('');
      if (clave !== null && cache.has(clave)) return cache.get(clave);
      const { A, bD } = estampar(est, lin);
      const lu = luFactor(A, n);
      let cfg = null;
      if (lu) {
        const S = filaAO.map(fila => { const e = new Float64Array(n); e[fila] = 1; return luSolve(lu, e); });
        const J = aos.map(ak => S.map(Sl => volt(Sl, ak.p) - volt(Sl, ak.n)));
        cfg = { lu, bD, S, J };
      }
      if (clave !== null) { if (cache.size > 400) cache.clear(); cache.set(clave, cfg); }
      return cfg;
    }

    // Elige el estado de los AO (lineal o ±Vsat) más próximo al instante anterior
    function evaluarAO(J, estado, cvec) {
      const Li = [], Sd = [];
      estado.forEach((s, k) => (s === 0 ? Li : Sd).push(k));
      const vo = new Array(na).fill(0);
      Sd.forEach(k => { vo[k] = estado[k] * Vsat; });
      if (Li.length) {
        const JLL = Li.map(i => Li.map(j => J[i][j]));
        const rhs = Li.map(i => -(cvec[i] + Sd.reduce((s, j) => s + J[i][j] * vo[j], 0)));
        const sol = resolverPequeno(JLL, rhs);
        if (!sol) return null;
        for (let q = 0; q < Li.length; q++) {
          if (Math.abs(sol[q]) > Vsat * (1 + 1e-9)) return null;
          vo[Li[q]] = sol[q];
        }
        if (!esHurwitz(JLL)) return null;
      }
      for (const k of Sd) {
        let vd = cvec[k];
        for (let j = 0; j < na; j++) vd += J[k][j] * vo[j];
        if (estado[k] * vd < -1e-9) return null;
      }
      return vo;
    }
    function elegirAO(J, cvec) {
      let vo = evaluarAO(J, estPrevAO, cvec);
      if (vo) return { vo, est: estPrevAO };
      let mejor = null, mejorD = Infinity, mejorE = null;
      for (const e of combosAO) {
        const v = evaluarAO(J, e, cvec);
        if (!v) continue;
        let d = 0;
        for (let k = 0; k < na; k++) d += (v[k] - voPrev[k]) ** 2;
        d += 1e-9 * e.reduce((s, z) => s + Math.abs(z), 0);
        if (d < mejorD) { mejorD = d; mejor = v; mejorE = e; }
      }
      return mejor ? { vo: mejor, est: mejorE } : null;
    }

    function resolverCfg(cfg, bS) {
      const rhs = new Float64Array(n);
      for (let i = 0; i < n; i++) rhs[i] = bS[i] + cfg.bD[i];
      const x = luSolve(cfg.lu, rhs);
      if (!na) return { x, vo: [], estAO: [], J: cfg.J };
      const cvec = aos.map(a => volt(x, a.p) - volt(x, a.n));
      const ra = elegirAO(cfg.J, cvec);
      if (!ra) return null;
      for (let k = 0; k < na; k++) {
        const v = ra.vo[k], Sk = cfg.S[k];
        if (v !== 0) for (let j = 0; j < n; j++) x[j] += v * Sk[j];
      }
      return { x, vo: ra.vo, estAO: ra.est, J: cfg.J };
    }

    // Tensión de control de un MOSFET (VGS o VSG)
    const vControl = (i, x) => {
      const nd = D[i].nodos;
      return D[i].tipo === 'pmos' ? volt(x, nd.s) - volt(x, nd.g) : volt(x, nd.g) - volt(x, nd.s);
    };
    const vgsPrev = D.map(d => (d.par.vth || 0) + 1);

    function resolverEstados(est, bS) {
      const act = [];
      D.forEach((d, i) => { if ((d.tipo === 'nmos' || d.tipo === 'pmos') && est[i] === 1) act.push(i); });
      if (!act.length) {
        const cfg = configurar(est, null);
        return cfg ? resolverCfg(cfg, bS) : null;
      }
      // Newton sobre la ecuación cuadrática de los MOSFET en zona activa
      const lin = new Float64Array(D.length);
      for (const i of act) lin[i] = Math.max(vgsPrev[i], D[i].par.vth + 0.05);
      let sol = null;
      for (let it = 0; it < 60; it++) {
        const cfg = configurar(est, lin);
        if (!cfg) return null;
        sol = resolverCfg(cfg, bS);
        if (!sol) return null;
        let dmax = 0, bajo = false;
        for (const i of act) {
          const v = vControl(i, sol.x);
          dmax = Math.max(dmax, Math.abs(v - lin[i]));
          if (v < D[i].par.vth) bajo = true;
          lin[i] = Math.max(v, D[i].par.vth + 1e-4);
        }
        if (dmax < 1e-8 || bajo) break;
      }
      return sol;
    }

    // Condiciones de cada estado: devuelve [dispositivo, estado nuevo, cuánto se incumple]
    function verificar(est, x) {
      const viol = [];
      D.forEach((d, i) => {
        const e = est[i], q = d.par, o = rama[i], nd = d.nodos;
        const v = (k) => volt(x, k);
        switch (d.tipo) {
          case 'diodo': case 'led': {
            const vak = v(nd.a) - v(nd.k);
            if (e === 0 && vak > q.vg + EV) viol.push([i, 1, vak - q.vg]);
            if (e === 1 && x[o] < -EI) viol.push([i, 0, -x[o] * 1e3]);
            break;
          }
          case 'zener': {
            const vak = v(nd.a) - v(nd.k);
            if (e === 0) {
              if (vak > q.vg + EV) viol.push([i, 1, vak - q.vg]);
              else if (-vak > q.vz + EV) viol.push([i, 2, -vak - q.vz]);
            } else if (x[o] < -EI) viol.push([i, 0, -x[o] * 1e3]);
            break;
          }
          case 'npn': case 'pnp': {
            const s = d.tipo === 'pnp' ? -1 : 1;
            const vbe = s * (v(nd.b) - v(nd.e)), vce = s * (v(nd.c) - v(nd.e));
            const ib = x[o];
            if (e === 0) {
              if (vbe > q.vbe + EV) viol.push([i, 1, vbe - q.vbe]);
              else if (vce > q.vceo + EV) viol.push([i, 3, vce - q.vceo]);
            } else if (e === 1) {
              if (ib < -EI) viol.push([i, 0, -ib * 1e3]);
              else if (vce < q.vcesat - EV) viol.push([i, 2, q.vcesat - vce]);
            } else if (e === 2) {
              const ic = x[o + 1];
              if (ib < -EI) viol.push([i, 0, -ib * 1e3]);
              else if (ic > q.beta * ib + EI) viol.push([i, 1, (ic - q.beta * ib) * 1e3]);
            } else if (x[o + 1] < -EI) viol.push([i, 0, -x[o + 1] * 1e3]);
            break;
          }
          case 'nmos': case 'pmos': {
            const s = d.tipo === 'pmos' ? -1 : 1;
            const vgs = s * (v(nd.g) - v(nd.s)), vds = s * (v(nd.d) - v(nd.s));
            const isat = vgs > q.vth ? q.k * (vgs - q.vth) ** 2 : 0;
            if (e === 0) {
              if (vgs > q.vth + EV) viol.push([i, 1, vgs - q.vth]);
              else if (vds > q.vdss + EV) viol.push([i, 3, vds - q.vdss]);
            } else if (e === 1) {
              if (vgs < q.vth - EV) viol.push([i, 0, q.vth - vgs]);
              else if (vds < isat * q.ron - EV) viol.push([i, 2, isat * q.ron - vds]);
            } else if (e === 2) {
              if (vgs < q.vth - EV) viol.push([i, 0, q.vth - vgs]);
              else if (vds / q.ron > isat + EI) viol.push([i, 1, (vds / q.ron - isat) * 1e3]);
            } else if (x[o] < -EI) viol.push([i, 0, -x[o] * 1e3]);
            break;
          }
        }
      });
      return viol;
    }

    // Último recurso: probar todas las combinaciones de estados
    function enumerar(bS) {
      let total = 1;
      for (const d of D) total *= NUM_ESTADOS[d.tipo];
      if (total > 3000) return null;
      for (let c = 0; c < total; c++) {
        const e = [];
        let q = c;
        for (const d of D) { e.push(q % NUM_ESTADOS[d.tipo]); q = Math.floor(q / NUM_ESTADOS[d.tipo]); }
        const sol = resolverEstados(e, bS);
        if (sol && !verificar(e, sol.x).length) return { sol, est: e };
      }
      return null;
    }

    // Resultados
    const V = Array.from({ length: circ.N }, () => new Float32Array(ns));
    const sat = aos.map(() => new Int8Array(ns));
    const Jkk = aos.map(() => ({ pos: 0, neg: 0, cero: 0 }));
    const rd = D.map(() => ({ est: new Int8Array(ns), i: new Float32Array(ns), ib: new Float32Array(ns), p: new Float32Array(ns) }));
    const cargas = circ.R.filter(e => e.carga);
    const rc = cargas.map(e => ({ id: e.id, tipo: e.carga, i: new Float32Array(ns) }));
    const entFuente = F.map((f, k) => f.tipo === 'ent' ? k : -1).filter(k => k >= 0);
    const iEnt = (nivel.entradas || []).map(() => new Float32Array(ns));
    const vC = new Float64Array(circ.C.length);
    const iL = new Float64Array(circ.L.length);
    let est = D.map(() => 0);
    let noConverge = 0, singular = false;

    const bS = new Float64Array(n);
    for (let i = 0; i < ns; i++) {
      bS.fill(0);
      F.forEach((f, k) => {
        if (f.tipo === 'ent') bS[nN + k] = entradas[f.k][i];
        else if (f.tipo === 'dc') bS[nN + k] = f.V;
      });
      circ.C.forEach((c, k) => {
        const ieq = gC[k] * vC[k];
        if (c.a > 0) bS[c.a - 1] += ieq;
        if (c.b > 0) bS[c.b - 1] -= ieq;
      });
      circ.L.forEach((l, k) => {
        if (l.a > 0) bS[l.a - 1] -= iL[k];
        if (l.b > 0) bS[l.b - 1] += iL[k];
      });

      // Suponer y comprobar
      let sol = null, viol = null;
      const visitados = new Set();
      for (let it = 0; it < 80; it++) {
        sol = resolverEstados(est, bS);
        if (!sol) break;
        viol = verificar(est, sol.x);
        if (!viol.length) break;
        visitados.add(est.join(''));
        viol.sort((a, b) => b[2] - a[2]);
        let movido = false;
        for (const [k, nuevo] of viol) {
          const e2 = est.slice(); e2[k] = nuevo;
          if (!visitados.has(e2.join(''))) { est = e2; movido = true; break; }
        }
        if (!movido) {
          const e2 = est.slice();
          for (const [k, nuevo] of viol) e2[k] = nuevo;
          if (visitados.has(e2.join(''))) break;
          est = e2;
        }
      }
      if (!sol || (viol && viol.length)) {
        const en = enumerar(bS);
        if (en) { sol = en.sol; est = en.est; }
        else if (!sol) { singular = true; break; }
        else noConverge++;
      }

      const x = sol.x;
      for (let nd = 1; nd < circ.N; nd++) V[nd][i] = x[nd - 1];
      circ.C.forEach((c, k) => { vC[k] = volt(x, c.a) - volt(x, c.b); });
      circ.L.forEach((l, k) => { iL[k] = gL[k] * (volt(x, l.a) - volt(x, l.b)) + iL[k]; });
      for (let k = 0; k < na; k++) {
        sat[k][i] = sol.estAO[k];
        const j = sol.J[k][k];
        if (j > 1e-6) Jkk[k].pos++; else if (j < -1e-6) Jkk[k].neg++; else Jkk[k].cero++;
      }
      if (na) { estPrevAO = sol.estAO; voPrev = sol.vo; }
      D.forEach((d, k) => {
        const e = est[k], o = rama[k], q = d.par, nd = d.nodos, v = (z) => volt(x, z);
        let corr = 0, ib = 0, pot = 0;
        if (d.tipo === 'diodo' || d.tipo === 'led') { corr = e === 1 ? x[o] : 0; pot = (v(nd.a) - v(nd.k)) * corr; }
        else if (d.tipo === 'zener') { corr = e === 1 ? x[o] : e === 2 ? -x[o] : 0; pot = Math.abs((v(nd.a) - v(nd.k)) * corr); }
        else if (d.tipo === 'npn' || d.tipo === 'pnp') {
          const s = d.tipo === 'pnp' ? -1 : 1;
          ib = (e === 1 || e === 2) ? x[o] : 0;
          corr = e === 1 ? q.beta * ib : (e === 2 || e === 3) ? x[o + 1] : 0;
          pot = s * (v(nd.c) - v(nd.e)) * corr + s * (v(nd.b) - v(nd.e)) * ib;
        } else {
          const s = d.tipo === 'pmos' ? -1 : 1;
          const vgs = s * (v(nd.g) - v(nd.s)), vds = s * (v(nd.d) - v(nd.s));
          corr = e === 1 ? q.k * Math.max(vgs - q.vth, 0) ** 2 : e === 2 ? vds / q.ron : e === 3 ? x[o] : 0;
          pot = vds * corr;
          if (e === 1) vgsPrev[k] = vgs;
        }
        rd[k].est[i] = e; rd[k].i[i] = corr; rd[k].ib[i] = ib; rd[k].p[i] = pot;
      });
      cargas.forEach((e, k) => { rc[k].i[i] = (volt(x, e.a) - volt(x, e.b)) / e.R; });
      for (const k of entFuente) iEnt[F[k].k][i] = -x[nN + k];
    }

    if (singular) {
      res.errores.push({ txt: D.length
        ? 'El circuito no tiene solución: al conducir, algún diodo o transistor cierra un lazo de fuentes de tensión sin ninguna resistencia (la corriente sería infinita y lo quemaría).'
        : 'El circuito no tiene solución: hay fuentes de tensión (o salidas de AO) en paralelo o en un lazo cerrado sin resistencias.' });
      return res;
    }
    if (noConverge) res.avisos.push({ txt: `En ${noConverge} instantes no se ha encontrado un estado coherente para todos los dispositivos.` });

    // Avisos de los AO
    const noLineal = !!nivel.aoNoLineal;
    aos.forEach((a, k) => {
      const j = Jkk[k];
      const otro = noLineal ? 'info' : 'aviso';
      if (j.pos && !j.neg && !j.cero) res.avisos.push({ txt: a.nombre + ' tiene realimentación positiva: su salida irá a ±Vsat.', id: a.id, clase: otro });
      else if (j.cero && !j.neg && !j.pos) res.avisos.push({ txt: a.nombre + ' no tiene realimentación (bucle abierto): funciona como comparador.', id: a.id, clase: otro });
      if (sat[k].some(s => s !== 0)) res.avisos.push({ txt: a.nombre + ' se satura (su salida llega a ±' + Vsat + ' V).', id: a.id, sat: true, clase: otro });
    });

    // Avisos y errores de los dispositivos
    const hayBobina = circ.L.length > 0;
    D.forEach((d, k) => {
      const q = d.par, rr = rd[k];
      const pmax = rr.p.reduce((m, v) => Math.max(m, v), 0);
      const imax = rr.i.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      if (rr.est.some(e => e === 3)) {
        const vmax = /mos/.test(d.tipo) ? 'V_DS supera V_DSS = ' + q.vdss : 'V_CE supera V_CEO = ' + q.vceo;
        res.errores.push({ txt: `${d.nombre} entra en ruptura (${vmax} V) y se destruiría.` + (hayBobina ? ' Al cortar la corriente de una carga inductiva (bobina, motor) aparece una sobretensión: falta el diodo de libre circulación.' : ''), id: d.id });
      }
      if (q.pmax && pmax > q.pmax) res.errores.push({ txt: `${d.nombre} disipa ${(pmax).toFixed(2).replace('.', ',')} W y su máximo es ${String(q.pmax).replace('.', ',')} W: se destruiría.`, id: d.id });
      if (q.imax && imax > q.imax) res.errores.push({ txt: `Por ${d.nombre} circularían ${(imax * 1e3).toFixed(0)} mA y su máximo es ${(q.imax * 1e3).toFixed(0)} mA: se quemaría.`, id: d.id });
      if (nivel.conmutacion && /npn|pnp|mos/.test(d.tipo)) {
        let pAct = 0;
        for (let i = 0; i < ns; i++) if (rr.est[i] === 1) pAct = Math.max(pAct, rr.p[i]);
        if (pAct > 0.05) res.avisos.push({ txt: `${d.nombre} no llega a ${/mos/.test(d.tipo) ? 'zona óhmica' : 'saturarse'}: trabaja en zona activa y disipa hasta ${pAct.toFixed(2).replace('.', ',')} W.`, id: d.id });
      }
    });
    (nivel.entradas || []).forEach((e, k) => {
      if (!e.imax) return;
      const m = iEnt[k].reduce((a, v) => Math.max(a, Math.abs(v)), 0);
      if (m > e.imax * 1.001) res.errores.push({ txt: `${e.tipo === 'digital' ? 'La salida del µC' : 'La entrada ' + e.nombre} tendría que dar ${(m * 1e3).toFixed(1).replace('.', ',')} mA y solo puede dar ${(e.imax * 1e3).toFixed(0)} mA.` });
    });

    res.V = V;
    res.sat = sat;
    res.disp = rd;
    res.cargas = rc;
    res.iEnt = iEnt;
    res.salida = medir(res, circ, nivel);
    res.ok = true;
    return res;
  }

  /* Magnitud que se compara con el objetivo: tensión de salida (V) o
     corriente por las cargas de un tipo (mA). */
  function medir(res, circ, nivel) {
    const m = nivel.medida;
    const ns = res.t.length;
    if (!m || m.tipo === 'v') return circ.nudoSalida >= 0 ? res.V[circ.nudoSalida] : new Float32Array(ns);
    const out = new Float32Array(ns);
    circ.disp.forEach((d, k) => { if (d.tipo === m.de) for (let i = 0; i < ns; i++) out[i] += 1e3 * res.disp[k].i[i]; });
    res.cargas.forEach(c => { if (c.tipo === m.de) for (let i = 0; i < ns; i++) out[i] += 1e3 * c.i[i]; });
    return out;
  }

  /* Comparación con la salida objetivo. */
  function puntuar(salida, objetivo, ref) {
    const n = objetivo.length;
    let e2 = 0, o2 = 0;
    for (let i = 0; i < n; i++) {
      e2 += (salida[i] - objetivo[i]) ** 2;
      o2 += objetivo[i] ** 2;
    }
    const err = Math.sqrt(e2 / n);
    const r = ref || Math.max(Math.sqrt(o2 / n), 0.2);
    return { err, coincidencia: Math.max(0, 1 - err / r) };
  }

  G.Simulador = { construir, simular, puntuar, esHurwitz, NOMBRES_ESTADO };
})(typeof window !== 'undefined' ? window : globalThis);
