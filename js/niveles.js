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
    continua: (V) => () => V
  };

  const puntual = (fn) => (E, t) => {
    const out = new Float64Array(t.length);
    for (let i = 0; i < t.length; i++) out[i] = fn(E.map(e => e[i]), t[i]);
    return out;
  };

  const CABLES = ['cable', 'codo', 'te', 'cruz', 'puente'];
  const v1 = 'v<sub>1</sub>', v2 = 'v<sub>2</sub>', vo = 'v<sub>o</sub>';

  const NIVELES = [
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
      pista: 'Con R<sub>f</sub> = 20 kΩ: R<sub>1</sub> = R<sub>f</sub>/2 y R<sub>2</sub> = R<sub>f</sub>/0,5.',
      solucion: [
        ['ao', 11, 5],
        ['R', 6, 3, 0, 10e3], ['w', [0, 3], [6, 3]],
        ['R', 6, 9, 0, 40e3], ['w', [0, 9], [6, 9]],
        ['w', [6, 3], [8, 3], [8, 5], [11, 5]],
        ['w', [6, 9], [8, 9], [8, 5]],
        ['gnd', 10, 8], ['w', [11, 7], [10, 7], [10, 8]],
        ['R', 11, 2, 0, 20e3], ['w', [9, 5], [9, 2], [11, 2]],
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
      pista: 'Con v<sup>+</sup> = v<sub>1</sub> y en la patilla −: R<sub>1</sub> a −5 V, R<sub>3</sub> a tierra y R<sub>2</sub> a la salida, se obtiene v<sub>o</sub> = (1 + R<sub>2</sub>/R<sub>1</sub> + R<sub>2</sub>/R<sub>3</sub>)·v<sub>1</sub> + 5·R<sub>2</sub>/R<sub>1</sub>. Iguala coeficientes.',
      solucion: [
        ['ao', 10, 3],
        ['w', [0, 6], [3, 6], [3, 5], [10, 5]],
        ['w', [10, 3], [5, 3]], ['R', 5, 3, 0, 10e3],
        ['w', [5, 3], [4, 3], [4, 4]], ['gnd', 4, 4],
        ['R', 8, 2, 1, 40e3], ['w', [8, 3], [8, 2]], ['V', 8, 1, 0, -5],
        ['w', [6, 3], [6, 0], [9, 0]], ['R', 9, 0, 0, 8e3],
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

  // Nivel libre: entradas y objetivo configurables
  const LIBRE = {
    id: 'libre',
    titulo: 'Laboratorio libre',
    concepto: 'Elige las señales y la función objetivo',
    libre: true,
    enunciado: 'Configura las entradas y escribe la función objetivo. Puedes usar v1, v2, t (en ms) y funciones como sin, cos, abs, sqrt, min, max.',
    config: {
      entradas: [
        { forma: 'seno', A: 1, f: 1, off: 0 },
        { forma: 'cuadrada', A: 1, f: 0.5, off: 0 }
      ],
      expr: '-(v1 + 2*v2)'
    },
    tmax: 4,
    piezas: [...CABLES, 'resistencia', 'condensador', 'tierra', 'ao', 'fuente'],
    fuentes: 'libre',
    par: 99
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
    const lista = filas.map((y, k) => ({ tipo: 'entrada', x: 0, y: y + DY, r: 0, k, fija: true }));
    lista.push({ tipo: 'salida', x: TABLERO.cols - 1, y: (nv.filaSalida || 6) + DY, r: 0, fija: true });
    return lista;
  }

  /* Aplica un guion de solución sobre un tablero. */
  function aplicarSolucion(tab, guion) {
    for (const c of guion) {
      const [op, ...a] = c;
      if (op === 'w') tab.trazar(a.map(([x, y]) => [x, y + DY]), true);
      else if (op === 'ao') tab.colocar({ tipo: 'ao', x: a[0], y: a[1] + DY, r: a[2] || 0, m: !!a[3] });
      else if (op === 'R') tab.colocar({ tipo: 'resistencia', x: a[0], y: a[1] + DY, r: a[2] || 0, valor: a[3] });
      else if (op === 'C') tab.colocar({ tipo: 'condensador', x: a[0], y: a[1] + DY, r: a[2] || 0, valor: a[3] });
      else if (op === 'gnd') tab.colocar({ tipo: 'tierra', x: a[0], y: a[1] + DY, r: a[2] || 0 });
      else if (op === 'V') tab.colocar({ tipo: 'fuente', x: a[0], y: a[1] + DY, r: a[2] || 0, valor: a[3] });
    }
  }

  for (const nv of NIVELES) nv.Vsat = nv.Vsat || 12;
  LIBRE.Vsat = 12;

  G.Niveles = { NIVELES, LIBRE, Senal, TABLERO, conectores, aplicarSolucion, prepararLibre };
})(typeof window !== 'undefined' ? window : globalThis);
