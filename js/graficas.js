/* ==========================================================================
   Gráficas de formas de onda en <canvas>.
   ========================================================================== */
(function (G) {
  'use strict';

  const ESCALAS = [0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30, 50, 100];

  function escalaBonita(m) {
    for (const e of ESCALAS) if (m <= e * 1.001) return e;
    return Math.ceil(m / 50) * 50;
  }

  function pasoBonito(rango, objetivo) {
    const bruto = rango / objetivo;
    const p = Math.pow(10, Math.floor(Math.log10(bruto)));
    for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= bruto) return k * p;
    return 10 * p;
  }

  const css = (nombre) => getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();

  /* opciones: { t, series: [{ y, color, ancho, discontinua, alfa }], ymax, cursor, lineas: [{ v, color }] } */
  function dibujar(canvas, op) {
    const dpr = window.devicePixelRatio || 1;
    if (!canvas.dataset.h) canvas.dataset.h = canvas.getAttribute('height');
    const hCss = +canvas.dataset.h;
    const wCss = canvas.clientWidth || 300;
    canvas.style.height = hCss + 'px';
    if (canvas.width !== Math.round(wCss * dpr) || canvas.height !== Math.round(hCss * dpr)) {
      canvas.width = Math.round(wCss * dpr);
      canvas.height = Math.round(hCss * dpr);
    }
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, wCss, hCss);

    const izq = 34, der = 6, arr = 14, abj = 18;
    const W = wCss - izq - der, H = hCss - arr - abj;
    const t = op.t;
    if (!t || !t.length) return;
    const tmax = t[t.length - 1];
    const ymax = op.ymax;
    const X = (tt) => izq + (tt / tmax) * W;
    const Y = (v) => arr + H / 2 - (v / ymax) * (H / 2);

    // Rejilla
    g.font = '10px ' + css('--font');
    g.textBaseline = 'middle';
    const colRej = css('--line'), colTxt = css('--muted');
    g.lineWidth = 1;
    const pv = pasoBonito(ymax, 2);
    const marcas = [0];
    for (let v = pv; v <= ymax + 1e-9; v += pv) marcas.push(v, -v);
    for (const v of marcas) {
      const y = Math.round(Y(v)) + 0.5;
      g.strokeStyle = colRej;
      g.globalAlpha = Math.abs(v) < 1e-9 ? 1 : 0.55;
      g.beginPath(); g.moveTo(izq, y); g.lineTo(izq + W, y); g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = colTxt;
      g.textAlign = 'right';
      g.fillText((Math.round(v * 100) / 100).toString().replace('.', ',').replace('-', '−'), izq - 5, y);
    }
    const pt = pasoBonito(tmax, 4);
    g.textAlign = 'center';
    g.textBaseline = 'top';
    for (let tt = 0; tt <= tmax + 1e-9; tt += pt) {
      const x = Math.round(X(tt)) + 0.5;
      g.strokeStyle = colRej;
      g.globalAlpha = 0.55;
      g.beginPath(); g.moveTo(x, arr); g.lineTo(x, arr + H); g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = colTxt;
      g.fillText((Math.round(tt * 100) / 100).toString().replace('.', ','), x, arr + H + 4);
    }
    g.textAlign = 'right';
    g.fillText('t (ms)', izq - 5, arr + H + 4);
    g.textBaseline = 'top';
    g.textAlign = 'left';
    g.fillText(op.unidad || 'V', 4, 0);

    // Líneas horizontales destacadas (±Vsat)
    for (const l of (op.lineas || [])) {
      if (Math.abs(l.v) > ymax) continue;
      g.strokeStyle = l.color;
      g.setLineDash([4, 4]);
      g.globalAlpha = 0.8;
      g.beginPath(); g.moveTo(izq, Y(l.v)); g.lineTo(izq + W, Y(l.v)); g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 1;
    }

    // Series
    g.save();
    g.beginPath(); g.rect(izq, arr - 2, W, H + 4); g.clip();
    for (const s of op.series) {
      if (!s.y) continue;
      g.strokeStyle = s.color;
      g.lineWidth = s.ancho || 2;
      g.globalAlpha = s.alfa === undefined ? 1 : s.alfa;
      g.setLineDash(s.discontinua ? [7, 5] : []);
      g.lineJoin = 'round';
      g.beginPath();
      for (let i = 0; i < t.length; i++) {
        const x = X(t[i]), y = Y(s.y[i]);
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.stroke();
    }
    g.restore();
    g.setLineDash([]);
    g.globalAlpha = 1;

    // Cursor de tiempo
    if (op.cursor !== undefined && op.cursor !== null) {
      const x = Math.round(X(t[op.cursor])) + 0.5;
      g.strokeStyle = css('--fg');
      g.globalAlpha = 0.35;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, arr); g.lineTo(x, arr + H); g.stroke();
      g.globalAlpha = 1;
      for (const s of op.series) {
        if (!s.y || s.sinPunto) continue;
        g.fillStyle = s.color;
        g.beginPath(); g.arc(x, Y(Math.max(-ymax, Math.min(ymax, s.y[op.cursor]))), 3.2, 0, 2 * Math.PI); g.fill();
      }
    }
  }

  G.Graficas = { dibujar, escalaBonita };
})(window);
