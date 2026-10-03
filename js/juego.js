/* ==========================================================================
   Circuitos de Electrónica — interfaz del juego.
   ========================================================================== */
(function () {
  'use strict';
  const P = window.Piezas, S = window.Simulador, N = window.Niveles, D = window.Dibujo, Gr = window.Graficas;
  const T = D.T;
  const { cols: COLS, filas: FILAS } = N.TABLERO;
  // Coincidencia necesaria: 98 % salvo en los niveles de diseño con tolerancia
  const umbral = () => E.nivel.umbral || 0.98;
  const NIVELES = N.NIVELES.concat([N.LIBRE]);
  const OPS_COMPONENTE = ['ao', 'R', 'C', 'V'];

  const $ = (id) => document.getElementById(id);
  const fmt = (v, dec = 2) => (Math.abs(v) < 0.5 * Math.pow(10, -dec) ? 0 : v).toFixed(dec).replace('.', ',').replace('-', '−');
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sinEtiquetas = (s) => String(s).replace(/<sub>(.*?)<\/sub>/g, '$1').replace(/<[^>]+>/g, '');

  /* Componentes que cuentan para las estrellas: todo lo que no es cable,
     conector ni carga dada por el enunciado. */
  const esComponente = (p) => !p.fija && !P.TIPOS[p.tipo].cable && !P.TIPOS[p.tipo].carga && p.tipo !== 'tierra';

  /* ---------- Almacenamiento (opcional) ---------- */
  const PREFIJO = 'circuitosAO.';
  const ALM = {
    leer(k, def) {
      try { const v = localStorage.getItem(PREFIJO + k); return v === null ? def : JSON.parse(v); } catch (e) { return def; }
    },
    escribir(k, v) {
      try { localStorage.setItem(PREFIJO + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ }
    },
    /* Todas las claves del juego (sin el prefijo), con su valor. */
    todas() {
      const datos = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(PREFIJO)) datos[k.slice(PREFIJO.length)] = JSON.parse(localStorage.getItem(k));
        }
      } catch (e) { /* sin almacenamiento */ }
      return datos;
    },
    /* Borra las claves del juego salvo las indicadas. */
    borrar(conservar) {
      try {
        const claves = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(PREFIJO) && !conservar.includes(k.slice(PREFIJO.length))) claves.push(k);
        }
        for (const k of claves) localStorage.removeItem(k);
      } catch (e) { /* sin almacenamiento */ }
    }
  };
  // Preferencias de la interfaz que no forman parte del progreso
  const PREFERENCIAS = ['tema', 'ayudaVista'];

  /* ---------- Estado ---------- */
  const E = {
    idx: 0, nivel: null, tab: null, circ: null, res: null, obj: null, punt: null,
    herr: 'lapiz', rot: 0, esp: false, sel: null,
    hover: null, hoverPt: null, trazo: null, arrastre: null, borrando: null,
    hist: [], rehacer: [], sondas: [],
    cursor: 0, anim: false, ultimoT: 0,
    ganado: false, ayuda: false, interaccion: false,
    progreso: ALM.leer('progreso', {}),
    colores: {}
  };

  const svg = $('tablero');
  const medidaCorriente = () => E.nivel.medida && E.nivel.medida.tipo === 'i';
  const unidadSalida = () => medidaCorriente() ? 'mA' : 'V';
  const nombreSalida = () => medidaCorriente() ? E.nivel.medida.nombre : 'v<sub>o</sub>';

  /* ---------- Paleta ---------- */
  function herramientasNivel() {
    return N.paleta(E.nivel).map(e => Object.assign(e, { clave: 'p:' + e.clave }));
  }

  function textoParametros(tipo, par) {
    const q = Object.assign({}, P.TIPOS[tipo].par || {}, par || {});
    const v = (x) => String(+(+x).toPrecision(4)).replace('.', ',');
    switch (tipo) {
      case 'diodo': case 'led': return `V<sub>γ</sub> = ${v(q.vg)} V`;
      case 'zener': return `V<sub>Z</sub> = ${v(q.vz)} V · V<sub>γ</sub> = ${v(q.vg)} V` + (q.pmax ? ` · P<sub>máx</sub> = ${v(q.pmax)} W` : '');
      case 'npn': case 'pnp': return `β = ${v(q.beta)} · V<sub>BE</sub> = ${v(q.vbe)} V · V<sub>CE(sat)</sub> = ${v(q.vcesat)} V · V<sub>CEO</sub> = ${v(q.vceo)} V`;
      case 'nmos': case 'pmos': return `V<sub>TH</sub> = ${v(q.vth)} V · k = ${v(q.k * 1e3)} mA/V² · R<sub>DS(on)</sub> = ${v(q.ron)} Ω · V<sub>DSS</sub> = ${v(q.vdss)} V`;
      case 'bobina': return `L = ${P.formatearValor(q.L, 'H')}`;
      default: return '';
    }
  }

  function construirPaleta() {
    const herr = [
      ['lapiz', 'Lápiz de cables', 'W'], ['sel', 'Seleccionar', 'V'],
      ['borrar', 'Borrar', 'E'], ['sonda', 'Sonda', 'P']
    ];
    $('herramientas').innerHTML = herr.map(([k, l, tecla]) =>
      `<button class="item" data-herr="${k}" title="${l} (${tecla})">${D.iconoHerramienta(k)}<span class="lbl">${l}</span><span class="tecla">${tecla}</span></button>`).join('');
    $('piezas').innerHTML = herramientasNivel().map((h, i) => {
      const t = P.TIPOS[h.tipo];
      let lbl = h.etiqueta || t.nombre;
      if (h.tipo === 'fuente') lbl = h.libre ? 'Fuente' : 'Fuente ' + (h.valor > 0 ? '+' : h.valor < 0 ? '−' : '') + String(Math.abs(h.valor)).replace('.', ',') + ' V';
      if (h.tipo === 'ao') lbl = 'AO';
      const tecla = i < 9 ? `<span class="tecla">${i + 1}</span>` : '';
      const tip = sinEtiquetas((h.etiqueta || t.nombre) + (textoParametros(h.tipo, h.par) ? ' · ' + textoParametros(h.tipo, h.par) : ''));
      return `<button class="item${h.tipo === 'ao' ? ' ancho' : ''}" data-herr="${h.clave}" title="${esc(tip)}">${D.icono(h.tipo, h.valor)}<span class="lbl">${lbl}</span>${tecla}</button>`;
    }).join('');
    marcarHerramienta();
  }

  function marcarHerramienta() {
    document.querySelectorAll('.paleta .item').forEach(b => b.classList.toggle('activo', b.dataset.herr === E.herr));
  }

  function elegirHerramienta(h) {
    E.herr = h;
    if (h.startsWith('p:')) { E.rot = 0; E.esp = false; }
    marcarHerramienta();
    dibujarFantasma();
    textoEstado();
  }

  function herrPieza() {
    if (!E.herr.startsWith('p:')) return null;
    return herramientasNivel().find(h => h.clave === E.herr) || null;
  }

  /* ---------- Carga de niveles ---------- */
  function cargarNivel(idx) {
    pararAnim();
    E.idx = (idx + NIVELES.length) % NIVELES.length;
    E.nivel = NIVELES[E.idx];
    const nv = E.nivel;
    ALM.escribir('nivel', nv.id);
    if (nv.libre) {
      nv.config = ALM.leer('libreConfig', nv.config);
      N.prepararLibre(nv);
    }
    E.tab = new window.Tablero(COLS, FILAS);
    const guardado = ALM.leer('circuito.' + nv.id, null);
    let cargado = false;
    if (guardado && Array.isArray(guardado)) {
      try { E.tab.cargar(guardado.filter(p => P.TIPOS[p.tipo])); cargado = true; } catch (e) { cargado = false; }
    }
    if (!cargado) E.tab = new window.Tablero(COLS, FILAS);
    // Los conectores fijos siempre desde el nivel
    E.tab.cargar(E.tab.serializar().filter(p => !p.fija));
    for (const c of N.conectores(nv)) {
      for (const [x, y] of P.casillas(c)) { const q = E.tab.piezaEn(x, y); if (q) E.tab.quitar(q.id); }
      E.tab.colocar(c);
    }
    if (!cargado && nv.inicial) N.aplicarSolucion(E.tab, nv.inicial, nv);
    E.hist = []; E.rehacer = []; E.sondas = []; E.sel = null;
    E.ayuda = false; E.ganado = false; E.interaccion = false; E.mejorSesion = 0; E.cursor = 0;
    E.par = nv.solucion ? nv.solucion.filter(c => OPS_COMPONENTE.includes(c[0]) || (c[0] === 'p' && !P.TIPOS[c[1]].carga)).length : Infinity;

    $('nivelNum').textContent = nv.numero;
    $('nivelTitulo').textContent = nv.titulo;
    $('nivelConcepto').innerHTML = nv.concepto;
    $('marcaSub').textContent = nv.libre ? 'Electrónica · Laboratorio libre' : `Electrónica · Tema ${nv.tema.num} · ${nv.tema.nombre}`;
    $('enunciado').innerHTML = nv.enunciado;
    $('pista').hidden = true;
    $('pista').innerHTML = nv.pista ? '<b>Pista.</b> ' + nv.pista : '';
    $('btnPista').disabled = !nv.pista;
    $('btnSolucion').disabled = !nv.solucion;
    $('libreConfig').hidden = !nv.libre;
    $('tarjetaEntradas').hidden = !nv.entradas.length;
    $('tituloSalida').textContent = medidaCorriente() ? 'Corriente' : 'Salida';
    if (nv.libre) construirLibre();
    actualizarEstrellasCabecera();
    if (!herramientasNivel().some(h => h.clave === E.herr) && E.herr.startsWith('p:')) E.herr = 'lapiz';
    construirPaleta();
    textoEntradas();
    cambio(false);
    textoEstado();
  }

  function textoEntradas() {
    const nv = E.nivel;
    let h = nv.entradas.map(e => `<b>${e.nombre}</b>: ${e.texto}` +
      (e.Rs ? ` · resistencia interna ${P.formatearValor(e.Rs, 'Ω')}` : '') +
      (e.imax ? ` · máximo ${fmt(e.imax * 1e3, 0)} mA` : '')).join('<br>');
    if (nv.RL) h += `<br><b>Carga</b> en la salida: R<sub>L</sub> = ${P.formatearValor(nv.RL, 'Ω')}`;
    $('textoEntradas').innerHTML = h;
    $('objetivoFormula').innerHTML = '<span class="etq">Objetivo</span>' + nv.objetivoHTML;
  }

  function actualizarEstrellasCabecera() {
    const n = E.progreso[E.nivel.id] || 0;
    $('nivelEstrellas').innerHTML = E.nivel.libre ? '' : estrellasHTML(n);
  }
  const estrellasHTML = (n) => [1, 2, 3].map(i => `<span class="${i <= n ? '' : 'off'}">★</span>`).join('');

  /* ---------- Historial ---------- */
  const instantanea = () => JSON.stringify(E.tab.serializar());
  function empujar(snap) {
    E.hist.push(snap);
    if (E.hist.length > 150) E.hist.shift();
    E.rehacer = [];
  }
  function deshacer() {
    if (!E.hist.length) return;
    E.rehacer.push(instantanea());
    E.tab.cargar(JSON.parse(E.hist.pop()));
    E.sel = null;
    cambio(true);
  }
  function rehacerAccion() {
    if (!E.rehacer.length) return;
    E.hist.push(instantanea());
    E.tab.cargar(JSON.parse(E.rehacer.pop()));
    E.sel = null;
    cambio(true);
  }

  /* ---------- Simulación ---------- */
  function simular() {
    const nv = E.nivel;
    E.circ = S.construir(E.tab.piezas, nv);
    E.res = S.simular(E.circ, nv, { muestras: 500 });
    E.obj = nv.objetivo(E.res.entradas, E.res.t, E.res.dt);
    E.punt = !E.res.ok ? { coincidencia: 0, err: NaN }
      : nv.puntuar ? nv.puntuar(E.res.salida, E.obj, E.res.t)
      : S.puntuar(E.res.salida, E.obj, nv.ref);
    // Escala de color de tensiones
    let m = 1;
    if (E.res.V) for (let n = 1; n < E.res.V.length; n++) for (const v of E.res.V[n]) if (Math.abs(v) > m) m = Math.abs(v);
    E.vEscala = m;
    // Sondas: recalcular su nudo
    E.sondas = E.sondas.filter(s => E.tab.piezas.some(p => p.id === s.pid));
    for (const s of E.sondas) s.nodo = E.circ.nudoDe(s.pid, s.n);
  }

  function cambio(interaccion) {
    if (interaccion) E.interaccion = true;
    if (E.sel && !E.tab.piezas.some(p => p.id === E.sel)) E.sel = null;
    simular();
    dibujarTablero();
    dibujarGraficas();
    actualizarPanel();
    comprobarVictoria();
    ALM.escribir('circuito.' + E.nivel.id, E.tab.serializar());
    $('btnDeshacer').disabled = !E.hist.length;
    $('btnRehacer').disabled = !E.rehacer.length;
  }

  const avisosReales = () => E.res.avisos.filter(a => a.clase !== 'info');

  /* ---------- Victoria ---------- */
  function comprobarVictoria() {
    const c = E.punt.coincidencia;
    const ganado = E.res.ok && !E.res.errores.length && c >= umbral();
    $('medidor').classList.toggle('ganado', ganado);
    const pc = Math.round(c * 1000) / 10;
    $('coincidencia').textContent = pc >= 100 ? '100' : fmt(pc, 1);
    $('coincidenciaBarra').style.width = (100 * c).toFixed(1) + '%';
    $('umbralMarca').style.left = (100 * umbral()).toFixed(1) + '%';
    $('medidor').title = 'Se supera con un ' + fmt(100 * umbral(), 0) + ' % de coincidencia';
    if (ganado && E.interaccion && !E.nivel.libre) {
      const comp = E.tab.piezas.filter(esComponente).length;
      const limpio = !avisosReales().length && !E.circ.sueltos.length;
      let est = 1;
      if (comp <= E.par) est = limpio ? 3 : 2;
      if (E.ayuda) est = 1;
      const previas = E.progreso[E.nivel.id] || 0;
      if (est > previas) { E.progreso[E.nivel.id] = est; ALM.escribir('progreso', E.progreso); }
      actualizarEstrellasCabecera();
      // Se celebra la primera vez y cada vez que se mejora en esta visita al nivel
      if (est <= E.mejorSesion) { E.ganado = ganado; return; }
      E.mejorSesion = est;
      $('vicEstrellas').innerHTML = estrellasHTML(est);
      let txt = `Coincidencia del ${fmt(100 * c, 1)} % con ${comp} componente${comp === 1 ? '' : 's'}.`;
      if (E.ayuda) txt += ' Has partido de la solución: prueba a montarlo tú desde cero para ganar más estrellas.';
      else if (comp > E.par) txt += ` Se puede hacer con ${E.par}. ¿Sobra algo?`;
      else if (!limpio) txt += ' Revisa los avisos del diagnóstico para la tercera estrella.';
      else txt += ' Montaje limpio y con los componentes justos.';
      $('vicTexto').textContent = txt;
      const sig = NIVELES[E.idx + 1];
      $('btnVicSiguiente').textContent = !sig ? 'Volver al principio ›' : sig.libre ? 'Laboratorio libre ›' : sig.tema !== E.nivel.tema ? `Tema ${sig.tema.num} ›` : 'Siguiente nivel ›';
      abrirModal('modalVictoria');
    }
    E.ganado = ganado;
  }

  /* ---------- Tablero SVG ---------- */
  function dibujarTablero() {
    const W = COLS * T, H = FILAS * T;
    svg.setAttribute('viewBox', `${-MX - 4} -6 ${W + 2 * MX + 8} ${H + 12}`);
    let h = `<rect class="fondo" x="0" y="0" width="${W}" height="${H}" rx="8"/>`;
    h += miniOsciloscopios();
    let rej = '';
    for (let x = 1; x < COLS; x++) rej += `M${x * T} 0V${H}`;
    for (let y = 1; y < FILAS; y++) rej += `M0 ${y * T}H${W}`;
    h += `<path class="rejilla" d="${rej}"/>`;
    let pts = '';
    for (let x = 0; x < COLS; x++) for (let y = 0; y < FILAS; y++) pts += `M${x * T + 20} ${y * T + 19}v2`;
    h += `<path d="${pts}" stroke="var(--board-dot)" stroke-width="2.4" stroke-linecap="round"/>`;
    h += '<rect id="hoverCasilla" class="hover-casilla" width="40" height="40" visibility="hidden"/>';

    let grupos = '', etiquetas = '';
    let nAO = 0;
    for (const p of E.tab.piezas) {
      const ctx = { nivel: E.nivel };
      if (p.tipo === 'ao') ctx.nombreAO = 'AO' + (++nAO);
      const d = D.pieza(p, ctx);
      grupos += d.grupo;
      etiquetas += d.etiquetas;
    }
    h += grupos + etiquetas;

    // Extremos sueltos
    for (const [x, y] of E.circ.sueltos) h += `<circle class="suelto" cx="${x * T}" cy="${y * T}" r="4.5"/>`;

    // Selección
    if (E.sel) {
      const p = E.tab.piezas.find(q => q.id === E.sel);
      if (p) {
        const [w, hh] = P.dimensiones(p);
        h += `<rect class="seleccion" x="${p.x * T + 2}" y="${p.y * T + 2}" width="${w * T - 4}" height="${hh * T - 4}"/>`;
      }
    }
    // Sondas
    E.sondas.forEach((s, i) => {
      const col = `var(--probe-${i + 1})`;
      h += `<g class="sonda-marca"><circle cx="${s.x * T + 33}" cy="${s.y * T + 8}" r="8" fill="${col}"/><text x="${s.x * T + 33}" y="${s.y * T + 8}">${i + 1}</text></g>`;
    });
    h += '<g id="capaFantasma"></g>';
    svg.innerHTML = h;

    E.hilos = [...svg.querySelectorAll('.hilo')].map(el => ({ el, pid: +el.dataset.pid, n: el.dataset.n, fill: !!el.dataset.f }));
    for (const hh of E.hilos) hh.nodo = E.circ.nudoDe(hh.pid, hh.n);
    E.gruposAO = E.circ.aos.map((a, k) => ({ k, g: svg.querySelector(`.pieza[data-id="${a.id}"]`), sat: svg.querySelector(`[data-sat="${a.id}"]`) }));
    E.estDisp = E.circ.disp.map((d, k) => ({ k, d, el: svg.querySelector(`[data-est="${d.id}"]`), luz: svg.querySelector(`[data-luz="${d.id}"]`) }));
    E.lucesCarga = (E.res.cargas || []).map((c, k) => {
      let imax = 1e-9;
      for (const v of c.i) imax = Math.max(imax, Math.abs(v));
      return { k, el: svg.querySelector(`[data-luz="${c.id}"]`), imax };
    });
    colorear();
    dibujarFantasma();
  }

  /* Miniosciloscopios junto a los conectores: forma de cada entrada y,
     a la derecha, el objetivo superpuesto a la salida real. */
  const MX = 92;
  function miniOsciloscopios() {
    const r = E.res;
    if (!r || !r.t) return '';
    const w = MX - 12, hh = 58;
    const traza = (y, x0, yc, esc, clase) => {
      const n = y.length, paso = Math.max(1, Math.floor(n / 120));
      let d = '';
      for (let i = 0; i < n; i += paso) {
        const v = Math.max(-esc, Math.min(esc, y[i]));
        d += (i ? 'L' : 'M') + (x0 + 4 + (w - 8) * i / (n - 1)).toFixed(1) + ' ' + (yc - (hh / 2 - 6) * v / esc).toFixed(1);
      }
      return `<path class="${clase}" d="${d}"/>`;
    };
    const caja = (x0, yc, titulo, contenido) =>
      `<g class="mini"><rect x="${x0}" y="${yc - hh / 2}" width="${w}" height="${hh}" rx="6"/>` +
      `<path class="mini-cero" d="M${x0 + 4} ${yc}H${x0 + w - 4}"/>${contenido}` +
      `<text x="${x0 + w / 2}" y="${yc - hh / 2 - 6}">${titulo}</text></g>`;
    const maxAbs = (...arrs) => {
      let m = 0.5;
      for (const a of arrs) if (a) for (const v of a) m = Math.max(m, Math.abs(v));
      return Gr.escalaBonita(m * 1.05);
    };
    const salidaDibujo = () => {
      const p = E.tab.piezas.find(q => q.tipo === 'salida');
      const yc = ((p ? p.y : 6 + N.DY) + 0.5) * T, x0 = COLS * T + 10;
      const escala = maxAbs(E.obj, r.ok ? r.salida : null);
      let c = traza(E.obj, x0, yc, escala, 'mini-obj');
      if (r.ok) c += traza(r.salida, x0, yc, escala, 'mini-real');
      const titulo = medidaCorriente() ? E.nivel.medida.nombre.replace(/<sub>(.*?)<\/sub>/, ' $1') : 'vₒ';
      return caja(x0, yc, titulo, c) +
        (p ? `<path class="mini-guia" d="M${COLS * T} ${yc}H${x0}"/>` : '');
    };
    let s = '';
    for (const p of E.tab.piezas) {
      if (p.tipo === 'entrada' || p.tipo === 'secundario') {
        const y = r.entradas[p.k];
        const yc = (p.y + (p.tipo === 'secundario' ? 1.5 : 0.5)) * T, x0 = -MX + 2;
        s += caja(x0, yc, E.nivel.entradas[p.k].nombre, traza(y, x0, yc, maxAbs(y), 'mini-ent'));
        s += `<path class="mini-guia" d="M${x0 + w} ${yc}H0"/>`;
      }
    }
    return s + salidaDibujo();
  }

  function leerColores() {
    const c = (n) => {
      const s = getComputedStyle(document.documentElement).getPropertyValue(n).trim();
      const m = s.match(/^#([0-9a-f]{6})$/i);
      return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)] : [128, 128, 128];
    };
    E.colores = { neg: c('--v-neg'), pos: c('--v-pos'), cero: c('--v-zero') };
  }

  function colorTension(v) {
    const x = Math.max(-1, Math.min(1, v / E.vEscala));
    const a = E.colores.cero, b = x < 0 ? E.colores.neg : E.colores.pos;
    const k = Math.pow(Math.abs(x), 0.7);
    const mix = a.map((ca, i) => Math.round(ca + (b[i] - ca) * k));
    return `rgb(${mix[0]},${mix[1]},${mix[2]})`;
  }

  function tensionNodo(n, i) {
    if (n === undefined || n < 0 || !E.res.V) return null;
    if (n === 0) return 0;
    return E.res.V[n][i];
  }

  const ABREV_ESTADO = { 'OFF': 'OFF', 'ON': 'ON', 'Z': 'Z', 'corte': 'CORTE', 'activa': 'ACT', 'saturación': 'SAT', 'óhmica': 'ÓHM', 'ruptura': 'RUPT' };
  function colorear() {
    const activo = $('chkColor').checked && E.res.ok;
    for (const h of E.hilos || []) {
      const v = activo ? tensionNodo(h.nodo, E.cursor) : null;
      const col = v === null ? '' : colorTension(v);
      if (h.fill) h.el.style.fill = col; else h.el.style.stroke = col;
    }
    for (const a of E.gruposAO || []) {
      const s = E.res.ok && E.res.sat[a.k] ? E.res.sat[a.k][E.cursor] : 0;
      if (a.g) a.g.classList.toggle('ao-sat', s !== 0);
      if (a.sat) {
        a.sat.setAttribute('visibility', s !== 0 ? 'visible' : 'hidden');
        a.sat.textContent = s > 0 ? '+SAT' : '−SAT';
      }
    }
    // Estado de cada dispositivo y brillo de LED y cargas
    for (const x of E.estDisp || []) {
      if (!E.res.ok || !E.res.disp[x.k]) { if (x.el) x.el.textContent = ''; continue; }
      const e = E.res.disp[x.k].est[E.cursor];
      const nombre = S.NOMBRES_ESTADO[x.d.tipo][e];
      if (x.el) {
        x.el.textContent = ABREV_ESTADO[nombre];
        x.el.setAttribute('class', 'est-disp est-' + ({ ON: 'on', Z: 'z', activa: 'act', 'saturación': 'sat', 'óhmica': 'sat', ruptura: 'rupt' }[nombre] || 'off'));
      }
      if (x.luz) x.luz.setAttribute('opacity', Math.min(1, Math.max(0, E.res.disp[x.k].i[E.cursor]) / 0.01).toFixed(2));
    }
    for (const c of E.lucesCarga || []) {
      if (!c.el || !E.res.ok) continue;
      c.el.setAttribute('opacity', Math.min(1, Math.abs(E.res.cargas[c.k].i[E.cursor]) / c.imax).toFixed(2));
    }
  }

  /* ---------- Fantasma (vista previa de la pieza) ---------- */
  function piezaFantasma() {
    const hp = herrPieza();
    if (!hp || !E.hover) return null;
    const p = { tipo: hp.tipo, r: E.rot, m: E.esp };
    if (hp.valor !== undefined) p.valor = hp.valor;
    else if (P.TIPOS[hp.tipo].valor !== undefined) p.valor = P.TIPOS[hp.tipo].valor;
    if (hp.par) p.par = Object.assign({}, hp.par);
    const [w, h] = P.dimensiones(p);
    p.x = E.hover[0] - Math.floor(w / 2);
    p.y = E.hover[1] - Math.floor(h / 2);
    return p;
  }

  function dibujarFantasma() {
    const capa = svg.querySelector('#capaFantasma');
    const hc = svg.querySelector('#hoverCasilla');
    if (!capa) return;
    let p = null;
    if (E.arrastre && E.arrastre.movido && E.hover) {
      const q = E.tab.piezas.find(z => z.id === E.arrastre.id);
      p = Object.assign({}, q, { x: E.hover[0] - E.arrastre.dx, y: E.hover[1] - E.arrastre.dy });
    } else if (!E.arrastre) p = piezaFantasma();
    if (p) {
      const ok = !!E.tab.comprobar(p, E.arrastre ? E.arrastre.id : undefined);
      const d = D.pieza(Object.assign({}, p, { id: 0 }), { nivel: E.nivel, icono: false });
      capa.innerHTML = `<g class="fantasma${ok ? '' : ' invalido'}">${d.grupo}${d.etiquetas}</g>`;
    } else capa.innerHTML = '';
    if (hc) {
      const ver = E.hover && !p;
      hc.setAttribute('visibility', ver ? 'visible' : 'hidden');
      if (E.hover) { hc.setAttribute('x', E.hover[0] * T); hc.setAttribute('y', E.hover[1] * T); }
    }
  }

  /* ---------- Ratón ---------- */
  function puntoSVG(ev) {
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    const m = svg.getScreenCTM();
    if (!m) return null;
    const q = pt.matrixTransform(m.inverse());
    return [q.x / T, q.y / T];
  }
  function casillaDe(ev) {
    const q = puntoSVG(ev);
    if (!q) return null;
    const x = Math.floor(q[0]), y = Math.floor(q[1]);
    return E.tab.dentro(x, y) ? [x, y] : null;
  }

  /* Puerto más cercano de una pieza al punto (en casillas). */
  function puertoCercano(p, pt) {
    let mejor = null, dmin = Infinity;
    for (const q of P.puertos(p)) {
      const px = q.cx + 0.5 + P.DX[q.d] * 0.5, py = q.cy + 0.5 + P.DY[q.d] * 0.5;
      const d = (px - pt[0]) ** 2 + (py - pt[1]) ** 2;
      if (d < dmin) { dmin = d; mejor = q; }
    }
    return mejor;
  }

  svg.addEventListener('contextmenu', ev => ev.preventDefault());

  svg.addEventListener('pointerdown', ev => {
    const c = casillaDe(ev);
    if (!c) return;
    E.hover = c;
    if (ev.button === 2) {
      if (herrPieza()) { E.rot = (E.rot + 1) % 4; dibujarFantasma(); }
      else {
        const p = E.tab.piezaEn(c[0], c[1]);
        if (p && !p.fija) { const s = instantanea(); if (E.tab.girar(p.id)) { empujar(s); cambio(true); } }
      }
      return;
    }
    if (ev.button !== 0) return;
    svg.setPointerCapture(ev.pointerId);
    const hp = herrPieza();
    if (hp) {
      const p = piezaFantasma();
      if (p && E.tab.comprobar(p)) {
        const s = instantanea();
        const nueva = E.tab.colocar(p);
        if (nueva) {
          empujar(s);
          if (!P.TIPOS[nueva.tipo].cable) E.sel = nueva.id;
          cambio(true);
        }
      }
      return;
    }
    if (E.herr === 'lapiz') {
      E.trazo = { tr: E.tab.iniciarTrazo(), ultimo: c, snap: instantanea(), cambiado: false };
      return;
    }
    if (E.herr === 'borrar') {
      E.borrando = { snap: instantanea(), cambiado: false, ultimo: c };
      borrarEn(c);
      return;
    }
    if (E.herr === 'sonda') {
      ponerSonda(c, puntoSVG(ev));
      return;
    }
    // Seleccionar
    const p = E.tab.piezaEn(c[0], c[1]);
    E.sel = p ? p.id : null;
    if (p && !p.fija) E.arrastre = { id: p.id, dx: c[0] - p.x, dy: c[1] - p.y, movido: false, origen: c };
    dibujarTablero();
    actualizarPropiedades();
  });

  svg.addEventListener('pointermove', ev => {
    const c = casillaDe(ev);
    E.hoverPt = puntoSVG(ev);
    const cambioCasilla = (c && (!E.hover || c[0] !== E.hover[0] || c[1] !== E.hover[1])) || (!c && E.hover);
    if (E.trazo && c) {
      let [x, y] = E.trazo.ultimo;
      while (x !== c[0] || y !== c[1]) {
        const dx = c[0] - x, dy = c[1] - y;
        let nx = x, ny = y;
        if (Math.abs(dx) >= Math.abs(dy)) nx += Math.sign(dx); else ny += Math.sign(dy);
        E.tab.pasoTrazo(E.trazo.tr, [x, y], [nx, ny]);
        E.trazo.cambiado = true;
        x = nx; y = ny;
      }
      if (E.trazo.cambiado && cambioCasilla) { E.trazo.ultimo = c; simular(); dibujarTablero(); }
      E.trazo.ultimo = c;
    }
    if (E.borrando && c && cambioCasilla) {
      // Recorre las casillas intermedias si el ratón salta varias
      let [x, y] = E.borrando.ultimo;
      while (x !== c[0] || y !== c[1]) {
        const dx = c[0] - x, dy = c[1] - y;
        if (Math.abs(dx) >= Math.abs(dy)) x += Math.sign(dx); else y += Math.sign(dy);
        borrarEn([x, y]);
      }
      E.borrando.ultimo = c;
    }
    if (E.arrastre && c && (c[0] !== E.arrastre.origen[0] || c[1] !== E.arrastre.origen[1])) E.arrastre.movido = true;
    if (cambioCasilla) {
      E.hover = c;
      dibujarFantasma();
    }
    textoEstado();
  });

  function finPuntero() {
    if (E.trazo) {
      if (E.trazo.cambiado) { empujar(E.trazo.snap); E.trazo = null; cambio(true); }
      E.trazo = null;
    }
    if (E.borrando) {
      if (E.borrando.cambiado) { empujar(E.borrando.snap); cambio(true); }
      E.borrando = null;
    }
    if (E.arrastre) {
      const a = E.arrastre;
      E.arrastre = null;
      if (a.movido && E.hover) {
        const s = instantanea();
        if (E.tab.mover(a.id, E.hover[0] - a.dx, E.hover[1] - a.dy)) { empujar(s); cambio(true); }
        else dibujarFantasma();
      } else dibujarFantasma();
    }
  }
  svg.addEventListener('pointerup', finPuntero);
  svg.addEventListener('pointercancel', finPuntero);
  svg.addEventListener('pointerleave', () => {
    if (!E.trazo && !E.arrastre && !E.borrando) { E.hover = null; dibujarFantasma(); textoEstado(); }
  });
  svg.addEventListener('dblclick', ev => {
    const c = casillaDe(ev);
    if (!c) return;
    const p = E.tab.piezaEn(c[0], c[1]);
    if (p && !p.fija) {
      E.sel = p.id;
      dibujarTablero();
      actualizarPropiedades();
      const inp = $('propiedades').querySelector('input');
      if (inp) { inp.focus(); inp.select(); }
    }
  });

  function borrarEn(c) {
    const p = E.tab.piezaEn(c[0], c[1]);
    if (p && !p.fija) {
      E.tab.quitar(p.id);
      E.borrando.cambiado = true;
      simular();
      dibujarTablero();
    }
  }

  function ponerSonda(c, pt) {
    const p = E.tab.piezaEn(c[0], c[1]);
    if (!p) return;
    const q = puertoCercano(p, pt);
    if (!q) return;
    const nodo = E.circ.nudoDe(p.id, q.n);
    const ya = E.sondas.findIndex(s => s.nodo === nodo);
    if (ya >= 0) E.sondas.splice(ya, 1);
    else {
      if (E.sondas.length >= 3) E.sondas.shift();
      E.sondas.push({ pid: p.id, n: q.n, x: c[0], y: c[1], nodo });
    }
    dibujarTablero();
    dibujarGraficas();
  }

  /* ---------- Barra de estado ---------- */
  function textoDispositivo(k) {
    const d = E.circ.disp[k], r = E.res.disp[k], i = E.cursor, nd = d.nodos;
    const v = (n) => tensionNodo(n, i);
    const est = S.NOMBRES_ESTADO[d.tipo][r.est[i]];
    const mA = (x) => fmt(1e3 * x, Math.abs(x) < 0.01 ? 3 : 1) + ' mA';
    let s = `<b>${d.nombre}</b> (${P.TIPOS[d.tipo].nombre.toLowerCase()}) · <b>${est}</b>`;
    switch (d.tipo) {
      case 'diodo': case 'led': case 'zener':
        s += ` · V<sub>AK</sub> = ${fmt(v(nd.a) - v(nd.k))} V · I<sub>AK</sub> = ${mA(r.i[i])}`;
        break;
      case 'npn': case 'pnp': {
        const sg = d.tipo === 'pnp' ? -1 : 1, x = d.tipo === 'pnp' ? ['EB', 'EC'] : ['BE', 'CE'];
        s += ` · V<sub>${x[0]}</sub> = ${fmt(sg * (v(nd.b) - v(nd.e)))} V · V<sub>${x[1]}</sub> = ${fmt(sg * (v(nd.c) - v(nd.e)))} V · I<sub>B</sub> = ${mA(r.ib[i])} · I<sub>C</sub> = ${mA(r.i[i])}`;
        if (r.est[i] === 2) s += ` (β·I<sub>B</sub> = ${mA(d.par.beta * r.ib[i])})`;
        break;
      }
      case 'nmos': case 'pmos': {
        const sg = d.tipo === 'pmos' ? -1 : 1, x = d.tipo === 'pmos' ? ['SG', 'SD'] : ['GS', 'DS'];
        s += ` · V<sub>${x[0]}</sub> = ${fmt(sg * (v(nd.g) - v(nd.s)))} V · V<sub>${x[1]}</sub> = ${fmt(sg * (v(nd.d) - v(nd.s)))} V · I<sub>D</sub> = ${mA(r.i[i])}`;
        break;
      }
    }
    if (Math.abs(r.p[i]) > 1e-4) s += ` · P = ${fmt(r.p[i], 3)} W`;
    return s;
  }

  function textoEstado() {
    const el = $('estadoTexto');
    const c = E.hover;
    const ti = E.res && E.res.t ? E.res.t[E.cursor] : 0;
    if (c) {
      const p = E.tab.piezaEn(c[0], c[1]);
      if (p && E.res && E.res.ok) {
        const t = P.TIPOS[p.tipo];
        let s = `<b>${t.nombre}</b>`;
        const kd = E.circ.disp.findIndex(d => d.id === p.id);
        if (p.tipo === 'resistencia' || p.tipo === 'condensador') s += ' ' + P.formatearValor(p.valor, t.unidad);
        if (p.tipo === 'entrada' || p.tipo === 'secundario') s = `<b>${p.tipo === 'secundario' ? 'Secundario' : 'Entrada'} ${E.nivel.entradas[p.k].nombre}</b>`;
        if (p.tipo === 'salida') s = '<b>Salida v<sub>o</sub></b>';
        if (kd >= 0) s = textoDispositivo(kd);
        else if (p.tipo === 'ao') {
          const k = E.circ.aos.findIndex(a => a.id === p.id);
          const a = E.circ.aos[k];
          const vp = tensionNodo(a.p, E.cursor), vn = tensionNodo(a.n, E.cursor), vo = tensionNodo(a.o, E.cursor);
          s = `<b>${a.nombre}</b> · v<sup>+</sup> = ${fmt(vp)} V · v<sup>−</sup> = ${fmt(vn)} V · v<sub>o</sub> = ${fmt(vo)} V`;
          const st = E.res.sat[k][E.cursor];
          s += st ? ` · <b style="color:var(--bad)">saturado a ${st > 0 ? '+' : '−'}${E.nivel.Vsat} V</b>` : ' · zona lineal (v<sup>+</sup> = v<sup>−</sup>)';
        } else if (E.hoverPt) {
          const q = puertoCercano(p, E.hoverPt);
          if (q) {
            const v = tensionNodo(E.circ.nudoDe(p.id, q.n), E.cursor);
            if (v !== null) s += ` · tensión del nudo: <b>${fmt(v)} V</b>`;
            if (p.tipo === 'resistencia') {
              const va = tensionNodo(E.circ.nudoDe(p.id, 'a'), E.cursor), vb = tensionNodo(E.circ.nudoDe(p.id, 'b'), E.cursor);
              s += ` · corriente ${fmt(1000 * (va - vb) / p.valor, 3)} mA`;
            }
            const kc = (E.res.cargas || []).findIndex(z => z.id === p.id);
            if (kc >= 0) s += ` · corriente ${fmt(1000 * E.res.cargas[kc].i[E.cursor], 1)} mA`;
          }
        }
        el.innerHTML = s + ` <span style="opacity:.7">(t = ${fmt(ti)} ms)</span>`;
        return;
      }
    }
    const ayudas = {
      lapiz: 'Lápiz: arrastra desde una patilla para dibujar un cable. Pasar en recto sobre otro cable lo cruza sin unirlo; terminar sobre él los une.',
      sel: 'Seleccionar: clic en una pieza para ver o editar sus valores; arrástrala para moverla. Clic derecho gira.',
      borrar: 'Borrar: clic o arrastra sobre las piezas que quieras quitar.',
      sonda: 'Sonda: clic en un cable para ver su tensión en la gráfica de salida (hasta 3). Clic otra vez para quitarla.'
    };
    const hp = herrPieza();
    el.innerHTML = ayudas[E.herr] || 'Clic para colocar · clic derecho o <kbd>R</kbd> para girar' + (hp && /ao|npn|pnp|mos/.test(hp.tipo) ? ' · <kbd>M</kbd> voltea la pieza' : '') + ' · <kbd>Esc</kbd> para soltar la pieza.';
  }

  /* ---------- Gráficas y panel ---------- */
  function dibujarGraficas() {
    const r = E.res;
    if (!r) return;
    const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const colEnt = [css('--sig-1'), css('--sig-2'), css('--probe-3')];
    if (r.entradas.length) {
      let m = 0.5;
      for (const e of r.entradas) for (const v of e) m = Math.max(m, Math.abs(v));
      const seriesE = r.entradas.map((e, k) => ({ y: e, color: colEnt[k], ancho: 2 }));
      Gr.dibujar($('grafEntradas'), { t: r.t, series: seriesE, ymax: Gr.escalaBonita(m * 1.05), cursor: E.cursor });
    }

    let mo = 0.5;
    for (const v of E.obj) mo = Math.max(mo, Math.abs(v));
    if (r.ok) for (const v of r.salida) mo = Math.max(mo, Math.abs(v));
    const corriente = medidaCorriente();
    const sondas = corriente ? [] : E.sondas.map((s, i) => ({ y: s.nodo > 0 && r.V ? r.V[s.nodo] : (s.nodo === 0 ? new Float32Array(r.t.length) : null), color: css('--probe-' + (i + 1)), ancho: 1.6 }));
    for (const s of sondas) if (s.y) for (const v of s.y) mo = Math.max(mo, Math.abs(v));
    const ymax = Gr.escalaBonita(mo * 1.05);
    const series = [
      { y: E.obj, color: css('--sig-obj'), ancho: 5, alfa: 0.45, sinPunto: false },
      ...sondas,
      { y: r.ok ? r.salida : null, color: css('--sig-real'), ancho: 2.2 }
    ];
    const hayAO = E.tab.piezas.some(p => p.tipo === 'ao');
    Gr.dibujar($('grafSalida'), {
      t: r.t, series, ymax, cursor: E.cursor, unidad: unidadSalida(),
      lineas: hayAO && !corriente ? [{ v: E.nivel.Vsat, color: css('--bad') }, { v: -E.nivel.Vsat, color: css('--bad') }] : []
    });
    leyendas();
    $('cursor').max = r.t.length - 1;
    $('cursor').value = E.cursor;
    $('tLbl').textContent = 't = ' + fmt(r.t[E.cursor]) + ' ms';
  }

  function leyendas() {
    const r = E.res, i = E.cursor, u = unidadSalida();
    const css = (n) => `var(${n})`;
    const colEnt = ['--sig-1', '--sig-2', '--probe-3'];
    $('leyendaEntradas').innerHTML = E.nivel.entradas.map((e, k) =>
      `<span><i style="background:${css(colEnt[k])}"></i>${e.nombre} = ${fmt(r.entradas[k][i])} V</span>`).join('');
    const dec = u === 'mA' ? 1 : 2;
    let h = `<span><i class="disc" style="border-color:${css('--sig-obj')}"></i>objetivo ${fmt(E.obj[i], dec)} ${u}</span>`;
    h += `<span><i style="background:${css('--sig-real')}"></i>${nombreSalida()} real ${r.ok ? fmt(r.salida[i], dec) + ' ' + u : '—'}</span>`;
    if (!medidaCorriente()) E.sondas.forEach((s, k) => {
      const v = tensionNodo(s.nodo, i);
      h += `<span><i style="background:${css('--probe-' + (k + 1))}"></i>sonda ${k + 1} ${v === null ? '—' : fmt(v) + ' V'}<button class="quitar" data-sonda="${k}" title="Quitar sonda">×</button></span>`;
    });
    if (E.punt && E.punt.periodo0) h += `<span>T = ${E.punt.periodo ? fmt(E.punt.periodo, 3) : '—'} ms (objetivo ${fmt(E.punt.periodo0, 3)} ms)</span>`;
    $('leyendaSalida').innerHTML = h;
  }

  function actualizarPanel() {
    const ul = $('avisos');
    const items = [];
    const r = E.res;
    for (const e of r.errores) items.push(['error', e.txt, e.id]);
    if (E.circ.sueltos.length) {
      const n = E.circ.sueltos.length;
      items.push(['aviso', `Hay ${n} extremo${n > 1 ? 's' : ''} de cable suelto${n > 1 ? 's' : ''} (círculos rojos): no conecta${n > 1 ? 'n' : ''} con nada.`]);
    }
    for (const a of r.avisos) items.push([a.clase || 'aviso', a.txt, a.id]);
    if (E.nivel.libre && E.nivel.errorExpr) items.push(['error', E.nivel.errorExpr]);
    const usaAO = E.nivel.piezas.includes('ao');
    if (usaAO && !E.tab.piezas.some(p => p.tipo === 'ao') && !E.nivel.libre) items.push(['info', 'Todavía no hay ningún AO en el tablero.']);
    if (r.ok && E.punt.coincidencia >= umbral() && !r.errores.length) items.unshift(['ok', '¡Objetivo conseguido! La salida coincide con la función pedida.']);
    else if (r.ok && !items.some(it => it[0] !== 'info')) items.push(['info', 'Sin problemas eléctricos. La salida todavía no coincide con el objetivo: compara las dos curvas.']);
    ul.innerHTML = items.map(([c, t, id]) => `<li class="${c}"${id ? ` data-id="${id}" style="cursor:pointer" title="Seleccionar la pieza"` : ''}>${esc(t)}</li>`).join('');
    actualizarPropiedades();
  }

  /* ---------- Propiedades de la pieza seleccionada ---------- */
  /* Valores normalizados (serie E24, que incluye la E12) y ajuste fino
     en la segunda cifra significativa, para llegar a valores de cálculo
     como 40 kΩ u 8 kΩ. */
  const E24 = [1, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2, 2.2, 2.4, 2.7, 3, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1];
  const SERIE = [];
  for (let d = -13; d <= 7; d++) for (const m of E24) SERIE.push(+(m * Math.pow(10, d)).toPrecision(3));
  function pasoE24(v, dir) {
    if (dir > 0) return SERIE.find(c => c > v * 1.0001) || v;
    for (let i = SERIE.length - 1; i >= 0; i--) if (SERIE[i] < v * 0.9999) return SERIE[i];
    return v;
  }
  function pasoFino(v, dir) {
    let d = Math.floor(Math.log10(v) + 1e-9);
    let m = Math.round(v / Math.pow(10, d) * 10) / 10 + 0.1 * dir;
    if (m >= 9.95) { m = 1; d++; } else if (m < 0.95) { m = 9.9; d--; }
    return +(m * Math.pow(10, d)).toPrecision(3);
  }
  const esNormalizado = (v) => SERIE.some(c => Math.abs(c - v) <= v * 1e-6);
  function infoNormalizado(v, unidad) {
    if (esNormalizado(v)) return '<span class="norm-ok">✓ Valor normalizado (E24)</span>';
    return `<span class="norm-no">Valor no normalizado.</span> Comerciales más próximos: ${P.formatearValor(pasoE24(v, -1), unidad)} y ${P.formatearValor(pasoE24(v, 1), unidad)}.`;
  }
  function cambiarValor(p, nuevo) {
    if (!(nuevo > 0) || nuevo === p.valor) return;
    empujar(instantanea());
    p.valor = nuevo;
    cambio(true);
  }

  // Parámetros editables en el laboratorio libre
  const PARAMS_LIBRE = {
    zener: [['vz', 'V<sub>Z</sub> (V)']],
    npn: [['beta', 'β']], pnp: [['beta', 'β']],
    nmos: [['vth', 'V<sub>TH</sub> (V)'], ['k', 'k (A/V²)']], pmos: [['vth', 'V<sub>TH</sub> (V)'], ['k', 'k (A/V²)']],
    bobina: [['L', 'L (H)']]
  };

  function actualizarPropiedades() {
    const box = $('propiedades');
    const p = E.sel ? E.tab.piezas.find(q => q.id === E.sel) : null;
    if (!p) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    const t = P.TIPOS[p.tipo];
    const libre = !!E.nivel.libre;
    const kd = E.circ.disp.findIndex(d => d.id === p.id);
    let h = `<h4>${kd >= 0 ? E.circ.disp[kd].nombre + ' · ' : ''}${t.nombre}</h4>`;
    const editableValor = p.tipo === 'resistencia' || p.tipo === 'condensador' || (p.tipo === 'fuente' && E.nivel.fuentes === 'libre') || (t.carga && libre);
    if (editableValor) {
      const txt = p.tipo === 'fuente' ? String(p.valor).replace('.', ',') : P.formatearValor(p.valor, t.unidad).replace(' ', '');
      h += `<div class="fila"><input type="text" id="propValor" value="${esc(txt)}" spellcheck="false" aria-label="Valor"></div>`;
      h += p.tipo === 'fuente' ? '<p class="nota">En voltios, p. ej. 5 o −2,5.</p>'
        : `<p class="nota">Escribe el valor exacto y pulsa Intro (${p.tipo === 'condensador' ? '100n, 1u, 47n' : '10k, 4,7k, 220, 1M'}).</p>`;
      if (p.tipo === 'resistencia' || p.tipo === 'condensador') {
        h += '<div class="pasos"><span>E24</span><button class="btn" data-paso="e-1" title="Valor normalizado anterior (− o ↓)">−</button><button class="btn" data-paso="e1" title="Valor normalizado siguiente (+ o ↑)">+</button>' +
          '<span>fino</span><button class="btn" data-paso="f-1" title="Bajar la segunda cifra (Mayús + ↓)">−</button><button class="btn" data-paso="f1" title="Subir la segunda cifra (Mayús + ↑)">+</button></div>';
        h += `<p class="nota">${infoNormalizado(p.valor, t.unidad)}</p>`;
      }
    } else if (p.tipo === 'fuente') {
      h += `<p class="nota">Fuente de ${fmt(p.valor, 1)} V respecto a tierra (valor fijo en este nivel).</p>`;
    } else if (t.carga) {
      h += `<p class="nota">Carga de ${P.formatearValor(p.valor, 'Ω')}${p.tipo === 'bobina' ? ' y ' + P.formatearValor(P.parDe(p).L, 'H') : ''}, dada por el enunciado.</p>`;
    } else if (p.tipo === 'entrada' || p.tipo === 'secundario') {
      const e = E.nivel.entradas[p.k];
      h += `<p class="nota">${e.nombre}: ${e.texto}${e.Rs ? '. Tiene una resistencia interna de ' + P.formatearValor(e.Rs, 'Ω') : ''}${e.imax ? '. Puede dar como máximo ' + fmt(e.imax * 1e3, 0) + ' mA' : ''}. Conector fijo del nivel.</p>`;
    } else if (p.tipo === 'salida') {
      h += `<p class="nota">Aquí se mide v<sub>o</sub>${E.nivel.RL ? ', con una carga de ' + P.formatearValor(E.nivel.RL, 'Ω') + ' a tierra' : ''}. Conector fijo del nivel.</p>`;
    } else if (p.tipo === 'ao') {
      h += '<p class="nota">AO ideal alimentado a ±12 V. M intercambia las entradas + y −.</p>';
    }
    if (t.par && p.tipo !== 'bobina') {
      h += `<p class="nota">${textoParametros(p.tipo, p.par)}</p>`;
      if (/npn|pnp|mos/.test(p.tipo)) h += '<p class="nota">M voltea la pieza (intercambia los terminales de arriba y abajo).</p>';
    }
    if (libre && PARAMS_LIBRE[p.tipo]) {
      const q = P.parDe(p);
      for (const [clave, nombre] of PARAMS_LIBRE[p.tipo]) {
        h += `<div class="fila"><span style="min-width:62px">${nombre}</span><input type="text" data-par="${clave}" value="${String(q[clave]).replace('.', ',')}" spellcheck="false"></div>`;
      }
    }
    if (!p.fija) {
      h += '<div class="botones"><button class="btn" data-acc="girar">Girar (R)</button>';
      if (/ao|npn|pnp|mos/.test(p.tipo)) h += `<button class="btn" data-acc="espejo">${p.tipo === 'ao' ? '+ ↔ −' : 'Voltear'} (M)</button>`;
      h += '<button class="btn" data-acc="borrar">Borrar</button></div>';
    }
    box.innerHTML = h;
    box.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('keydown', ev => {
        ev.stopPropagation();
        if (ev.key === 'Enter') { aplicarCampo(p, inp); inp.blur(); }
        if (ev.key === 'Escape') inp.blur();
      });
      inp.addEventListener('change', () => aplicarCampo(p, inp));
    });
  }

  function aplicarCampo(p, inp) {
    if (inp.dataset.par) {
      const v = P.parsearValor(inp.value);
      if (!Number.isFinite(v) || v <= 0) { inp.classList.add('mal'); return; }
      inp.classList.remove('mal');
      const q = P.parDe(p);
      if (q[inp.dataset.par] === v) return;
      empujar(instantanea());
      p.par = Object.assign({}, p.par || {}, { [inp.dataset.par]: v });
      cambio(true);
      return;
    }
    const v = P.parsearValor(inp.value);
    const okRango = p.tipo === 'fuente' ? Number.isFinite(v) && Math.abs(v) <= 50
      : p.tipo === 'condensador' ? Number.isFinite(v) && v >= 1e-12 && v <= 1
      : Number.isFinite(v) && v >= 0.01 && v <= 1e9;
    if (!okRango) { inp.classList.add('mal'); return; }
    inp.classList.remove('mal');
    if (v === p.valor) return;
    empujar(instantanea());
    p.valor = v;
    cambio(true);
  }

  $('propiedades').addEventListener('click', ev => {
    const ps = ev.target.closest('[data-paso]');
    if (ps && E.sel) {
      const p = E.tab.piezas.find(q => q.id === E.sel);
      const dir = +ps.dataset.paso.slice(1);
      if (p) cambiarValor(p, ps.dataset.paso[0] === 'e' ? pasoE24(p.valor, dir) : pasoFino(p.valor, dir));
      return;
    }
    const b = ev.target.closest('[data-acc]');
    if (!b || !E.sel) return;
    accionSeleccion(b.dataset.acc);
  });

  function accionSeleccion(acc) {
    const p = E.tab.piezas.find(q => q.id === E.sel);
    if (!p || p.fija) return;
    const s = instantanea();
    let ok = false;
    if (acc === 'girar') ok = E.tab.girar(p.id);
    if (acc === 'espejo' && /ao|npn|pnp|mos/.test(p.tipo)) ok = E.tab.espejo(p.id);
    if (acc === 'borrar') { ok = E.tab.quitar(p.id); E.sel = null; }
    if (ok) { empujar(s); cambio(true); }
  }

  $('avisos').addEventListener('click', ev => {
    const li = ev.target.closest('li[data-id]');
    if (!li) return;
    E.sel = +li.dataset.id;
    dibujarTablero();
    actualizarPropiedades();
  });
  $('leyendaSalida').addEventListener('click', ev => {
    const b = ev.target.closest('[data-sonda]');
    if (!b) return;
    E.sondas.splice(+b.dataset.sonda, 1);
    dibujarTablero();
    dibujarGraficas();
  });

  /* ---------- Nivel libre ---------- */
  function construirLibre() {
    const c = E.nivel.config;
    const formas = [['seno', 'senoidal'], ['cuadrada', 'cuadrada'], ['triangular', 'triangular'], ['diente', 'diente de sierra'], ['continua', 'continua']];
    let h = '<div class="fila cab"><span></span><span>Forma</span><span>Amp. (V)</span><span>f (kHz)</span><span>Offset</span></div>';
    c.entradas.forEach((e, k) => {
      h += `<div class="fila" data-k="${k}"><b>v${k + 1}</b>
        <select data-c="forma">${formas.map(([v, l]) => `<option value="${v}"${v === e.forma ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <input data-c="A" type="number" step="0.1" value="${e.A}">
        <input data-c="f" type="number" step="0.1" min="0.05" value="${e.f}">
        <input data-c="off" type="number" step="0.1" value="${e.off}"></div>`;
    });
    h += `<div class="expr"><span>v<sub>o</sub> =</span><input id="libreExpr" type="text" value="${esc(c.expr)}" spellcheck="false" aria-label="Función objetivo"></div>`;
    h += '<div class="cab" style="font-size:11.5px;color:var(--muted)">Usa v1, v2, t (ms) y funciones de Math: sin, cos, abs, min, max…</div>';
    $('libreConfig').innerHTML = h;
  }

  $('libreConfig').addEventListener('change', ev => {
    const c = E.nivel.config;
    const fila = ev.target.closest('[data-k]');
    if (fila) {
      const e = c.entradas[+fila.dataset.k];
      const campo = ev.target.dataset.c;
      e[campo] = campo === 'forma' ? ev.target.value : (parseFloat(ev.target.value) || 0);
      if (campo === 'f' && e.f <= 0) e.f = 0.1;
    }
    if (ev.target.id === 'libreExpr') c.expr = ev.target.value;
    ALM.escribir('libreConfig', c);
    N.prepararLibre(E.nivel);
    textoEntradas();
    cambio(false);
  });
  $('libreConfig').addEventListener('keydown', ev => ev.stopPropagation());

  /* ---------- Tiempo y animación ---------- */
  function ponerCursor(i) {
    E.cursor = Math.max(0, Math.min(E.res.t.length - 1, i));
    colorear();
    dibujarGraficas();
    textoEstado();
  }
  $('cursor').addEventListener('input', ev => { pararAnim(); ponerCursor(+ev.target.value); });
  $('chkColor').addEventListener('change', colorear);

  function bucleAnim(ts) {
    if (!E.anim) return;
    const dt = ts - (E.ultimoT || ts);
    E.ultimoT = ts;
    E.acum = (E.acum || 0) + dt * (E.res.t.length / 6000);
    const pasos = Math.floor(E.acum);
    if (pasos > 0) {
      E.acum -= pasos;
      ponerCursor((E.cursor + pasos) % E.res.t.length);
    }
    requestAnimationFrame(bucleAnim);
  }
  function alternarAnim() {
    E.anim = !E.anim;
    $('btnPlay').textContent = E.anim ? '❚❚' : '▶';
    if (E.anim) { E.ultimoT = 0; requestAnimationFrame(bucleAnim); }
  }
  function pararAnim() { if (E.anim) alternarAnim(); }
  $('btnPlay').addEventListener('click', alternarAnim);

  /* ---------- Modales ---------- */
  function abrirModal(id) { $(id).hidden = false; }
  function cerrarModales() { document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); }
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', ev => {
      if (ev.target === m || ev.target.closest('[data-cerrar]')) { m.hidden = true; if (m.id === 'modalAyuda') ALM.escribir('ayudaVista', true); }
    });
  });

  function abrirNiveles() {
    const carta = (nv) => {
      const i = NIVELES.indexOf(nv);
      const est = E.progreso[nv.id] || 0;
      return `<button class="carta${i === E.idx ? ' actual' : ''}" data-i="${i}">
        <span class="n">${nv.libre ? 'Extra' : 'Nivel ' + nv.numero}</span>
        <span class="t">${nv.titulo}</span>
        <span class="c">${nv.concepto}</span>
        ${nv.libre ? '' : `<span class="f">${nv.objetivoHTML}</span><span class="estrellas">${estrellasHTML(est)}</span>`}
      </button>`;
    };
    let h = '';
    for (const tema of N.TEMAS) {
      const total = tema.niveles.length * 3;
      const conseguidas = tema.niveles.reduce((s, nv) => s + (E.progreso[nv.id] || 0), 0);
      h += `<section class="tema-niveles"><h3><span class="tema-num">Tema ${tema.num}</span> ${tema.nombre}<span class="tema-prog">★ ${conseguidas}/${total}</span></h3>` +
        `<div class="rejilla-niveles">${tema.niveles.map(carta).join('')}</div></section>`;
    }
    h += `<section class="tema-niveles"><h3><span class="tema-num">Extra</span> Laboratorio</h3><div class="rejilla-niveles">${carta(N.LIBRE)}</div></section>`;
    $('rejillaNiveles').innerHTML = h;
    abrirModal('modalNiveles');
    const actual = $('rejillaNiveles').querySelector('.carta.actual');
    if (actual) actual.scrollIntoView({ block: 'center' });
  }
  $('rejillaNiveles').addEventListener('click', ev => {
    const c = ev.target.closest('[data-i]');
    if (!c) return;
    cerrarModales();
    cargarNivel(+c.dataset.i);
  });

  /* ---------- Botones de la barra ---------- */
  $('btnNiveles').addEventListener('click', abrirNiveles);
  $('btnAnterior').addEventListener('click', () => cargarNivel(E.idx - 1));
  $('btnSiguiente').addEventListener('click', () => cargarNivel(E.idx + 1));
  $('btnVicSiguiente').addEventListener('click', () => { cerrarModales(); cargarNivel(E.idx + 1); });
  $('btnDeshacer').addEventListener('click', deshacer);
  $('btnRehacer').addEventListener('click', rehacerAccion);
  $('btnVaciar').addEventListener('click', () => {
    if (!E.tab.piezas.some(p => !p.fija)) return;
    confirmar('¿Vaciar el tablero?', 'Se quitarán todas las piezas excepto los conectores. Puedes recuperarlas con Deshacer.', 'Vaciar', () => {
      empujar(instantanea());
      E.tab.cargar(E.tab.serializar().filter(p => p.fija));
      E.sel = null; E.ayuda = false;
      cambio(true);
    });
  });
  $('btnPista').addEventListener('click', () => { $('pista').hidden = !$('pista').hidden; });
  $('btnSolucion').addEventListener('click', () => {
    if (!E.nivel.solucion) return;
    confirmar('¿Ver la solución?', 'Sustituirá tu circuito (puedes recuperarlo con Deshacer). Si superas el nivel partiendo de ella, solo obtendrás una estrella.', 'Ver solución', () => {
      empujar(instantanea());
      E.tab.cargar(E.tab.serializar().filter(p => p.fija));
      N.aplicarSolucion(E.tab, E.nivel.solucion, E.nivel);
      E.ayuda = true; E.sel = null;
      E.mejorSesion = Math.max(E.mejorSesion, 1);   // no celebrar la solución
      cambio(false);
    });
  });

  /* Confirmación dentro de la página (algunos navegadores integrados bloquean confirm()). */
  function confirmar(titulo, texto, boton, accion) {
    $('confTitulo').textContent = titulo;
    $('confTexto').textContent = texto;
    $('confAceptar').textContent = boton;
    $('confCancelar').hidden = false;
    $('confAceptar').onclick = () => { cerrarModales(); accion(); };
    abrirModal('modalConfirmar');
    $('confAceptar').focus();
  }
  /* Mensaje informativo con un solo botón (no cierra las demás ventanas). */
  function avisar(titulo, texto) {
    $('confTitulo').textContent = titulo;
    $('confTexto').textContent = texto;
    $('confAceptar').textContent = 'Aceptar';
    $('confCancelar').hidden = true;
    $('confAceptar').onclick = () => { $('modalConfirmar').hidden = true; };
    abrirModal('modalConfirmar');
    $('confAceptar').focus();
  }

  /* ---------- Progreso: exportar, importar y reiniciar ---------- */
  const FORMATO = 'circuitos-electronica-progreso';
  const resumenProgreso = (datos) => {
    const prog = datos.progreso || {};
    const niveles = Object.keys(prog).filter(id => prog[id] > 0).length;
    const estrellas = Object.values(prog).reduce((s, n) => s + (+n || 0), 0);
    const circuitos = Object.keys(datos).filter(k => k.startsWith('circuito.') && Array.isArray(datos[k]) && datos[k].some(p => !p.fija)).length;
    return `${niveles} nivel${niveles === 1 ? '' : 'es'} superado${niveles === 1 ? '' : 's'}, ${estrellas} estrella${estrellas === 1 ? '' : 's'} y ${circuitos} circuito${circuitos === 1 ? '' : 's'} guardado${circuitos === 1 ? '' : 's'}`;
  };

  // Recarga el estado en memoria tras importar o reiniciar
  function recargarProgreso() {
    E.progreso = ALM.leer('progreso', {});
    const idx = Math.max(0, NIVELES.findIndex(n => n.id === ALM.leer('nivel', null)));
    cargarNivel(idx);
  }

  $('btnExportar').addEventListener('click', () => {
    const datos = ALM.todas();
    for (const k of PREFERENCIAS) delete datos[k];
    const archivo = { formato: FORMATO, version: 1, fecha: new Date().toISOString(), datos };
    const blob = new Blob([JSON.stringify(archivo, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const hoy = new Date(), dd = (n) => String(n).padStart(2, '0');
    a.download = `progreso-circuitos-${hoy.getFullYear()}-${dd(hoy.getMonth() + 1)}-${dd(hoy.getDate())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('btnImportar').addEventListener('click', () => { $('archivoImportar').value = ''; $('archivoImportar').click(); });
  $('archivoImportar').addEventListener('change', () => {
    const f = $('archivoImportar').files[0];
    if (!f) return;
    const lector = new FileReader();
    lector.onload = () => {
      let archivo;
      try { archivo = JSON.parse(lector.result); } catch (e) { archivo = null; }
      if (!archivo || archivo.formato !== FORMATO || typeof archivo.datos !== 'object' || !archivo.datos) {
        avisar('Archivo no válido', 'Ese archivo no es un progreso exportado desde este juego.');
        return;
      }
      const datos = archivo.datos;
      const fecha = archivo.fecha ? new Date(archivo.fecha).toLocaleString('es-ES') : 'fecha desconocida';
      confirmar('¿Importar el progreso?',
        `El archivo (${fecha}) contiene ${resumenProgreso(datos)}. Sustituirá el progreso y los circuitos de este navegador.`,
        'Importar', () => {
          ALM.borrar(PREFERENCIAS);
          for (const [k, v] of Object.entries(datos)) if (!PREFERENCIAS.includes(k)) ALM.escribir(k, v);
          recargarProgreso();
        });
    };
    lector.readAsText(f);
  });

  $('btnReiniciar').addEventListener('click', () => {
    confirmar('¿Reiniciar el progreso?',
      `Se borrarán de este navegador ${resumenProgreso(ALM.todas())}. No se puede deshacer: si quieres conservarlos, expórtalos antes.`,
      'Reiniciar', () => {
        ALM.borrar(PREFERENCIAS);
        E.progreso = {};
        cargarNivel(0);
      });
  });
  $('btnAyuda').addEventListener('click', () => abrirModal('modalAyuda'));
  $('btnTema').addEventListener('click', () => {
    const html = document.documentElement;
    const oscuro = html.dataset.theme ? html.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    html.dataset.theme = oscuro ? 'light' : 'dark';
    ALM.escribir('tema', html.dataset.theme);
    leerColores();
    construirPaleta();
    colorear();
    dibujarGraficas();
  });

  $('herramientas').addEventListener('click', ev => { const b = ev.target.closest('[data-herr]'); if (b) elegirHerramienta(b.dataset.herr); });
  $('piezas').addEventListener('click', ev => { const b = ev.target.closest('[data-herr]'); if (b) elegirHerramienta(b.dataset.herr); });

  /* ---------- Teclado ---------- */
  document.addEventListener('keydown', ev => {
    if (ev.target.closest && ev.target.closest('input, select, textarea')) return;
    const abierto = [...document.querySelectorAll('.modal')].some(m => !m.hidden);
    if (abierto) { if (ev.key === 'Escape') cerrarModales(); return; }
    const k = ev.key;
    if ((ev.ctrlKey || ev.metaKey) && k.toLowerCase() === 'z') { ev.preventDefault(); if (ev.shiftKey) rehacerAccion(); else deshacer(); return; }
    if ((ev.ctrlKey || ev.metaKey) && k.toLowerCase() === 'y') { ev.preventDefault(); rehacerAccion(); return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const sel = E.sel ? E.tab.piezas.find(q => q.id === E.sel) : null;
    switch (k.toLowerCase()) {
      case 'r':
        if (herrPieza()) { E.rot = (E.rot + 1) % 4; dibujarFantasma(); }
        else if (sel) accionSeleccion('girar');
        break;
      case 'm':
        if (herrPieza()) { E.esp = !E.esp; dibujarFantasma(); }
        else if (sel) accionSeleccion('espejo');
        break;
      case 'delete': case 'backspace':
        if (sel) { ev.preventDefault(); accionSeleccion('borrar'); }
        break;
      case 'escape': elegirHerramienta('sel'); E.sel = null; dibujarTablero(); actualizarPropiedades(); break;
      case 'v': elegirHerramienta('sel'); break;
      case 'w': elegirHerramienta('lapiz'); break;
      case 'e': elegirHerramienta('borrar'); break;
      case 'p': elegirHerramienta('sonda'); break;
      case ' ': ev.preventDefault(); alternarAnim(); break;
      case '+': case '-': case '−':
        if (sel && (sel.tipo === 'resistencia' || sel.tipo === 'condensador')) cambiarValor(sel, pasoE24(sel.valor, k === '+' ? 1 : -1));
        break;
      case 'arrowup': case 'arrowdown':
        if (sel && (sel.tipo === 'resistencia' || sel.tipo === 'condensador')) {
          ev.preventDefault();
          const dir = k === 'ArrowUp' ? 1 : -1;
          cambiarValor(sel, ev.shiftKey ? pasoFino(sel.valor, dir) : pasoE24(sel.valor, dir));
        }
        break;
      case 'arrowleft': ponerCursor(E.cursor - 5); break;
      case 'arrowright': ponerCursor(E.cursor + 5); break;
      default:
        if (/^[1-9]$/.test(k)) {
          const h = herramientasNivel()[+k - 1];
          if (h) elegirHerramienta(h.clave);
        }
    }
  });

  window.addEventListener('resize', () => dibujarGraficas());

  /* ---------- Arranque ---------- */
  const tema = ALM.leer('tema', null);
  if (tema) document.documentElement.dataset.theme = tema;
  leerColores();
  // ?nivel=<id o número, p. ej. 1.2> abre un nivel concreto; &solucion muestra la solución (para clase)
  const params = new URLSearchParams(location.search);
  const pedido = params.get('nivel');
  let idx0 = -1;
  if (pedido) idx0 = NIVELES.findIndex(n => n.id === pedido || n.numero === pedido);
  if (idx0 < 0) idx0 = Math.max(0, NIVELES.findIndex(n => n.id === ALM.leer('nivel', null)));
  cargarNivel(idx0);
  if (params.has('solucion') && E.nivel.solucion) {
    E.tab.cargar(E.tab.serializar().filter(p => p.fija));
    N.aplicarSolucion(E.tab, E.nivel.solucion, E.nivel);
    E.ayuda = true; E.mejorSesion = 1;
    cambio(false);
  } else if (!ALM.leer('ayudaVista', false) && !pedido) abrirModal('modalAyuda');
})();
