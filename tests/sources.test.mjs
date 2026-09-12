import test from 'node:test';
import assert from 'node:assert/strict';
import {extractSource,datedStatus,observe,failedObservation,excerpt} from '../scripts/sources.mjs';
const now=Date.parse('2026-09-12T18:00:00Z');
const source={id:'test',expectedTitle:'Parque Nacional Ejemplo',adapter:'conaf'};
test('a 200 page belonging to another place is rejected',()=>{
 assert.throws(()=>extractSource('<h1>Página no encontrada</h1>',source));
 assert.throws(()=>extractSource('<h2 class="elementor-heading-title">Parque Nacional Otro</h2><p>Información para visitar el parque</p>',source));
});
test('CONAF adapter monitors services as well as visitor announcements',()=>{
 const html='<body><h2 class="elementor-heading-title">Parque Nacional Ejemplo</h2><p>Información para visitar el parque</p><p>AVISO: Consulte los sectores disponibles para su visita.</p><table><tr><td>Unidad</td><td>Ejemplo</td></tr><tr><td>Servicios</td><td>El camping está cerrado por reparación.</td></tr></table></body>';
 const result=extractSource(html,source);assert.match(result.text,/camping está cerrado/);
 assert.equal(datedStatus(result.text,now).status,'unknown');
});
test('parser distinguishes whole-unit closures, partial access and unrelated trail closures',()=>{
 assert.equal(datedStatus('La reserva se mantiene cerrada al público durante la temporada invernal, desde el 1 de junio de 2026.',now).status,'closed');
 assert.equal(datedStatus('La atención a público se reanuda desde el 12 de agosto de 2026, pero solo hasta un mirador.',now).status,'partial');
 assert.equal(datedStatus('Desde el 8 de agosto de 2026: acceso solo con vehículos 4 × 4.',now).status,'partial');
 assert.equal(datedStatus('Sendero El Mirador cerrado desde el 1 de junio de 2026.',now).status,'unknown');
 assert.equal(datedStatus('El parque se encuentra abierto al público desde el 1 de octubre de 2026.',now).status,'unknown');
 assert.equal(datedStatus('Parque abierto de lunes a domingo.',now).status,'unknown');
 assert.equal(datedStatus('La reserva se mantiene cerrada al público desde el 31 de febrero de 2026.',now).status,'unknown');
});
test('expired interval never implies reopening',()=>{
 assert.equal(datedStatus('Estado del parque: cerrado desde 2026-09-01 hasta 2026-09-10',now).status,'unknown');
});
test('refresh failures preserve original evidence and changed flags persist until review',()=>{
 const previous={checkedAt:'2026-09-10T10:00:00Z',hash:'old',notice:'Aviso anterior',status:'closed',evidenceAt:'2026-09-01T12:00:00Z',changed:true};
 const failed=failedObservation(source,previous,'2026-09-12T10:00:00Z','timeout');
 assert.equal(failed.checkedAt,previous.checkedAt);assert.equal(failed.notice,'Aviso anterior');assert.equal(failed.ok,false);
 const next=observe(source,{hash:'old',text:'Información de visita que necesita confirmación'},previous,'2026-09-12T10:00:00Z');
 assert.equal(next.changed,true);assert.equal(next.evidenceAt,null);
 assert.ok(excerpt('palabra '.repeat(100)).split(/\s+/).filter(x=>x!=='…').length<=24);
});
