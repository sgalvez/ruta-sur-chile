# Ruta Sur Chile

Una app para explorar **42 campings, parques y reservas entre O’Higgins y Chaitén** desde el teléfono. Selección inicial para primavera de 2026: 26 campings y 16 áreas protegidas en siete regiones.

**Abrir la app:** https://sgalvez.github.io/ruta-sur-chile/

Mapa y lista, búsqueda sin distinción de tildes, filtros por región, tipo, servicios y apertura; favoritos locales, contactos y enlaces para llegar. Las fichas y favoritos funcionan sin señal después de preparar la app. El mapa detallado requiere conexión.

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

- `public/data/catalog.json`: selección editorial, servicios, contactos, coordenadas, accesos y fuentes. Los valores de servicios son `true`, `false` o `null` (sin información).
- `public/data/state.json`: resultados del seguimiento, avisos breves, errores y fechas. Se conserva la última evidencia cuando una consulta falla.
- Cada fuente incluye su URL y fecha de consulta. La fecha de consulta **no es** la fecha del aviso ni una confirmación de cupos.
- Se contrastaron ubicaciones de campings con objetos de OpenStreetMap y mapas de operadores. Se descartaron coordenadas de directorios que caían en otra localidad o en el mar. Los parques usan puntos de referencia; no son porterías. “Cómo llegar” busca por nombre y localidad, no dirige a un centroide.
- Se usan CONAF, Pases Parques, sitios de establecimientos, referencias de Sernatur y directorios identificados. La ficha de infraestructura de Pumalín de 2025 se identifica expresamente como histórica y no determina aperturas actuales.

No se reproducen fotografías, páginas completas ni reseñas de viajeros. Las descripciones son síntesis editoriales; los avisos automáticos son extractos breves atribuidos. Las referencias no compatibles con seguimiento permanecen como consulta inicial.

## Actualización

GitHub Actions ejecuta la revisión diaria a las **09:17 UTC**, además de permitir ejecución manual. La publicación inicial y cada cambio en `main` construyen y publican el catálogo. Las consultas se hacen en Actions, no desde el navegador.

```bash
npm run refresh
npm run validate
npm run build
```

Los adaptadores verifican el título y el formato antes de aceptar la respuesta; una página de error con HTTP 200 no cuenta como consulta válida. Se consultan 30 fuentes con pausa entre solicitudes y tiempo límite. Una ejecución parcialmente fallida no renueva la fecha global de revisión satisfactoria; las fechas individuales permiten distinguir cuáles funcionaron. Pasadas 48 horas, la app indica revisión pendiente.

Los avisos fechados y explícitos permiten identificar algunos cierres y accesos parciales. Horarios genéricos, venta de entradas, una reapertura futura y avisos ambiguos no confirman apertura. Los cambios se comparan con `reviewedHash`: la advertencia persiste hasta que se revisan los datos editoriales. No hay clasificación automática libre de texto mediante IA.

Para revisar un cambio: abrir la fuente, comprobar servicios y restricciones, editar la ficha y actualizar su `reviewedHash` al `hash` de la observación validada. Si una fuente se comparte entre varias fichas, conservar una definición idéntica. Ejecutar validación y pruebas antes de publicar. `statusSourceIds` impide aplicar el estado de un parque a su camping.

El workflow conserva las consultas en Git y publica en la misma ejecución: no depende de que un commit hecho por `GITHUB_TOKEN` dispare otro workflow. Si GitHub desactiva una tarea programada por inactividad, reactivarla en Actions y ejecutar manualmente. Una versión anterior puede recuperarse desde Git y publicarse con un nuevo commit.

## Publicación

Repositorio `sgalvez/ruta-sur-chile`, renombrado desde `sgalvez/viaje`. Pages utiliza **GitHub Actions**. Los recursos, manifest y service worker usan rutas relativas para admitir el prefijo del proyecto.

El workflow necesita `contents: write`, `pages: write` e `id-token: write`. No requiere secretos adicionales. Los permisos personales usados para el renombrado y publicación inicial no se guardan en el proyecto.

## Pruebas

Las pruebas cubren filtros combinados, ausencia de servicios, evidencia antigua o contradictoria, cierres parciales, cambios de formato y persistencia de avisos ante fallos. Playwright comprueba móvil y escritorio, favoritos, geolocalización denegada, mapa, enlaces de fichas, descarga y recarga sin señal, y publicación bajo un subdirectorio.

## Atribución y límites

Las coordenadas derivadas de **© OpenStreetMap contributors** se utilizan bajo [ODbL](https://www.openstreetmap.org/copyright). Sus URLs individuales están en cada ficha; se conserva esa atribución al reutilizar los datos. Los datos combinados no cambian los derechos de las fuentes originales. La cartografía estándar se consulta al visualizar el mapa y no se descarga para uso offline.

Los favoritos se almacenan en este navegador; borrar sus datos los elimina. La geolocalización es opcional y sus distancias son en línea recta. La app no garantiza disponibilidad, estado del camino ni cobertura móvil: cada ficha ofrece el contacto o fuente para comprobar lo que importa antes de desviarse.
