# Circuitos de Electrónica

Juego de construcción de circuitos para la asignatura de Electrónica. El alumnado monta un circuito con piezas sobre un tablero para que la salida real (una tensión o la corriente de una carga) coincida con un objetivo dado. Hay 31 niveles en cinco temas y un laboratorio libre.

**Jugar en línea: <https://carlos-arino.github.io/juego-electronica/>**

## Cómo abrirlo

La forma más sencilla es usar la versión publicada: <https://carlos-arino.github.io/juego-electronica/>. Funciona en cualquier navegador moderno, sin instalar nada.

También se puede usar sin conexión: descarga el repositorio y abre `index.html`. No necesita servidor. Si lo prefieres, puedes servirlo en local:

```bash
python -m http.server 8765
```

Enlaces útiles para clase (en la web o en local):

- `https://carlos-arino.github.io/juego-electronica/?nivel=1.2` o `index.html?nivel=1.2` o `index.html?nivel=puente`: abre directamente un nivel, por su número o por su identificador.
- `index.html?nivel=puente&solucion`: abre el nivel con la solución ya montada.

El progreso (estrellas) y el circuito de cada nivel se guardan automáticamente en el navegador (`localStorage`). Se conservan al cerrar y volver a abrir, pero son de ese navegador y de esa forma de abrir el juego (archivo local, servidor o web). En la ventana **Niveles** hay tres botones:

- **Exportar progreso**: descarga un archivo `progreso-circuitos-AAAA-MM-DD.json` con las estrellas y los circuitos.
- **Importar progreso**: carga un archivo exportado y sustituye el progreso de este navegador. Sirve para llevarlo de un ordenador a otro.
- **Reiniciar progreso**: borra las estrellas y los circuitos de este navegador (útil en ordenadores compartidos). Las preferencias (tema claro u oscuro) se conservan.

## Temas y niveles

| Nivel | Título | Objetivo |
|-------|--------|----------|
| **Tema 1** | **Diodos** | |
| 1.1 | Rectificador de media onda | vₒ = máx(v₁ − 0,7 V, 0) |
| 1.2 | Rectificador en puente (secundario flotante) | vₒ = máx(\|v₁\| − 1,4 V, 0) |
| 1.3 | Filtro con condensador | rizado ΔV ≈ I_L/(f_r·C) ≈ 1 V |
| 1.4 | Recortador con dos Zener | recortar a ±(V_Z + V_γ) |
| 1.5 | Zona muerta | vₒ = máx(v₁ − 4 V, 0) |
| 1.6 | Regulador con Zener (P_máx del Zener) | vₒ = 5,1 V |
| **Tema 3** | **El transistor en continua** | |
| 3.1 | Corte, activa y saturación | V_CE(v₁) en emisor común |
| 3.2 | Seguidor de emisor (entrada de 1 mA como máximo) | vₒ = v₁ − 0,7 V |
| 3.3 | Regulador lineal (Zener comercial de 5,6 V) | vₒ = V_Z − 0,7 = 4,9 V |
| 3.4 | Fuente de corriente con Zener (diseño, ±12 %) | I_LED = 10 mA |
| 3.5 | MOSFET: característica de transferencia | V_DS(v₁) |
| **Tema 4** | **El transistor en conmutación** | |
| 4.1 | Encender un LED desde el µC (diseño, ±12 %) | I_LED = 10 mA |
| 4.2 | Relé con un NPN (diodo volante) | I_bobina ≈ 49 mA |
| 4.3 | Motor inductivo con un MOSFET (nivel lógico frente a estándar, diodo volante) | I_motor ≈ 1 A |
| 4.4 | Lado alto con PNP y excitador NPN | I_lámpara ≈ 0,5 A |
| **Tema 6** | **El AO: aplicaciones lineales** | |
| 6.1–6.11 | Seguidor, inversor, no inversor, sumadores, restador, acondicionamiento, convertidor A/D, instrumentación, integrador | |
| **Tema 7** | **El AO: aplicaciones no lineales** | |
| 7.1 | Comparador | ±12 V según v₁ > 2 V |
| 7.2 | Disparador de Schmitt (entrada con ruido) | umbrales ±3 V |
| 7.3 | Rectificador de precisión | vₒ = máx(v₁, 0) con 0,5 V de pico |
| 7.4 | Limitador con Zener | −5·v₁ limitada a ±5,4 V |
| 7.5 | Multivibrador astable (se puntúa el periodo) | T = 2 ms |
| Extra | Laboratorio libre: señales, función objetivo y parámetros configurables | |

## Mecánica

- **Tablero**: los conectores de entrada están a la izquierda: generador de señal, salida digital del µC o secundario flotante de un transformador. El conector de salida está a la derecha. Junto a ellos hay miniosciloscopios con la forma de onda de cada entrada y el objetivo superpuesto a la salida real.
- **Piezas**: cables rectos y en L, nudos en T y en cruz, cruce sin unión, resistencia, condensador, tierra, fuente de un terminal, diodo, Zener, LED, NPN, PNP, MOSFET N y P, AO, y como cargas lámpara, motor (inductivo) y bobina de relé.
- **Estado de los dispositivos**: cada diodo o transistor muestra en el tablero su estado en el instante elegido (ON, OFF, Z, CORTE, ACT, SAT, ÓHM, RUPT). Al pasar el ratón se ven sus tensiones, corrientes y potencia. Los LED y las lámparas brillan según su corriente.
- **Objetivo y puntuación**: coincidencia = `1 − error RMS / referencia`, y el nivel se supera con un 98 %. En los niveles de diseño (4.1 y 3.4) basta con un 88 %, para que valga el valor E12 más próximo al calculado; el enunciado da la tolerancia y el medidor marca el umbral. En el astable se compara el periodo.
- **Valores de los componentes**: se escriben con su valor exacto (10k, 4,7k, 100n) o se ajustan con + / − o ↑ / ↓ por la serie E24, y con Mayús + ↑ / ↓ en la segunda cifra significativa (para valores de cálculo como 40 kΩ). El panel indica si el valor está normalizado y cuáles son los comerciales más próximos. Todas las soluciones de referencia usan valores E24 y Zener comerciales.
- **Estrellas**: ★ nivel superado; ★★ sin usar más componentes que la solución de referencia; ★★★ además sin avisos.
- **Diagnóstico**: avisa de realimentación positiva, bucle abierto y saturación de los AO. También de transistores que no saturan en conmutación, bases o puertas al aire y extremos de cable sueltos. Son errores, que impiden superar el nivel, la ruptura (V_CE > V_CEO, típica al cortar una bobina sin diodo volante), la potencia excesiva de un Zener, un LED quemado, la corriente excesiva pedida al µC y los cortocircuitos.

## Modelo eléctrico

Análisis nodal modificado (MNA) en el dominio del tiempo, con 500 muestras. Los condensadores y las bobinas se integran por Euler implícito. Los dispositivos usan los modelos por tramos de los apuntes:

- **Diodo**: OFF (abierto) u ON (fuente de V_γ = 0,7 V; LED, 2 V). **Zener**: además, avalancha a V_Z.
- **BJT**: corte, activa (V_BE = 0,7 V, I_C = β·I_B), saturación (V_CE = 0,2 V) y ruptura (V_CE = V_CEO).
- **MOSFET**: corte, activa (I_D = k(V_GS − V_TH)², resuelta por Newton), óhmica (R_DS(on)) y ruptura.
- **AO ideal** alimentado a ±12 V. La salida toma el valor que hace v⁺ = v⁻ si ese equilibrio es estable (criterio de Routh–Hurwitz sobre la matriz de realimentación). Si no, se queda en ±12 V y conserva el estado anterior, lo que da la histéresis del Schmitt.

El estado de los dispositivos se busca como en clase: se supone uno, se resuelve el circuito lineal, se comprueban las condiciones y se cambia el dispositivo que más las incumple. Si no converge, se prueban todas las combinaciones.

## Estructura

```
index.html          interfaz
css/estilos.css     estilos (tema claro y oscuro)
js/piezas.js        geometría, puertos y parámetros de las piezas
js/tablero.js       modelo del tablero, lápiz de cables, deshacer
js/simulador.js     lista de nudos, MNA, dispositivos y AO
js/niveles.js       temas, niveles, señales y soluciones
js/dibujo.js        símbolos SVG
js/graficas.js      gráficas de formas de onda
js/juego.js         controlador de la interfaz
test/test.js        comprueba las soluciones y casos de error
```

Para añadir niveles, edita `js/niveles.js`. Cada nivel define sus entradas, su objetivo (una función o `'solucion'`, que simula la solución de referencia), las piezas de la paleta (con sus parámetros), una pista y la solución escrita como guion.

## Pruebas

```bash
node test/test.js
```

Comprueba que la solución de referencia de cada uno de los 31 niveles da al menos un 99 % de coincidencia, sin errores ni cables sueltos. También comprueba 18 errores típicos, entre ellos: el diodo al revés, un puente con un diodo abierto, el relé sin diodo volante, un MOSFET que no es de nivel lógico, la base del PNP al aire, el LED sin resistencia, el Schmitt sin histéresis y el AO con + y − intercambiados.

## Licencia

© 2026 Carlos Ariño. Este juego se distribuye con la licencia [Creative Commons Atribución 4.0 Internacional (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/deed.es). El texto completo está en [LICENSE](LICENSE).

Puedes copiarlo, distribuirlo, adaptarlo y usarlo con cualquier fin, también comercial, siempre que reconozcas la autoría, enlaces la licencia e indiques si has hecho cambios.
