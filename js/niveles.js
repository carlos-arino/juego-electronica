/* ==========================================================================
   Niveles del juego. Tiempos en ms, frecuencias en kHz, tensiones en V.
   Cada nivel define sus entradas, la salida objetivo, las piezas
   disponibles y una solución de referencia (también sirve de test).
   ========================================================================== */
(function (G) {
  'use strict';

  const PI2 = 2 * Math.PI;
  const frac = (x) => x - Math.floor(x);

  const Senal = {
    seno: (A, f, off = 0, fase = 0) => t => off + A * Math.sin(PI2 * f * t + fase),
    cuadrada: (A, f, off = 0) => t => off + (frac(f * t) < 0.5 ? A : -A),
    triangular: (A, f, off = 0) => t => off + (2 * A / Math.PI) * Math.asin(Math.sin(PI2 * f * t)),
    diente: (A, f, off = 0) => t => off + A * (2 * frac(f * t) - 1),
    continua: (V) => () => V,
    rampa: (Vmax, f) => t => { const u = frac(f * t); return Vmax * (u < 0.5 ? 2 * u : 2 - 2 * u); },
    pulsos: (V, f, D = 0.5) => t => (frac(f * t) < D ? V : 0)
  };

  const puntual = (fn) => (E, t) => {
    const out = new Float64Array(t.length);
    for (let i = 0; i < t.length; i++) out[i] = fn(E.map(e => e[i]), t[i]);
    return out;
  };

  const CABLES = ['cable', 'codo', 'te', 'cruz', 'puente'];
  const v1 = 'v<sub>1</sub>', v2 = 'v<sub>2</sub>', vo = 'v<sub>o</sub>';

  const AO_LINEAL = [
    {
      id: 'seguidor',
      titulo: 'El seguidor de tensión',
      concepto: 'Realimentación negativa · cortocircuito virtual',
      enunciado: `La fuente ${v1} tiene una resistencia interna de 10 kΩ y la salida alimenta una carga de 1 kΩ. Si unes la entrada con la salida mediante un cable, el divisor de tensión hunde la señal. Usa un AO para copiar ${v1} en la salida sin cargar a la fuente.`,
      objetivoHTML: `${vo} = ${v1}`,
      entradas: [{ nombre: 'v₁', f: Senal.seno(2, 1), texto: '2·sen(2π·1 kHz·t) V', Rs: 10e3 }],
      RL: 1e3,
      objetivo: puntual(([a]) => a),
      tmax: 2,
      piezas: [...CABLES, 'ao'],
      par: 1,
      pista: 'Lleva la entrada a la patilla + del AO y une su salida con la patilla −. Así el AO ajusta su salida hasta que v− = v+.',
      solucion: [
        ['ao', 9, 5],
        ['w', [0, 6], [4, 6], [4, 7], [9, 7]],
        ['w', [11, 6], [23, 6]],
        ['w', [9, 5], [8, 5], [8, 3], [13, 3], [13, 6]]
      ]
    },
    {
      id: 'inversor',
      titulo: 'Amplificador inversor',
      concepto: 'Masa virtual · ganancia −R₂/R₁',
      enunciado: `Construye un amplificador que multiplique la entrada por −2. La entrada + del AO a tierra hace que la − sea una <i>masa virtual</i>: toda la corriente que entra por R<sub>1</sub> sale por R<sub>2</sub>.`,
      objetivoHTML: `${vo} = −2·${v1}`,
      entradas: [{ nombre: 'v₁', f: Senal.seno(1.5, 1), texto: '1,5·sen(2π·1 kHz·t) V' }],
      objetivo: puntual(([a]) => -2 * a),
      tmax: 2,
      piezas: [...CABLES, 'resistencia', 'tierra', 'ao'],
      par: 3,
      pista: 'v<sub>o</sub> = −(R<sub>2</sub>/R<sub>1</sub>)·v<sub>1</sub>. Prueba R<sub>1</sub> = 10 kΩ y R<sub>2</sub> = 20 kΩ. Selecciona una resistencia para cambiar su valor.',
      solucion: [
        ['ao', 10, 5],
        ['gnd', 9, 8],
        ['w', [10, 7], [9, 7], [9, 8]],
        ['R', 5, 5, 0, 10e3],
        ['w', [0, 6], [2, 6], [2, 5], [5, 5]],
        ['w', [5, 5], [10, 5]],
        ['R', 12, 3, 0, 20e3],
        ['w', [7, 5], [7, 3], [12, 3]],
        ['w', [12, 3], [14, 3], [14, 6]],
        ['w', [12, 6], [23, 6]]
      ]
    },
    {
      id: 'noinversor',
      titulo: 'Amplificador no inversor',
      concepto: 'Ganancia 1 + R₂/R₁ · Zᵢ infinita',
      enunciado: `Ahora la señal entra por la patilla +. La patilla − recibe una fracción de la salida a través de un divisor de tensión, y el AO hace que esa fracción sea igual a la entrada.`,
      objetivoHTML: `${vo} = 3·${v1}`,
      entradas: [{ nombre: 'v₁', f: Senal.triangular(1.2, 1), texto: 'triangular de 1,2 V de pico, 1 kHz' }],
      objetivo: puntual(([a]) => 3 * a),
      tmax: 2,
      piezas: [...CABLES, 'resistencia', 'tierra', 'ao'],
      par: 3,
      pista: 'v<sub>o</sub> = (1 + R<sub>2</sub>/R<sub>1</sub>)·v<sub>1</sub>: R<sub>1</sub> va de la patilla − a tierra y R<sub>2</sub> de la salida a la patilla −.',
      solucion: [
        ['ao', 10, 4],
        ['w', [0, 6], [10, 6]],
        ['w', [12, 5], [13, 5], [13, 6], [23, 6]],
        ['R', 5, 4, 0, 10e3],
        ['w', [10, 4], [5, 4]],
        ['gnd', 4, 5],
        ['w', [5, 4], [4, 4], [4, 5]],
        ['R', 10, 2, 0, 20e3],
        ['w', [7, 4], [7, 2], [10, 2]],
        ['w', [10, 2], [14, 2], [14, 6]]
      ]
    },
    {
      id: 'sumador',
      titulo: 'Sumador inversor',
      concepto: 'Las corrientes se suman en la masa virtual',
      enunciado: `Dos señales entran por dos resistencias a la misma masa virtual. Sus corrientes se suman y atraviesan juntas la resistencia de realimentación.`,
      objetivoHTML: `${vo} = −(${v1} + ${v2})`,
      entradas: [
        { nombre: 'v₁', f: Senal.seno(2, 1), texto: '2·sen(2π·1 kHz·t) V' },
        { nombre: 'v₂', f: Senal.cuadrada(1, 0.5), texto: 'cuadrada de ±1 V, 500 Hz' }
      ],
      objetivo: puntual(([a, b]) => -(a + b)),
      tmax: 4,
      piezas: [...CABLES, 'resistencia', 'tierra', 'ao'],
      par: 4,
      pista: 'v<sub>o</sub> = −R<sub>f</sub>·(v<sub>1</sub>/R<sub>1</sub> + v<sub>2</sub>/R<sub>2</sub>). Con las tres resistencias iguales, cada entrada tiene peso 1.',
      solucion: [
        ['ao', 11, 5],
        ['R', 6, 3, 0, 10e3], ['w', [0, 3], [6, 3]],
        ['R', 6, 9, 0, 10e3], ['w', [0, 9], [6, 9]],
        ['w', [6, 3], [8, 3], [8, 5], [11, 5]],
        ['w', [6, 9], [8, 9], [8, 5]],
        ['gnd', 10, 8], ['w', [11, 7], [10, 7], [10, 8]],
        ['R', 11, 2, 0, 10e3], ['w', [9, 5], [9, 2], [11, 2]],
        ['w', [11, 2], [15, 2], [15, 6]],
        ['w', [13, 6], [23, 6]]
      ]
    },
    {
      id: 'ponderado',
      titulo: 'Sumador ponderado',
      concepto: 'Cada entrada con su propio peso',
      enunciado: `Mismo montaje, pero cada entrada debe tener un peso distinto. El peso de cada entrada lo fija el cociente entre la resistencia de realimentación y su resistencia de entrada.`,
      objetivoHTML: `${vo} = −(2·${v1} + 0,5·${v2})`,
      entradas: [
        { nombre: 'v₁', f: Senal.seno(1, 1), texto: 'sen(2π·1 kHz·t) V' },
        { nombre: 'v₂', f: Senal.triangular(4, 0.5), texto: 'triangular de 4 V de pico, 500 Hz' }
      ],
      objetivo: puntual(([a, b]) => -(2 * a + 0.5 * b)),
      tmax: 4,
      piezas: [...CABLES, 'resistencia', 'tierra', 'ao'],
      par: 4,
      pista: 'R<sub>1</sub> = R<sub>f</sub>/2 y R<sub>2</sub> = R<sub>f</sub>/0,5 = 2·R<sub>f</sub>. Con valores comerciales (serie E24): R<sub>f</sub> = 15 kΩ, R<sub>1</sub> = 7,5 kΩ y R<sub>2</sub> = 30 kΩ.',
      solucion: [
        ['ao', 11, 5],
        ['R', 6, 3, 0, 7.5e3], ['w', [0, 3], [6, 3]],
        ['R', 6, 9, 0, 30e3], ['w', [0, 9], [6, 9]],
        ['w', [6, 3], [8, 3], [8, 5], [11, 5]],
        ['w', [6, 9], [8, 9], [8, 5]],
        ['gnd', 10, 8], ['w', [11, 7], [10, 7], [10, 8]],
        ['R', 11, 2, 0, 15e3], ['w', [9, 5], [9, 2], [11, 2]],
        ['w', [11, 2], [15, 2], [15, 6]],
        ['w', [13, 6], [23, 6]]
      ]
    },
    {
      id: 'restador',
      titulo: 'Restador',
      concepto: 'Amplificador diferencial · rechazo del modo común',
      enunciado: `Las dos entradas llevan un desplazamiento de 2 V que no interesa. Resta las dos señales para quedarte solo con la parte que cambia. Pista: necesitarás cruzar un cable sin unirlo, o colocar bien el AO (la tecla M intercambia + y −).`,
      objetivoHTML: `${vo} = ${v1} − ${v2}`,
      entradas: [
        { nombre: 'v₁', f: Senal.seno(1, 1, 2), texto: '2 + sen(2π·1 kHz·t) V' },
        { nombre: 'v₂', f: Senal.continua(2), texto: '2 V (continua)' }
      ],
      objetivo: puntual(([a, b]) => a - b),
      tmax: 2,
      piezas: [...CABLES, 'resistencia', 'tierra', 'ao'],
      par: 5,
      pista: 'v<sub>1</sub> llega a la patilla + por un divisor R<sub>1</sub>–R<sub>2</sub>; v<sub>2</sub> entra por R<sub>1</sub> a la patilla − y R<sub>2</sub> realimenta. Con las dos parejas iguales, v<sub>o</sub> = (R<sub>2</sub>/R<sub>1</sub>)(v<sub>1</sub> − v<sub>2</sub>).',
      solucion: [
        ['ao', 12, 5, 0, true],
        ['R', 5, 3, 0, 10e3], ['w', [0, 3], [5, 3]],
        ['w', [5, 3], [8, 3], [8, 5], [12, 5]],
        ['R', 8, 6, 1, 10e3], ['w', [8, 5], [8, 6]], ['w', [8, 6], [8, 8]], ['gnd', 8, 8],
        ['R', 5, 9, 0, 10e3], ['w', [0, 9], [5, 9]],
        ['w', [5, 9], [9, 9], [9, 7], [12, 7]],
        ['w', [10, 7], [10, 10], [12, 10]], ['R', 12, 10, 0, 10e3],
        ['w', [12, 10], [16, 10], [16, 6]],
        ['w', [14, 6], [23, 6]]
      ]
    },
    {
      id: 'sumadornoinv',
      titulo: 'Sumador no inversor',
      concepto: 'Media por superposición + no inversor',
      enunciado: `Suma las dos señales <b>sin cambiarles el signo</b> y con un solo AO. Dos resistencias iguales que llegan a un mismo nudo dan la media de las tensiones; luego basta con amplificar.`,
      objetivoHTML: `${vo} = ${v1} + ${v2}`,
      entradas: [
        { nombre: 'v₁', f: Senal.seno(1.5, 1), texto: '1,5·sen(2π·1 kHz·t) V' },
        { nombre: 'v₂', f: Senal.cuadrada(0.5, 0.5), texto: 'cuadrada de ±0,5 V, 500 Hz' }
      ],
      objetivo: puntual(([a, b]) => a + b),
      tmax: 4,
      piezas: [...CABLES, 'resistencia', 'tierra', 'ao'],
      par: 5,
      pista: 'v<sup>+</sup> = (v<sub>1</sub> + v<sub>2</sub>)/2 con dos resistencias iguales. Después, un no inversor de ganancia 2 (R<sub>f</sub> = R<sub>g</sub>).',
      solucion: [
        ['ao', 12, 5, 0, true],
        ['R', 6, 3, 0, 10e3], ['w', [0, 3], [6, 3]],
        ['w', [6, 3], [8, 3], [8, 5], [12, 5]],
        ['R', 6, 9, 0, 10e3], ['w', [0, 9], [6, 9]],
        ['w', [6, 9], [8, 9], [8, 5]],
        ['w', [12, 7], [10, 7], [10, 8]], ['R', 10, 8, 1, 10e3], ['w', [10, 8], [10, 10]], ['gnd', 10, 10],
        ['w', [11, 7], [11, 11], [14, 11]], ['R', 14, 11, 0, 10e3],
        ['w', [14, 11], [16, 11], [16, 6]],
        ['w', [14, 6], [23, 6]]
      ]
    },
    {
      id: 'sensor',
      titulo: 'Acondicionar un sensor',
      concepto: 'Pendiente y offset con una referencia',
      enunciado: `Un sensor da entre 0 y 2 V. Hay que llevarlo al rango de 1 a 5 V: doblar la pendiente y sumar 1 V. Solo dispones de una fuente de <b>−5 V</b>, así que tendrás que diseñar el divisor que da el offset adecuado.`,
      objetivoHTML: `${vo} = 2·${v1} + 1 V`,
      entradas: [{ nombre: 'v₁', f: Senal.seno(1, 0.5, 1, -Math.PI / 2), texto: '1 − cos(2π·500 Hz·t) V (de 0 a 2 V)' }],
      objetivo: puntual(([a]) => 2 * a + 1),
      tmax: 4,
      piezas: [...CABLES, 'resistencia', 'tierra', 'ao', 'fuente'],
      fuentes: [-5],
      par: 5,
      pista: 'Con v<sup>+</sup> = v<sub>1</sub> y en la patilla −: R<sub>1</sub> a −5 V, R<sub>3</sub> a tierra y R<sub>2</sub> a la salida, se obtiene v<sub>o</sub> = (1 + R<sub>2</sub>/R<sub>1</sub> + R<sub>2</sub>/R<sub>3</sub>)·v<sub>1</sub> + 5·R<sub>2</sub>/R<sub>1</sub>. Iguala coeficientes: R<sub>1</sub> = 5·R<sub>2</sub> y R<sub>3</sub> = 1,25·R<sub>2</sub>. Con R<sub>2</sub> = 2,4 kΩ salen valores comerciales: R<sub>1</sub> = 12 kΩ y R<sub>3</sub> = 3 kΩ.',
      solucion: [
        ['ao', 10, 3],
        ['w', [0, 6], [3, 6], [3, 5], [10, 5]],
        ['w', [10, 3], [5, 3]], ['R', 5, 3, 0, 3e3],
        ['w', [5, 3], [4, 3], [4, 4]], ['gnd', 4, 4],
        ['R', 8, 2, 1, 12e3], ['w', [8, 3], [8, 2]], ['V', 8, 1, 0, -5],
        ['w', [6, 3], [6, 0], [9, 0]], ['R', 9, 0, 0, 2.4e3],
        ['w', [9, 0], [15, 0], [15, 6]],
        ['w', [12, 4], [14, 4], [14, 6], [23, 6]]
      ]
    },
    {
      id: 'adc',
      titulo: 'Adaptar al convertidor A/D',
      concepto: 'Desplazar una señal bipolar a 0–5 V',
      enunciado: `El convertidor de un microcontrolador solo lee tensiones entre 0 y 5 V, pero la señal va de −1 a +1 V. Diséñalo para que la salida vaya de 1 a 4 V, sin invertirla, usando una fuente de <b>+5 V</b>.`,
      objetivoHTML: `${vo} = 1,5·${v1} + 2,5 V`,
      entradas: [{ nombre: 'v₁', f: Senal.seno(1, 1), texto: 'sen(2π·1 kHz·t) V' }],
      objetivo: puntual(([a]) => 1.5 * a + 2.5),
      tmax: 2,
      piezas: [...CABLES, 'resistencia', 'tierra', 'ao', 'fuente'],
      fuentes: [5],
      par: 6,
      pista: 'Lleva v<sub>1</sub> (por R<sub>a</sub>) y +5 V (por R<sub>b</sub>) al mismo nudo, la patilla +. Después, un no inversor de ganancia G. Necesitas G·R<sub>b</sub>/(R<sub>a</sub>+R<sub>b</sub>) = 1,5 y G·5·R<sub>a</sub>/(R<sub>a</sub>+R<sub>b</sub>) = 2,5.',
      solucion: [
        ['ao', 12, 5, 0, true],
        ['w', [0, 6], [3, 6], [3, 5], [6, 5]], ['R', 6, 5, 0, 10e3],
        ['w', [6, 5], [12, 5]],
        ['R', 9, 4, 1, 30e3], ['w', [9, 5], [9, 4]], ['V', 9, 3, 0, 5],
        ['w', [12, 7], [10, 7], [10, 8]], ['R', 10, 8, 1, 10e3], ['w', [10, 8], [10, 10]], ['gnd', 10, 10],
        ['w', [11, 7], [11, 11], [14, 11]], ['R', 14, 11, 0, 10e3],
        ['w', [14, 11], [16, 11], [16, 6]],
        ['w', [14, 6], [23, 6]]
      ]
    },
    {
      id: 'instrumentacion',
      titulo: 'Medir un puente de sensores',
      concepto: 'Seguidores + restador · impedancia de entrada',
      enunciado: `Las dos ramas de un puente de Wheatstone dan 2,5 V más una pequeña señal en oposición, y cada rama tiene una resistencia de salida de 10 kΩ. Amplifica la <b>diferencia</b> por 10 sin que las resistencias del puente estropeen la ganancia.`,
      objetivoHTML: `${vo} = 10·(${v1} − ${v2})`,
      entradas: [
        { nombre: 'v₁', f: Senal.seno(0.2, 1, 2.5), texto: '2,5 + 0,2·sen(2π·1 kHz·t) V', Rs: 10e3 },
        { nombre: 'v₂', f: Senal.seno(-0.2, 1, 2.5), texto: '2,5 − 0,2·sen(2π·1 kHz·t) V', Rs: 10e3 }
      ],
      objetivo: puntual(([a, b]) => 10 * (a - b)),
      tmax: 2,
      piezas: [...CABLES, 'resistencia', 'tierra', 'ao'],
      par: 7,
      pista: 'Pon un seguidor detrás de cada rama para que el restador no cargue al puente, y luego un restador de ganancia 10 (R<sub>2</sub>/R<sub>1</sub> = 10).',
      solucion: [
        ['ao', 3, 2, 0, true],
        ['w', [0, 3], [1, 3], [1, 2], [3, 2]],
        ['w', [3, 4], [2, 4], [2, 5], [7, 5], [7, 3]],
        ['ao', 3, 8],
        ['w', [0, 9], [1, 9], [1, 10], [3, 10]],
        ['w', [3, 8], [2, 8], [2, 7], [7, 7], [7, 9]],
        ['ao', 14, 5, 0, true],
        ['w', [5, 3], [10, 3]], ['R', 10, 3, 0, 10e3],
        ['w', [10, 3], [12, 3], [12, 5], [14, 5]],
        ['w', [12, 5], [12, 6]], ['R', 12, 6, 1, 100e3], ['w', [12, 6], [12, 8]], ['gnd', 12, 8],
        ['w', [5, 9], [10, 9]], ['R', 10, 9, 0, 10e3],
        ['w', [10, 9], [13, 9], [13, 7], [14, 7]],
        ['w', [13, 9], [13, 11], [15, 11]], ['R', 15, 11, 0, 100e3],
        ['w', [15, 11], [18, 11], [18, 6]],
        ['w', [16, 6], [23, 6]]
      ]
    },
    {
      id: 'integrador',
      titulo: 'Integrador inversor',
      concepto: 'Un condensador en la realimentación',
      enunciado: `Convierte la onda cuadrada en una triangular. Con un condensador en la realimentación, la corriente v<sub>1</sub>/R lo carga a ritmo constante y la salida es una rampa. El producto RC debe valer 1 ms.`,
      objetivoHTML: `${vo} = −(1/1 ms)·∫${v1} dt`,
      entradas: [{ nombre: 'v₁', f: Senal.cuadrada(1, 0.5), texto: 'cuadrada de ±1 V, 500 Hz' }],
      objetivo: (E, t, dt) => {
        const out = new Float64Array(t.length);
        let acc = 0;
        for (let i = 0; i < t.length; i++) { acc -= E[0][i] * dt / 1; out[i] = acc; }
        return out;
      },
      tmax: 4,
      piezas: [...CABLES, 'resistencia', 'condensador', 'tierra', 'ao'],
      par: 3,
      pista: 'Es un inversor con un condensador en lugar de R<sub>2</sub>: v<sub>o</sub> = −(1/RC)∫v<sub>1</sub>dt. Por ejemplo, R = 10 kΩ y C = 100 nF.',
      solucion: [
        ['ao', 10, 5],
        ['gnd', 9, 8],
        ['w', [10, 7], [9, 7], [9, 8]],
        ['R', 5, 5, 0, 10e3],
        ['w', [0, 6], [2, 6], [2, 5], [5, 5]],
        ['w', [5, 5], [10, 5]],
        ['C', 12, 3, 0, 100e-9],
        ['w', [7, 5], [7, 3], [12, 3]],
        ['w', [12, 3], [14, 3], [14, 6]],
        ['w', [12, 6], [23, 6]]
      ]
    }
  ];

  /* ---------- Piezas con parámetros ---------- */
  const ZENER = (vz, extra) => ({ tipo: 'zener', par: Object.assign({ vz }, extra), etiqueta: `Zener ${String(vz).replace('.', ',')} V` });
  const NPN = (beta, extra, nombre) => ({ tipo: 'npn', par: Object.assign({ beta }, extra), etiqueta: nombre || `NPN (β = ${beta})` });
  const PNP = (beta, extra, nombre) => ({ tipo: 'pnp', par: Object.assign({ beta }, extra), etiqueta: nombre || `PNP (β = ${beta})` });
  const NMOS = (par, nombre) => ({ tipo: 'nmos', par, etiqueta: nombre });
  const FUENTE = (V) => ({ tipo: 'fuente', valor: V });
  const vi = 'v<sub>i</sub>', iL = 'I<sub>L</sub>';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- Tema 1 · Diodos ---------- */
  const DIODOS = [
    {
      id: 'mediaonda',
      titulo: 'Rectificador de media onda',
      concepto: 'Modelo de tensión umbral · Vγ = 0,7 V',
      enunciado: `La entrada es una senoidal de 10 V de pico y 50 Hz, y la salida alimenta una carga de 1 kΩ. Deja pasar solo los semiciclos positivos. El diodo conduce cuando su tensión ánodo–cátodo llega a V<sub>γ</sub> = 0,7 V, así que la salida pierde esos 0,7 V.`,
      objetivoHTML: `${vo} = máx(${v1} − 0,7 V, 0)`,
      entradas: [{ nombre: 'v₁', f: Senal.seno(10, 0.05), texto: '10·sen(2π·50 Hz·t) V' }],
      RL: 1e3,
      objetivo: puntual(([a]) => Math.max(a - 0.7, 0)),
      tmax: 40,
      piezas: [...CABLES, 'diodo', 'tierra'],
      pista: 'Un solo diodo en serie entre la entrada y la salida, con el ánodo hacia la entrada. Gira las piezas con R o con el clic derecho.',
      solucion: [
        ['p', 'diodo', 10, 6, 0],
        ['w', [0, 6], [10, 6]],
        ['w', [10, 6], [23, 6]]
      ]
    },
    {
      id: 'puente',
      titulo: 'Rectificador en puente',
      concepto: 'Onda completa · dos diodos en serie',
      enunciado: `Ahora la señal viene del <b>secundario de un transformador</b>, que es una fuente flotante: ninguno de sus dos terminales está a tierra. Con cuatro diodos en puente se aprovechan los dos semiciclos. En cada uno conducen dos diodos en serie, así que la salida pierde 2·V<sub>γ</sub>. La carga R<sub>L</sub> está entre ${vo} y <b>tierra</b>: su corriente vuelve por tierra, así que el puente también tiene que estar unido a tierra para cerrar el circuito.`,
      objetivoHTML: `${vo} = máx(|${v1}| − 1,4 V, 0)`,
      entradas: [{ nombre: 'v₁', tipo: 'flotante', f: Senal.seno(12, 0.05), texto: 'secundario de 12 V de pico, 50 Hz (flotante)' }],
      RL: 1e3,
      objetivo: puntual(([a]) => Math.max(Math.abs(a) - 1.4, 0)),
      tmax: 40,
      piezas: [...CABLES, 'diodo', 'tierra'],
      pista: 'La corriente sale del puente por v<sub>o</sub>, atraviesa R<sub>L</sub> y vuelve por tierra, así que el puente tiene que estar unido a tierra: con una pieza de tierra o con un cable al terminal de 0 V de la salida. Une un terminal del secundario a los diodos D1 (hacia la salida) y D3 (desde tierra), y el otro a D2 y D4 del mismo modo. Los cátodos de D1 y D2 van a la salida; los ánodos de D3 y D4, a tierra. Para cruzar un cable sin unirlo, pasa por encima en línea recta.',
      solucion: [
        ['p', 'diodo', 8, 4, 3], ['p', 'diodo', 8, 8, 3],
        ['p', 'diodo', 10, 4, 3], ['p', 'diodo', 10, 8, 3],
        ['w', [8, 4], [8, 8]], ['w', [10, 4], [10, 8]],
        ['w', [0, 5], [8, 5]],
        ['wx', [0, 7], [10, 7]],
        ['w', [8, 4], [8, 3], [12, 3], [12, 6], [23, 6]],
        ['w', [10, 4], [10, 3]],
        ['w', [8, 8], [8, 9], [10, 9], [10, 8]],
        ['gnd', 9, 10], ['w', [9, 9], [9, 10]]
      ]
    },
    {
      id: 'filtro',
      titulo: 'Filtro con condensador',
      concepto: 'Rizado ΔV ≈ I<sub>L</sub>/(f<sub>r</sub>·C)',
      enunciado: `Partes del puente rectificador. Añade un condensador para que la salida sea casi continua, con un rizado de unos <b>1,06 V</b>. La carga consume I<sub>L</sub> ≈ 10,6 mA y, en onda completa, los pulsos llegan a f<sub>r</sub> = 100 Hz.`,
      objetivoHTML: `${vo} ≈ 10,6 V con ΔV ≈ 1,06 V`,
      entradas: [{ nombre: 'v₁', tipo: 'flotante', f: Senal.seno(12, 0.05), texto: 'secundario de 12 V de pico, 50 Hz (flotante)' }],
      RL: 1e3,
      objetivo: 'solucion',
      ref: 2,
      tmax: 40,
      piezas: [...CABLES, 'diodo', 'condensador', 'tierra'],
      pista: 'ΔV ≈ I<sub>L</sub>/(f<sub>r</sub>·C) ⇒ C ≈ 10,6 mA/(100 Hz · 1,06 V) = 100 µF. El condensador va entre la salida y tierra (escribe «100u» en su valor).',
      inicial: 'puente',
      solucion: 'puente+',
      solucionExtra: [
        ['C', 15, 7, 1, 100e-6], ['w', [15, 6], [15, 7]], ['w', [15, 7], [15, 9]], ['gnd', 15, 9]
      ]
    },
    {
      id: 'recortador',
      titulo: 'Recortador con dos Zener',
      concepto: 'Zener en avalancha + diodo en directa',
      enunciado: `Limita la señal a ±5,4 V sin usar fuentes. Dos Zener de 4,7 V en oposición conducen uno en avalancha y otro en directa, y fijan la salida en V<sub>Z</sub> + V<sub>γ</sub>. Hace falta una resistencia en serie que absorba la diferencia de tensión.`,
      objetivoHTML: `${vo} = ${v1} recortada a ±5,4 V`,
      entradas: [{ nombre: 'v₁', f: Senal.seno(10, 1), texto: '10·sen(2π·1 kHz·t) V' }],
      objetivo: puntual(([a]) => clamp(a, -5.4, 5.4)),
      tmax: 2,
      piezas: [...CABLES, 'resistencia', ZENER(4.7), 'tierra'],
      pista: 'R de 1 kΩ en serie hasta la salida. Desde la salida a tierra, dos Zener en serie enfrentados: cátodo–ánodo–ánodo–cátodo.',
      solucion: [
        ['R', 6, 6, 0, 1e3], ['w', [0, 6], [6, 6]], ['w', [6, 6], [23, 6]],
        ['p', 'zener', 12, 7, 3], ['p', 'zener', 12, 8, 1],
        ['w', [12, 6], [12, 7]], ['w', [12, 8], [12, 10]], ['gnd', 12, 10]
      ]
    },
    {
      id: 'zonamuerta',
      titulo: 'Zona muerta',
      concepto: 'Diodo y Zener en serie con la señal',
      enunciado: `La salida debe quedarse a 0 mientras la entrada no supere 4 V. A partir de ahí debe seguir a la entrada restándole esos 4 V. Las tensiones negativas no deben pasar. Las fuentes de un terminal están referidas a tierra y no sirven en serie: usa un Zener de 3,3 V.`,
      objetivoHTML: `${vo} = máx(${v1} − 4 V, 0)`,
      entradas: [{ nombre: 'v₁', f: Senal.triangular(8, 1), texto: 'triangular de 8 V de pico, 1 kHz' }],
      RL: 1e3,
      objetivo: puntual(([a]) => Math.max(a - 4, 0)),
      tmax: 2,
      piezas: [...CABLES, 'diodo', ZENER(3.3), 'tierra'],
      pista: '4 V = V<sub>Z</sub> + V<sub>γ</sub> = 3,3 + 0,7. Pon en serie un diodo en directa y un Zener en inversa (con el cátodo hacia la entrada).',
      solucion: [
        ['p', 'diodo', 8, 6, 0], ['p', 'zener', 12, 6, 2],
        ['w', [0, 6], [8, 6]], ['w', [8, 6], [12, 6]], ['w', [12, 6], [23, 6]]
      ]
    },
    {
      id: 'reguladorzener',
      titulo: 'Regulador con Zener',
      concepto: 'I<sub>Z</sub> = I<sub>R</sub> − I<sub>L</sub> · potencia del Zener',
      enunciado: `La entrada oscila entre 10 y 14 V y la carga es de 470 Ω. Mantén la salida fija en 5,1 V. Si la resistencia serie es demasiado grande, el Zener se corta con la entrada mínima. Si es demasiado pequeña, el Zener supera su potencia máxima de 0,5 W.`,
      objetivoHTML: `${vo} = 5,1 V`,
      entradas: [{ nombre: 'v₁', f: Senal.seno(2, 1, 12), texto: '12 + 2·sen(2π·1 kHz·t) V' }],
      RL: 470,
      objetivo: puntual(() => 5.1),
      ref: 0.5,
      tmax: 2,
      piezas: [...CABLES, 'resistencia', ZENER(5.1, { pmax: 0.5 }), 'tierra'],
      pista: 'Con 10 V y I<sub>L</sub> = 5,1/470 ≈ 10,9 mA, hace falta (10 − 5,1)/R > 10,9 mA, es decir, R < 450 Ω. Con 14 V, la potencia del Zener debe quedar por debajo de 0,5 W. Prueba R = 220 Ω.',
      solucion: [
        ['R', 8, 6, 0, 220], ['w', [0, 6], [8, 6]], ['w', [8, 6], [23, 6]],
        ['p', 'zener', 14, 7, 3], ['w', [14, 6], [14, 7]], ['w', [14, 7], [14, 9]], ['gnd', 14, 9]
      ]
    }
  ];

  /* ---------- Tema 3 · El transistor en continua ---------- */
  const T1_OBJ = (v) => {
    if (v <= 0.7) return 20;
    const ic = 80 * (v - 0.7) / 20e3;
    return Math.max(20 - 1e3 * ic, 0.2);
  };
  const T5_OBJ = (vg) => {
    if (vg <= 3) return 20;
    const I = 0.025 * (vg - 3) ** 2, vds = 20 - 200 * I;
    return vds >= I * 0.1 ? vds : 20 * 0.1 / 200.1;
  };
  const CONTINUA = [
    {
      id: 'ec',
      titulo: 'Corte, activa y saturación',
      concepto: 'Emisor común · I<sub>C</sub> = β·I<sub>B</sub>',
      enunciado: `Monta un emisor común con R<sub>C</sub> = 1 kΩ, alimentado a 20 V, y mide en la salida la tensión de colector. Elige R<sub>B</sub> para que el transistor (β = 80) pase de corte a activa con v<sub>1</sub> = 0,7 V y llegue a saturación con v<sub>1</sub> ≈ 5,65 V.`,
      objetivoHTML: `${vo} = V<sub>CE</sub>(${v1})`,
      entradas: [{ nombre: 'v₁', f: Senal.rampa(8, 0.5), texto: 'rampa de 0 a 8 V y vuelta, 500 Hz' }],
      objetivo: puntual(([a]) => T1_OBJ(a)),
      tmax: 2,
      piezas: [...CABLES, 'resistencia', NPN(80), FUENTE(20), 'tierra'],
      pista: 'En saturación I<sub>C</sub> = (20 − 0,2)/1 kΩ = 19,8 mA, así que I<sub>B</sub> = 19,8/80 ≈ 0,25 mA. Con v<sub>1</sub> = 5,65 V: R<sub>B</sub> = (5,65 − 0,7)/0,25 mA ≈ 20 kΩ.',
      solucion: [
        ['p', 'npn', 12, 7, 0],
        ['w', [0, 6], [3, 6], [3, 7], [6, 7]], ['R', 6, 7, 0, 20e3], ['w', [6, 7], [12, 7]],
        ['R', 12, 4, 1, 1e3], ['w', [12, 7], [12, 4]], ['V', 12, 3, 0, 20],
        ['w', [12, 6], [23, 6]],
        ['w', [12, 7], [12, 9]], ['gnd', 12, 9]
      ]
    },
    {
      id: 'seguidoremisor',
      titulo: 'Seguidor de emisor',
      concepto: 'Colector común · ganancia de corriente β + 1',
      enunciado: `La señal no puede dar más de <b>1 mA</b> y la carga es de 100 Ω: unida directamente necesitaría hasta 80 mA. Usa un transistor (β = 100) como seguidor de emisor, con el colector a 12 V. La salida reproduce la entrada menos V<sub>BE</sub>.`,
      objetivoHTML: `${vo} = ${v1} − 0,7 V`,
      entradas: [{ nombre: 'v₁', f: Senal.seno(3, 1, 5), texto: '5 + 3·sen(2π·1 kHz·t) V', imax: 1e-3 }],
      RL: 100,
      objetivo: puntual(([a]) => a - 0.7),
      tmax: 2,
      piezas: [...CABLES, 'resistencia', NPN(100), FUENTE(12), 'tierra'],
      pista: 'Base a la entrada, colector a +12 V y emisor a la salida. La corriente de base es (β + 1) veces menor que la de la carga.',
      solucion: [
        ['p', 'npn', 12, 6, 0],
        ['w', [0, 6], [12, 6]],
        ['V', 12, 4, 0, 12], ['w', [12, 6], [12, 4]],
        ['w', [12, 6], [12, 7], [16, 7], [16, 6], [23, 6]]
      ]
    },
    {
      id: 'reguladorlineal',
      titulo: 'Regulador lineal',
      concepto: 'Zener de referencia + seguidor de emisor',
      enunciado: `La entrada varía entre 10 y 14 V y la carga es de 50 Ω (unos 100 mA). Obtén una tensión fija de 4,9 V con un Zener comercial de 5,6 V. Un Zener solo tendría que dar toda la corriente de la carga. Si fija la base de un seguidor de emisor, solo tiene que dar la corriente de base.`,
      objetivoHTML: `${vo} = V<sub>Z</sub> − V<sub>BE</sub> = 4,9 V`,
      entradas: [{ nombre: 'v₁', f: Senal.seno(2, 1, 12), texto: '12 + 2·sen(2π·1 kHz·t) V' }],
      RL: 50,
      objetivo: puntual(() => 4.9),
      ref: 0.3,
      tmax: 2,
      piezas: [...CABLES, 'resistencia', ZENER(5.6), NPN(100), 'tierra'],
      pista: 'V<sub>s</sub> = V<sub>Z</sub> − 0,7 = 5,6 − 0,7 = 4,9 V. El colector va a la entrada y la base al Zener, que se polariza desde la entrada con una resistencia de 1 kΩ: así le llega más corriente que la de base (≈ 1 mA).',
      solucion: [
        ['p', 'npn', 12, 6, 0],
        ['w', [0, 6], [2, 6], [2, 3], [12, 3], [12, 6]],
        ['R', 6, 4, 1, 1e3], ['w', [6, 3], [6, 4]], ['w', [6, 4], [6, 6], [12, 6]],
        ['p', 'zener', 9, 7, 3], ['w', [9, 6], [9, 7]], ['w', [9, 7], [9, 9]], ['gnd', 9, 9],
        ['w', [12, 6], [12, 7], [16, 7], [16, 6], [23, 6]]
      ]
    },
    {
      id: 'fuentecorriente',
      titulo: 'Fuente de corriente',
      concepto: 'I<sub>E</sub> = (V<sub>Z</sub> − 0,7)/R<sub>E</sub>',
      enunciado: `Alimenta un LED con <b>10 mA constantes</b> aunque la alimentación varíe entre 9 y 15 V. Un Zener de 2,7 V fija la base y la resistencia de emisor fija la corriente. El LED va en el colector, entre la alimentación y el transistor. Es un diseño: puedes usar valores normalizados, basta con quedar a menos de un 12 % del objetivo.`,
      objetivoHTML: `I<sub>LED</sub> = 10 mA (±12 %)`,
      entradas: [{ nombre: 'v₁', f: Senal.seno(3, 1, 12), texto: '12 + 3·sen(2π·1 kHz·t) V' }],
      sinSalida: true,
      medida: { tipo: 'i', de: 'led', nombre: 'I<sub>LED</sub>' },
      objetivo: puntual(() => 10),
      umbral: 0.88,
      tmax: 2,
      piezas: [...CABLES, 'resistencia', ZENER(2.7), NPN(100), 'led', 'tierra'],
      pista: 'R<sub>E</sub> = (2,7 − 0,7)/10 mA = 200 Ω (serie E24). En la E12, 180 Ω o 220 Ω dan 11,1 o 9,1 mA, dentro de la tolerancia. Polariza el Zener desde la entrada con 1 kΩ.',
      solucion: [
        ['w', [0, 6], [2, 6], [2, 3], [12, 3]],
        ['p', 'led', 12, 4, 1], ['w', [12, 3], [12, 4]], ['w', [12, 4], [12, 6]],
        ['p', 'npn', 12, 6, 0],
        ['w', [12, 6], [12, 8]], ['R', 12, 8, 1, 200], ['w', [12, 8], [12, 10]], ['gnd', 12, 10],
        ['R', 6, 4, 1, 1e3], ['w', [6, 3], [6, 4]], ['w', [6, 4], [6, 6], [12, 6]],
        ['p', 'zener', 9, 7, 3], ['w', [9, 6], [9, 7]], ['w', [9, 7], [9, 9]], ['gnd', 9, 9]
      ]
    },
    {
      id: 'mostransf',
      titulo: 'MOSFET: transferencia',
      concepto: 'I<sub>DS</sub> = k(V<sub>GS</sub> − V<sub>TH</sub>)²',
      enunciado: `El MOSFET tiene V<sub>TH</sub> = 3 V y k = 25 mA/V². Con la fuente a tierra y alimentado a 20 V a través de R<sub>D</sub>, la salida es V<sub>DS</sub>. Elige R<sub>D</sub> para que el MOSFET entre en zona óhmica (V<sub>DS</sub> ≈ 0) justo con v<sub>1</sub> = 5 V.`,
      objetivoHTML: `${vo} = V<sub>DS</sub>(${v1})`,
      entradas: [{ nombre: 'v₁', f: Senal.rampa(8, 0.5), texto: 'rampa de 0 a 8 V y vuelta, 500 Hz' }],
      objetivo: puntual(([a]) => T5_OBJ(a)),
      tmax: 2,
      piezas: [...CABLES, 'resistencia', NMOS({ vth: 3, k: 0.025, ron: 0.1, vdss: 60 }, 'MOSFET N (VTH = 3 V)'), FUENTE(20), 'tierra'],
      pista: 'Con v<sub>1</sub> = 5 V, I<sub>DS</sub> = 25·(5 − 3)² = 100 mA. Para que en ese punto V<sub>DS</sub> llegue a 0: R<sub>D</sub> = 20 V/100 mA = 200 Ω.',
      solucion: [
        ['p', 'nmos', 12, 7, 0],
        ['w', [0, 6], [3, 6], [3, 7], [12, 7]],
        ['R', 12, 4, 1, 200], ['w', [12, 7], [12, 4]], ['V', 12, 3, 0, 20],
        ['w', [12, 6], [23, 6]],
        ['w', [12, 7], [12, 9]], ['gnd', 12, 9]
      ]
    }
  ];

  /* ---------- Tema 4 · El transistor en conmutación ---------- */
  const UC = (f, imax, D) => ({ nombre: 'µC', tipo: 'digital', f: Senal.pulsos(5, f, D || 0.5), texto: `salida digital de 0/5 V, ${f * 1000} Hz` + (D && D !== 0.5 ? `, ciclo de trabajo ${D * 100} %` : ''), imax });
  const CONMUTACION = [
    {
      id: 'led',
      titulo: 'Encender un LED',
      concepto: 'R = (V<sub>OH</sub> − V<sub>LED</sub>)/I<sub>LED</sub>',
      enunciado: `Una salida del microcontrolador da 5 V a nivel alto y como máximo 20 mA. Enciende un LED rojo (V<sub>γ</sub> = 2 V) con <b>10 mA</b> cada vez que la salida está a 1. Sin resistencia, la corriente no tendría límite. Usa una resistencia normalizada: basta con quedar a menos de un 12 % de 10 mA.`,
      objetivoHTML: `I<sub>LED</sub> = 10 mA (±12 %) con la salida a 1`,
      entradas: [UC(1, 0.02)],
      sinSalida: true,
      medida: { tipo: 'i', de: 'led', nombre: 'I<sub>LED</sub>' },
      objetivo: puntual(([a]) => a > 2.5 ? 10 : 0),
      umbral: 0.88,
      tmax: 2,
      conmutacion: true,
      piezas: [...CABLES, 'resistencia', 'led', 'tierra'],
      pista: 'R = (5 − 2) V / 10 mA = 300 Ω. Normalizada a la E12: 270 Ω (11,1 mA) o 330 Ω (9,1 mA). En serie con el LED, y el cátodo del LED a tierra.',
      solucion: [
        ['R', 6, 6, 0, 300], ['w', [0, 6], [6, 6]],
        ['p', 'led', 10, 6, 0], ['w', [6, 6], [10, 6]],
        ['w', [10, 6], [12, 6], [12, 8]], ['gnd', 12, 8]
      ]
    },
    {
      id: 'rele',
      titulo: 'Relé con un NPN',
      concepto: 'Lado bajo · ganancia forzada · diodo volante',
      enunciado: `El µC (máximo <b>10 mA</b>) debe activar un relé de 12 V cuya bobina tiene 240 Ω. Usa un NPN BC547 (β = 110, V<sub>CEO</sub> = 45 V) en el lado bajo. La bobina es una carga inductiva: al cortar la corriente genera una sobretensión que puede romper el transistor.`,
      objetivoHTML: `I<sub>bobina</sub> ≈ 49 mA con la salida a 1`,
      entradas: [UC(0.5, 0.01)],
      sinSalida: true,
      medida: { tipo: 'i', de: 'bobina', nombre: 'I<sub>bobina</sub>' },
      objetivo: 'solucion',
      tmax: 4,
      conmutacion: true,
      piezas: [...CABLES, 'resistencia', 'diodo', NPN(110, { vceo: 45 }, 'NPN BC547'), FUENTE(12), 'bobina', 'tierra'],
      pista: 'I<sub>C</sub> = (12 − 0,2)/240 ≈ 49 mA. Con ganancia forzada 10, I<sub>B</sub> ≈ 5 mA ⇒ R<sub>B</sub> = (5 − 0,7)/5 mA ≈ 820 Ω. Pon un diodo en antiparalelo con la bobina: el cátodo hacia +12 V.',
      solucion: [
        ['p', 'npn', 12, 7, 0],
        ['w', [0, 6], [3, 6], [3, 7], [6, 7]], ['R', 6, 7, 0, 820], ['w', [6, 7], [12, 7]],
        ['w', [12, 7], [12, 9]], ['gnd', 12, 9],
        ['p', 'bobina', 12, 4, 1], ['w', [12, 7], [12, 4]],
        ['V', 12, 1, 0, 12], ['w', [12, 1], [12, 4]],
        ['p', 'diodo', 14, 4, 3], ['w', [12, 3], [14, 3], [14, 4]], ['w', [14, 4], [14, 5], [12, 5]]
      ]
    },
    {
      id: 'motor',
      titulo: 'Motor con un MOSFET',
      concepto: 'MOSFET de nivel lógico · zona óhmica',
      enunciado: `Gobierna con PWM un motor de 12 V que consume 1 A (12 Ω). Tienes dos MOSFET: el <b>IRF530</b> (V<sub>TH</sub> = 4 V) y el <b>IRL530</b>, de nivel lógico (V<sub>TH</sub> = 1,5 V). Con los 5 V del µC en la puerta, solo uno llega a zona óhmica. El otro se queda en activa, limita la corriente y se calienta. Además, el motor es una carga inductiva: al cortar su corriente genera una sobretensión.`,
      objetivoHTML: `I<sub>motor</sub> ≈ 1 A con la salida a 1`,
      entradas: [UC(1, 0.02, 0.3)],
      sinSalida: true,
      medida: { tipo: 'i', de: 'motor', nombre: 'I<sub>motor</sub>' },
      objetivo: 'solucion',
      tmax: 3,
      conmutacion: true,
      piezas: [...CABLES, 'resistencia', NMOS({ vth: 4, k: 0.25, ron: 0.16, vdss: 100 }, 'IRF530'), NMOS({ vth: 1.5, k: 1, ron: 0.16, vdss: 100 }, 'IRL530 (nivel lógico)'), FUENTE(12), 'motor', 'diodo', 'tierra'],
      pista: 'Con V<sub>GS</sub> = 5 V, el IRF530 solo puede conducir k(5 − 4)² = 0,25 A. El IRL530 podría conducir 12 A, así que queda en zona óhmica con la corriente que fija el motor. Motor entre +12 V y el drenador; fuente a tierra; y un diodo en antiparalelo con el motor (cátodo hacia +12 V).',
      solucion: [
        ['p', 'nmos', 12, 7, 0, { etiqueta: 'IRL530 (nivel lógico)' }],
        ['w', [0, 6], [3, 6], [3, 7], [12, 7]],
        ['w', [12, 7], [12, 9]], ['gnd', 12, 9],
        ['p', 'motor', 12, 4, 1], ['w', [12, 7], [12, 4]],
        ['V', 12, 1, 0, 12], ['w', [12, 1], [12, 4]],
        ['p', 'diodo', 14, 4, 3], ['w', [12, 3], [14, 3], [14, 4]], ['w', [14, 4], [14, 5], [12, 5]]
      ]
    },
    {
      id: 'ladoalto',
      titulo: 'Lado alto con PNP',
      concepto: 'PNP en el positivo + NPN excitador',
      enunciado: `Una lámpara de 24 V y 48 Ω tiene un terminal a tierra, así que el interruptor va en el positivo: un PNP (β = 50) con el emisor a 24 V. El µC (máximo <b>10 mA</b>) no puede llevar esa base a 23,3 V. Un NPN excitador (β = 100) tirará de ella hacia tierra. Asegura también el corte cuando el excitador no conduce.`,
      objetivoHTML: `I<sub>lámpara</sub> ≈ 0,5 A con la salida a 1`,
      entradas: [UC(0.5, 0.01)],
      sinSalida: true,
      medida: { tipo: 'i', de: 'lampara', nombre: 'I<sub>lámpara</sub>' },
      objetivo: puntual(([a]) => a > 2.5 ? 1e3 * (24 - 0.2) / 48 : 0),
      tmax: 4,
      conmutacion: true,
      piezas: [...CABLES, 'resistencia', PNP(50), NPN(100), FUENTE(24), 'lampara', 'tierra'],
      pista: 'Q1 necesita I<sub>B1</sub> > 0,5/50 = 10 mA: con R<sub>C</sub> = 1 kΩ desde su base al colector de Q2 llegan unos 23 mA. R<sub>EB</sub> = 1 kΩ entre base y emisor de Q1 asegura el corte. Para Q2, R<sub>B</sub> = 4,7 kΩ da ≈ 0,9 mA de base.',
      solucion: [
        ['V', 14, 1, 0, 24], ['p', 'pnp', 14, 4, 0], ['w', [14, 1], [14, 4]],
        ['p', 'lampara', 14, 6, 1], ['w', [14, 4], [14, 6]], ['w', [14, 6], [14, 8]], ['gnd', 14, 8],
        ['w', [14, 4], [12, 4]], ['R', 12, 4, 0, 1e3],
        ['R', 13, 3, 1, 1e3], ['w', [13, 3], [13, 2], [14, 2]], ['w', [13, 3], [13, 4]],
        ['w', [12, 4], [10, 4], [10, 6]], ['p', 'npn', 10, 6, 0],
        ['w', [10, 6], [10, 8]], ['gnd', 10, 8],
        ['R', 6, 6, 0, 4.7e3], ['w', [0, 6], [6, 6]], ['w', [6, 6], [10, 6]]
      ]
    }
  ];

  /* ---------- Tema 7 · El AO: aplicaciones no lineales ---------- */
  const SCHMITT_ENT = (t) => 5 * Math.sin(PI2 * 0.5 * t) + 1.2 * Math.sin(PI2 * 11 * t);
  const SCHMITT_OBJ = (E, t) => {
    const out = new Float64Array(t.length);
    let s = 12;
    for (let i = 0; i < t.length; i++) {
      const v = E[0][i];
      if (s > 0 && v > 3) s = -12;
      else if (s < 0 && v < -3) s = 12;
      out[i] = s;
    }
    return out;
  };
  /* Puntuación por periodo (oscilador): se compara la duración media de los ciclos. */
  const puntuarPeriodo = (salida, obj, t) => {
    const periodo = (y) => {
      const subidas = [];
      for (let i = 1; i < y.length; i++) if (y[i - 1] < 0 && y[i] >= 0) subidas.push(t[i]);
      if (subidas.length < 2) return null;
      return (subidas[subidas.length - 1] - subidas[0]) / (subidas.length - 1);
    };
    const T0 = periodo(obj), T = periodo(salida);
    if (!T0 || !T) return { err: NaN, coincidencia: 0 };
    let amp = 0;
    for (const v of salida) amp = Math.max(amp, Math.abs(v));
    const c = Math.max(0, 1 - Math.abs(T - T0) / T0) * Math.min(1, amp / 11);
    return { err: Math.abs(T - T0), coincidencia: c, periodo: T, periodo0: T0 };
  };
  const AO_NO_LINEAL = [
    {
      id: 'comparador',
      titulo: 'Comparador',
      concepto: 'Bucle abierto · la salida siempre saturada',
      enunciado: `Sin realimentación, el AO compara sus dos entradas y su salida se va a +V<sub>sat</sub> o a −V<sub>sat</sub>. Haz que la salida esté a +12 V cuando la entrada supere <b>2 V</b>. Solo tienes una fuente de +5 V para fijar la referencia.`,
      objetivoHTML: `${vo} = +12 V si ${v1} > 2 V; −12 V si no`,
      entradas: [{ nombre: 'v₁', f: Senal.seno(4, 1), texto: '4·sen(2π·1 kHz·t) V' }],
      objetivo: puntual(([a]) => a > 2 ? 12 : -12),
      tmax: 2,
      aoNoLineal: true,
      piezas: [...CABLES, 'resistencia', 'ao', FUENTE(5), 'tierra'],
      pista: 'La señal va a la entrada + y la referencia a la −. Un divisor de 3 kΩ y 2 kΩ desde +5 V da 2 V.',
      solucion: [
        ['ao', 12, 5, 0, true],
        ['w', [0, 6], [3, 6], [3, 5], [12, 5]],
        ['V', 7, 7, 3, 5], ['R', 8, 7, 0, 3e3], ['w', [8, 7], [12, 7]],
        ['R', 10, 8, 1, 2e3], ['w', [10, 7], [10, 8]], ['w', [10, 8], [10, 10]], ['gnd', 10, 10],
        ['w', [14, 6], [23, 6]]
      ]
    },
    {
      id: 'schmitt',
      titulo: 'Disparador de Schmitt',
      concepto: 'Realimentación positiva · histéresis',
      enunciado: `La entrada trae ruido: un comparador simple conmutaría varias veces en cada cruce. Con realimentación positiva hay dos umbrales. Diseña un comparador <b>inversor</b> con umbrales de ±3 V, de modo que la salida pase a −12 V al superar +3 V y vuelva a +12 V al bajar de −3 V.`,
      objetivoHTML: `umbrales ±3 V · ${vo} = ±12 V`,
      entradas: [{ nombre: 'v₁', f: SCHMITT_ENT, texto: '5·sen(2π·500 Hz·t) + ruido de 1,2 V' }],
      objetivo: SCHMITT_OBJ,
      tmax: 4,
      aoNoLineal: true,
      piezas: [...CABLES, 'resistencia', 'ao', 'tierra'],
      pista: 'La señal va a la entrada −. La + recibe una fracción de la salida: v<sup>+</sup> = ±12·R<sub>1</sub>/(R<sub>1</sub> + R<sub>2</sub>) = ±3 V ⇒ R<sub>2</sub> = 3·R<sub>1</sub> (R<sub>1</sub> a tierra, R<sub>2</sub> a la salida).',
      solucion: [
        ['ao', 12, 5],
        ['w', [0, 6], [3, 6], [3, 5], [12, 5]],
        ['w', [12, 7], [10, 7], [10, 8]], ['R', 10, 8, 1, 10e3], ['w', [10, 8], [10, 10]], ['gnd', 10, 10],
        ['w', [11, 7], [11, 11], [14, 11]], ['R', 14, 11, 0, 30e3],
        ['w', [14, 11], [16, 11], [16, 6]],
        ['w', [14, 6], [23, 6]]
      ]
    },
    {
      id: 'precision',
      titulo: 'Rectificador de precisión',
      concepto: 'El AO compensa la caída del diodo',
      enunciado: `La señal es de solo 0,5 V de pico: un diodo solo no la rectificaría, porque necesita 0,7 V para conducir. Mete el diodo dentro del lazo de realimentación de un AO. El AO sube su salida lo necesario para que el diodo conduzca.`,
      objetivoHTML: `${vo} = máx(${v1}, 0)`,
      entradas: [{ nombre: 'v₁', f: Senal.seno(0.5, 1), texto: '0,5·sen(2π·1 kHz·t) V' }],
      RL: 10e3,
      objetivo: puntual(([a]) => Math.max(a, 0)),
      tmax: 2,
      aoNoLineal: true,
      piezas: [...CABLES, 'resistencia', 'diodo', 'ao', 'tierra'],
      pista: 'Entrada a la patilla +, salida del AO al ánodo del diodo y realimentación desde el cátodo (la salida v<sub>o</sub>) a la patilla −.',
      solucion: [
        ['ao', 10, 5, 0, true],
        ['w', [0, 6], [3, 6], [3, 5], [10, 5]],
        ['p', 'diodo', 14, 6, 0], ['w', [12, 6], [14, 6]], ['w', [14, 6], [23, 6]],
        ['w', [16, 6], [16, 9], [9, 9], [9, 7], [10, 7]]
      ]
    },
    {
      id: 'limitador',
      titulo: 'Limitador inversor',
      concepto: 'Zener en la realimentación del inversor',
      enunciado: `Amplifica por −5, pero sin que la salida pase de ±5,4 V. Dos Zener de 4,7 V en oposición, en paralelo con la resistencia de realimentación, no conducen mientras |v<sub>o</sub>| < V<sub>Z</sub> + V<sub>γ</sub>. Cuando se alcanza ese valor, fijan la salida.`,
      objetivoHTML: `${vo} = −5·${v1}, limitada a ±5,4 V`,
      entradas: [{ nombre: 'v₁', f: Senal.seno(2, 1), texto: '2·sen(2π·1 kHz·t) V' }],
      objetivo: puntual(([a]) => clamp(-5 * a, -5.4, 5.4)),
      tmax: 2,
      aoNoLineal: true,
      piezas: [...CABLES, 'resistencia', ZENER(4.7), 'ao', 'tierra'],
      pista: 'Inversor con R<sub>1</sub> = 2 kΩ y R<sub>2</sub> = 10 kΩ. En paralelo con R<sub>2</sub>, dos Zener en serie enfrentados (cátodo–ánodo–ánodo–cátodo).',
      solucion: [
        ['ao', 10, 5],
        ['gnd', 9, 8], ['w', [10, 7], [9, 7], [9, 8]],
        ['R', 5, 5, 0, 2e3], ['w', [0, 6], [2, 6], [2, 5], [5, 5]], ['w', [5, 5], [10, 5]],
        ['R', 12, 3, 0, 10e3], ['w', [7, 5], [7, 3], [12, 3]], ['w', [12, 3], [14, 3], [14, 6]],
        ['w', [12, 6], [23, 6]],
        ['p', 'zener', 11, 1, 2], ['p', 'zener', 12, 1, 0],
        ['w', [7, 3], [7, 1], [11, 1]], ['w', [12, 1], [14, 1], [14, 3]]
      ]
    },
    {
      id: 'limitadornoinv',
      titulo: 'Limitador no inversor',
      concepto: 'Zener en la entrada + del no inversor',
      enunciado: `Amplifica por +2, pero sin que la salida pase de ±10,8 V. Aquí los Zener no van en la realimentación: dos Zener de 4,7 V en oposición, de la entrada + a tierra, limitan v<sup>+</sup> a ±(V<sub>Z</sub> + V<sub>γ</sub>) = ±5,4 V. Una resistencia en serie con la señal absorbe el resto, y después el no inversor amplifica.`,
      objetivoHTML: `${vo} = 2·${v1}, limitada a ±10,8 V`,
      entradas: [{ nombre: 'v₁', f: Senal.seno(8, 1), texto: '8·sen(2π·1 kHz·t) V' }],
      objetivo: puntual(([a]) => 2 * clamp(a, -5.4, 5.4)),
      tmax: 2,
      aoNoLineal: true,
      piezas: [...CABLES, 'resistencia', ZENER(4.7), 'ao', 'tierra'],
      pista: 'Resistencia de 1 kΩ entre la entrada y la patilla +. De la patilla + a tierra, dos Zener en serie enfrentados (cátodo–ánodo–ánodo–cátodo). No inversor de ganancia 1 + R<sub>2</sub>/R<sub>1</sub> = 2: R<sub>1</sub> = R<sub>2</sub> = 10 kΩ (R<sub>1</sub> de la patilla − a tierra y R<sub>2</sub> a la salida).',
      solucion: [
        ['ao', 12, 5, 0, true],
        ['R', 6, 5, 0, 1e3], ['w', [0, 6], [2, 6], [2, 5], [6, 5]], ['w', [6, 5], [12, 5]],
        ['p', 'zener', 9, 6, 3], ['p', 'zener', 9, 7, 1],
        ['w', [9, 5], [9, 6]], ['w', [9, 7], [9, 9]], ['gnd', 9, 9],
        ['w', [12, 7], [10, 7], [10, 8]], ['R', 10, 8, 1, 10e3], ['w', [10, 8], [10, 10]], ['gnd', 10, 10],
        ['w', [11, 7], [11, 11], [14, 11]], ['R', 14, 11, 0, 10e3],
        ['w', [14, 11], [16, 11], [16, 6]],
        ['w', [14, 6], [23, 6]]
      ]
    },
    {
      id: 'zonamuertanoinv',
      titulo: 'Zona muerta no inversora',
      concepto: 'Zener en serie con la entrada + del no inversor',
      enunciado: `La salida debe ser nula mientras |v<sub>1</sub>| < 5 V. Fuera de esa zona, los Zener restan 5 V a la entrada y el no inversor amplifica el resto. Elige la ganancia para que v<sub>o</sub> = 10 V cuando v<sub>1</sub> = 10 V. Dos Zener de 4,3 V en serie y opuestos solo conducen cuando su tensión supera V<sub>Z</sub> + V<sub>γ</sub> = 5 V.`,
      objetivoHTML: `${vo} = 2·(${v1} ∓ 5 V) si |${v1}| > 5 V; 0 si no`,
      entradas: [{ nombre: 'v₁', f: Senal.triangular(10, 1), texto: 'triangular de 10 V de pico, 1 kHz' }],
      objetivo: puntual(([a]) => Math.abs(a) > 5 ? 2 * (a - Math.sign(a) * 5) : 0),
      tmax: 2,
      aoNoLineal: true,
      piezas: [...CABLES, 'resistencia', ZENER(4.3), 'ao', 'tierra'],
      pista: 'Los dos Zener en serie y enfrentados (ánodo–cátodo–cátodo–ánodo) entre la entrada y la patilla +, y una resistencia de 10 kΩ de la patilla + a tierra: sin ella, con los Zener cortados la entrada + quedaría al aire. 10 = (1 + R<sub>2</sub>/R<sub>1</sub>)(10 − 5) ⇒ R<sub>2</sub> = R<sub>1</sub> = 10 kΩ.',
      solucion: [
        ['ao', 12, 5, 0, true],
        ['w', [0, 6], [2, 6], [2, 5], [5, 5]],
        ['p', 'zener', 5, 5, 0], ['p', 'zener', 6, 5, 2], ['w', [6, 5], [12, 5]],
        ['w', [9, 5], [9, 6]], ['R', 9, 6, 1, 10e3], ['w', [9, 6], [9, 8]], ['gnd', 9, 8],
        ['w', [12, 7], [10, 7], [10, 8]], ['R', 10, 8, 1, 10e3], ['w', [10, 8], [10, 10]], ['gnd', 10, 10],
        ['w', [11, 7], [11, 11], [14, 11]], ['R', 14, 11, 0, 10e3],
        ['w', [14, 11], [16, 11], [16, 6]],
        ['w', [14, 6], [23, 6]]
      ]
    },
    {
      id: 'zonamuertainv',
      titulo: 'Zona muerta inversora',
      concepto: 'Zener en serie con R<sub>1</sub> hacia la masa virtual',
      enunciado: `La salida debe ser nula mientras |v<sub>1</sub>| < 4 V y, fuera de esa zona, valer −1,5·(v<sub>1</sub> ∓ 4 V). Pon dos Zener de 3,3 V en serie y opuestos delante de la R<sub>1</sub> de un inversor. Mientras no conducen no llega corriente a la masa virtual y la salida es nula. Cuando conducen, restan V<sub>Z</sub> + V<sub>γ</sub> a la entrada.`,
      objetivoHTML: `${vo} = −1,5·(${v1} ∓ 4 V) si |${v1}| > 4 V; 0 si no`,
      entradas: [{ nombre: 'v₁', f: Senal.triangular(10, 1), texto: 'triangular de 10 V de pico, 1 kHz' }],
      objetivo: puntual(([a]) => Math.abs(a) > 4 ? -1.5 * (a - Math.sign(a) * 4) : 0),
      tmax: 2,
      aoNoLineal: true,
      piezas: [...CABLES, 'resistencia', ZENER(3.3), 'ao', 'tierra'],
      pista: 'V<sub>Z</sub> + V<sub>γ</sub> = 3,3 + 0,7 = 4 V. Entrada, Zener enfrentados (ánodo–cátodo–cátodo–ánodo) y R<sub>1</sub> = 10 kΩ en serie hasta la patilla −. R<sub>2</sub>/R<sub>1</sub> = 1,5 ⇒ R<sub>2</sub> = 15 kΩ de la patilla − a la salida. La patilla +, a tierra.',
      solucion: [
        ['ao', 12, 5],
        ['w', [0, 6], [2, 6], [2, 5], [4, 5]],
        ['p', 'zener', 4, 5, 0], ['p', 'zener', 5, 5, 2], ['w', [5, 5], [8, 5]],
        ['R', 8, 5, 0, 10e3], ['w', [8, 5], [12, 5]],
        ['w', [10, 5], [10, 3], [13, 3]], ['R', 13, 3, 0, 15e3], ['w', [13, 3], [16, 3], [16, 6]],
        ['w', [12, 7], [11, 7], [11, 8]], ['gnd', 11, 8],
        ['w', [14, 6], [23, 6]]
      ]
    },
    {
      id: 'astable',
      titulo: 'Multivibrador astable',
      concepto: 'Oscilador: Schmitt + red RC',
      enunciado: `Sin ninguna señal de entrada, genera una onda cuadrada de ±12 V con un <b>periodo de 2 ms</b>. Es un Schmitt inversor cuya entrada es la tensión de un condensador que se carga desde la propia salida a través de R. Se puntúa el periodo de la oscilación.`,
      objetivoHTML: `T = 2RC·ln(1 + 2R<sub>1</sub>/R<sub>2</sub>) = 2 ms`,
      entradas: [],
      objetivo: 'solucion',
      puntuar: puntuarPeriodo,
      tmax: 8,
      aoNoLineal: true,
      piezas: [...CABLES, 'resistencia', 'condensador', 'ao', 'tierra'],
      pista: 'Con R<sub>1</sub> = R<sub>2</sub>, T = 2RC·ln 3 ≈ 2,2·RC ⇒ RC = 0,91 ms: por ejemplo C = 100 nF y R = 9,1 kΩ. El condensador va de la patilla − a tierra; R, de la salida a la patilla −.',
      solucion: [
        ['ao', 12, 5],
        ['w', [12, 7], [10, 7], [10, 8]], ['R', 10, 8, 1, 10e3], ['w', [10, 8], [10, 10]], ['gnd', 10, 10],
        ['w', [11, 7], [11, 11], [14, 11]], ['R', 14, 11, 0, 10e3],
        ['w', [14, 11], [16, 11], [16, 6]],
        ['w', [14, 6], [23, 6]],
        ['w', [12, 5], [9, 5], [9, 6]], ['C', 9, 6, 1, 100e-9], ['w', [9, 6], [9, 8]], ['gnd', 9, 8],
        ['w', [10, 5], [10, 3], [12, 3]], ['R', 12, 3, 0, 9.1e3], ['w', [12, 3], [15, 3], [15, 6]]
      ]
    }
  ];

  const TEMAS = [
    { num: 1, id: 'diodos', nombre: 'Diodos', niveles: DIODOS },
    { num: 3, id: 'continua', nombre: 'El transistor en continua', niveles: CONTINUA },
    { num: 4, id: 'conmutacion', nombre: 'El transistor en conmutación', niveles: CONMUTACION },
    { num: 6, id: 'aolineal', nombre: 'El AO: aplicaciones lineales', niveles: AO_LINEAL },
    { num: 7, id: 'aonolineal', nombre: 'El AO: aplicaciones no lineales', niveles: AO_NO_LINEAL }
  ];

  // Nivel libre: entradas y objetivo configurables
  const LIBRE = {
    id: 'libre',
    titulo: 'Laboratorio libre',
    concepto: 'Elige las señales y la función objetivo',
    libre: true,
    enunciado: 'Configura las entradas y escribe la función objetivo. Puedes usar v1, v2, t (en ms) y funciones como sin, cos, abs, sqrt, min, max. Los parámetros de los dispositivos se pueden cambiar.',
    config: {
      entradas: [
        { forma: 'seno', A: 1, f: 1, off: 0 },
        { forma: 'cuadrada', A: 1, f: 0.5, off: 0 }
      ],
      expr: '-(v1 + 2*v2)'
    },
    tmax: 4,
    piezas: [...CABLES, 'resistencia', 'condensador', 'tierra', 'fuente', 'diodo', 'zener', 'led', 'npn', 'pnp', 'nmos', 'pmos', 'lampara', 'motor', 'bobina', 'ao'],
    fuentes: 'libre'
  };

  /* Prepara el nivel libre a partir de su configuración. */
  function prepararLibre(nv) {
    nv.entradas = nv.config.entradas.map((e, k) => {
      const f = Senal[e.forma](e.A, e.f, e.off);
      const nombres = { seno: 'senoidal', cuadrada: 'cuadrada', triangular: 'triangular', diente: 'diente de sierra', continua: 'continua' };
      const texto = e.forma === 'continua' ? `${e.A} V (continua)`
        : `${nombres[e.forma]} de ${e.A} V de pico, ${e.f * 1000} Hz` + (e.off ? `, offset ${e.off} V` : '');
      return { nombre: k ? 'v₂' : 'v₁', f: e.forma === 'continua' ? Senal.continua(e.A) : f, texto };
    });
    let fn;
    try {
      // eslint-disable-next-line no-new-func
      fn = new Function('v1', 'v2', 't', 'with (Math) { return (' + nv.config.expr + '); }');
      fn(0, 0, 0);
      nv.errorExpr = null;
    } catch (e) {
      fn = () => 0;
      nv.errorExpr = 'La expresión no es válida: ' + e.message;
    }
    nv.objetivo = puntual(([a, b], t) => {
      const v = fn(a, b, t);
      return Number.isFinite(v) ? v : 0;
    });
    nv.objetivoHTML = 'v<sub>o</sub> = ' + nv.config.expr.replace(/\*/g, '·').replace(/v(\d)/g, 'v<sub>$1</sub>');
  }

  // Los niveles se diseñan en 13 filas; DY las centra en el tablero de 16.
  const TABLERO = { cols: 24, filas: 16 };
  const DY = 2;

  /* Conectores fijos de un nivel. */
  function conectores(nv) {
    const n = nv.entradas.length;
    const filas = nv.filasEntradas || (n === 1 ? [6] : n === 2 ? [3, 9] : [2, 6, 10]);
    const lista = [];
    nv.entradas.forEach((e, k) => {
      if (e.tipo === 'flotante') lista.push({ tipo: 'secundario', x: 0, y: filas[k] - 1 + DY, r: 0, k, fija: true });
      else lista.push({ tipo: 'entrada', x: 0, y: filas[k] + DY, r: 0, k, fija: true });
    });
    if (!nv.sinSalida) lista.push({ tipo: nv.RL > 0 ? 'salidarl' : 'salida', x: TABLERO.cols - 1, y: (nv.filaSalida || 6) + DY, r: 0, fija: true });
    return lista;
  }

  /* Entradas de la paleta de un nivel, normalizadas. */
  function paleta(nv) {
    const lista = [];
    for (const e of nv.piezas) {
      if (typeof e === 'object') { lista.push(Object.assign({}, e)); continue; }
      if (e === 'fuente') {
        if (Array.isArray(nv.fuentes)) for (const v of nv.fuentes) lista.push({ tipo: 'fuente', valor: v });
        else lista.push({ tipo: 'fuente', valor: 5, libre: true });
      } else lista.push({ tipo: e });
    }
    lista.forEach((e, i) => { e.clave = 'p' + i; });
    return lista;
  }

  /* Aplica un guion de solución sobre un tablero. Los dispositivos toman
     los parámetros de la paleta del nivel. */
  function aplicarSolucion(tab, guion, nv) {
    const pal = nv ? paleta(nv) : [];
    const deLaPaleta = (tipo, etiqueta) => pal.find(e => e.tipo === tipo && (!etiqueta || e.etiqueta === etiqueta)) || {};
    for (const c of guion) {
      const [op, ...a] = c;
      if (op === 'w' || op === 'wx') tab.trazar(a.map(([x, y]) => [x, y + DY]), op === 'w');
      else if (op === 'ao') tab.colocar({ tipo: 'ao', x: a[0], y: a[1] + DY, r: a[2] || 0, m: !!a[3] });
      else if (op === 'R') tab.colocar({ tipo: 'resistencia', x: a[0], y: a[1] + DY, r: a[2] || 0, valor: a[3] });
      else if (op === 'C') tab.colocar({ tipo: 'condensador', x: a[0], y: a[1] + DY, r: a[2] || 0, valor: a[3] });
      else if (op === 'gnd') tab.colocar({ tipo: 'tierra', x: a[0], y: a[1] + DY, r: a[2] || 0 });
      else if (op === 'V') tab.colocar({ tipo: 'fuente', x: a[0], y: a[1] + DY, r: a[2] || 0, valor: a[3] });
      else if (op === 'p') {
        const [tipo, x, y, r, extra] = a;
        const e = extra || {};
        const base = deLaPaleta(tipo, e.etiqueta);
        const pieza = { tipo, x, y: y + DY, r: r || 0, m: !!e.m };
        const par = e.par || base.par;
        if (par) pieza.par = Object.assign({}, par);
        const valor = e.valor !== undefined ? e.valor : base.valor;
        if (valor !== undefined) pieza.valor = valor;
        tab.colocar(pieza);
      }
    }
  }

  /* Objetivo calculado simulando la solución de referencia. */
  function objetivoDeSolucion(nv) {
    if (nv._obj) return nv._obj;
    const tab = new G.Tablero(TABLERO.cols, TABLERO.filas);
    for (const c of conectores(nv)) tab.colocar(c);
    aplicarSolucion(tab, nv.solucion, nv);
    const res = G.Simulador.simular(G.Simulador.construir(tab.piezas, nv), nv, { muestras: 500 });
    nv._obj = Float64Array.from(res.salida || []);
    return nv._obj;
  }

  // Lista plana de niveles con su tema
  const NIVELES = [];
  for (const tema of TEMAS) {
    tema.niveles.forEach((nv, i) => {
      nv.tema = tema;
      nv.numero = tema.num + '.' + (i + 1);
      nv.Vsat = nv.Vsat || 12;
      NIVELES.push(nv);
    });
  }
  const porId = (id) => NIVELES.find(n => n.id === id);
  for (const nv of NIVELES) {
    // Soluciones que amplían la de otro nivel
    if (typeof nv.solucion === 'string') {
      const [base] = nv.solucion.split('+');
      nv.solucion = porId(base).solucion.concat(nv.solucionExtra || []);
    }
    if (typeof nv.inicial === 'string') nv.inicial = porId(nv.inicial).solucion;
    if (nv.objetivo === 'solucion') nv.objetivo = () => objetivoDeSolucion(nv);
  }
  LIBRE.Vsat = 12;
  LIBRE.tema = { num: 0, id: 'libre', nombre: 'Laboratorio' };
  LIBRE.numero = '∞';

  G.Niveles = { NIVELES, TEMAS, LIBRE, Senal, TABLERO, DY, conectores, paleta, aplicarSolucion, prepararLibre };
})(typeof window !== 'undefined' ? window : globalThis);
