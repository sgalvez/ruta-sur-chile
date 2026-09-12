import { readFile, writeFile, rename } from 'node:fs/promises';
import { extractSource, observe, failedObservation } from './sources.mjs';
const root=new URL('../public/data/',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('catalog.json',root),'utf8'));
let previous;
try{previous=JSON.parse(await readFile(new URL('state.json',root),'utf8'));}catch{previous={schemaVersion:1,lastSuccessfulAt:null,observations:{}};}
const at=new Date().toISOString();
const next={schemaVersion:1,attemptedAt:at,lastSuccessfulAt:previous.lastSuccessfulAt,observations:{...previous.observations}};
const sources=[...new Map(catalog.places.flatMap(p=>p.sources).filter(s=>s.adapter!=='reference').map(s=>[s.id,s])).values()];
let success=0;
for(const source of sources){
  try{
    const response=await fetch(source.url,{headers:{'User-Agent':'RutaSurChile/1.0 (+https://github.com/sgalvez/ruta-sur-chile)'},signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    if(!response.headers.get('content-type')?.includes('text/html'))throw new Error('Formato no compatible');
    const body=await response.text();if(body.length>3_000_000)throw new Error('Respuesta demasiado grande');
    const extracted=extractSource(body,source);
    next.observations[source.id]=observe(source,extracted,previous.observations[source.id],at);
    success++;console.log(`OK ${source.id}${next.observations[source.id].changed?' · cambio pendiente de revisión':''}`);
  }catch(error){
    next.observations[source.id]=failedObservation(source,previous.observations[source.id],at,error.message);
    console.warn(`WARN ${source.id}: ${error.message}`);
  }
  await new Promise(resolve=>setTimeout(resolve,800));
}
// A partially successful run must not hide failures: each source keeps its own
// check timestamp and health. A global success requires every monitored source.
if(success===sources.length && success>0)next.lastSuccessfulAt=at;
const tmp=new URL('state.json.tmp',root);await writeFile(tmp,JSON.stringify(next,null,2)+'\n');await rename(tmp,new URL('state.json',root));
console.log(`${success}/${sources.length} fuentes consultadas; ${at}`);
if(success===0)console.error('Ninguna fuente respondió correctamente. Se conservó la evidencia anterior.');
