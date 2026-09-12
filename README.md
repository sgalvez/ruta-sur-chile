# Ruta Sur Chile

Una app para explorar **62 lugares desde Santiago hasta Quellón** desde el teléfono. Selección para primavera de 2026: 31 campings, 16 parques y reservas, cuatro monumentos naturales, cinco atractivos y seis localidades o cementerios, en ocho regiones. Conserva los 42 lugares originales y la alternativa por Hornopirén–Chaitén.

**Abrir la app:** https://sgalvez.github.io/ruta-sur-chile/

Mapa y lista, búsqueda sin distinción de tildes, filtros por recorrido, región, tipo, temáticas, servicios y apertura; favoritos locales, contactos y enlaces para llegar. Mitos y leyendas incluye Talagante, Quicaví, Aucar y el Muelle de las Almas. Paso Pehuenche destaca Muela del Diablo, Cascada Invertida y Monjes Blancos. Se priorizan visitas breves y se señalan caminatas o accesos por confirmar.

**Rutas y ferries** reúne siete cruces con vehículos, terminales, operadores y referencias de horarios y tarifas. Incluye avisos de emergencias de Vialidad MOP. Las fichas, ferries, avisos descargados y favoritos funcionan sin señal después de preparar la app. El mapa detallado requiere conexión.

## Desarrollo

Requiere Node.js 22 y npm. No utiliza una base de datos, claves de mapas ni un servicio de IA.

```bash
npm ci
npm run dev
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm run preview` sirve la compilación. `node scripts/serve-preview.mjs` permite probar también el prefijo `/ruta-sur-chile/` que usa Pages.

## Datos y procedencia

- `public/data/v2/catalog.json`: lugares y ferries, selección editorial, relatos atribuidos, servicios, contactos, coordenadas, accesos y fuentes. Los valores de servicios son `true`, `false` o `null` (sin información).
- `public/data/v2/state.json`: seguimiento de fuentes, avisos breves, errores y fechas. Se conserva la última evidencia cuando una consulta falla.
- `public/data/v2/mobility.json`: última respuesta íntegra de emergencias viales para las ocho regiones del viaje, con salud y fechas de consulta y de evidencia.
- Cada fuente incluye su URL y fecha de consulta. La fecha de consulta **no es** la fecha del aviso ni una confirmación de cupos.
- Se contrastaron ubicaciones de campings con objetos de OpenStreetMap y mapas de operadores. Se descartaron coordenadas de directorios que caían en otra localidad o en el mar. Los parques usan puntos de referencia; no son porterías. “Cómo llegar” busca por nombre y localidad, no dirige a un centroide.
- Se usan CONAF, Pases Parques, sitios de establecimientos, referencias de Sernatur y directorios identificados. La ficha de infraestructura de Pumalín de 2025 se identifica expresamente como histórica y no determina aperturas actuales.

No se reproducen fotografías, páginas completas ni reseñas de viajeros. Las descripciones son síntesis editoriales; los avisos automáticos son extractos breves atribuidos. Las referencias no compatibles con seguimiento permanecen como consulta inicial.

Los relatos se identifican como tradición oral, memoria literaria o interpretación artística. Las coordenadas de Quicaví y Teupa son referencias de localidad; no se inventa una entrada a la cueva de los brujos ni al cementerio. Monumento Natural es una clasificación formal y no se aplica a cualquier formación geológica.

## Actualización

GitHub Actions ejecuta la revisión diaria a las **09:17 UTC**, además de permitir ejecución manual. La publicación inicial y cada cambio en `main` construyen y publican el catálogo. Las consultas se hacen en Actions, no desde el navegador.

```bash
npm run refresh
npm run validate
npm run build
```

Los adaptadores verifican el título y el formato antes de aceptar la respuesta; una página de error con HTTP 200 no cuenta como consulta válida. Se consultan 43 fuentes con pausa entre solicitudes y tiempo límite. Una ejecución parcialmente fallida no renueva la fecha global de revisión satisfactoria; las fechas individuales permiten distinguir cuáles funcionaron. Pasadas 48 horas, la app indica revisión pendiente.

El botón **Actualizar información** descarga la última publicación; no ejecuta scraping desde el teléfono ni inicia Actions. Distingue información nueva, datos sin cambios y descarga fallida. Las consultas automáticas se ejecutan diariamente, conservando selección, favoritos y ficha abierta al actualizar.

Vialidad se consulta por la capa pública 0 de `VIALIDAD/Emergencias_Vialidad/MapServer`. Se obtienen primero los identificadores de las regiones 13, 06, 07, 16, 08, 09, 14 y 10, y luego lotes de 100 registros, proyectados a WGS84. Si falta un lote se conserva toda la respuesta previa. Conflictos entre `TRANSITO` y `SIMBOLOGIA` quedan por confirmar. El servicio cubre emergencias de competencia del MOP; ausencia de avisos no certifica caminos abiertos.

Los horarios de ferries son referencias editoriales fechadas, no disponibilidad en vivo. Quellón–Chaitén publica un itinerario de junio de 2026 y se muestra vencido; Somarco mezcla textos contradictorios y bloquea consultas automáticas, por lo que queda como referencia manual con enlace a reservas. El Cementerio General responde localmente pero bloquea al ejecutor de GitHub (HTTP 403), por lo que su ficha también conserva una referencia manual al sitio oficial. Cambios de tarifas o páginas generan una indicación para volver a comprobar con el operador.

Los avisos fechados y explícitos permiten identificar algunos cierres y accesos parciales. Horarios genéricos, venta de entradas, una reapertura futura y avisos ambiguos no confirman apertura. Los cambios se comparan con `reviewedHash`: la advertencia persiste hasta que se revisan los datos editoriales. No hay clasificación automática libre de texto mediante IA.

Para revisar un cambio: abrir la fuente, comprobar servicios y restricciones, editar la ficha y actualizar su `reviewedHash` al `hash` de la observación validada. Si una fuente se comparte entre varias fichas, conservar una definición idéntica. Ejecutar validación y pruebas antes de publicar. `statusSourceIds` impide aplicar el estado de un parque a su camping.

El workflow conserva las consultas en Git y publica en la misma ejecución: no depende de que un commit hecho por `GITHUB_TOKEN` dispare otro workflow. Si GitHub desactiva una tarea programada por inactividad, reactivarla en Actions y ejecutar manualmente. Una versión anterior puede recuperarse desde Git y publicarse con un nuevo commit.

## Publicación

Repositorio `sgalvez/ruta-sur-chile`, renombrado desde `sgalvez/viaje`. Pages utiliza **GitHub Actions**. Los recursos, manifest y service worker usan rutas relativas para admitir el prefijo del proyecto.

El workflow necesita `contents: write`, `pages: write` e `id-token: write`. No requiere secretos adicionales. Los permisos personales usados para el renombrado y publicación inicial no se guardan en el proyecto.

La versión 2 usa rutas JSON y almacenamiento local propios. Los JSON originales de versión 1 permanecen publicados para clientes antiguos, con sus fechas originales, y no reciben categorías nuevas. Se conserva la clave `ruta-sur-favorites` y todos los identificadores anteriores. El service worker precarga los tres documentos nuevos y sus recursos; una nueva versión reemplaza la caché cuando termina su instalación. Si la app instalada aún muestra la portada anterior, cerrarla y abrirla de nuevo con conexión.

## Pruebas

Las pruebas cubren filtros combinados de recorrido, temas y naturaleza, servicios desconocidos, evidencia antigua o contradictoria, lotes incompletos del MOP, horarios vencidos y fallos. Playwright comprueba móvil y escritorio, favoritos anteriores, geolocalización denegada, mapa, lugares destacados, ferries, avisos viales, actualización con y sin cambios, descarga fallida, recarga sin señal y publicación bajo un subdirectorio.

## Atribución y límites

Las coordenadas derivadas de **© OpenStreetMap contributors** se utilizan bajo [ODbL](https://www.openstreetmap.org/copyright). Sus URLs individuales están en cada ficha; se conserva esa atribución al reutilizar los datos. Los datos combinados no cambian los derechos de las fuentes originales. La cartografía estándar se consulta al visualizar el mapa y no se descarga para uso offline.

Los favoritos se almacenan en este navegador; borrar sus datos los elimina. La geolocalización es opcional y sus distancias son en línea recta. La app no garantiza disponibilidad, estado del camino ni cobertura móvil: cada ficha ofrece el contacto o fuente para comprobar lo que importa antes de desviarse.
