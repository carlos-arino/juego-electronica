# Circuitos con AO

Juego de construcción de circuitos para el **Tema 6 de Electrónica: el amplificador operacional y sus aplicaciones lineales**. El alumnado monta un circuito con piezas sobre un tablero para que la salida real coincida con una salida objetivo dada.

## Cómo abrirlo

Abre `index.html` en un navegador moderno. No necesita servidor ni conexión a internet. Si lo prefieres, también puedes servirlo en local:

```bash
python -m http.server 8765
```

Enlaces útiles para clase:

- `index.html?nivel=inversor`: abre directamente un nivel, por su identificador o por su número (`?nivel=2`).
- `index.html?nivel=inversor&solucion`: abre el nivel con la solución ya montada.

El progreso (estrellas) y el circuito de cada nivel se guardan en el navegador de cada alumno.

## Mecánica

- **Tablero**: los conectores de entrada (`v₁`, `v₂`) están a la izquierda y el de salida (`vₒ`) a la derecha. Junto a cada conector hay un miniosciloscopio: el de las entradas muestra su forma de onda y el de la salida, el objetivo superpuesto a la salida real.
- **Piezas**: cable recto, cable en L, nudo en T, nudo en cruz, cruce sin unión, resistencia, condensador (solo en el integrador), tierra, fuente de tensión de un terminal (referida a tierra) y AO.
- **Objetivo**: arriba se muestra la función numérica (por ejemplo `vₒ = −2·v₁`). A la derecha están las gráficas de las entradas y de la salida (objetivo y real) y el porcentaje de coincidencia, `1 − error RMS / valor RMS del objetivo`. El nivel se supera con un 98 %.
- **Estrellas**: ★ nivel superado; ★★ sin usar más componentes que la solución de referencia; ★★★ además sin avisos (ningún AO saturado ni cables sueltos).
- **Diagnóstico**: avisa de realimentación positiva, bucle abierto, saturación, entradas del AO al aire, extremos sueltos y cortocircuitos entre fuentes.
- **Ayudas**: el lápiz dibuja cables arrastrando, la sonda muestra la tensión de cualquier nudo y, al pasar el ratón sobre un AO, se ven v⁺, v⁻ y vₒ, de modo que se comprueba el cortocircuito virtual. La animación colorea los cables según su tensión.

## Modelo eléctrico

- Análisis nodal modificado (MNA) en el dominio del tiempo, con 500 muestras por simulación. Los condensadores se integran por Euler implícito.
- **AO ideal alimentado a ±12 V**. Su salida es una fuente de tensión que toma el valor que hace v⁺ = v⁻, siempre que ese equilibrio sea estable (realimentación negativa) y quede dentro de ±12 V. Si no, la salida se queda en ±12 V. La estabilidad se comprueba con el criterio de Routh–Hurwitz sobre la matriz de realimentación, así que la realimentación positiva satura aunque la ecuación v⁺ = v⁻ tenga solución, como explican los apuntes.
- Las entradas pueden tener resistencia interna y la salida una carga. El nivel del seguidor las usa para que conectar la entrada directamente a la salida con un cable no funcione.

## Niveles

| # | Nivel | Objetivo |
|---|-------|----------|
| 1 | Seguidor de tensión (fuente con Rs = 10 kΩ, carga de 1 kΩ) | vₒ = v₁ |
| 2 | Amplificador inversor | vₒ = −2·v₁ |
| 3 | Amplificador no inversor | vₒ = 3·v₁ |
| 4 | Sumador inversor | vₒ = −(v₁ + v₂) |
| 5 | Sumador ponderado | vₒ = −(2·v₁ + 0,5·v₂) |
| 6 | Restador (rechazo del offset común) | vₒ = v₁ − v₂ |
| 7 | Sumador no inversor | vₒ = v₁ + v₂ |
| 8 | Acondicionar un sensor (solo con fuente de −5 V) | vₒ = 2·v₁ + 1 V |
| 9 | Adaptar al convertidor A/D (solo con fuente de +5 V) | vₒ = 1,5·v₁ + 2,5 V |
| 10 | Puente de sensores (Rs = 10 kΩ en cada rama) | vₒ = 10·(v₁ − v₂) |
| 11 | Integrador inversor | vₒ = −(1/1 ms)·∫v₁ dt |
| ∞ | Laboratorio libre: entradas y función objetivo configurables | — |

Para añadir o cambiar niveles, edita `js/niveles.js`. Cada nivel define sus entradas, la función objetivo, las piezas disponibles, una pista y una solución de referencia escrita como guion.

## Estructura

```
index.html          interfaz
css/estilos.css     estilos (tema claro y oscuro)
js/piezas.js        geometría y puertos de las piezas
js/tablero.js       modelo del tablero, lápiz de cables, deshacer
js/simulador.js     lista de nudos, MNA y modelo del AO
js/niveles.js       niveles, señales y soluciones
js/dibujo.js        símbolos SVG
js/graficas.js      gráficas de formas de onda
js/juego.js         controlador de la interfaz
test/test.js        comprueba las soluciones y casos de error
```

## Pruebas

```bash
node test/test.js
```

Comprueba que la solución de referencia de cada nivel da una coincidencia del 100 %. También comprueba casos de error: conectar la entrada directamente a la salida, intercambiar + y −, saturar el AO, dejarlo en bucle abierto y cortocircuitar su salida.
