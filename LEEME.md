# Study App

Lector de PDF para estudiar: marca las páginas leídas (con % de texto leído) y añade
notas que aparecen en una hoja en blanco justo después de cada página.

## Uso

- **Añadir PDF**: botón «Añadir PDF» o arrastra los archivos a la ventana.
- **Marcar como leída**: botón bajo cada página (o tecla `L`). El % se calcula según la
  cantidad de texto de cada página (en PDF escaneados, por nº de páginas).
- **Marcar un fragmento**
  - Modo *Texto*: arrastra sobre el texto; se selecciona letra a letra → elige una
    etiqueta. Para afinar: arrastra los tiradores azules del principio y del final,
    o usa Mayúsculas + ← / → (una letra cada vez). Doble clic = una palabra;
    Mayúsculas+clic = ampliar; Cmd+C copia. En el móvil: mantén pulsado y arrastra
    (aparece una lupa); luego ajusta con los tiradores.
  - Los fragmentos con notación matemática se guardan como imagen del renglón en la
    página de notas (y en el PDF exportado), para que se vean igual que en el original.
  - Modo *Recuadro* (tecla `R`): arrastra un rectángulo (sirve para fórmulas, imágenes
    o PDF escaneados) → elige una etiqueta.
  - Se crea la hoja «Notas · página N» tras la página, con un párrafo numerado por
    fragmento. El número aparece también sobre la página; tócalo para ir a la nota.
  - **Comentarios en LaTeX (como en Overleaf)**: pulsa en el recuadro del comentario (o en
    el lápiz) y se abre el editor: código a la izquierda, resultado en vivo a la derecha
    (en el móvil, arriba y abajo). Admite $…$, \[ … \], equation, align (numeradas,
    con \label y \eqref), matrices, \newcommand, paquetes physics/braket/mhchem…, y
    \textbf, \emph, itemize/enumerate y \section*. Al escribir «\» aparecen sugerencias
    (\frac, \alpha…); Ctrl+Espacio las muestra. Los errores se marcan en rojo.
    «Listo», Esc o Cmd+Enter cierran el editor. Todo se guarda solo.
  - Cada hoja de notas tiene el tamaño de la página. Si lo que escribes no cabe, el
    comentario continúa automáticamente en una hoja nueva justo detrás («hoja 2 de 2»…).
- **Etiquetas**: Importante, Definición, Duda, Idea, Ejemplo (se pueden cambiar en cada nota).
- **Exportar** (icono de descarga en el lector): genera un PDF con los subrayados y las
  hojas de notas insertadas detrás de cada página.
- **Copia** (en la biblioteca): descarga/restaura todos tus PDF y notas en un .json.
  Úsalo para pasar tus datos del ordenador al móvil o viceversa.

Los datos se guardan en el navegador de cada dispositivo (no se suben a ningún servidor).

## Abrirla en el Mac

Doble clic en el icono **Study App** del Escritorio. Se abre en una ventana propia
(con Chrome, Edge o Brave instalados; si no, en Safari). Puedes arrastrar el icono
al Dock o a la carpeta Aplicaciones.

- Si la primera vez macOS dice que no puede abrirla: clic derecho sobre el icono → Abrir
  → Abrir (o Ajustes del Sistema → Privacidad y seguridad → «Abrir igualmente»).
- La app lleva dentro su propio mini‑servidor (no necesita Python). Funciona en
  `http://localhost:8765` y se apaga sola tras 6 h sin uso.
- `Abrir Study App.command` (esta carpeta) es una alternativa que usa la misma
  dirección y, por tanto, los mismos datos.

## Usarla en el móvil (y compartirla)

La app está publicada en **https://danielcb0104-png.github.io/study-app/**. Ese enlace
se puede enviar a cualquiera (por WhatsApp, por ejemplo).

- iPhone/iPad (Safari): Compartir → «Añadir a pantalla de inicio».
- Android (Chrome): menú ⋮ → «Instalar aplicación».
- Ordenador (Chrome/Edge): botón de instalar en la barra de direcciones.

Después funciona sin conexión. Cada persona tiene sus propios PDF y notas en su
dispositivo. Para llevar tus datos de un dispositivo a otro: «Copia» → descargar y,
en el otro, «Copia» → restaurar.

**Publicar una actualización:** abre GitHub Desktop → escribe un resumen → «Commit to
main» → «Push origin». En 1–2 minutos el enlace tiene la versión nueva.

## Archivos

`index.html`, `styles.css`, `app.js` (la app) · `sw.js`, `manifest.webmanifest`,
`icons/` (modo app y sin conexión) · `latex.js` (LaTeX de los comentarios) ·
`vendor/` (pdf.js 4.10, pdf-lib 1.17, MathJax 3.2 y CodeMirror 5.65).
