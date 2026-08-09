const labels={operational:"すべて正常に稼働しています",degraded:"一部サービスを確認中です",down:"サービス障害が発生しています",unknown:"監視データを準備しています"};
const stateLabels={operational:"正常",degraded:"確認中",down:"障害",unknown:"未確認"};
const fmt=value=>value==null?"—":`${value.toFixed(2)}%`;

function bars(history){
  const items=history.slice(-48);
  const empty=Array.from({length:Math.max(0,48-items.length)},()=>'<i class="bar empty"></i>');
  return empty.concat(items.map(item=>`<i class="bar ${item.ok?"":"bad"}" title="${new Date(item.at).toLocaleString("ja-JP")}"></i>`)).join("");
}

function endpointList(service){
  if(service.endpoints.length<2)return "";
  return `<div class="endpoints">${service.endpoints.map(endpoint=>`<div class="endpoint"><span class="endpoint-label"><span class="dot ${endpoint.state}"></span>${endpoint.name}</span><span>HTTP ${endpoint.statusCode??"—"}</span></div>`).join("")}</div>`;
}

function render(data){
  const overall=document.querySelector("#overall");
  overall.className=`overall ${data.overall}`;
  overall.innerHTML=`<span class="dot"></span><span>${labels[data.overall]??labels.unknown}</span>`;
  document.querySelector("#services").innerHTML=data.services.map(service=>`<article class="card"><div class="top"><div><div class="name">${service.name}</div><div class="meta"><span>応答 ${service.latencyMs??"—"} ms</span><span>${service.endpoints.length>1?`${service.endpoints.length} endpoints`:`HTTP ${service.statusCode??"—"}`}</span></div></div><div class="state"><span class="dot ${service.state}"></span>${stateLabels[service.state]??stateLabels.unknown}</div></div>${endpointList(service)}<div class="history" aria-label="直近の稼働履歴">${bars(service.history)}</div><div class="uptime"><div class="metric"><b>${fmt(service.uptime.day)}</b><span>過去24時間</span></div><div class="metric"><b>${fmt(service.uptime.week)}</b><span>過去7日間</span></div><div class="metric"><b>${fmt(service.uptime.month)}</b><span>過去30日間</span></div></div></article>`).join("");
  document.querySelector("#updated").textContent=`最終更新 ${new Date(data.generatedAt).toLocaleString("ja-JP")}`;
}

async function load(){
  try{
    const response=await fetch(`./status.json?v=${Date.now()}`,{cache:"no-store"});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    render(await response.json());
  }catch{
    const overall=document.querySelector("#overall");
    overall.className="overall down";
    overall.innerHTML='<span class="dot"></span><span>監視データを取得できません</span>';
  }
}

load();
setInterval(load,60000);
