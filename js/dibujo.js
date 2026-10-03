/* ==========================================================================
   Dibujo SVG de las piezas. Cada pieza se dibuja en su marco local
   (sin girar, 40 px por casilla) y se coloca con una matriz afín.
   Los textos se dibujan fuera de la matriz para que no giren.
   ========================================================================== */
(function (G) {
  'use strict';
  const P = G.Piezas;
  const T = 40;

  /* Matriz [a, b, c, d, e, f] de la pieza: espejo, giros y traslación. */
  function matriz(p) {
    const t = P.TIPOS[p.tipo];
    let W = t.w * T, H = t.h * T;
    let M = [1, 0, 0, 1, 0, 0];
    const mult = (A, B) => [  // A·B (B se aplica primero)
      A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1],
      A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
      A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]
    ];
    if (p.m) M = mult([1, 0, 0, -1, 0, H], M);
    for (let i = 0; i < (p.r || 0); i++) {
      M = mult([0, 1, -1, 0, H, 0], M);
      const tmp = W; W = H; H = tmp;
    }
    M[4] += (p.x || 0) * T;
    M[5] += (p.y || 0) * T;
    return M;
  }
  const aplicar = (M, x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
  const f1 = (v) => Math.round(v * 10) / 10;

  function hilo(d, n, pid, extra) {
    return `<path class="pz hilo${extra ? ' ' + extra : ''}" data-pid="${pid}" data-n="${n}" d="${d}"/>`;
  }
  function nudo(x, y, n, pid) {
    return `<circle class="pz-nudo hilo" data-f="1" data-pid="${pid}" data-n="${n}" cx="${x}" cy="${y}" r="4.6"/>`;
  }
  function texto(M, x, y, txt, clase, extra) {
    const [tx, ty] = aplicar(M, x, y);
    return `<text class="pz-txt ${clase || ''}" x="${f1(tx)}" y="${f1(ty)}" ${extra || ''}>${txt}</text>`;
  }

  /* Contenido de una pieza. ctx: { nivel, nombreAO, icono } */
  function pieza(p, ctx) {
    ctx = ctx || {};
    const id = p.id || 0;
    const M = matriz(p);
    let cuerpo = '', etiquetas = '';
    switch (p.tipo) {
      case 'cable': cuerpo = hilo('M0 20H40', 'a', id); break;
      case 'extremo':
        cuerpo = hilo('M40 20H22', 'a', id) + `<circle class="pz-fino" cx="19" cy="20" r="3"/>`;
        break;
      case 'codo': cuerpo = hilo('M40 20H20V40', 'a', id); break;
      case 'te': cuerpo = hilo('M0 20H40M20 20V40', 'a', id) + nudo(20, 20, 'a', id); break;
      case 'cruz': cuerpo = hilo('M0 20H40M20 0V40', 'a', id) + nudo(20, 20, 'a', id); break;
      case 'puente':
        cuerpo = hilo('M20 0V40', 'a', id) + hilo('M0 20H12.5A7.5 7.5 0 0 1 27.5 20H40', 'b', id);
        break;
      case 'resistencia':
        cuerpo = hilo('M0 20H7', 'a', id) + hilo('M33 20H40', 'b', id) +
          `<rect class="pz-relleno" x="7" y="13" width="26" height="14" rx="1.5"/>`;
        if (!ctx.icono) {
          const vertical = (p.r % 2) === 1;
          const txt = P.formatearValor(p.valor, 'Ω').replace(' ', ' ');
          etiquetas = vertical
            ? texto(M, 20, 20, txt, 'val', `dx="11" text-anchor="start" style="text-anchor:start"`)
            : texto(M, 20, 20, txt, 'val', `dy="-14"`);
        }
        break;
      case 'condensador':
        cuerpo = hilo('M0 20H16', 'a', id) + hilo('M24 20H40', 'b', id) +
          `<path class="pz" d="M16 10V30M24 10V30"/>`;
        if (!ctx.icono) {
          const vertical = (p.r % 2) === 1;
          const txt = P.formatearValor(p.valor, 'F').replace(' ', ' ');
          etiquetas = vertical
            ? texto(M, 20, 20, txt, 'val', `dx="14" style="text-anchor:start"`)
            : texto(M, 20, 20, txt, 'val', `dy="-17"`);
        }
        break;
      case 'tierra':
        cuerpo = hilo('M20 0V20', 'a', id) + `<path class="pz-fino" style="stroke-width:2.6" d="M8 20H32M12.5 26.5H27.5M17 33H23"/>`;
        break;
      case 'fuente': {
        cuerpo = hilo('M20 40V26', 'a', id);
        const [cx, cy] = aplicar(M, 20, 14);
        const txt = (p.valor > 0 ? '+' : p.valor < 0 ? '−' : '') + String(Math.abs(p.valor)).replace('.', ',') + ' V';
        const w = Math.max(30, 7 * txt.length + 6);
        etiquetas = `<rect class="pz-relleno" x="${f1(cx - w / 2)}" y="${f1(cy - 9)}" width="${w}" height="18" rx="9" style="stroke-width:2"/>` +
          `<text class="pz-txt val" x="${f1(cx)}" y="${f1(cy + 0.5)}">${txt}</text>`;
        break;
      }
      case 'ao': {
        cuerpo = hilo('M0 20H24', 'n', id) + hilo('M0 100H24', 'p', id) + hilo('M96 60H120', 'o', id) +
          `<path class="pz-relleno" d="M24 5L24 115L97 60Z"/>`;
        etiquetas = texto(M, 32, 23, '−', 'signo') + texto(M, 32, 98, '+', 'signo');
        if (ctx.nombreAO) etiquetas += texto(M, 50, 60, ctx.nombreAO, 'peq');
        if (!ctx.icono) {
          const [sx, sy] = aplicar(M, 108, 60);
          etiquetas += `<text class="sat-txt" data-sat="${id}" x="${f1(sx)}" y="${f1(sy - 9)}" visibility="hidden">SAT</text>`;
        }
        break;
      }
      case 'entrada': {
        const ent = ctx.nivel && ctx.nivel.entradas[p.k];
        cuerpo = `<rect class="pz-fija-fondo" x="1" y="1" width="38" height="38" rx="7"/>` +
          hilo('M25 22H40', 'a', id) +
          `<circle class="pz-relleno" cx="15" cy="22" r="10"/>` +
          `<path class="pz-fino" style="stroke-width:1.6" d="M8.5 22q3.25 -7 6.5 0t6.5 0"/>`;
        if (ent && ent.Rs > 0) cuerpo += `<rect class="pz-relleno" style="stroke-width:1.6" x="27" y="18.5" width="11" height="7" rx="1"/>`;
        etiquetas = `<text class="pz-txt" style="font-weight:700;font-size:12px" x="${p.x * T + 15}" y="${p.y * T + 6}">${ent ? ent.nombre : 'v'}</text>`;
        break;
      }
      case 'salida': {
        cuerpo = `<rect class="pz-fija-fondo" x="1" y="1" width="38" height="38" rx="7"/>` +
          hilo('M0 22H21', 'a', id) +
          `<circle class="pz-relleno" style="stroke-width:2.2" cx="26" cy="22" r="5"/>`;
        etiquetas = `<text class="pz-txt" style="font-weight:700;font-size:12px" x="${p.x * T + 25}" y="${p.y * T + 6}">vₒ</text>`;
        if (ctx.nivel && ctx.nivel.RL > 0) {
          etiquetas += `<text class="pz-txt peq" x="${p.x * T + 22}" y="${p.y * T + 35}">R<tspan font-size="8" dy="2">L</tspan></text>`;
        }
        break;
      }
    }
    const mat = M.map(f1).join(' ');
    return {
      grupo: `<g class="pieza tipo-${p.tipo}" data-id="${id}" transform="matrix(${mat})">${cuerpo}</g>`,
      etiquetas
    };
  }

  /* Icono de la paleta (SVG completo). */
  function icono(tipo, valor) {
    const t = P.TIPOS[tipo];
    const p = { tipo, x: 0, y: 0, r: 0, m: false, valor: valor !== undefined ? valor : t.valor };
    if (tipo === 'extremo') p.r = 2;
    const d = pieza(p, { icono: true });
    const vb = tipo === 'ao' ? '-4 -4 128 128' : '0 0 40 40';
    return `<svg viewBox="${vb}" aria-hidden="true">${d.grupo}${d.etiquetas}</svg>`;
  }

  function iconoHerramienta(nombre) {
    const s = 'fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';
    const iconos = {
      sel: `<path ${s} d="M12 8l16 9-7 2-3 7z"/>`,
      lapiz: `<path ${s} d="M9 31l2-7 15-15 5 5-15 15z"/><path ${s} d="M23 12l5 5"/>`,
      borrar: `<path ${s} d="M10 26l12-14 8 7-10 11h-7z"/><path ${s} d="M17 19l8 7M13 30h18"/>`,
      sonda: `<path ${s} d="M11 29l7-7"/><circle ${s} cx="23" cy="17" r="6"/><path ${s} d="M23 14v6M20 17h6"/>`
    };
    return `<svg viewBox="0 0 40 40" aria-hidden="true" style="color:var(--ink)">${iconos[nombre]}</svg>`;
  }

  G.Dibujo = { T, matriz, aplicar, pieza, icono, iconoHerramienta };
})(typeof window !== 'undefined' ? window : globalThis);
