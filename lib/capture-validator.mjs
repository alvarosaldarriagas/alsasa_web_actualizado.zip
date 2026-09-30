// INACTIVE strict contract for the new signed receiver; no network or SDK.
const own=(o,keys)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.getPrototypeOf(o)===Object.prototype&&Object.keys(o).every(k=>keys.includes(k));
const text=(v,max,required=false)=>v==null?!required:typeof v==='string'&&v.length<=max&&(!required||v.trim().length>0)&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
const number=(v,max=Number.MAX_SAFE_INTEGER)=>v==null||v===''||((typeof v==='number'||typeof v==='string'&&/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(v))&&Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=max);
const list=(v,n,max)=>v==null||Array.isArray(v)&&v.length<=n&&v.every(x=>text(x,max,true));
const budgets=o=>number(o.budget_min)&&number(o.budget_max)&&(!(o.budget_min!=null&&o.budget_min!==''&&o.budget_max!=null&&o.budget_max!=='')||Number(o.budget_min)<=Number(o.budget_max));
const email=v=>text(v,160,true)&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const intents=['buy','rent','sell','landlord','invest','valuation','human','information','other'];
export function validateCapture(kind,b){
 try{
  const common=['email','phone','consent'];
  if(!own(b,kind==='form'?[...common,'full_name','message','source','lead_type','property_id','budget_min','budget_max','preferred_areas']:
   kind==='chat'?[...common,'name','qualification','messages']:[]))return false;
  if(b.consent!==true||!email(b.email)||!text(b.phone,25))return false;
  if(kind==='form')return text(b.full_name,120,true)&&text(b.message,1500)&&text(b.source,80)&&text(b.lead_type,80)&&text(b.property_id,100)&&budgets(b)&&list(b.preferred_areas,10,120);
  if(kind!=='chat'||!text(b.name,120,true))return false;
  const q=b.qualification??{};
  if(!own(q,['intent','property_ids','preferred_areas','lead_score','budget_min','budget_max','budget_range','urgency'])||
   !(q.intent==null||q.intent===''||intents.includes(q.intent))||!list(q.property_ids,10,100)||!list(q.preferred_areas,10,120)||
   !number(q.lead_score,100)||!budgets(q)||!text(q.budget_range,200)||!text(q.urgency,120))return false;
  const messages=b.messages??[];
  return Array.isArray(messages)&&messages.length<=30&&messages.every(m=>own(m,['role','content'])&&['user','bot','assistant'].includes(m.role)&&text(m.content,2000,true))&&messages.reduce((n,m)=>n+m.content.length,0)<=30000;
 }catch{return false;}
}
