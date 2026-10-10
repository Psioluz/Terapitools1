# Imágenes del juego de fonemas — dónde colocarlas

Esta carpeta vive junto al juego (`terapia-lenguaje-fonema-m.html`) y debe
subirse siempre junto con él (a GitHub, al hosting, o copiada a mano si se
usa el archivo suelto). El juego busca aquí una imagen por cada palabra;
si no la encuentra, muestra un ícono neutro de "sin foto" en vez de romperse
o mostrar una figura sin forma.

## Estado actual (169 de 170 cubiertas)

Las 170 palabras pendientes ya tienen una ilustración (emoji a color,
recortado y agrandado para que se vea grande y clara dentro de la tarjeta),
generada sin depender de fotos de internet. Son dibujos claros y
reconocibles, pero en algunas palabras poco comunes no existe un emoji
exacto y se usó la aproximación más cercana disponible — revísalas cuando
tengas un momento y reemplaza la que no te convenza (basta con subir un PNG
con el mismo nombre exacto, se reemplaza solo).

**Palabras con aproximación más débil (revisar primero):**
- `p_puma` (se usó leopardo, no existe emoji de puma)
- `p_piso` (se usó una casa, no existe emoji de "piso/suelo")
- `b_rabo` (se usó un perro completo, no solo la cola)
- `d_codo` (se usó un brazo/bíceps, no existe emoji de codo)
- `d_todo` (palabra abstracta - se usó el planeta Tierra)
- `g_goma` (se usó una esponja, no existe emoji de goma de borrar)
- `k_cuna` (se usó una cama, no existe emoji de cuna de bebé)
- `l_pala` (se usó un pico/piqueta, no existe emoji de pala)
- `p_tapa` (se usó un frasco con tapa)
- `t_tela` (se usó un carrete de hilo)
- `t_trompo` (se usó un yo-yo, no existe emoji de trompo)
- `y_toalla` (se usó a alguien en la tina, no existe emoji de toalla)
- `s_mesa` (se usó plato+cubiertos, no existe emoji de mesa)

**`r_pero.png` sigue faltando a propósito.** "Pero" es una palabra abstracta
(conjunción) y no hay forma de dibujarla sin arriesgar que el niño la
confunda con "perro" — que es justo la otra palabra con la que se está
contrastando R suave vs. RR fuerte en ese mismo nivel. Si quieren esa
palabra en el juego, mejor pedirle a una psicóloga una foto/tarjeta con el
texto "pero" en vez de un dibujo, o cambiarla por otra palabra con R suave
en medio (ej. "cara", "oro" ya están cubiertas, o "mira", "para", "toro").

## Cómo se ve el problema anterior

Antes, cada palabra tenía una imagen "genérica" generada automáticamente
(una figura abstracta reciclada + el nombre de la palabra en texto encima).
Eso no sirve para terapia de lenguaje: los niños muchas veces todavía no
leen, así que la imagen tiene que representar la palabra por sí sola.

## Qué subir (si quieres reemplazar alguna)

- Formato: **PNG o JPG**, cuadradas (ideal 512×512px o más, no menos de
  300×300px), fondo simple (blanco o un color liso) — nada de fondos
  recargados, porque la imagen se ve pequeña dentro de la tarjeta del juego.
- Contenido: una foto o un dibujo/ícono claro y realista de la palabra —
  evita dibujos infantiles ambiguos o clip-art genérico que no se entienda
  a primera vista. Puede ser foto real o ilustración, lo importante es que
  cualquier niño reconozca el objeto de inmediato.
- **Nombre del archivo: exactamente el de la lista de abajo**, incluyendo
  el prefijo del fonema (ej. `b_bebe.png`, no `bebe.png`). El juego arma
  la ruta como `imagenes-fonemas/<nombre>.png` — si el nombre no coincide
  exacto, no se va a mostrar.
- Sube el archivo directo a esta carpeta del repositorio de GitHub
  (`apps/psicologa/herramientas/imagenes-fonemas/`). En cuanto el archivo
  con el nombre correcto esté ahí, el juego lo muestra — no hace falta
  tocar código ni pedirme que lo "anexe" a mano.

## Lista completa (referencia)

Las 192 palabras de los 16 fonemas ya tienen imagen, excepto `r_pero.png`
(ver arriba). El detalle fonema por fonema queda en `Lista_Imagenes_Fonemas.txt`.

## Nota sobre la selección de palabras

La lista de palabras (no las imágenes, solo qué palabras se usan) ya sigue
la metodología estándar de terapia de articulación en español: se trabaja
el fonema en posición inicial y media dentro de la palabra, con progresión
de mono/bisílabas a trisílabas. Si una psicóloga del equipo quiere revisar
o ajustar alguna palabra puntual (por ejemplo, cambiar una por otra más
usada en Perú), es un cambio de una línea en el código — avísame cuál.
