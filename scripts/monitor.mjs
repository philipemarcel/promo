// Standalone scheduler. Credentials are environment-only. Keep this process alive on a server.
const site = process.env.PROMORADAR_URL;
const secret = process.env.MONITOR_SECRET;
const service = process.env.OAI_SITES_SERVICE_TOKEN;
if(!site || !secret || !service) throw new Error("Configure PROMORADAR_URL, MONITOR_SECRET e OAI_SITES_SERVICE_TOKEN no ambiente do processo.");
if(new URL(site).protocol !== "https:") throw new Error("PROMORADAR_URL precisa usar HTTPS.");
async function tick() {
  try {
    const response=await fetch(new URL("/api/scan",site),{method:"POST",headers:{Authorization:`Bearer ${secret}`,"OAI-Sites-Authorization":`Bearer ${service}`},signal:AbortSignal.timeout(175000)});
    const data=await response.json();
    if(!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    console.log(new Date().toISOString(),JSON.stringify({count:data.count,errors:data.errors}));
    const monitor=await fetch(new URL("/api/monitor",site),{method:"POST",headers:{Authorization:`Bearer ${secret}`,"OAI-Sites-Authorization":`Bearer ${service}`},signal:AbortSignal.timeout(175000)});
    if(!monitor.ok)throw new Error("Monitor indisponível");
  } catch { console.error(new Date().toISOString(),"Falha na verificação. Consulte as conexões e o histórico no painel."); }
}
await tick();
let running=false;
setInterval(async()=>{if(running)return;running=true;try{await tick();}finally{running=false;}},5*60*1000);
