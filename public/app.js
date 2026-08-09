const labels={operational:"縺吶∋縺ｦ豁｣蟶ｸ縺ｫ遞ｼ蜒阪＠縺ｦ縺・∪縺・,degraded:"荳驛ｨ繧ｵ繝ｼ繝薙せ繧堤｢ｺ隱堺ｸｭ縺ｧ縺・,down:"繧ｵ繝ｼ繝薙せ髫懷ｮｳ縺檎匱逕溘＠縺ｦ縺・∪縺・,unknown:"逶｣隕悶ョ繝ｼ繧ｿ繧呈ｺ門ｙ縺励※縺・∪縺・};
const stateLabels={operational:"豁｣蟶ｸ",degraded:"遒ｺ隱堺ｸｭ",down:"髫懷ｮｳ",unknown:"譛ｪ遒ｺ隱・};
const fmt=value=>value==null?"窶・:`${value.toFixed(2)}%`;

function bars(history){
  const items=history.slice(-48);
  const empty=Array.from({length:Math.max(0,48-items.length)},()=>'<i class="bar empty"></i>');
  return empty.concat(items.map(item=>`<i class="bar ${item.ok?"":"bad"}" title="${new Date(item.at).toLocaleString("ja-JP")}"></i>`)).join("");
}

function endpointList(service){
  if(service.endpoints.length<2)return "";
  return `<div class="endpoints">${service.endpoints.map(endpoint=>`<div class="endpoint"><span class="endpoint-label"><span class="dot ${endpoint.state}"></span>${endpoint.name}</span><span>HTTP ${endpoint.statusCode??"窶・}</span></div>`).join("")}</div>`;
}

function render(data){
  const overall=document.querySelector("#overall");
  overall.className=`overall ${data.overall}`;
  overall.innerHTML=`<span class="dot"></span><span>${labels[data.overall]??labels.unknown}</span>`;
  document.querySelector("#services").innerHTML=data.services.map(service=>`<article class="card"><div class="top"><div><div class="name">${service.name}</div><div class="meta"><span>蠢懃ｭ・${service.latencyMs??"窶・} ms</span><span>${service.endpoints.length>1?`${service.endpoints.length} endpoints`:`HTTP ${service.statusCode??"窶・}`}</span></div></div><div class="state"><span class="dot ${service.state}"></span>${stateLabels[service.state]??stateLabels.unknown}</div></div>${endpointList(service)}<div class="history" aria-label="逶ｴ霑代・遞ｼ蜒榊ｱ･豁ｴ">${bars(service.history)}</div><div class="uptime"><div class="metric"><b>${fmt(service.uptime.day)}</b><span>驕主悉24譎る俣</span></div><div class="metric"><b>${fmt(service.uptime.week)}</b><span>驕主悉7譌･髢・/span></div><div class="metric"><b>${fmt(service.uptime.month)}</b><span>驕主悉30譌･髢・/span></div></div></article>`).join("");
  document.querySelector("#updated").textContent=`譛邨よ峩譁ｰ ${new Date(data.generatedAt).toLocaleString("ja-JP")}`;
}

async function load(){
  try{
    const response=await fetch(`./status.json?v=${Date.now()}`,{cache:"no-store"});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    render(await response.json());
  }catch{
    const overall=document.querySelector("#overall");
    overall.className="overall down";
    overall.innerHTML='<span class="dot"></span><span>逶｣隕悶ョ繝ｼ繧ｿ繧貞叙蠕励〒縺阪∪縺帙ｓ</span>';
  }
}

load();
setInterval(load,60000);

