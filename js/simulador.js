/* ==========================================================================
   Simulador: del tablero a la lista de nudos y análisis temporal (MNA).
   - Resistencias, condensadores (Euler implícito), fuentes de tensión.
   - AO ideal: la salida es una fuente de tensión cuyo valor se elige para
     que v+ = v- (zona lineal, sólo si el equilibrio es estable, es decir,
     con realimentación negativa) o queda en ±Vsat.
   ========================================================================== */
(function (G) {
  'use strict';
  const P = G.Piezas;

  const GMIN = 1e-12;

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
    for (let k = 0; k < n; k++) {
      const p = piv[k];
      if (p !== k) { const t = x[k]; x[k] = x[p]; x[p] = t; }
      for (let i = k + 1; i < n; i++) x[i] -= A[i * n + k] * x[k];
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

  /* ---------- Construcción de la lista de nudos ---------- */
  function construir(piezas, nivel) {
    const uf = new UF();
    const cuenta = new Map();      // borde -> número de puertos
    const posBorde = new Map();    // borde -> punto medio (para marcar extremos sueltos)
    const GND = 'GND';
    uf.find(GND);

    for (const p of piezas) {
      for (const q of P.puertos(p)) {
        const k = P.claveBorde(q.cx, q.cy, q.d);
        uf.union(p.id + ':' + q.n, k);
        cuenta.set(k, (cuenta.get(k) || 0) + 1);
        posBorde.set(k, [q.cx + 0.5 + P.DX[q.d] * 0.5, q.cy + 0.5 + P.DY[q.d] * 0.5]);
      }
      if (p.tipo === 'tierra') uf.union(p.id + ':a', GND);
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

    const R = [], C = [], fuentes = [], aos = [];
    let nudoSalida = -1;
    const avisos = [], errores = [];
    const nombreAO = new Map();

    for (const p of piezas) {
      const t = p.tipo;
      if (t === 'resistencia') R.push({ a: nudo(p.id + ':a'), b: nudo(p.id + ':b'), R: Math.max(p.valor || 1, 1e-3), id: p.id });
      else if (t === 'condensador') C.push({ a: nudo(p.id + ':a'), b: nudo(p.id + ':b'), C: Math.max(p.valor || 1e-12, 1e-15), id: p.id });
      else if (t === 'fuente') fuentes.push({ n: nudo(p.id + ':a'), tipo: 'dc', V: p.valor || 0, id: p.id });
      else if (t === 'ao') {
        nombreAO.set(p.id, 'AO' + (aos.length + 1));
        aos.push({ p: nudo(p.id + ':p'), n: nudo(p.id + ':n'), o: nudo(p.id + ':o'), id: p.id, nombre: 'AO' + (aos.length + 1) });
      } else if (t === 'entrada') {
        const ent = nivel.entradas[p.k];
        const nc = nudo(p.id + ':a');
        if (ent && ent.Rs > 0) {
          const ni = N++;
          fuentes.push({ n: ni, tipo: 'ent', k: p.k, id: p.id });
          R.push({ a: ni, b: nc, R: ent.Rs, id: p.id, interna: true });
        } else {
          fuentes.push({ n: nc, tipo: 'ent', k: p.k, id: p.id });
        }
      } else if (t === 'salida') {
        nudoSalida = nudo(p.id + ':a');
        if (nivel.RL > 0) R.push({ a: nudoSalida, b: 0, R: nivel.RL, id: p.id, interna: true });
      } else {
        nudo(p.id + ':a');
        if (t === 'puente') nudo(p.id + ':b');
      }
    }

    // Nudo de cada (pieza, etiqueta) y de cada borde (para sondas y colores)
    const nudoDe = (id, etiqueta) => {
      const r = uf.find(id + ':' + etiqueta);
      return indice.has(r) ? indice.get(r) : -1;
    };

    // Extremos sueltos
    const sueltos = [];
    for (const [k, n] of cuenta) if (n === 1) sueltos.push(posBorde.get(k));
    for (const p of piezas) if (p.tipo === 'extremo') sueltos.push([p.x + 0.5, p.y + 0.5]);

    // Fuentes de tensión: alimentadas como fuentes ideales (AO incluidos)
    const todas = fuentes.map(f => ({ ...f }));
    for (const a of aos) todas.push({ n: a.o, tipo: 'ao', id: a.id, nombre: a.nombre });

    // Cortocircuitos evidentes entre fuentes
    const visto = new Map();
    const desc = (f) => f.tipo === 'ao' ? 'la salida de ' + f.nombre
      : f.tipo === 'ent' ? 'la entrada ' + (nivel.entradas[f.k] ? nivel.entradas[f.k].nombre : '')
      : 'una fuente de ' + P.formatearValor(f.V, 'V');
    for (const f of todas) {
      if (f.n === 0) errores.push({ txt: 'Cortocircuito: ' + desc(f) + ' está unida directamente a tierra.', id: f.id });
      else if (visto.has(f.n)) errores.push({ txt: 'Cortocircuito: ' + desc(f) + ' está unida directamente a ' + desc(visto.get(f.n)) + '.', id: f.id });
      else visto.set(f.n, f);
    }

    // Nudos flotantes (sin camino resistivo a una fuente o a tierra)
    const ady = Array.from({ length: N }, () => []);
    for (const r of R) { ady[r.a].push(r.b); ady[r.b].push(r.a); }
    const alcanzado = new Uint8Array(N);
    const cola = [0];
    alcanzado[0] = 1;
    for (const f of todas) if (!alcanzado[f.n]) { alcanzado[f.n] = 1; cola.push(f.n); }
    while (cola.length) {
      const u = cola.pop();
      for (const v of ady[u]) if (!alcanzado[v]) { alcanzado[v] = 1; cola.push(v); }
    }
    for (const a of aos) {
      if (!alcanzado[a.p]) avisos.push({ txt: 'La entrada + de ' + a.nombre + ' está al aire (no llega a ninguna tensión).', id: a.id });
      if (!alcanzado[a.n]) avisos.push({ txt: 'La entrada − de ' + a.nombre + ' está al aire (no llega a ninguna tensión).', id: a.id });
    }
    if (nudoSalida < 0) errores.push({ txt: 'No hay conector de salida.' });
    else if (!alcanzado[nudoSalida]) avisos.push({ txt: 'La salida vo no está conectada a nada que fije su tensión.' });

    return { N, R, C, fuentes: todas, aos, nudoSalida, nudoDe, sueltos, avisos, errores, uf, indice };
  }

  /* ---------- Simulación temporal ---------- */
  function simular(circ, nivel, opciones) {
    const ns = (opciones && opciones.muestras) || 500;
    const tmax = nivel.tmax;           // en ms
    const dt = tmax / (ns - 1);        // ms
    const dts = dt * 1e-3;             // s
    const Vsat = nivel.Vsat;
    const t = new Float64Array(ns);
    for (let i = 0; i < ns; i++) t[i] = i * dt;

    const entradas = nivel.entradas.map(e => {
      const a = new Float64Array(ns);
      for (let i = 0; i < ns; i++) a[i] = e.f(t[i]);
      return a;
    });

    const res = { t, dt, entradas, V: null, salida: null, sat: [], ok: false, avisos: circ.avisos.slice(), errores: circ.errores.slice() };
    if (circ.errores.length) return res;

    const nN = circ.N - 1, M = circ.fuentes.length, n = nN + M;
    const A = new Float64Array(n * n);
    const add = (i, j, v) => { if (i > 0 && j > 0) A[(i - 1) * n + (j - 1)] += v; };
    const stampG = (a, b, g) => { add(a, a, g); add(b, b, g); add(a, b, -g); add(b, a, -g); };
    for (let i = 1; i <= nN; i++) add(i, i, GMIN);
    for (const r of circ.R) stampG(r.a, r.b, 1 / r.R);
    const gC = circ.C.map(c => c.C / dts);
    circ.C.forEach((c, k) => stampG(c.a, c.b, gC[k]));
    circ.fuentes.forEach((f, k) => {
      const row = nN + k;
      if (f.n > 0) {
        A[(f.n - 1) * n + row] += 1;
        A[row * n + (f.n - 1)] += 1;
      }
    });
    const lu = luFactor(A, n);
    if (!lu) {
      res.errores.push({ txt: 'El circuito no tiene solución: hay fuentes de tensión (o salidas de AO) en paralelo o en un lazo cerrado sin resistencias.' });
      return res;
    }

    const aos = circ.aos, na = aos.length;
    const idxFuenteAO = aos.map(a => circ.fuentes.findIndex(f => f.tipo === 'ao' && f.id === a.id));
    const volt = (x, nodo) => nodo > 0 ? x[nodo - 1] : 0;

    // Sensibilidades: tensiones de nudo por voltio en la salida de cada AO
    const S = idxFuenteAO.map(k => {
      const b = new Float64Array(n);
      b[nN + k] = 1;
      return luSolve(lu, b);
    });
    const J = aos.map(ak => S.map(Sl => volt(Sl, ak.p) - volt(Sl, ak.n)));

    // Avisos por tipo de realimentación
    aos.forEach((a, k) => {
      const jkk = J[k][k];
      if (jkk > 1e-6) res.avisos.push({ txt: a.nombre + ' tiene realimentación positiva: su salida irá a ±Vsat.', id: a.id });
      else if (Math.abs(jkk) <= 1e-6) res.avisos.push({ txt: a.nombre + ' no tiene realimentación (bucle abierto): funciona como comparador.', id: a.id });
    });

    const V = Array.from({ length: circ.N }, () => new Float32Array(ns));
    const sat = aos.map(() => new Int8Array(ns));
    const vC = new Float64Array(circ.C.length);
    let estPrev = aos.map(() => 0);   // 0 lineal, ±1 saturado
    let voPrev = aos.map(() => 0);
    let sinSolucion = false;

    const evaluar = (estado, cvec) => {
      const L = [], Sd = [];
      estado.forEach((s, k) => (s === 0 ? L : Sd).push(k));
      const vo = new Array(na).fill(0);
      Sd.forEach(k => { vo[k] = estado[k] * Vsat; });
      if (L.length) {
        const JLL = L.map(i => L.map(j => J[i][j]));
        const rhs = L.map(i => -(cvec[i] + Sd.reduce((s, j) => s + J[i][j] * vo[j], 0)));
        const sol = resolverPequeno(JLL, rhs);
        if (!sol) return null;
        for (let q = 0; q < L.length; q++) {
          if (Math.abs(sol[q]) > Vsat * (1 + 1e-9)) return null;
          vo[L[q]] = sol[q];
        }
        if (!esHurwitz(JLL)) return null;
      }
      for (const k of Sd) {
        let vd = cvec[k];
        for (let j = 0; j < na; j++) vd += J[k][j] * vo[j];
        if (estado[k] * vd < -1e-9) return null;
      }
      return vo;
    };

    // Todas las combinaciones de estados (lineal, +sat, -sat)
    const combos = [];
    if (na > 0 && na <= 7) {
      const total = Math.pow(3, na);
      for (let c = 0; c < total; c++) {
        const e = [];
        let r = c;
        for (let k = 0; k < na; k++) { e.push([0, 1, -1][r % 3]); r = Math.floor(r / 3); }
        combos.push(e);
      }
    }

    const b = new Float64Array(n);
    for (let i = 0; i < ns; i++) {
      b.fill(0);
      circ.fuentes.forEach((f, k) => {
        if (f.tipo === 'ent') b[nN + k] = entradas[f.k][i];
        else if (f.tipo === 'dc') b[nN + k] = f.V;
      });
      circ.C.forEach((c, k) => {
        const ieq = gC[k] * vC[k];
        if (c.a > 0) b[c.a - 1] += ieq;
        if (c.b > 0) b[c.b - 1] -= ieq;
      });
      const x0 = luSolve(lu, b);
      const x = Float64Array.from(x0);

      if (na) {
        const cvec = aos.map(a => volt(x0, a.p) - volt(x0, a.n));
        let vo = evaluar(estPrev, cvec);
        let est = estPrev;
        if (!vo) {
          let mejor = null, mejorD = Infinity, mejorE = null;
          for (const e of combos) {
            const r = evaluar(e, cvec);
            if (!r) continue;
            let d = 0;
            for (let k = 0; k < na; k++) d += (r[k] - voPrev[k]) ** 2;
            d += 1e-9 * e.reduce((s, v) => s + Math.abs(v), 0);
            if (d < mejorD) { mejorD = d; mejor = r; mejorE = e; }
          }
          if (mejor) { vo = mejor; est = mejorE; }
          else {
            sinSolucion = true;
            vo = voPrev.slice();
            est = estPrev;
          }
        }
        for (let k = 0; k < na; k++) {
          const Sk = S[k], v = vo[k];
          if (v !== 0) for (let j = 0; j < n; j++) x[j] += v * Sk[j];
          sat[k][i] = est[k];
        }
        estPrev = est;
        voPrev = vo;
      }

      for (let nd = 1; nd < circ.N; nd++) V[nd][i] = x[nd - 1];
      circ.C.forEach((c, k) => { vC[k] = volt(x, c.a) - volt(x, c.b); });
    }

    if (sinSolucion) res.errores.push({ txt: 'No se ha encontrado un punto de trabajo estable para los AO.' });
    aos.forEach((a, k) => {
      if (sat[k].some(s => s !== 0)) res.avisos.push({ txt: a.nombre + ' se satura (su salida llega a ±' + Vsat + ' V).', id: a.id, sat: true });
    });

    res.V = V;
    res.sat = sat;
    res.salida = circ.nudoSalida >= 0 ? V[circ.nudoSalida] : new Float32Array(ns);
    res.ok = true;
    return res;
  }

  /* Comparación con la salida objetivo. */
  function puntuar(salida, objetivo) {
    const n = objetivo.length;
    let e2 = 0, o2 = 0;
    for (let i = 0; i < n; i++) {
      e2 += (salida[i] - objetivo[i]) ** 2;
      o2 += objetivo[i] ** 2;
    }
    const err = Math.sqrt(e2 / n);
    const ref = Math.max(Math.sqrt(o2 / n), 0.2);
    return { err, coincidencia: Math.max(0, 1 - err / ref) };
  }

  G.Simulador = { construir, simular, puntuar, esHurwitz };
})(typeof window !== 'undefined' ? window : globalThis);
