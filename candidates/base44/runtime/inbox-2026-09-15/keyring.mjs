// INACTIVE. Keys supplied by a trusted secret store; never generated or logged here.
import {seal,unseal} from './capture-ledger.mjs';
const idOK=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(x);
export class InboxKeyring {
 #keys=new Map(); #active; #destroyed=false;
 constructor({activeId,entries,requiredKeyIds,signingKey}={}){
  if(!idOK(activeId)||!Array.isArray(entries)||!entries.length||entries.length>32||
   !Array.isArray(requiredKeyIds)||!requiredKeyIds.every(idOK)||
   !Buffer.isBuffer(signingKey)||signingKey.length<32)throw Error('Invalid key configuration');
  const ids=new Set(),materials=new Set();
  for(const e of entries){
   if(!e||!idOK(e.id)||ids.has(e.id)||!Buffer.isBuffer(e.key)||e.key.length!==32||
    signingKey.equals(e.key)||materials.has(e.key.toString('hex')))throw Error('Invalid key configuration');
   ids.add(e.id);materials.add(e.key.toString('hex'));
  }
  if(!ids.has(activeId)||requiredKeyIds.some(id=>!ids.has(id)))throw Error('Required key unavailable');
  for(const e of entries)this.#keys.set(e.id,Buffer.from(e.key));
  this.#active=activeId;
 }
 #get(id){if(this.#destroyed||!idOK(id)||!this.#keys.has(id))throw Error('Key unavailable');return this.#keys.get(id);}
 encrypt(bytes,context){return seal(this.#get(this.#active),this.#active,bytes,context);}
 decrypt(payload,context){
  if(!payload||payload.alg!=='AES-256-GCM'||!idOK(payload.keyId)||
   typeof payload.iv!=='string'||!/^[a-f0-9]{24}$/.test(payload.iv)||
   typeof payload.tag!=='string'||!/^[a-f0-9]{32}$/.test(payload.tag)||
   typeof payload.ciphertext!=='string'||payload.ciphertext.length<2||payload.ciphertext.length>32768||
   payload.ciphertext.length%2||!/^[a-f0-9]+$/.test(payload.ciphertext))throw Error('Invalid encrypted payload');
  return unseal(this.#get(payload.keyId),payload,context);
 }
 bind(ledger,bytes){
  const copy=Buffer.from(bytes);
  return {admit:request=>ledger.call('admit',{...request,payload:this.encrypt(copy,{scope:ledger.scope,operation:request.operation,bodyTag:request.bodyTag})})};
 }
 destroy(){for(const k of this.#keys.values())k.fill(0);this.#keys.clear();this.#destroyed=true;}
}
