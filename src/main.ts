import './style.css';
import './expansion.css';
import 'leaflet/dist/leaflet.css';
import type * as Leaflet from 'leaflet';
import {renderMobility} from './mobility';
import type { Catalog, Place, State, Service, Mobility } from './types';
import { REGIONS, STATUS_LABELS, filterPlaces, effectiveStatus, distanceKm, safeExternalUrl, isStale, KIND_LABELS } from './domain.mjs';

const icons: Record<string, string> = {
  moon: '<path d="M20 14A9 9 0 0 1 10 4a9 9 0 1 0 10 10Z"/>',
  sparkles: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>',
  ferry: '<path d="M4 13V6h16v7M9 6V2h6v4M2 13l10-3 10 3-4 7H6ZM2 22l4-2 6 2 6-2 4 2"/>',
  mountain: '<path d="m2 19 8-14 5 9 3-5 5 10Z"/><path d="m7 10 3 3 3-3"/>',
  tent: '<path d="m3 20 9-16 9 16H3Z"/><path d="m8 20 4-8 4 8M10 2l2 2 2-2"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1"/>',
  locate: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  external: '<path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/>',
  water: '<path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z"/>',
  toilets: '<path d="M5 4h6v9H5zM5 13h15a7 7 0 0 1-7 7H9v-3m4 3v2H8m12-9v-3"/>',
  showers: '<path d="M5 21V8a5 5 0 0 1 10 0m-4 3 8-4m-5 7v2m4-4v2m-1 5v2m4-5v2"/>',
  electricity: '<path d="m13 2-9 12h7l-1 8 10-13h-7l0-7Z"/>',
  parking: '<path d="M8 21V3h6a5 5 0 0 1 0 10H8"/>',
  phone: '<path d="m7 3 3 5-3 3a16 16 0 0 0 6 6l3-3 5 3-2 4C10 21 3 14 3 5l4-2Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-11v1"/>',
  tree: '<path d="m12 2-7 9h4l-6 7h18l-6-7h4L12 2Zm0 16v4"/>',
};
const icon = (name: string, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.pin}</svg>`;
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const date = (v: string | null | undefined) => v ? new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Santiago' }).format(new Date(v)) : 'Sin comprobación';
const serviceLabels: Record<Service, string> = { toilets: 'Baños', water: 'Agua potable', showers: 'Duchas', electricity: 'Electricidad', parking: 'Estacionamiento' };
const kindLabels = KIND_LABELS as Record<Place['kind'],string>;
const placeIcon=(p:Place)=>p.kind==='camping'?'tent':p.kind==='cemetery'?'moon':p.kind==='town'?'sparkles':p.kind==='attraction'?'mountain':'tree';
let mobility:Mobility={schemaVersion:2,attemptedAt:null,checkedAt:null,ok:false,sourceUrl:'https://rest-sit.mop.gob.cl/arcgis/rest/services/VIALIDAD/Emergencias_Vialidad/MapServer/0',notices:[]};
let mobilityView=false, roadRegion='', ferryRoute='';
let catalog: Catalog;
let state: State = { schemaVersion: 2, attemptedAt: null, lastSuccessfulAt: null, observations: {} };
let favorites = new Set<string>();
try { const saved = JSON.parse(localStorage.getItem('ruta-sur-favorites') || '[]'); if (Array.isArray(saved)) favorites = new Set(saved.filter(x=>typeof x==='string')); } catch { /* A fresh session remains usable. */ }
let position: [number, number] | null = null;
let map: Leaflet.Map | null = null;
let layer: Leaflet.LayerGroup | null = null;
let L: typeof Leaflet | null = null;
let mapLoading = false;
let visiblePlaces: Place[] = [];
let activePlace: string | null = null;
let offlineReady = false;
let toastTimer: ReturnType<typeof setTimeout>;
const filters = { route:'', themes:[] as string[], query: '', region: '', kind: '', status: '', service: '', saved: false, car: false };

function toast(message: string) {
  $('#toast').textContent = message; $('#toast').classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>$('#toast').classList.remove('show'), 5500);
}
function link(url: string | undefined, label: string, cls = 'text-link') {
  const safe = url && safeExternalUrl(url);
  return safe ? `<a class="${cls}" href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${label}${icon('external')}</a>` : '';
}
function sourceLink(place: Place, id: string | undefined) { return place.sources.find(s=>s.id === id); }
function skeleton() {
  $('#app').innerHTML = `
    <header class="site-header"><a href="#" class="brand" aria-label="Ruta Sur Chile, inicio"><span class="brand-mark">${icon('mountain')}</span><span>RUTA SUR <small>CHILE</small></span></a>
      <nav aria-label="Navegación principal"><button class="nav-link active" data-view="explore">Explorar</button><button class="nav-link" data-view="saved">Mis lugares <span class="saved-count">0</span></button><button class="nav-link" data-view="mobility">Rutas y ferries</button><button class="nav-link" id="about">Sobre los datos ${icon('info')}</button></nav>
      <span class="season">${icon('tree')} Primavera 2026</span>
    </header>
    <main>
      <section class="hero" aria-labelledby="hero-title"><div class="hero-copy"><div class="eyebrow"><span></span> DESDE SANTIAGO HASTA QUELLÓN</div><h1 id="hero-title">El sur,<br><em>a tu ritmo.</em></h1><p>Bosques, campings y relatos que acompañan el camino. Partimos en Santiago, rumbo a las islas y leyendas de Chiloé.</p><a class="hero-link" href="#explorar">Explorar lugares y leyendas ${icon('arrow')}</a></div>
        <div class="journey" aria-label="Un viaje por ocho regiones"><div class="contours"></div><div class="journey-path"></div><div class="journey-start"><span class="route-dot"></span><small>EL PUNTO DE PARTIDA</small><strong>Santiago</strong></div><div class="journey-middle">${icon('tree')} Bosques, leyendas<br>y una buena carpa.</div><div class="journey-end"><span class="route-dot"></span><small>RUMBO A CHILOÉ</small><strong>Quellón</strong></div><div class="journey-tag">${icon('tent')} La mejor ruta es la tuya.</div></div>
      </section>
      <section class="trip-strip" aria-label="Información del catálogo"><div><strong id="total-count">—</strong><span>lugares para descubrir</span></div><div><strong id="region-count">08</strong><span>regiones en el camino</span></div><div class="strip-status">${icon('clock')}<span id="freshness">Consultando las fuentes…</span></div><button id="reload" class="secondary-button refresh-button" aria-label="Actualizar información">↻ Actualizar información</button><div class="refresh-note"><small>Última revisión publicada · lugares, aperturas y caminos</small></div><button id="offline" class="offline-button">${icon('download')}<span>Preparar para el viaje</span></button></section>
      <section class="explore" id="explorar" aria-labelledby="explore-title"><div class="section-heading"><div><span class="eyebrow">TU PRÓXIMA PARADA</span><h2 id="explore-title">Hay un lugar para ti.</h2></div><div class="type-tabs" role="group" aria-label="Tipo de lugar"><button data-kind="" class="active">Todos</button><button data-kind="camping">${icon('tent')} Campings</button><button data-kind="nature">${icon('tree')} Naturaleza</button></div></div><div class="journey-controls"><label>Tu recorrido<select id="route"><option value="">Todo el viaje</option><option value="main">Santiago–Quellón</option><option value="austral">Alternativa Austral</option></select></label><label>Tipo de lugar<select id="place-kind"><option value="">Todos los lugares</option><option value="nature">Toda la naturaleza</option>${Object.entries(kindLabels).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><div class="theme-buttons" role="group" aria-label="Temáticas"><button data-theme="myths" aria-pressed="false">${icon('sparkles')} Mitos y leyendas</button><button data-theme="heritage" aria-pressed="false">${icon('moon')} Cementerios y patrimonio</button></div></div><p id="route-description" class="route-description"></p><div class="featured-stops"><span>PASO PEHUENCHE</span><button data-featured="muela-del-diablo">Muela del Diablo ↗</button><button data-featured="cascada-invertida">Cascada Invertida ↗</button><small>Desvío cordillerano desde Talca · revisar acceso y caminata</small></div>
        <div class="filter-bar"><label class="search-box">${icon('search')}<input id="query" type="search" placeholder="Un lugar, un lago, una localidad…" aria-label="Buscar lugares"></label><label class="select-wrap"><span>Región</span><select id="region"><option value="">Todas las regiones</option>${REGIONS.map(r=>`<option>${esc(r)}</option>`).join('')}</select></label><label class="select-wrap"><span>Servicios</span><select id="service"><option value="">Cualquier servicio</option>${Object.entries(serviceLabels).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label class="select-wrap"><span>Apertura</span><select id="status"><option value="">Todos los estados</option>${Object.entries(STATUS_LABELS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label></div>
        <div class="results-toolbar"><p id="results-count" role="status" aria-live="polite"></p><div><label class="car-filter"><input type="checkbox" id="car"> Acceso publicado para auto</label><button id="nearby" class="text-button">${icon('locate')} Cerca de mí</button><button id="clear" class="text-button" hidden>Limpiar filtros</button></div></div>
        <div id="connection-banner" class="notice-banner" hidden></div>
        <div class="explorer-layout"><div id="results" class="results-list" aria-label="Lugares encontrados"></div><aside class="map-panel" aria-label="Mapa de lugares"><div id="map"><div class="map-placeholder">${icon('map')}<p>Un mapa para seguir explorando.</p><button class="primary-button" id="load-map">Cargar mapa</button></div></div><div class="map-caption"><span>${icon('tent')} Camping</span><span>${icon('tree')} Naturaleza</span><span>${icon('sparkles')} Patrimonio</span><button id="fit-map" class="text-button">Ver todos ${icon('locate')}</button></div><p class="map-footnote">Los puntos pueden ser referenciales. Revisa el acceso en cada ficha.</p></aside></div>
      </section>
      <section id="mobility-section" class="mobility-section" hidden aria-label="Rutas y ferries"></section><section class="field-note"><span class="note-icon">${icon('info')}</span><div><h3>Un buen viaje empieza con un dato claro.</h3><p>Cada ficha muestra sus fuentes. Una apertura puede cambiar y un parque abierto no asegura un sitio para acampar. Confirma con el lugar antes de desviarte.</p></div><button id="about-bottom" class="text-button">Cómo leemos los datos ${icon('arrow')}</button></section>
    </main>
    <footer><a href="#" class="brand">${icon('mountain')} RUTA SUR <small>CHILE</small></a><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a><a href="https://github.com/sgalvez/ruta-sur-chile" id="repo-link" target="_blank" rel="noopener noreferrer">Proyecto y fuentes ${icon('external')}</a></footer>
    <nav class="mobile-nav" aria-label="Vistas"><button data-view="explore" class="active">${icon('list')}Explorar</button><button data-view="map">${icon('map')}Mapa</button><button data-view="mobility">${icon('ferry')}Ferries y rutas</button><button data-view="saved">${icon('heart')}Guardados <span class="saved-count">0</span></button></nav>
    <dialog id="detail" aria-label="Ficha del lugar"><button id="close-detail" class="dialog-close icon-button" aria-label="Cerrar ficha">${icon('close')}</button><div id="detail-content"></div></dialog>
    <dialog id="about-dialog" aria-labelledby="about-title"><button id="close-about" class="dialog-close icon-button" aria-label="Cerrar información">${icon('close')}</button><div class="about-content"><span class="eyebrow">FUENTES A LA VISTA</span><h2 id="about-title">Datos para decidir mejor.</h2><p>Esta es una selección de campings, naturaleza, cementerios y lugares de leyendas desde Santiago hasta Quellón, con una alternativa por Hornopirén y Chaitén. No es un inventario completo ni un sistema de reservas.</p><h3>Qué significa cada fecha</h3><p><strong>Última consulta</strong> indica cuándo pudimos leer una fuente. <strong>Fecha de la evidencia</strong> es la fecha explícita del aviso: consultar una página hoy no hace nuevo su contenido.</p><h3>Aperturas y restricciones</h3><p>“Por confirmar” significa que no hay evidencia suficiente para afirmar una apertura vigente. Los avisos sin fecha, cambios pendientes, fallos y contradicciones se muestran en la ficha. El parque, sus senderos y el camping pueden tener condiciones distintas.</p><h3>De dónde sale la información</h3><p>CONAF y Pases Parques para áreas protegidas; páginas de los establecimientos, turismo local y directorios identificados para campings. Los servicios son los publicados por esas fuentes; “sin información” no significa que el servicio no exista.</p><h3>Historia y leyendas</h3><p>Los relatos se identifican como tradición oral, interpretación artística o historia documentada. Una leyenda no confirma hechos sobrenaturales ni la existencia de un acceso visitable.</p><h3>Rutas y ferries</h3><p>El botón Actualizar información descarga la última revisión publicada. La consulta automática ocurre una vez al día; pulsar el botón no inicia una consulta nueva a los operadores. Los avisos del MOP describen emergencias de su competencia, no certifican todo el itinerario.</p><h3>Revisión diaria</h3><p>El catálogo consulta las fuentes compatibles cada día. Las páginas bloqueadas o sin un formato reconocible quedan pendientes. Los datos revisados editorialmente necesitan otra revisión cuando cambia su fuente.</p><h3>Cuando no hay señal</h3><p>Después de preparar la app, podrás consultar las fichas y tus favoritos. El mapa, las llamadas, WhatsApp y los sitios de reserva requieren conexión o cobertura del servicio correspondiente. El teléfono puede eliminar los datos si liberas su almacenamiento.</p><h3>Tu ubicación y favoritos</h3><p>Los favoritos quedan en este navegador. La ubicación se solicita solo al pulsar “Cerca de mí”, se usa para calcular distancias en línea recta y no se envía a un servidor de Ruta Sur.</p></div></dialog>
    <div id="toast" role="status" aria-live="polite"></div>`;
  bindEvents();
}
function showView(view: string) {
  mobilityView=view==='mobility';
  $('#explorar').hidden=mobilityView;$('#mobility-section').hidden=!mobilityView;
  filters.saved = view === 'saved';
  document.body.classList.toggle('map-view', view === 'map');
  document.querySelectorAll<HTMLElement>('[data-view]').forEach(b=>b.classList.toggle('active', b.dataset.view === view));
  $('#explore-title').textContent = filters.saved ? 'Tus próximas paradas.' : 'Hay un lugar para ti.';
  render();
  if (view === 'map') { void initMap(); setTimeout(()=>map?.invalidateSize(),100); }
  $(mobilityView?'#mobility-section':'#explorar').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function bindEvents() {
  document.querySelectorAll<HTMLElement>('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view!)));
  $('.hero-link').addEventListener('click',e=>{e.preventDefault();showView('explore');});
  let debounce: ReturnType<typeof setTimeout>;
  $('#query').addEventListener('input',e=>{clearTimeout(debounce);debounce=setTimeout(()=>{filters.query=(e.target as HTMLInputElement).value;render();},120);});
  for (const id of ['region','service','status'] as const) $('#'+id).addEventListener('change',e=>{filters[id]=(e.target as HTMLSelectElement).value;render();});
  $('#route').addEventListener('change',()=>{filters.route=$<HTMLSelectElement>('#route').value;render();fitMap();});
  $('#place-kind').addEventListener('change',()=>{filters.kind=$<HTMLSelectElement>('#place-kind').value;syncKinds();render();});
  document.querySelectorAll<HTMLElement>('[data-theme]').forEach(b=>b.addEventListener('click',()=>{const t=b.dataset.theme!;filters.themes=filters.themes.includes(t)?filters.themes.filter(x=>x!==t):[...filters.themes,t];b.setAttribute('aria-pressed',String(filters.themes.includes(t)));render();}));
  document.querySelectorAll<HTMLElement>('[data-featured]').forEach(b=>b.addEventListener('click',()=>openDetail(b.dataset.featured!)));
  $('#mobility-section').addEventListener('click',e=>{if((e.target as Element).closest('#mobility-refresh'))void reload();});
  $('#mobility-section').addEventListener('change',e=>{const target=e.target as HTMLSelectElement;if(target.id==='road-region')roadRegion=target.value;if(target.id==='ferry-route')ferryRoute=target.value;renderTransport();});
  $('#car').addEventListener('change',()=>{filters.car=$<HTMLInputElement>('#car').checked;render();});
  document.querySelectorAll<HTMLElement>('[data-kind]').forEach(b=>b.addEventListener('click',()=>{filters.kind=b.dataset.kind!;document.querySelectorAll('[data-kind]').forEach(el=>el.classList.toggle('active',el===b));syncKinds();render();}));
  $('#clear').addEventListener('click',()=>{Object.assign(filters,{query:'',region:'',kind:'',status:'',service:'',car:false,route:'',themes:[]});$('#route').querySelectorAll('option').forEach(o=>o.selected=!o.value);syncKinds();document.querySelectorAll('[data-theme]').forEach(el=>el.setAttribute('aria-pressed','false'));for(const id of ['query','region','service','status']) $<HTMLInputElement>('#'+id).value='';$<HTMLInputElement>('#car').checked=false;document.querySelectorAll<HTMLElement>('[data-kind]').forEach(el=>el.classList.toggle('active',el.dataset.kind===''));render();});
  $('#results').addEventListener('click',e=>{
    const target=e.target as Element; const save=target.closest<HTMLElement>('[data-save]');
    if(save){toggleFavorite(save.dataset.save!);return;}
    const open=target.closest<HTMLElement>('[data-open]');if(open)openDetail(open.dataset.open!);
  });
  $('#detail-content').addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLElement>('[data-save]');if(b)toggleFavorite(b.dataset.save!);});
  const clearDetailHash=()=>{activePlace=null;if(location.hash.startsWith('#lugar/'))history.replaceState(null,'',location.pathname+location.search+'#explorar');};
  $('#close-detail').addEventListener('click',()=>{clearDetailHash();$<HTMLDialogElement>('#detail').close();});
  $('#detail').addEventListener('cancel',clearDetailHash);
  $('#detail').addEventListener('close',()=>{activePlace=null;if(location.hash.startsWith('#lugar/'))history.replaceState(null,'',location.pathname+location.search+'#explorar');});
  for(const id of ['about','about-bottom']) $('#'+id).addEventListener('click',()=>$<HTMLDialogElement>('#about-dialog').showModal());
  $('#close-about').addEventListener('click',()=>$<HTMLDialogElement>('#about-dialog').close());
  document.querySelectorAll<HTMLDialogElement>('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
  $('#load-map').addEventListener('click',()=>void initMap());
  $('#fit-map').addEventListener('click',()=>fitMap());
  $('#nearby').addEventListener('click',()=>{
    if(!navigator.geolocation){toast('Este navegador no dispone de ubicación. Puedes buscar por localidad.');return;}
    $('#nearby').textContent='Buscando ubicación…';
    navigator.geolocation.getCurrentPosition(p=>{position=[p.coords.latitude,p.coords.longitude];$('#nearby').innerHTML=icon('locate')+' Cerca de mí';render();toast('Ordenado por distancia en línea recta, no por tiempo de conducción.');},()=>{$('#nearby').innerHTML=icon('locate')+' Cerca de mí';toast('No pudimos acceder a tu ubicación. Puedes elegir una región o buscar una localidad.');},{timeout:12000,maximumAge:60000,enableHighAccuracy:false});
  });
  $('#reload').addEventListener('click',()=>void reload());
  $('#offline').addEventListener('click',()=>void prepareOffline(true));
  window.addEventListener('online',()=>{updateHealth();void reload(false);});
  window.addEventListener('offline',()=>updateHealth());
  window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#lugar/'))openDetail(decodeURIComponent(location.hash.slice(7)));});
}
function toggleFavorite(id: string) {
  if(favorites.has(id))favorites.delete(id);else favorites.add(id);
  try{localStorage.setItem('ruta-sur-favorites',JSON.stringify([...favorites]));}catch{toast('No hay espacio para conservar los favoritos al cerrar. Libera almacenamiento del navegador.');}
  render();if(activePlace)renderDetail(activePlace);
}
function card(p: Place) {
  const status=effectiveStatus(p,state), saved=favorites.has(p.id);
  const amenities=Object.entries(p.services).filter(([,v])=>v===true).slice(0,4);
  const distance=position?distanceKm(position,p.coordinates):null;
  return `<article class="place-card ${p.kind}" data-id="${esc(p.id)}"><div class="card-top"><span class="kind-label">${icon(placeIcon(p))}${kindLabels[p.kind]}</span><button class="save-button ${saved?'saved':''}" data-save="${esc(p.id)}" aria-label="${saved?'Quitar':'Guardar'} ${esc(p.name)}" aria-pressed="${saved}">${icon('heart')}</button></div><button class="card-main" data-open="${esc(p.id)}"><span class="card-region">${esc(p.region)} <span>·</span> ${esc(p.locality)}</span><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p></button><div class="card-services">${amenities.length?amenities.map(([k])=>`<span title="${serviceLabels[k as Service]}">${icon(k)}${serviceLabels[k as Service]}</span>`).join(''):'<span>Servicios por confirmar</span>'}</div><div class="card-bottom"><span class="status ${status}"><i></i>${STATUS_LABELS[status as keyof typeof STATUS_LABELS]}</span>${distance!==null?`<span class="distance">${Math.round(distance)} km · línea recta</span>`:`<span class="source-count">${p.sources.length} fuente${p.sources.length>1?'s':''}</span>`}<button data-open="${esc(p.id)}" class="card-arrow" aria-label="Ver ficha de ${esc(p.name)}">${icon('arrow')}</button></div></article>`;
}
function render() {
  if(!catalog)return;
  visiblePlaces=filterPlaces(catalog.places,filters,state,favorites);
  $('#route-description').textContent=filters.route==='main'?'Santiago → Ruta 5 → Pargua–Chacao → Chiloé → Quellón. Con desvíos para explorar.':filters.route==='austral'?'Tramo compartido desde Santiago → Puerto Montt → La Arena–Puelche → Hornopirén → Caleta Gonzalo → Chaitén. Conexión marítima a Quellón.':'Dos alternativas desde Santiago: continúa a Quellón por Chiloé o explora Hornopirén y Chaitén por la Carretera Austral.';
  $('#region-count').textContent=String(new Set(catalog.places.map(p=>p.region)).size).padStart(2,'0');
  if(position)visiblePlaces.sort((a,b)=>distanceKm(position!,a.coordinates)-distanceKm(position!,b.coordinates));
  $('#results').innerHTML=visiblePlaces.length?visiblePlaces.map(card).join(''):`<div class="empty-state">${icon(filters.saved?'heart':'search')}<h3>${filters.saved?'Tu viaje empieza con un favorito.':'No encontramos lugares con esos filtros.'}</h3><p>${filters.saved?'Guarda los lugares que te interesen con el corazón de cada ficha.':'Prueba otra región o amplía los servicios. Lo que no está confirmado no se incluye en ese filtro.'}</p>${filters.saved?'<button id="back-explore" class="primary-button">Explorar lugares</button>':''}</div>`;
  $('#back-explore')?.addEventListener('click',()=>showView('explore'));
  $('#results-count').innerHTML=`<strong>${visiblePlaces.length}</strong> ${visiblePlaces.length===1?'lugar':'lugares'} ${filters.saved?'guardados':'para explorar'}${position?' · más cercanos primero':''}`;
  $('#clear').hidden=!Object.entries(filters).some(([k,v])=>k!=='saved'&&(Array.isArray(v)?v.length>0:Boolean(v)));
  $('#total-count').textContent=String(catalog.places.length);
  document.querySelectorAll('.saved-count').forEach(el=>el.textContent=String([...favorites].filter(id=>catalog.places.some(p=>p.id===id)).length));
  updateHealth();renderMarkers();if(mobilityView)renderTransport();
}
function syncKinds(){$<HTMLSelectElement>('#place-kind').value=filters.kind;document.querySelectorAll<HTMLElement>('[data-kind]').forEach(b=>b.classList.toggle('active',b.dataset.kind===filters.kind));}
function renderTransport(){$('#mobility-section').innerHTML=renderMobility(catalog,state,mobility,roadRegion,ferryRoute);}
function updateHealth() {
  const stale=isStale(state.lastSuccessfulAt);
  $('#freshness').innerHTML=`<strong>${stale?'Revisión pendiente':'Fuentes consultadas'}</strong><small>${date(state.lastSuccessfulAt)}</small>`;
  const banner=$('#connection-banner');
  if(!navigator.onLine){banner.hidden=false;banner.textContent='Sin conexión. Estás consultando los últimos datos guardados; el mapa y los enlaces necesitan señal.';}
  else if(stale){banner.hidden=false;banner.textContent='Han pasado más de 48 horas sin una revisión satisfactoria. Consulta las fuentes antes de viajar.';}
  else {banner.hidden=true;}
}
function renderDetail(id: string) {
  const p=catalog.places.find(x=>x.id===id);if(!p)return;
  const status=effectiveStatus(p,state),saved=favorites.has(id);
  const services=Object.entries(p.services).map(([key,value])=>`<div class="service-item ${value===null?'unknown-service':''}">${icon(key)}<span>${serviceLabels[key as Service]}<small>${value===true?'Publicado por la fuente':value===false?'No disponible según fuente':'Sin información'}</small></span></div>`).join('');
  const notices=p.sources.map(s=>{const o=state.observations[s.id];return o?.notice?`<div class="source-notice"><strong>${esc(s.label)}</strong><p>${esc(o.notice)}</p>${o.changed?'<span class="review-needed">La fuente cambió: confirma las condiciones.</span>':''}${!o.ok?'<span class="review-needed">Última consulta fallida. Se conserva el aviso anterior.</span>':''}</div>`:'';}).join('');
  const story=p.story?`<section class="story-box"><span class="eyebrow">${esc(p.story.label)}</span><p>${esc(p.story.text)}</p>${link(sourceLink(p,p.story.sourceId)?.url,'Leer la fuente del relato')}</section>`:'';
  const walk=p.walk?`<h3>A pie, a tu ritmo</h3><p>${esc(p.walk.description)}</p><p class="quiet">${link(sourceLink(p,p.walk.sourceId)?.url,'Fuente del recorrido a pie')}</p>`:'';
  $('#detail-content').innerHTML=`<div class="detail-heading"><span class="eyebrow">${kindLabels[p.kind]} · ${esc(p.region)}</span><h2>${esc(p.name)}</h2><p>${icon('pin')}${esc(p.locality)}</p><div class="detail-status"><span class="status ${status}"><i></i>${STATUS_LABELS[status as keyof typeof STATUS_LABELS]}</span><button class="secondary-button ${saved?'saved':''}" data-save="${esc(p.id)}" aria-pressed="${saved}">${icon('heart')}${saved?'Guardado':'Guardar lugar'}</button></div></div><div class="detail-body"><p class="detail-description">${esc(p.description)}</p><div class="highlights">${p.highlights.map(h=>`<span>${esc(h)}</span>`).join('')}</div>${story}${walk}<h3>Antes de ir</h3><div class="access-box">${icon('info')}<p>${esc(p.access)}</p></div><p class="quiet">Consulta el acceso específico que quieres visitar. Horarios, tours y cupos pueden tener condiciones diferentes.</p>${notices?`<h3>Avisos de las fuentes</h3>${notices}`:''}<h3>Servicios publicados</h3><div class="services-grid">${services}</div>${p.serviceSource?`<p class="quiet">Servicios según ${link(sourceLink(p,p.serviceSource)?.url,esc(sourceLink(p,p.serviceSource)?.label||'fuente'))}.</p>`:''}${p.price?`<h3>Tarifa publicada</h3><p><strong>${new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(p.price.amount)}</strong> ${esc(p.price.unit)} · consultada el ${date(p.price.observedAt)}. Confirmar antes de reservar.</p>`:''}<h3>Contacto y acceso</h3><div class="contact-actions">${p.phone?`<a class="secondary-button" href="tel:${esc(p.phone.replace(/[^+\d]/g,''))}">${icon('phone')} ${esc(p.phone)}</a>`:''}${p.whatsapp?link(`https://wa.me/${p.whatsapp.replace(/\D/g,'')}`,'WhatsApp','secondary-button'):''}${link(p.booking,'Consultar reservas','secondary-button')}${link(p.website,'Sitio del lugar','secondary-button')}${link(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name+' '+p.locality+' Chile')}`,'Cómo llegar','primary-button')}</div><p class="quiet">${esc(p.coordinateNote)} ${link(p.coordinateSource,'Fuente de ubicación')}</p><h3>Fuentes y fechas</h3><div class="sources-list">${p.sources.map(s=>{const o=state.observations[s.id];return `<div>${link(s.url,esc(s.label))}<small>Última consulta: ${date(o?.checkedAt||s.checkedAt)}${o?.evidenceAt?` · Evidencia: ${date(o.evidenceAt)}`:' · Sin fecha de apertura confirmada'}</small>${o&&!o.ok?'<small class="review-needed">No se pudo consultar en el último intento.</small>':''}${s.adapter==='reference'?'<small>Referencia consultada durante la investigación inicial.</small>':''}</div>`;}).join('')}</div></div>`;
}
function openDetail(id: string) {
  if(!catalog.places.some(p=>p.id===id))return;
  activePlace=id;renderDetail(id);const d=$<HTMLDialogElement>('#detail');if(!d.open)d.showModal();d.scrollTop=0;
  history.replaceState(null,'',`#lugar/${encodeURIComponent(id)}`);
}
async function initMap() {
  if(map){map.invalidateSize();return;}if(mapLoading)return;
  if(!navigator.onLine){toast('El mapa detallado necesita conexión. Tus fichas siguen disponibles.');return;}
  mapLoading=true;
  try {
    L=await import('leaflet');$('#map').innerHTML='';
    map=L.map('map',{scrollWheelZoom:false,zoomControl:false}).setView([-38.6,-72.5],6);
    L.control.zoom({position:'topright'}).addTo(map);
    const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
    let tileErrorShown=false;tiles.on('tileerror',()=>{if(!tileErrorShown){tileErrorShown=true;toast('No se pudo cargar parte del mapa. Las fichas y ubicaciones siguen disponibles.');}});
    layer=L.layerGroup().addTo(map);renderMarkers();fitMap();
  }catch{toast('No se pudo cargar el mapa. Puedes seguir usando la lista.');}
  finally{mapLoading=false;}
}
function renderMarkers() {
  if(!map||!L||!layer)return;
  layer.clearLayers();
  for(const p of visiblePlaces){const marker=L.marker(p.coordinates,{icon:L.divIcon({className:'place-marker '+p.kind,html:icon(placeIcon(p)),iconSize:[34,34],iconAnchor:[17,17]}),title:p.name,alt:p.name});marker.bindTooltip(esc(p.name),{direction:'top',offset:[0,-16]});marker.on('click',()=>openDetail(p.id));marker.addTo(layer);}
  if(position)L.circleMarker(position,{radius:7,color:'#fff',fillColor:'#267cb5',fillOpacity:1,weight:3}).bindTooltip('Tu ubicación aproximada').addTo(layer);
}
function fitMap(){if(map&&L&&visiblePlaces.length)map.fitBounds(L.latLngBounds(visiblePlaces.map(p=>p.coordinates)),{padding:[35,35],maxZoom:12});}
let usedCache=false;
async function fetchJson(path: string) {
  if(!navigator.onLine && 'caches' in window){const cached=await caches.match(new URL(path,document.baseURI));if(cached)return cached.json();}
  const response=await fetch(new URL(path,document.baseURI),{signal:AbortSignal.timeout(12000),cache:'no-cache'});
  if(!response.ok)throw new Error('Respuesta inválida');
  if(response.headers.get('X-Ruta-Sur-Cache')==='offline')usedCache=true;
  return response.json();
}
function loadStoredMobility(){try{const m=JSON.parse(localStorage.getItem('ruta-sur-v2-mobility')||'null');if(m?.schemaVersion===2&&Array.isArray(m.notices))mobility=m;}catch{}}
async function loadData() {
  usedCache=false;
  const before=JSON.stringify([typeof catalog==='undefined'?null:catalog,state,mobility]);
  let network=navigator.onLine;
  if(!navigator.onLine){
    try{
      const savedCatalog=JSON.parse(localStorage.getItem('ruta-sur-v2-catalog')||'null');
      const savedState=JSON.parse(localStorage.getItem('ruta-sur-v2-state')||'null');
      if(savedCatalog?.schemaVersion===2&&savedCatalog.places?.length){catalog=savedCatalog;if(savedState?.schemaVersion===2&&savedState.observations)state=savedState;loadStoredMobility();return {network:false,changed:false};}
    }catch{/* The service worker cache is the fallback when storage is unavailable. */}
  }
  let freshCatalog: Catalog;
  try {
    freshCatalog=await fetchJson('./data/v2/catalog.json');
    if(freshCatalog.schemaVersion!==2||!Array.isArray(freshCatalog.places)||!freshCatalog.places.length)throw new Error('Catálogo inválido');
    try{localStorage.setItem('ruta-sur-v2-catalog',JSON.stringify(freshCatalog));}catch{/* Service worker is the main offline store. */}
  }catch(error){const stored=localStorage.getItem('ruta-sur-v2-catalog');if(!stored)throw error;freshCatalog=JSON.parse(stored);network=false;}
  catalog=freshCatalog;
  try{const next=await fetchJson('./data/v2/state.json');if(next.schemaVersion!==2||!next.observations)throw new Error('Estado inválido');state=next;try{localStorage.setItem('ruta-sur-v2-state',JSON.stringify(state));}catch{}}
  catch{network=false;try{const stored=localStorage.getItem('ruta-sur-v2-state');if(stored)state=JSON.parse(stored);}catch{}}
  try{const m=await fetchJson('./data/v2/mobility.json');if(m.schemaVersion!==2||!Array.isArray(m.notices))throw Error('Datos de caminos inválidos');mobility=m;try{localStorage.setItem('ruta-sur-v2-mobility',JSON.stringify(m));}catch{}}catch{network=false;loadStoredMobility();}
  return {network:network&&!usedCache,changed:before!==JSON.stringify([catalog,state,mobility])};
}
async function reload(feedback=true) {
  $<HTMLButtonElement>('#reload').disabled=true;
  $('#reload').textContent='Consultando…';const button=document.querySelector<HTMLButtonElement>('#mobility-refresh');if(button){button.disabled=true;button.textContent='Consultando…';}
  try{const result=await loadData();render();if(activePlace)renderDetail(activePlace);if(feedback)toast(!result.network?'No pudimos descargar toda la revisión. Conservamos los datos guardados.':result.changed?'Información actualizada. Revisa las fechas de cada fuente.':'Ya tienes la última revisión publicada. No hay cambios nuevos.');}
  catch{if(feedback)toast('No se pudo actualizar. Conservamos los datos que ya tenías.');}
  finally{$<HTMLButtonElement>('#reload').disabled=false;$('#reload').textContent='↻ Actualizar información';if(mobilityView)renderTransport();}
}
async function prepareOffline(feedback=false) {
  if(!('serviceWorker' in navigator)||!('caches' in window)){if(feedback)toast('Este navegador no permite preparar la app sin conexión.');return;}
  try {
    await navigator.serviceWorker.register(new URL('./sw.js',document.baseURI),{scope:'./'});
    const registration=await navigator.serviceWorker.ready;
    offlineReady=await new Promise<boolean>(resolve=>{const channel=new MessageChannel();const timeout=setTimeout(()=>resolve(false),10000);channel.port1.onmessage=e=>{clearTimeout(timeout);resolve(e.data?.ready===true);};registration.active?.postMessage({type:'CHECK_OFFLINE'},[channel.port2]);});
    if(offlineReady){$('#offline').innerHTML=icon('check')+'<span>Fichas listas sin señal</span>';$('#offline').classList.add('ready');if(feedback)toast('Las fichas, ferries, avisos guardados y tus favoritos están disponibles sin señal. El mapa necesita conexión.');}
    else if(feedback)toast('La descarga todavía no terminó. Mantén la conexión y vuelve a intentarlo.');
  }catch{if(feedback)toast('No pudimos completar la descarga. Prueba de nuevo con conexión.');}
}
async function main() {
  try {
    await loadData();skeleton();render();void prepareOffline();
    if(location.hash.startsWith('#lugar/'))openDetail(decodeURIComponent(location.hash.slice(7)));
    if(matchMedia('(min-width: 900px)').matches)void initMap();
  }catch{$('#app').innerHTML=`<div class="fatal-error">${icon('mountain')}<h1>El camino sigue aquí.</h1><p>No pudimos cargar el catálogo. Conéctate a internet para abrir la app por primera vez.</p><button class="primary-button" id="retry">Volver a intentar</button></div>`;$('#retry').addEventListener('click',()=>location.reload());}
}
void main();
