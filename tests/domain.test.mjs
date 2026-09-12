import test from 'node:test';
import assert from 'node:assert/strict';
import {filterPlaces,distanceKm,effectiveStatus,normalize,safeExternalUrl,isStale} from '../src/domain.mjs';
const now=Date.parse('2026-09-12T18:00:00Z');
const p={id:'a',name:'Río Ñuble',locality:'Pinto',region:'Ñuble',kind:'camping',highlights:['Río'],services:{water:null,toilets:true},carAccess:'unknown',sources:[{id:'one'},{id:'two'}]};
const obs={ok:true,checkedAt:'2026-09-12T09:00:00Z',evidenceAt:'2026-09-01T12:00:00Z',validUntil:'2026-09-30T23:59:59Z',status:'open'};
test('search ignores accents and unknown services never pass positive filters',()=>{
 assert.equal(normalize('O’Higgins'),'ohiggins');
 assert.equal(filterPlaces([p],{query:'rio nuble'}, {observations:{}},new Set()).length,1);
 assert.equal(filterPlaces([p],{service:'water'}, {observations:{}},new Set()).length,0);
 assert.equal(filterPlaces([p],{service:'toilets'}, {observations:{}},new Set()).length,1);
});
test('saved and car filters compose',()=>{
 assert.equal(filterPlaces([p],{saved:true}, {observations:{}},new Set(['a'])).length,1);
 assert.equal(filterPlaces([p],{saved:true,car:true}, {observations:{}},new Set(['a'])).length,0);
});
test('outdated, failed, future or conflicting evidence does not assert open',()=>{
 assert.equal(effectiveStatus(p,{observations:{one:obs}},now),'open');
 for(const change of [{ok:false},{checkedAt:'2026-09-01T09:00:00Z'},{validUntil:'2026-09-01T12:00:00Z'},{evidenceAt:'2026-10-01T12:00:00Z'}])assert.equal(effectiveStatus(p,{observations:{one:{...obs,...change}}},now),'unknown');
 assert.equal(effectiveStatus(p,{observations:{one:obs,two:{...obs,status:'closed'}}},now),'unknown');
});
test('indefinite dated closure stays closed only while its source is freshly consulted',()=>{
 const closed={...obs,status:'closed',validUntil:null};
 assert.equal(effectiveStatus(p,{observations:{one:closed}},now),'closed');
 assert.equal(effectiveStatus(p,{observations:{one:closed}},now+72*3600*1000),'unknown');
});
test('a park observation never implies that its campsite is operating',()=>{
 assert.equal(effectiveStatus({...p,statusSourceIds:[]},{observations:{one:obs}},now),'unknown');
});
test('distances are geodesic approximations and URLs exclude executable protocols',()=>{
 assert.equal(distanceKm([-34,-71],[-34,-71]),0);
 assert.ok(distanceKm([-34,-71],[-35,-71])>110&&distanceKm([-34,-71],[-35,-71])<112);
 assert.equal(safeExternalUrl('javascript:alert(1)'),null);
 assert.equal(safeExternalUrl('https://conaf.cl/'),'https://conaf.cl/');
 assert.equal(isStale(null,now),true);
});
