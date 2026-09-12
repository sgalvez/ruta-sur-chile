import { load } from 'cheerio';
import { createHash } from 'node:crypto';
import { normalize } from '../src/domain.mjs';

export const fingerprint = text => createHash('sha256').update(text).digest('hex');
export const compact = text => text.replace(/\s+/g, ' ').trim();
export function extractSource(html, source) {
  const $=load(html);$('script,style,header,footer,nav,noscript').remove();
  const title=compact($(source.titleSelector || (source.adapter==='conaf' ? 'h2.elementor-heading-title' : 'h1')).first().text());
  const expected=normalize(source.expectedTitle || '').replace(/[^a-z0-9 ]/g,'');
  const actual=normalize(title).replace(/[^a-z0-9 ]/g,'');
  if (!expected || !actual.includes(expected)) throw new Error('La página no corresponde a la ficha esperada');
  let text=compact($('body').text());
  if(source.adapter==='conaf') {
    const sections=[];
    $('tr').each((_,row)=>{const cells=$(row).children('td,th');const label=compact(cells.first().text());if(['Servicios','Accesos'].includes(label))sections.push(`${label}: ${compact(cells.slice(1).text())}`);});
    const marker='Información para visitar el parque';
    const start=text.lastIndexOf(marker);
    if(start<0)throw new Error('Cambió el formato de la ficha CONAF');
    text=text.slice(start+marker.length).split(/\bUnidad\s/)[0];
    text=text.replace(/Planifica tu visita:.*?Recuerda que la información oficial.*?Pases Parques\s*\./,'').trim();
    // The generic health advisory is unrelated to the operational status.
    text=text.split(/(?:ATENCIÓN|IMPORTANTE|AVISO):\s*Chile experimenta/)[0].trim();
    if(!text)text='La ficha no publica un aviso de apertura fechado. Consulta horarios y condiciones en la fuente oficial.';
    text += '\n'+sections.join('\n');
  } else if(source.adapter==='directory') {
    const marker='Una experiencia para bajar el ritmo.';
    if(!text.includes(marker))throw new Error('Cambió el formato del directorio');
    text=text.split(marker)[1].split('Galería de')[0];
  } else if(source.adapter==='pases') {
    const start=text.indexOf(title);
    text=text.slice(start+title.length).split('Cada rincón')[0].split('Ubicación')[0];
    if(!/INFORMACIÓN IMPORTANTE|Último Ingreso|Horarios/.test(text))throw new Error('No se reconocen avisos u horarios');
  } else {
    const main=$(source.contentSelector || 'main').first();
    if(!main.length)throw new Error('La fuente necesita revisión manual de su formato');
    text=compact(main.text());
  }
  text=compact(text);
  if(text.length<25)throw new Error('Información incompleta');
  return { title, text, hash:fingerprint(text) };
}
export function excerpt(text) {
  // Publish a short attributed extract, never a copy of the source page.
  const paragraphs=text.replace(/^AVISOS?:\s*/i,'');
  const key=/\b(?:cerrad[oa]|4\s*[x×✕]\s*4|restricciones|cierre|suspendid[oa]|temporada)\b/i.exec(paragraphs);
  const start=key?Math.max(0,key.index-65):0;
  const fragment=paragraphs.slice(start).split(/\s+/).slice(0,24).join(' ');
  return `${start?'… ':''}${fragment}${paragraphs.slice(start).split(/\s+/).length>24?' …':''}`;
}
export function datedStatus(text, now = Date.now()) {
  const unknown={status:'unknown',evidenceAt:null,validUntil:null};
  const months={enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12};
  const d='(\\d{1,2}) de ('+Object.keys(months).join('|')+') de (\\d{4})';
  const parseDate=m=>{const iso=`${m[3]}-${String(months[m[2].toLowerCase()]).padStart(2,'0')}-${m[1].padStart(2,'0')}`;const t=Date.parse(iso+'T12:00:00Z');return new Date(t).toISOString().startsWith(iso)?iso+'T12:00:00Z':null;};
  // Read only the visitor announcement here; a camping or trail closure in
  // Servicios must never close the whole park.
  const announcement=text.split('Servicios:')[0];
  const patterns=[
    ['closed',new RegExp('(?:El parque|La reserva|La unidad) se (?:mantiene|encuentra) cerrad[oa] al público[^.]{0,110}?desde el '+d,'i')],
    ['partial',new RegExp('(?:atención a público se reanuda|es posible visitar los senderos cortos),? desde el '+d,'i')],
    ['partial',new RegExp('Desde el '+d+': (?:acceso|ingreso) solo con vehículos 4','i')],
    ['open',new RegExp('(?:El parque|La reserva) (?:está|se encuentra) abiert[oa] al público desde el '+d,'i')],
  ];
  for(const [status,pattern] of patterns){
    const m=announcement.match(pattern);if(!m)continue;
    const evidenceAt=parseDate(m);if(!evidenceAt||Date.parse(evidenceAt)>now)return unknown;
    // A reopening limited to a named sector is partial, never a full opening.
    if(status==='partial'&&/atención a público se reanuda/i.test(m[0])&&!/pero solo|únicamente|restric/i.test(announcement))return unknown;
    if(status==='open'&&/cerrad|restric|pero solo/i.test(announcement))return unknown;
    return {status,evidenceAt,validUntil:null};
  }
  // Explicit ISO intervals are supported for future compatible source formats.
  const match=text.match(/\b(?:Estado del parque|Estado de visita):\s*(abierto|cerrado|apertura parcial)\s*[,;.\s]+(?:vigente )?desde (\d{4}-\d{2}-\d{2}) hasta (\d{4}-\d{2}-\d{2})\b/i);
  if(!match)return unknown;
  const evidenceAt=match[2]+'T00:00:00-03:00',validUntil=match[3]+'T23:59:59-03:00';
  const start=Date.parse(evidenceAt),end=Date.parse(validUntil);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>now||end<now||start>end)return {status:'unknown',evidenceAt:null,validUntil:null};
  return {status:({'abierto':'open','cerrado':'closed','apertura parcial':'partial'})[match[1].toLowerCase()],evidenceAt,validUntil};
}
export function observe(source, extracted, previous, at) {
  return {sourceId:source.id,checkedAt:at,attemptedAt:at,ok:true,hash:extracted.hash,
    changed:source.reviewedHash ? source.reviewedHash!==extracted.hash : Boolean(previous?.changed || (previous?.hash && previous.hash!==extracted.hash)),
    notice:excerpt(extracted.text),...datedStatus(extracted.text,Date.parse(at))};
}
export function failedObservation(source, previous, at, error) {
  return {...previous,sourceId:source.id,checkedAt:previous?.checkedAt||null,attemptedAt:at,ok:false,
    changed:previous?.changed||false,notice:previous?.notice||'',status:previous?.status||'unknown',
    evidenceAt:previous?.evidenceAt||null,validUntil:previous?.validUntil||null,error:String(error).slice(0,180)};
}
