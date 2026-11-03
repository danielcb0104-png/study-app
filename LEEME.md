# Study App

Lector de PDF para estudiar: marca las páginas leídas (con % de texto leído) y añade
notas que aparecen en una hoja en blanco justo después de cada página.

## Uso

- **Añadir PDF**: botón «Añadir PDF» o arrastra los archivos a la ventana.
- **Carpetas**: «Nueva carpeta» crea una carpeta dentro de la que estás viendo (se pueden
  anidar). Pulsa una carpeta para entrar; la ruta de arriba («Biblioteca › Física › Tema 1»)
  sirve para volver. Los PDF que añades se guardan en la carpeta abierta.
  - Mover: menú «⋯» del documento o carpeta → «Mover a…», o arrastra la tarjeta encima de
    una carpeta o de un nombre de la ruta (en el ordenador).
  - «⋯» → «Cambiar nombre» / «Eliminar». Al eliminar una carpeta su contenido no se borra:
    pasa a la carpeta de arriba.
- **Marcar como leída**: botón bajo cada página (o tecla `L`). El % se calcula según la
  cantidad de texto de cada página (en PDF escaneados, por nº de páginas).
- **Marcar un fragmento**
  - Modo *Texto*: arrastra sobre el texto (se selecciona letra a letra). Para afinar:
    tiradores azules o Mayúsculas + ← / →. Doble clic = una palabra; Cmd+C copia.
    En el móvil: mantén pulsado y arrastra (aparece una lupa).
  - Modo *Recuadro* (tecla `R`): arrastra un rectángulo (fórmulas, imágenes, escaneados).
  - Al soltar aparecen las opciones:
    - **Importante**, **Definición**, **Observación**, **Ejemplo**: solo colorean el texto.
    - **Añadir comentario**: lo marca y abre la página de notas para escribir (en LaTeX,
      como en Overleaf: código a un lado y resultado al otro). Cada comentario lleva un
      número que también aparece sobre la página; púlsalo para ir al comentario.
  - Pulsa una marca de color para cambiarle el color, añadirle un comentario o quitarla.
  - Los fragmentos con notación matemática se guardan como imagen del renglón en la
    página de notas, para que se vean igual que en el original.
  - Cada hoja de notas tiene el tamaño de la página; si no cabe, continúa en otra hoja.
- **Exportar** (icono de descarga en el lector): genera un PDF con los subrayados y las
  hojas de notas insertadas detrás de cada página.
- **Copia** (en la biblioteca): descarga/restaura todos tus PDF y notas en un .json.
  Úsalo para pasar tus datos del ordenador al móvil o viceversa.

Los datos se guardan en el navegador de cada dispositivo (no se suben a ningún servidor).

## Abrirla en el Mac

Doble clic en el icono **Study App** del Escritorio: abre la versión publicada
(https://danielcb0104-png.github.io/study-app/) en una ventana propia (con Chrome,
Edge o Brave; si no, en Safari). Se actualiza sola cada vez que se publica una versión.

- Si macOS dice que no puede abrirla: clic derecho sobre el icono → Abrir → Abrir.

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
