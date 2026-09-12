import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {REGIONS,safeExternalUrl} from '../src/domain.mjs';
export function validateCatalog(catalog){
  assert.equal(catalog.schemaVersion,1);assert.ok(Number.isFinite(Date.parse(catalog.researchedAt)));
  assert.ok(catalog.places.length>=40&&catalog.places.length<=60,'El catálogo debe contener entre 40 y 60 lugares');
  const ids=new Set(),sources=new Map();
  for(const p of catalog.places){
    assert.ok(p.id&&!ids.has(p.id),'ID duplicado');ids.add(p.id);
    assert.ok(['camping','park','reserve'].includes(p.kind));assert.ok(REGIONS.includes(p.region),`Región inválida: ${p.name}`);
    assert.ok(p.name&&p.locality&&p.description&&p.access&&p.coordinateNote);
    assert.ok(p.description.length<700,'La descripción debe ser una síntesis original');
    assert.ok(Array.isArray(p.coordinates)&&p.coordinates.length===2);
    const [lat,lng]=p.coordinates;
    assert.ok(Number.isFinite(lat)&&lat<=-33.7&&lat>=-43.3&&Number.isFinite(lng)&&lng>=-74.5&&lng<=-70,`Coordenadas fuera de cobertura: ${p.name}`);
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
    if(p.phone)assert.match(p.phone,/^\+56\d{9}$/,'El teléfono debe tener formato chileno completo');
    if(p.whatsapp)assert.match(p.whatsapp,/^\+569\d{8}$/);
    for(const u of [p.website,p.booking].filter(Boolean))assert.ok(safeExternalUrl(u));
  }
  assert.deepEqual(new Set(catalog.places.map(p=>p.region)),new Set(REGIONS));
  return true;
}
if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1]){
  const catalog=JSON.parse(await readFile(new URL('../public/data/catalog.json',import.meta.url),'utf8'));
  validateCatalog(catalog);
  const state=JSON.parse(await readFile(new URL('../public/data/state.json',import.meta.url),'utf8'));
  assert.equal(state.schemaVersion,1);assert.ok(state.observations);
  const sourceIds=new Set(catalog.places.flatMap(p=>p.sources.map(s=>s.id)));
  for(const [id,o]of Object.entries(state.observations)){
    assert.ok(sourceIds.has(id));assert.equal(o.sourceId,id);assert.ok(['open','closed','partial','unknown'].includes(o.status));
    if(o.status!=='unknown')assert.ok(o.evidenceAt&&o.checkedAt);
  }
  console.log(`Catálogo válido: ${catalog.places.length} lugares, ${REGIONS.length} regiones.`);
}
