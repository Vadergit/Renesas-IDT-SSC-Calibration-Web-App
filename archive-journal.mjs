// Append-only browser journal, separate from the compact localStorage report index.
// No automatic pruning. A failed write is reported; never claim that it was persisted.
export function createJournal({indexedDB:dbFactory=globalThis.indexedDB,onError=()=>{}}={}){
 let database,failed=null,pending=Promise.resolve();
 function db(){if(!database)database=new Promise((resolve,reject)=>{
  if(!dbFactory){reject(Error('IndexedDB nicht verfügbar'));return}
  const req=dbFactory.open('renesas-calibration-journal-v1',1);
  req.onupgradeneeded=()=>{const store=req.result.createObjectStore('entries',{keyPath:'id',autoIncrement:true});store.createIndex('session','session');};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(Error('Archivdatenbank blockiert'));
 });return database;}
 const error=e=>{failed=e;onError(e);};
 function append(entry){
  // Clone immediately so later mutations cannot alter earlier records.
  let copy;try{copy=JSON.parse(JSON.stringify(entry));}catch(e){error(e);return}
  pending=pending.then(async()=>{const d=await db();await new Promise((resolve,reject)=>{const t=d.transaction('entries','readwrite');t.objectStore('entries').add(copy);t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('Archivtransaktion abgebrochen'));});}).catch(error);
 }
 async function flush(){await pending;if(failed)throw failed;}
 async function read(session){await flush();const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('entries','readonly'),store=t.objectStore('entries'),req=session?store.index('session').getAll(session):store.getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
 return {append,flush,read};
}
