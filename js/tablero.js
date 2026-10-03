/* ==========================================================================
   Modelo del tablero: piezas colocadas, ocupación, lápiz de cables,
   serialización y deshacer.
   ========================================================================== */
(function (G) {
  'use strict';
  const P = G.Piezas;

  function Tablero(cols, filas) {
    this.cols = cols;
    this.filas = filas;
    this.piezas = [];
    this.sigId = 1;
    this.ocupa = new Map();
  }

  const clave = (x, y) => x + ',' + y;

  Tablero.prototype.reindexar = function () {
    this.ocupa.clear();
    for (const p of this.piezas) for (const [x, y] of P.casillas(p)) this.ocupa.set(clave(x, y), p);
  };

  Tablero.prototype.piezaEn = function (x, y) {
    return this.ocupa.get(clave(x, y)) || null;
  };

  Tablero.prototype.dentro = function (x, y) {
    return x >= 0 && y >= 0 && x < this.cols && y < this.filas;
  };

  /* ¿Se puede colocar? Devuelve la lista de piezas que se sustituirían, o null. */
  Tablero.prototype.comprobar = function (p, ignorarId) {
    const quitar = new Set();
    for (const [x, y] of P.casillas(p)) {
      if (!this.dentro(x, y)) return null;
      const q = this.piezaEn(x, y);
      if (q && q.id !== ignorarId) {
        if (q.fija) return null;
        quitar.add(q);
      }
    }
    return [...quitar];
  };

  Tablero.prototype.colocar = function (p) {
    const quitar = this.comprobar(p);
    if (!quitar) return null;
    for (const q of quitar) this.quitar(q.id, true);
    const nueva = Object.assign({ r: 0, m: false }, p, { id: p.id || this.sigId++ });
    if (nueva.id >= this.sigId) this.sigId = nueva.id + 1;
    const t = P.TIPOS[nueva.tipo];
    if (t.valor !== undefined && nueva.valor === undefined) nueva.valor = t.valor;
    this.piezas.push(nueva);
    this.reindexar();
    return nueva;
  };

  Tablero.prototype.quitar = function (id, sinIndexar) {
    const i = this.piezas.findIndex(p => p.id === id);
    if (i < 0 || this.piezas[i].fija) return false;
    this.piezas.splice(i, 1);
    if (!sinIndexar) this.reindexar();
    return true;
  };

  Tablero.prototype.mover = function (id, x, y, r, m) {
    const p = this.piezas.find(q => q.id === id);
    if (!p || p.fija) return false;
    const prueba = Object.assign({}, p, { x, y, r: r === undefined ? p.r : r, m: m === undefined ? p.m : m });
    const quitar = this.comprobar(prueba, id);
    if (!quitar) return false;
    for (const q of quitar) this.quitar(q.id, true);
    Object.assign(p, { x: prueba.x, y: prueba.y, r: prueba.r, m: prueba.m });
    this.reindexar();
    return true;
  };

  /* Gira una pieza 90° alrededor de su centro (aprox.). */
  Tablero.prototype.girar = function (id) {
    const p = this.piezas.find(q => q.id === id);
    if (!p || p.fija) return false;
    const [w, h] = P.dimensiones(p);
    const cx = p.x + Math.floor(w / 2), cy = p.y + Math.floor(h / 2);
    const nr = (p.r + 1) % 4;
    const [nw, nh] = P.dimensiones({ tipo: p.tipo, r: nr });
    return this.mover(id, cx - Math.floor(nw / 2), cy - Math.floor(nh / 2), nr, p.m);
  };

  Tablero.prototype.espejo = function (id) {
    const p = this.piezas.find(q => q.id === id);
    if (!p || p.fija) return false;
    return this.mover(id, p.x, p.y, p.r, !p.m);
  };

  /* ---------- Lápiz de cables ----------
     Un trazo es una lista de casillas adyacentes. Cada casilla vacía o con
     cable recibe las direcciones del trazo; si el trazo cruza en recto un
     cable recto perpendicular, se pone un cruce sin unión. */
  Tablero.prototype.iniciarTrazo = function () {
    const original = new Map();
    for (const p of this.piezas) {
      if (P.TIPOS[p.tipo].cable && !p.fija) original.set(clave(p.x, p.y), { tipo: p.tipo, r: p.r, m: p.m });
    }
    return { original, dirs: new Map(), sinPuentes: false };
  };

  Tablero.prototype.esCableable = function (x, y, trazo) {
    if (!this.dentro(x, y)) return false;
    const q = this.piezaEn(x, y);
    if (!q) return true;
    if (q.fija) return false;
    return !!P.TIPOS[q.tipo].cable || (trazo && trazo.dirs.has(clave(x, y)));
  };

  Tablero.prototype.pasoTrazo = function (trazo, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    if (Math.abs(dx) + Math.abs(dy) !== 1) return;
    const d = dx === 1 ? 1 : dx === -1 ? 3 : dy === 1 ? 2 : 0;
    const ext = [[a, d], [b, (d + 2) % 4]];
    for (const [[x, y], dir] of ext) {
      if (!this.esCableable(x, y, trazo)) continue;
      const k = clave(x, y);
      if (!trazo.dirs.has(k)) trazo.dirs.set(k, new Set());
      trazo.dirs.get(k).add(dir);
      this.actualizarCasillaTrazo(trazo, x, y);
    }
  };

  Tablero.prototype.actualizarCasillaTrazo = function (trazo, x, y) {
    const k = clave(x, y);
    const nuevas = trazo.dirs.get(k);
    const orig = trazo.original.get(k);
    let res;
    if (!orig) res = P.cableDesdeDirs(nuevas);
    else if (orig.tipo === 'puente') res = orig;
    else {
      const od = P.dirsDeCable({ tipo: orig.tipo, r: orig.r, m: orig.m, x: 0, y: 0 });
      const recto = orig.tipo === 'cable';
      const nd = [...nuevas];
      if (!trazo.sinPuentes && recto && nd.length === 2 && (nd[0] + 2) % 4 === nd[1] && !od.has(nd[0])) {
        res = { tipo: 'puente', r: 0, m: false };
      } else {
        const u = new Set([...od, ...nuevas]);
        res = P.cableDesdeDirs(u);
      }
    }
    const actual = this.piezaEn(x, y);
    if (actual && !P.TIPOS[actual.tipo].cable) return;
    if (actual) this.quitar(actual.id, true);
    if (res) this.piezas.push({ id: this.sigId++, tipo: res.tipo, x, y, r: res.r, m: res.m });
    this.reindexar();
  };

  /* Expande una polilínea (vértices en casillas) a casillas adyacentes. */
  function expandir(vertices) {
    const out = [vertices[0].slice()];
    for (let i = 1; i < vertices.length; i++) {
      let [x, y] = out[out.length - 1];
      const [tx, ty] = vertices[i];
      while (x !== tx) { x += Math.sign(tx - x); out.push([x, y]); }
      while (y !== ty) { y += Math.sign(ty - y); out.push([x, y]); }
    }
    return out;
  }

  Tablero.prototype.trazar = function (vertices, sinPuentes) {
    const tr = this.iniciarTrazo();
    tr.sinPuentes = !!sinPuentes;
    const cas = expandir(vertices);
    for (let i = 1; i < cas.length; i++) this.pasoTrazo(tr, cas[i - 1], cas[i]);
  };

  /* ---------- Serialización ---------- */
  Tablero.prototype.serializar = function () {
    return this.piezas.map(p => {
      const o = { id: p.id, tipo: p.tipo, x: p.x, y: p.y, r: p.r };
      if (p.m) o.m = true;
      if (p.valor !== undefined) o.valor = p.valor;
      if (p.k !== undefined) o.k = p.k;
      if (p.par) o.par = p.par;
      if (p.fija) o.fija = true;
      return o;
    });
  };

  Tablero.prototype.cargar = function (lista) {
    this.piezas = lista.map(o => Object.assign({ r: 0, m: false }, o));
    this.sigId = this.piezas.reduce((m, p) => Math.max(m, p.id), 0) + 1;
    this.reindexar();
  };

  Tablero.expandir = expandir;
  G.Tablero = Tablero;
})(typeof window !== 'undefined' ? window : globalThis);
