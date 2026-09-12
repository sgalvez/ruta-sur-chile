import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRoad,fetchRoads} from '../scripts/roads.mjs';
import {ferryNeedsReview,filterPlaces} from '../src/domain.mjs';
const now=Date.parse('2026-09-12T20:00:00Z');
const feature={attributes:{OBJECTID:5,REGION:'07',ROL:'115-CH',TRANSITO:'No Operativo',SIMBOLOGIA:'Parcialmente Operativo',FECHA_EMERGENCIA:now},geometry:{x:-70.58,y:-35.95}};
test('MOP disagreement never becomes a confirmed status; dates and coordinates stay scoped',()=>{
 const n=normalizeRoad(feature);assert.equal(n.status,'unknown');assert.equal(n.region,'Maule');assert.deepEqual(n.coordinates,[-35.95,-70.58]);
 assert.equal(normalizeRoad({...feature,attributes:{...feature.attributes,SIMBOLOGIA:'No Operativo'}}).status,'closed');
 assert.equal(normalizeRoad({...feature,attributes:{...feature.attributes,REGION:'04'}}),null);
 assert.equal(normalizeRoad({...feature,geometry:{x:0,y:0}}).coordinates,null);
});
test('MOP obtains all IDs then batches records; missing records reject the entire snapshot',async()=>{
 const ids=Array.from({length:205},(_,i)=>i+1);let batches=0;
 const mock=missing=>async url=>{const q=new URL(url).searchParams;if(q.has('returnIdsOnly'))return {ok:true,json:async()=>({objectIds:ids})};batches++;const requested=q.get('objectIds').split(',').map(Number);return {ok:true,json:async()=>({features:requested.slice(missing?1:0).map(id=>({...feature,attributes:{...feature.attributes,OBJECTID:id}}))})};};
 const result=await fetchRoads(mock(false));assert.equal(result.length,205);assert.equal(batches,3);
 await assert.rejects(fetchRoads(mock(true)),/incompleta/);
 await assert.rejects(fetchRoads(async()=>({ok:true,json:async()=>({error:{message:'unavailable'}})})),/unavailable/);
});
test('expired ferry itinerary and changed or failed pages require review',()=>{
 const ferry={sources:[{id:'a',adapter:'operator'}]},state={observations:{a:{ok:true,checkedAt:new Date(now).toISOString(),changed:false}}};
 assert.equal(ferryNeedsReview(ferry,state,now),false);
 assert.equal(ferryNeedsReview({...ferry,validUntil:'2026-06-30T23:59:59Z'},state,now),true);
 for(const patch of [{changed:true},{ok:false},{checkedAt:'2026-09-01T00:00:00Z'}])assert.equal(ferryNeedsReview(ferry,{observations:{a:{...state.observations.a,...patch}}},now),true);
});
test('route, themes and nature filters compose without treating a cemetery as a park',()=>{
 const base={region:'Los Lagos',locality:'Quemchi',services:{},highlights:[],sources:[],routes:['main'],themes:['heritage','myths']};
 const places=[{...base,id:'aucar',name:'Aucar',kind:'cemetery',story:{text:'Almas navegantes'}},{...base,id:'nature',name:'Monumento',kind:'monument',themes:[]}];
 const state={observations:{}};
 assert.deepEqual(filterPlaces(places,{route:'main',themes:['myths','heritage'],query:'almas'},state,new Set()).map(p=>p.id),['aucar']);
 assert.equal(filterPlaces(places,{route:'austral'},state,new Set()).length,0);
 assert.deepEqual(filterPlaces(places,{kind:'nature'},state,new Set()).map(p=>p.id),['nature']);
});
