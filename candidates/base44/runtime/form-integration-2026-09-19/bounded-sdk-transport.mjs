// INACTIVE dedicated SDK transport. Requires pinned SDK internal factories; never mutates global Axios defaults.
import {Agent} from 'node:http';
import {Agent as HttpsAgent} from 'node:https';
const allowed={Client:['filter','create'],Property:['filter'],CommunicationLog:['create'],Opportunity:['filter','create'],Interaction:['filter','create'],ChatConversation:['create']};
export function createBoundedEntities({createAxiosClient,createEntitiesModule,serverUrl,appId,serviceToken,timeoutMs=5000,localTest=false}={}){
 const url=new URL(serverUrl);
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||
 !(url.protocol==='https:'||(localTest===true&&url.protocol==='http:'&&url.hostname==='127.0.0.1'))||
 !/^[a-zA-Z0-9_-]{1,100}$/.test(appId)||typeof serviceToken!=='string'||!serviceToken||
 !Number.isInteger(timeoutMs)||timeoutMs<25||timeoutMs>10000)throw Error('Invalid transport configuration');
 const baseURL=url.origin+'/api',httpAgent=new Agent({keepAlive:false}),httpsAgent=new HttpsAgent({keepAlive:false});
 const client=createAxiosClient({baseURL,token:serviceToken,headers:{'X-App-Id':appId}});
 client.interceptors.request.use(config=>{
  if(config.baseURL!==baseURL||!Object.entries(allowed).some(([entity,methods])=>
    config.url==='/apps/'+appId+'/entities/'+entity&&methods.includes(config.method==='get'?'filter':config.method==='post'?'create':'')))throw Error('Forbidden SDK route');
  Object.assign(config,{adapter:'http',timeout:timeoutMs,maxRedirects:0,proxy:false,httpAgent,httpsAgent,
   maxContentLength:262144,maxBodyLength:32768});
  return config;
 });
 const raw=createEntitiesModule({axios:client,appId,getSocket:()=>{throw Error('Realtime forbidden');}});
 const entities=Object.freeze(Object.fromEntries(Object.entries(allowed).map(([entity,methods])=>[entity,Object.freeze(Object.fromEntries(methods.map(method=>[method,(...args)=>raw[entity][method](...args)])))])));
 return {entities,close(){httpAgent.destroy();httpsAgent.destroy();}};
}
