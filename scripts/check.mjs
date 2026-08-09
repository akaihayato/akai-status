import {readFile,writeFile} from "node:fs/promises";

const services=[
  {id:"akaihayato-site",name:"akaihayato.com",endpoints:[
    {id:"akaihayato-home",name:"Top",url:"https://akaihayato.com/"},
    {id:"akaihayato-gallery",name:"Gallery",url:"https://akaihayato.com/gallery"},
    {id:"akaihayato-blog",name:"Blog",url:"https://akaihayato.com/blog"},
  ]},
  {id:"links",name:"Relay",endpoints:[{id:"links",name:"Relay",url:"https://link.akaihayato.com/"}]},
  {id:"image-upload",name:"HushPic",endpoints:[{id:"image-upload",name:"HushPic",url:"https://image-upload.akaihayato.com/"}]},
  {id:"vrchatosc",name:"VRCOSC Control",endpoints:[{id:"vrchatosc",name:"VRCOSC Control",url:"https://vrchatosc.akaihayato.com/"}]},
];
const outputUrl=new URL("../public/status.json",import.meta.url);
const now=Date.now();
const retention=30*24*60*60*1000;

let previous={history:{}};
try{previous=JSON.parse(await readFile(outputUrl,"utf8"))}catch{}

async function check(endpoint){
  const started=Date.now();
  try{
    const response=await fetch(endpoint.url,{redirect:"follow",signal:AbortSignal.timeout(15000),headers:{"user-agent":"AkaiHayato-Status-GitHub/1.0"}});
    return {id:endpoint.id,ok:response.status>=200&&response.status<400,statusCode:response.status,latencyMs:Date.now()-started};
  }catch(error){
    return {id:endpoint.id,ok:false,statusCode:null,latencyMs:Date.now()-started,error:String(error?.message??error).slice(0,160)};
  }
}

const checks=await Promise.all(services.flatMap(service=>service.endpoints).map(check));
const byId=new Map(checks.map(check=>[check.id,check]));
const history={...(previous.history??{})};
for(const check of checks){
  history[check.id]=[...(history[check.id]??[]),{at:now,ok:check.ok}].filter(item=>item.at>=now-retention);
}

const stateFrom=(check,items)=>check.ok?"operational":items.slice(-2).every(item=>!item.ok)&&items.length>=2?"down":"degraded";
const uptime=(items,since)=>{const selected=items.filter(item=>item.at>=since);return selected.length?Math.round(selected.filter(item=>item.ok).length/selected.length*10000)/100:null};
const serviceResults=services.map(service=>{
  const endpoints=service.endpoints.map(endpoint=>{const current=byId.get(endpoint.id);const items=history[endpoint.id]??[];return {...endpoint,state:stateFrom(current,items),statusCode:current.statusCode,latencyMs:current.latencyMs}});
  const states=endpoints.map(endpoint=>endpoint.state);
  const state=states.includes("down")?"down":states.includes("degraded")?"degraded":states.every(value=>value==="operational")?"operational":"unknown";
  const aggregate=[];
  const times=[...new Set(service.endpoints.flatMap(endpoint=>(history[endpoint.id]??[]).map(item=>item.at)))].sort((a,b)=>a-b);
  for(const at of times){const group=service.endpoints.map(endpoint=>(history[endpoint.id]??[]).find(item=>item.at===at));if(group.every(Boolean))aggregate.push({at,ok:group.every(item=>item.ok)})}
  return {id:service.id,name:service.name,state,lastCheckedAt:now,statusCode:endpoints.length===1?endpoints[0].statusCode:null,latencyMs:Math.max(...endpoints.map(endpoint=>endpoint.latencyMs??0)),endpoints,uptime:{day:uptime(aggregate,now-86400000),week:uptime(aggregate,now-7*86400000),month:uptime(aggregate,now-retention)},history:aggregate.slice(-288)};
});
const states=serviceResults.map(service=>service.state);
const overall=states.includes("down")?"down":states.includes("degraded")?"degraded":states.every(state=>state==="operational")?"operational":"unknown";
await writeFile(outputUrl,JSON.stringify({overall,generatedAt:now,services:serviceResults,history},null,2)+"\n");
console.log(JSON.stringify(checks,null,2));

