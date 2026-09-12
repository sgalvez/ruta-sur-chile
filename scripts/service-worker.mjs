import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const dist=new URL('../dist/',import.meta.url);
async function files(dir,prefix=''){
  const result=[];for(const file of await readdir(dir,{withFileTypes:true})){
    if(file.isDirectory())result.push(...await files(new URL(file.name+'/',dir),prefix+file.name+'/'));
    else if(file.name!=='sw.js')result.push(prefix+file.name);
  }return result;
}
const assets=(await files(dist)).filter(p=>p!=='data/catalog.json'&&p!=='data/state.json');const hash=createHash('sha256');
for(const file of assets)hash.update(await readFile(new URL(file,dist)));
const version=hash.digest('hex').slice(0,16);
const script=`const CACHE='ruta-sur-${version}';
const BASE=new URL('./',self.location.href);
const ASSETS=${JSON.stringify(assets)}.map(p=>new URL(p,BASE).href);
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(ASSETS);await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('ruta-sur-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data?.type==='CHECK_OFFLINE')event.waitUntil((async()=>{const cache=await caches.open(CACHE);const ready=(await Promise.all(ASSETS.map(url=>cache.match(url)))).every(Boolean);event.ports[0]?.postMessage({ready});})());});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
 // External map tiles are never prefetched or handled by this service worker.
 if(url.pathname.includes('/data/v2/')){
  event.respondWith((async()=>{const cache=await caches.open(CACHE);if(!self.navigator.onLine){const saved=await cache.match(event.request);if(saved)return saved;}try{const response=await fetch(event.request,{signal:AbortSignal.timeout(7000),cache:'no-cache'});if(!response.ok)throw new Error('HTTP error');const data=await response.clone().json();if(data.schemaVersion!==2)throw new Error('Invalid data');await cache.put(event.request,response.clone());return response;}catch{const saved=await cache.match(event.request);if(!saved)return new Response('Offline',{status:503});const headers=new Headers(saved.headers);headers.set('X-Ruta-Sur-Cache','offline');return new Response(await saved.arrayBuffer(),{status:200,headers});}})());return;
 }
 event.respondWith((async()=>{const cache=await caches.open(CACHE);const saved=await cache.match(event.request);if(saved)return saved;try{return await fetch(event.request);}catch{return event.request.mode==='navigate'?(await cache.match(new URL('index.html',BASE).href)||Response.error()):Response.error();}})());
});`;
await writeFile(new URL('sw.js',dist),script);
console.log(`Service worker ${version}: ${assets.length} recursos, sin mapas externos.`);
