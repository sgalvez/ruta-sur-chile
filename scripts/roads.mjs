export const ROAD_URL='https://rest-sit.mop.gob.cl/arcgis/rest/services/VIALIDAD/Emergencias_Vialidad/MapServer/0';
export const REGION_CODES={'13':'Metropolitana','06':'O’Higgins','07':'Maule','16':'Ñuble','08':'Biobío','09':'La Araucanía','14':'Los Ríos','10':'Los Lagos'};
const asDate=value=>value!==null&&value!==undefined&&Number.isFinite(Number(value))?new Date(Number(value)).toISOString():null;
const clean=value=>String(value??'').replace(/<[^>]*>/g,'').trim();
export function normalizeRoad(feature){
 const a=feature.attributes||{},g=feature.geometry;
 const region=REGION_CODES[String(a.REGION).padStart(2,'0')];if(!region)return null;
 const statuses=[a.TRANSITO,a.SIMBOLOGIA].filter(Boolean).map(clean);
 const labels={'Operativo':'open','Parcialmente Operativo':'partial','No Operativo':'closed'};
 const status=statuses.length&&new Set(statuses).size===1?(labels[statuses[0]]||'unknown'):'unknown';
 const coordinates=g&&Number.isFinite(g.x)&&Number.isFinite(g.y)&&g.y<=-33&&g.y>=-43.6&&g.x>=-75&&g.x<=-69?[g.y,g.x]:null;
 return {id:String(a.OBJECTID),region,road:clean(a.ROL),name:clean(a.NOMBRE_CAMINO),restriction:clean(a.RESTRICCION),summary:clean(a.RESUMEN_EMERGENCIA||a.RESUMEN),status,reportedStatus:[...new Set(statuses)].join(' / '),evidenceAt:asDate(a.FECHA_EMERGENCIA),updatedAt:asDate(a.last_edited_date),coordinates};
}
export async function fetchRoads(fetcher=fetch){
 const request=async params=>{const r=await fetcher(ROAD_URL+'/query?'+new URLSearchParams({...params,f:'json'}),{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('MOP HTTP '+r.status);const d=await r.json();if(d.error)throw Error('MOP: '+d.error.message);return d;};
 const where='REGION IN ('+Object.keys(REGION_CODES).map(c=>`'${c}'`).join(',')+')';
 const ids=await request({where,returnIdsOnly:'true'});
 if(!Array.isArray(ids.objectIds))throw Error('MOP: listado incompleto');
 const unique=[...new Set(ids.objectIds)],features=[];
 for(let i=0;i<unique.length;i+=100){
  const batch=unique.slice(i,i+100);
  const data=await request({objectIds:batch.join(','),outFields:'OBJECTID,REGION,ROL,NOMBRE_CAMINO,RESUMEN_EMERGENCIA,RESUMEN,FECHA_EMERGENCIA,TRANSITO,RESTRICCION,SIMBOLOGIA,last_edited_date',returnGeometry:'true',outSR:'4326'});
  if(!Array.isArray(data.features)||data.exceededTransferLimit||new Set(data.features.map(f=>f.attributes?.OBJECTID)).size!==batch.length)throw Error('MOP: respuesta incompleta, se conserva revisión anterior');
  if(data.features.some(f=>!batch.includes(f.attributes?.OBJECTID)))throw Error('MOP: identificadores inesperados');
  features.push(...data.features);
 }
 return features.map(normalizeRoad).filter(Boolean);
}
