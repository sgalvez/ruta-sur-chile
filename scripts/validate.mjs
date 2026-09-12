import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {REGIONS,KIND_LABELS,safeExternalUrl} from '../src/domain.mjs';
export function validateCatalog(catalog){
  assert.equal(catalog.schemaVersion,2);assert.ok(Number.isFinite(Date.parse(catalog.researchedAt)));
  assert.ok(catalog.places.length>=42,'Conservar el catálogo original');
  const ids=new Set(),sources=new Map();
  for(const p of catalog.places){
    assert.ok(p.id&&!ids.has(p.id),'ID duplicado');ids.add(p.id);
    assert.ok(p.kind in KIND_LABELS);assert.ok(REGIONS.includes(p.region),`Región inválida: ${p.name}`);
    assert.ok(p.routes.length&&p.routes.every(r=>['main','austral'].includes(r)));assert.ok(p.themes.every(t=>['myths','heritage'].includes(t)));
    assert.ok(p.name&&p.locality&&p.description&&p.access&&p.coordinateNote);
    assert.ok(p.description.length<700,'La descripción debe ser una síntesis original');
    assert.ok(Array.isArray(p.coordinates)&&p.coordinates.length===2);
    const [lat,lng]=p.coordinates;
    assert.ok(Number.isFinite(lat)&&lat<=-33&&lat>=-43.6&&Number.isFinite(lng)&&lng>=-75&&lng<=-69,`Coordenadas fuera de cobertura: ${p.name}`);
    assert.ok(safeExternalUrl(p.coordinateSource));
    for(const k of ['toilets','water','showers','electricity','parking'])assert.ok([true,false,null].includes(p.services[k]));
    assert.ok(p.sources.length>0);
    for(const s of p.sources){
      assert.ok(s.id&&s.label&&safeExternalUrl(s.url));
      assert.ok(['conaf','pases','operator','directory','reference'].includes(s.adapter));
      if(s.adapter!=='reference')assert.ok(s.expectedTitle,'Falta el título esperado para validar la fuente');
      if(sources.has(s.id))assert.deepEqual(s,sources.get(s.id),'Una fuente compartida debe tener la misma definición');
      sources.set(s.id,s);
    }
    if(p.serviceSource)assert.ok(p.sources.some(s=>s.id===p.serviceSource));
    for(const item of [p.walk,p.story].filter(Boolean))assert.ok(p.sources.some(s=>s.id===item.sourceId));
    assert.ok(p.statusSourceIds.every(id=>p.sources.some(s=>s.id===id)));
    if(p.phone)assert.match(p.phone,/^\+56\d{9}$/,'El teléfono debe tener formato chileno completo');
    if(p.whatsapp)assert.match(p.whatsapp,/^\+569\d{8}$/);
    for(const u of [p.website,p.booking].filter(Boolean))assert.ok(safeExternalUrl(u));
  }
  assert.equal(catalog.ferries.length,7);
  for(const f of catalog.ferries){
    assert.ok(f.id&&!ids.has(f.id));ids.add(f.id);
    assert.ok(f.name&&f.operator&&f.schedule&&f.fare&&f.bookingNote&&f.duration);
    assert.ok([true,false,null].includes(f.vehicles));assert.ok(safeExternalUrl(f.booking));
    assert.ok(f.terminals.length===2&&f.terminals.every(t=>t.name&&safeExternalUrl(t.mapUrl)));
    assert.ok(f.sources.length&&f.sources.every(s=>s.id&&s.label&&s.expectedTitle&&safeExternalUrl(s.url)));
    assert.ok(f.routes.length&&f.routes.every(r=>['main','austral'].includes(r)));
  }
  assert.deepEqual(new Set(catalog.places.map(p=>p.region)),new Set(REGIONS));
  return true;
}
if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1]){
  const catalog=JSON.parse(await readFile(new URL('../public/data/v2/catalog.json',import.meta.url),'utf8'));
  validateCatalog(catalog);
  const legacy=JSON.parse(await readFile(new URL('../public/data/catalog.json',import.meta.url),'utf8'));
  for(const p of legacy.places)assert.ok(catalog.places.some(n=>n.id===p.id&&n.kind===p.kind),'Se perdió un lugar original');
  const state=JSON.parse(await readFile(new URL('../public/data/v2/state.json',import.meta.url),'utf8'));
  assert.equal(state.schemaVersion,2);assert.ok(state.observations);
  const sourceIds=new Set([...catalog.places,...catalog.ferries].flatMap(p=>p.sources.map(s=>s.id)));
  for(const [id,o]of Object.entries(state.observations)){
    assert.ok(sourceIds.has(id));assert.equal(o.sourceId,id);assert.ok(['open','closed','partial','unknown'].includes(o.status));
    if(o.status!=='unknown')assert.ok(o.evidenceAt&&o.checkedAt);
  }
  const roads=JSON.parse(await readFile(new URL('../public/data/v2/mobility.json',import.meta.url),'utf8'));
  assert.equal(roads.schemaVersion,2);assert.ok(Array.isArray(roads.notices));
  assert.equal(new Set(roads.notices.map(n=>n.id)).size,roads.notices.length);
  for(const n of roads.notices){assert.ok(REGIONS.includes(n.region));assert.ok(['open','closed','partial','unknown'].includes(n.status));}
  console.log(`Catálogo válido: ${catalog.places.length} lugares, ${REGIONS.length} regiones.`);
}
