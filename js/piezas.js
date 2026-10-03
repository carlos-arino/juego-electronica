/* ==========================================================================
   Piezas del tablero: geometría, puertos y transformaciones.
   Direcciones: 0 = N, 1 = E, 2 = S, 3 = O.
   Cada pieza ocupa w×h casillas (sin girar) y tiene puertos en los bordes
   de algunas casillas. Los puertos con la misma etiqueta están unidos
   dentro de la pieza (cables); los elementos (R, C, AO...) unen etiquetas.
   ========================================================================== */
(function (G) {
  'use strict';

  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];

  const TIPOS = {
    cable: {
      nombre: 'Cable recto', w: 1, h: 1, cable: true,
      puertos: [{ x: 0, y: 0, d: 3, n: 'a' }, { x: 0, y: 0, d: 1, n: 'a' }]
    },
    extremo: {
      nombre: 'Extremo de cable', w: 1, h: 1, cable: true,
      puertos: [{ x: 0, y: 0, d: 1, n: 'a' }]
    },
    codo: {
      nombre: 'Cable en L', w: 1, h: 1, cable: true,
      puertos: [{ x: 0, y: 0, d: 1, n: 'a' }, { x: 0, y: 0, d: 2, n: 'a' }]
    },
    te: {
      nombre: 'Nudo en T', w: 1, h: 1, cable: true,
      puertos: [{ x: 0, y: 0, d: 3, n: 'a' }, { x: 0, y: 0, d: 1, n: 'a' }, { x: 0, y: 0, d: 2, n: 'a' }]
    },
    cruz: {
      nombre: 'Nudo en cruz', w: 1, h: 1, cable: true,
      puertos: [0, 1, 2, 3].map(d => ({ x: 0, y: 0, d, n: 'a' }))
    },
    puente: {
      nombre: 'Cruce sin unión', w: 1, h: 1, cable: true,
      puertos: [{ x: 0, y: 0, d: 0, n: 'a' }, { x: 0, y: 0, d: 2, n: 'a' },
                { x: 0, y: 0, d: 1, n: 'b' }, { x: 0, y: 0, d: 3, n: 'b' }]
    },
    resistencia: {
      nombre: 'Resistencia', w: 1, h: 1, valor: 10e3, unidad: 'Ω',
      puertos: [{ x: 0, y: 0, d: 3, n: 'a' }, { x: 0, y: 0, d: 1, n: 'b' }]
    },
    condensador: {
      nombre: 'Condensador', w: 1, h: 1, valor: 100e-9, unidad: 'F',
      puertos: [{ x: 0, y: 0, d: 3, n: 'a' }, { x: 0, y: 0, d: 1, n: 'b' }]
    },
    tierra: {
      nombre: 'Tierra', w: 1, h: 1,
      puertos: [{ x: 0, y: 0, d: 0, n: 'a' }]
    },
    fuente: {
      nombre: 'Fuente de tensión', w: 1, h: 1, valor: 5, unidad: 'V',
      puertos: [{ x: 0, y: 0, d: 2, n: 'a' }]
    },
    ao: {
      nombre: 'Amplificador operacional', w: 3, h: 3,
      puertos: [{ x: 0, y: 0, d: 3, n: 'n' }, { x: 0, y: 2, d: 3, n: 'p' }, { x: 2, y: 1, d: 1, n: 'o' }]
    },
    diodo: {
      nombre: 'Diodo', w: 1, h: 1, disp: true, par: { vg: 0.7 },
      puertos: [{ x: 0, y: 0, d: 3, n: 'a' }, { x: 0, y: 0, d: 1, n: 'k' }]
    },
    zener: {
      nombre: 'Diodo Zener', w: 1, h: 1, disp: true, par: { vg: 0.7, vz: 5.1 },
      puertos: [{ x: 0, y: 0, d: 3, n: 'a' }, { x: 0, y: 0, d: 1, n: 'k' }]
    },
    led: {
      nombre: 'LED', w: 1, h: 1, disp: true, par: { vg: 2, imax: 0.03 },
      puertos: [{ x: 0, y: 0, d: 3, n: 'a' }, { x: 0, y: 0, d: 1, n: 'k' }]
    },
    npn: {
      nombre: 'Transistor NPN', w: 1, h: 1, disp: true, par: { beta: 100, vbe: 0.7, vcesat: 0.2, vceo: 45 },
      puertos: [{ x: 0, y: 0, d: 3, n: 'b' }, { x: 0, y: 0, d: 0, n: 'c' }, { x: 0, y: 0, d: 2, n: 'e' }]
    },
    pnp: {
      nombre: 'Transistor PNP', w: 1, h: 1, disp: true, par: { beta: 100, vbe: 0.7, vcesat: 0.2, vceo: 45 },
      puertos: [{ x: 0, y: 0, d: 3, n: 'b' }, { x: 0, y: 0, d: 0, n: 'e' }, { x: 0, y: 0, d: 2, n: 'c' }]
    },
    nmos: {
      nombre: 'MOSFET canal N', w: 1, h: 1, disp: true, par: { vth: 2, k: 0.5, ron: 0.1, vdss: 60 },
      puertos: [{ x: 0, y: 0, d: 3, n: 'g' }, { x: 0, y: 0, d: 0, n: 'd' }, { x: 0, y: 0, d: 2, n: 's' }]
    },
    pmos: {
      nombre: 'MOSFET canal P', w: 1, h: 1, disp: true, par: { vth: 2, k: 0.5, ron: 0.1, vdss: 60 },
      puertos: [{ x: 0, y: 0, d: 3, n: 'g' }, { x: 0, y: 0, d: 0, n: 's' }, { x: 0, y: 0, d: 2, n: 'd' }]
    },
    lampara: {
      nombre: 'Lámpara', w: 1, h: 1, carga: true, valor: 48, unidad: 'Ω',
      puertos: [{ x: 0, y: 0, d: 3, n: 'a' }, { x: 0, y: 0, d: 1, n: 'b' }]
    },
    motor: {
      nombre: 'Motor', w: 1, h: 1, carga: true, valor: 12, unidad: 'Ω',
      puertos: [{ x: 0, y: 0, d: 3, n: 'a' }, { x: 0, y: 0, d: 1, n: 'b' }]
    },
    bobina: {
      nombre: 'Bobina de relé', w: 1, h: 1, carga: true, valor: 240, unidad: 'Ω', par: { L: 0.02 },
      puertos: [{ x: 0, y: 0, d: 3, n: 'a' }, { x: 0, y: 0, d: 1, n: 'b' }]
    },
    entrada: {
      nombre: 'Entrada', w: 1, h: 1, fija: true,
      puertos: [{ x: 0, y: 0, d: 1, n: 'a' }]
    },
    secundario: {
      nombre: 'Secundario del transformador', w: 1, h: 3, fija: true,
      puertos: [{ x: 0, y: 0, d: 1, n: 'a' }, { x: 0, y: 2, d: 1, n: 'b' }]
    },
    salida: {
      nombre: 'Salida', w: 1, h: 1, fija: true,
      puertos: [{ x: 0, y: 0, d: 3, n: 'a' }]
    }
  };

  /* Transforma un punto local (en casillas, continuo) de una pieza w×h:
     primero espejo vertical (m), luego r giros de 90° en sentido horario. */
  function transformarPunto(px, py, w, h, r, m) {
    let x = px, y = py, W = w, H = h;
    if (m) y = H - y;
    for (let i = 0; i < r; i++) {
      const nx = H - y, ny = x;
      x = nx; y = ny;
      const t = W; W = H; H = t;
    }
    return [x, y];
  }

  function transformarDir(d, r, m) {
    if (m && (d === 0 || d === 2)) d = 2 - d;
    return (d + r) % 4;
  }

  function dimensiones(p) {
    const t = TIPOS[p.tipo];
    return (p.r % 2) ? [t.h, t.w] : [t.w, t.h];
  }

  /* Casillas ocupadas por la pieza en coordenadas del tablero. */
  function casillas(p) {
    const [w, h] = dimensiones(p);
    const out = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out.push([p.x + i, p.y + j]);
    return out;
  }

  /* Puertos en coordenadas del tablero: casilla (cx, cy), dirección d y etiqueta n. */
  function puertos(p) {
    const t = TIPOS[p.tipo];
    return t.puertos.map(q => {
      const [cx, cy] = transformarPunto(q.x + 0.5, q.y + 0.5, t.w, t.h, p.r, p.m);
      return { cx: p.x + Math.floor(cx), cy: p.y + Math.floor(cy), d: transformarDir(q.d, p.r, p.m), n: q.n };
    });
  }

  /* Identificador del borde entre la casilla (cx, cy) y su vecina en la dirección d. */
  function claveBorde(cx, cy, d) {
    if (d === 0) return 'h' + cx + ',' + cy;
    if (d === 2) return 'h' + cx + ',' + (cy + 1);
    if (d === 3) return 'v' + cx + ',' + cy;
    return 'v' + (cx + 1) + ',' + cy;
  }

  /* Pieza de cable a partir de un conjunto de direcciones. */
  function cableDesdeDirs(dirs) {
    const s = [0, 1, 2, 3].filter(d => dirs.has(d));
    if (s.length === 0) return null;
    if (s.length === 1) return { tipo: 'extremo', r: (s[0] + 3) % 4, m: false };
    if (s.length === 4) return { tipo: 'cruz', r: 0, m: false };
    if (s.length === 3) {
      const falta = [0, 1, 2, 3].find(d => !dirs.has(d));
      // te base: O, E, S (falta N). Girar r veces: falta (0 + r)
      return { tipo: 'te', r: falta, m: false };
    }
    const [a, b] = s;
    if ((b - a) === 2) return { tipo: 'cable', r: (a === 0) ? 1 : 0, m: false };
    // codo base: E, S. Con r giros: (1+r, 2+r)
    for (let r = 0; r < 4; r++) {
      const d1 = (1 + r) % 4, d2 = (2 + r) % 4;
      if (dirs.has(d1) && dirs.has(d2)) return { tipo: 'codo', r, m: false };
    }
    return null;
  }

  /* Direcciones de cable de una pieza de cable (para fusionar con el lápiz). */
  function dirsDeCable(p) {
    return new Set(puertos(p).map(q => q.d));
  }

  /* Valores con prefijo SI. */
  function formatearValor(v, unidad) {
    if (v === 0) return '0 ' + unidad;
    const pref = [[1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
    const a = Math.abs(v);
    for (const [f, s] of pref) {
      if (a >= f * 0.9999) {
        let n = v / f;
        n = Math.round(n * 1000) / 1000;
        return String(n).replace('.', ',') + ' ' + s + unidad;
      }
    }
    return v.toExponential(2) + ' ' + unidad;
  }

  function parsearValor(txt) {
    if (txt == null) return NaN;
    let s = String(txt).trim().replace(',', '.').replace(/\s+/g, '');
    s = s.replace(/(Ω|ohm|ohms|F|V)$/i, '');
    const m = s.match(/^([+-]?\d*\.?\d+(?:e[+-]?\d+)?)([pnuµmkKM]?)$/);
    if (!m) return NaN;
    const f = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, '': 1 }[m[2]];
    return parseFloat(m[1]) * f;
  }

  /* Parámetros de un dispositivo: los del tipo completados con los de la pieza. */
  function parDe(p) {
    return Object.assign({}, TIPOS[p.tipo].par || {}, p.par || {});
  }

  G.Piezas = { TIPOS, DX, DY, transformarPunto, transformarDir, dimensiones, casillas, puertos,
    claveBorde, cableDesdeDirs, dirsDeCable, formatearValor, parsearValor, parDe };
})(typeof window !== 'undefined' ? window : globalThis);
