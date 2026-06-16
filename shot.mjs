// Usage: node shot.mjs <url> <outPath> [readyFlag] [extraWaitMs] [w] [h]
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const [,, url, out, readyFlag='window.__lumenReady===true', extraWait='1200', W='1280', H='800', SCROLL='0'] = process.argv;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9333 + Math.floor(Math.random()*200);

const edge = spawn(EDGE, [
  '--headless=new','--no-sandbox','--disable-gpu',
  '--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader',
  '--hide-scrollbars','--mute-audio',
  `--window-size=${W},${H}`,
  `--remote-debugging-port=${PORT}`,
  'about:blank'
], { stdio:'ignore' });

const sleep = ms => new Promise(r=>setTimeout(r,ms));

async function getWS(){
  for(let i=0;i<60;i++){
    try{
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const j = await r.json();
      if(j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    }catch{}
    await sleep(200);
  }
  throw new Error('CDP not reachable');
}

let id=0; const pending=new Map();
function send(ws, method, params={}, sessionId){
  return new Promise((res,rej)=>{
    const mid=++id; pending.set(mid,{res,rej});
    ws.send(JSON.stringify({id:mid, method, params, sessionId}));
  });
}

(async()=>{
  const wsUrl = await getWS();
  const ws = new WebSocket(wsUrl);
  await new Promise(r=>ws.onopen=r);
  ws.onmessage = (e)=>{
    const m = JSON.parse(e.data);
    if(m.id && pending.has(m.id)){ const p=pending.get(m.id); pending.delete(m.id); m.error?p.rej(new Error(JSON.stringify(m.error))):p.res(m.result); }
  };
  // attach to a target/page
  const {targetId} = await send(ws,'Target.createTarget',{url:'about:blank'});
  const {sessionId} = await send(ws,'Target.attachToTarget',{targetId, flatten:true});
  const S = (m,p)=>send(ws,m,p,sessionId);
  await S('Page.enable');
  await S('Runtime.enable');
  await S('Emulation.setDeviceMetricsOverride',{width:parseInt(W,10),height:parseInt(H,10),deviceScaleFactor:1,mobile:false});
  await S('Page.navigate',{url});
  // wait for ready flag (real wall-clock)
  let ok=false;
  for(let i=0;i<340;i++){   // up to ~100s
    await sleep(300);
    try{
      const {result} = await S('Runtime.evaluate',{expression:readyFlag, returnByValue:true});
      if(result && result.value===true){ ok=true; break; }
    }catch{}
  }
  if(parseInt(SCROLL,10)>0){
    await S('Runtime.evaluate',{expression:`window.scrollTo(0,${parseInt(SCROLL,10)})`});
    await sleep(400);
  }
  await sleep(parseInt(extraWait,10));
  const {data} = await S('Page.captureScreenshot',{format:'png'});
  writeFileSync(out, Buffer.from(data,'base64'));
  console.log(`${ok?'OK':'TIMEOUT'} ${out}`);
  edge.kill();
  process.exit(0);
})().catch(e=>{ console.error(e); edge.kill(); process.exit(1); });
