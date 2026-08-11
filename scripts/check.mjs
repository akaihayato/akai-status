const apiKey="AIzaSyB5iKZkSevv5Ij5PwMjR087uDU4LbAT0cs",projectId="akai-status-10f49";
const authBody={email:process.env.FIREBASE_MONITOR_EMAIL,password:process.env.FIREBASE_MONITOR_PASSWORD,returnSecureToken:true};let login=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(authBody)});if(!login.ok){const failed=await login.json();if(failed?.error?.message==="EMAIL_NOT_FOUND"||failed?.error?.message==="INVALID_LOGIN_CREDENTIALS")login=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(authBody)});else throw Error(`Firebase login failed: ${failed?.error?.message??login.status}`)}if(!login.ok){const failed=await login.json();throw Error(`Firebase auth failed: ${failed?.error?.message??login.status}`)}const{idToken}=await login.json();const documentUrl=`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/status/current`;
const services=[{id:"akaihayato-site",name:"akaihayato.com",endpoints:[{id:"akaihayato-home",name:"Top",url:"https://akaihayato.com/"},{id:"akaihayato-gallery",name:"Gallery",url:"https://akaihayato.com/gallery"},{id:"akaihayato-blog",name:"Blog",url:"https://akaihayato.com/blog"}]},{id:"links",name:"Relay",endpoints:[{id:"links",name:"Relay",url:"https://link.akaihayato.com/"}]},{id:"image-upload",name:"HushPic",endpoints:[{id:"image-upload",name:"HushPic",url:"https://image-upload.akaihayato.com/"}]},{id:"vrchatosc",name:"VRCOSC Control",endpoints:[{id:"vrchatosc",name:"VRCOSC Control",url:"https://vrchatosc.akaihayato.com/"}]}];
const cloudflareSpecs=[
  {id:"cf-workers-pages",name:"Workers & Pages",aliases:["workers","pages"]},
  {id:"cf-d1",name:"D1 SQL Database",aliases:["d1"]},
  {id:"cf-r2",name:"R2 Object Storage",aliases:["r2"]},
  {id:"cf-zero-trust",name:"Zero Trust",aliases:["cloudflare zero trust","zero trust"]},
  {id:"cf-security",name:"Security",aliases:["security services","cloudflare network firewall","web application firewall"]},
  {id:"cf-dns",name:"DNS",aliases:["authoritative dns","recursive dns","dns root servers","dns updates"]},
  {id:"cf-ssl",name:"SSL/TLS",aliases:["ssl/tls","ssl certificate provisioning"]},
  {id:"cf-caching",name:"Caching",aliases:["cdn/cache","cache purge"]},
  {id:"cf-workers-builds",name:"Workers Builds",aliases:["workers builds"]},
  {id:"cf-analytics-logs",name:"Analytics & Logs",aliases:["analytics","logs","logpush"]}
];
const statusRank={operational:0,under_maintenance:1,degraded_performance:2,partial_outage:3,major_outage:4};
const statusLabel={operational:"Operational",under_maintenance:"Maintenance",degraded_performance:"Degraded",partial_outage:"Partial outage",major_outage:"Major outage"};
const normalizeName=value=>String(value??"").trim().toLowerCase();
async function getCloudflareStatus(){
  try{
    const started=Date.now(),response=await fetch("https://www.cloudflarestatus.com/api/v2/components.json",{headers:{"user-agent":"AkaiHayato-Status-GitHub/2.0"},signal:AbortSignal.timeout(15000)});
    if(!response.ok)return null;
    const data=await response.json(),components=(data.components??[]).filter(component=>!component.group);
    const endpoints=[],componentChecks=[];
    for(const spec of cloudflareSpecs){
      const matched=components.filter(component=>spec.aliases.includes(normalizeName(component.name)));
      if(!matched.length)continue;
      const worst=matched.reduce((current,item)=>(statusRank[item.status]??4)>(statusRank[current.status]??4)?item:current,matched[0]);
      const ok=matched.every(item=>item.status==="operational");
      endpoints.push({id:spec.id,name:spec.name,detail:statusLabel[worst.status]??worst.status,source:"Cloudflare Status"});
      componentChecks.push({id:spec.id,ok,statusCode:null,latencyMs:Date.now()-started});
    }
    return endpoints.length?{service:{id:"cloudflare",name:"Cloudflare",endpoints},checks:componentChecks}:null;
  }catch{return null}
}
let previous={history:{}};const old=await fetch(documentUrl,{headers:{authorization:`Bearer ${idToken}`}});if(old.ok){const body=await old.json();try{previous=JSON.parse(body.fields.payload.stringValue)}catch{}}
if(!process.env.STATUS_MONITOR_KEY)throw Error("STATUS_MONITOR_KEY is required");
const now=Date.now(),retention=30*86400000;async function check(e){const started=Date.now();try{const r=await fetch(e.url,{redirect:"follow",signal:AbortSignal.timeout(15000),headers:{"user-agent":"AkaiHayato-Status-GitHub/2.0","x-akai-status-key":process.env.STATUS_MONITOR_KEY}});return{id:e.id,ok:r.status>=200&&r.status<400,statusCode:r.status,latencyMs:Date.now()-started}}catch(error){return{id:e.id,ok:false,statusCode:null,latencyMs:Date.now()-started,error:String(error?.message??error).slice(0,160)}}}
const cloudflare=await getCloudflareStatus();if(cloudflare)services.push(cloudflare.service);const checks=[...await Promise.all(services.flatMap(s=>s.endpoints).filter(e=>e.url).map(check)),...(cloudflare?.checks??[])],byId=new Map(checks.map(c=>[c.id,c])),history={...(previous.history??{})};for(const c of checks)history[c.id]=[...(history[c.id]??[]),{at:now,ok:c.ok}].filter(x=>x.at>=now-retention);const stateFrom=(c,a)=>c.ok?"operational":a.slice(-2).every(x=>!x.ok)&&a.length>=2?"down":"degraded",uptime=(a,s)=>{const x=a.filter(i=>i.at>=s);return x.length?Math.round(x.filter(i=>i.ok).length/x.length*10000)/100:null};
const results=services.map(s=>{const endpoints=s.endpoints.map(e=>{const c=byId.get(e.id),a=history[e.id]??[];return{...e,state:stateFrom(c,a),statusCode:c.statusCode,latencyMs:c.latencyMs}}),states=endpoints.map(e=>e.state),state=states.includes("down")?"down":states.includes("degraded")?"degraded":"operational",aggregate=[],times=[...new Set(s.endpoints.flatMap(e=>(history[e.id]??[]).map(i=>i.at)))].sort((a,b)=>a-b);for(const at of times){const g=s.endpoints.map(e=>(history[e.id]??[]).find(i=>i.at===at));if(g.every(Boolean))aggregate.push({at,ok:g.every(i=>i.ok)})}return{id:s.id,name:s.name,state,lastCheckedAt:now,statusCode:endpoints.length===1?endpoints[0].statusCode:null,latencyMs:Math.max(...endpoints.map(e=>e.latencyMs??0)),endpoints,uptime:{day:uptime(aggregate,now-86400000),week:uptime(aggregate,now-7*86400000),month:uptime(aggregate,now-retention)},history:aggregate.slice(-288)}});const states=results.map(s=>s.state),payload={overall:states.includes("down")?"down":states.includes("degraded")?"degraded":"operational",generatedAt:now,services:results,history};
const saved=await fetch(documentUrl,{method:"PATCH",headers:{authorization:`Bearer ${idToken}`,"content-type":"application/json"},body:JSON.stringify({fields:{payload:{stringValue:JSON.stringify(payload)},updatedAt:{timestampValue:new Date(now).toISOString()}}})});if(!saved.ok)throw Error(`Firestore write failed: ${saved.status} ${await saved.text()}`);console.log(JSON.stringify(checks,null,2));

