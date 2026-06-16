// node probe.mjs <url> <outPrefix>
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const [,, url, prefix] = process.argv;
const EDGE='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT=9700+Math.floor(Math.random()*200);
const edge=spawn(EDGE,['--headless=new','--no-sandbox','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--hide-scrollbars',`--window-size=900,700`,`--remote-debugging-port=${PORT}`,'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let id=0;const pend=new Map();
const send=(ws,m,p={},s)=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});ws.send(JSON.stringify({id:i,method:m,params:p,sessionId:s}))});
const views={
  front:[0,1.5,9], back:[0,1.5,-9], left:[-9,1.5,0], right:[9,1.5,0],
  top:[0,9,0.01], frontlow:[0,0,9]
};
(async()=>{
  let wsUrl;for(let i=0;i<60;i++){try{const j=await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();if(j.webSocketDebuggerUrl){wsUrl=j.webSocketDebuggerUrl;break;}}catch{}await sleep(200);}
  const ws=new WebSocket(wsUrl);await new Promise(r=>ws.onopen=r);
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){const p=pend.get(m.id);pend.delete(m.id);m.error?p.rej(new Error(JSON.stringify(m.error))):p.res(m.result);}};
  const {targetId}=await send(ws,'Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send(ws,'Target.attachToTarget',{targetId,flatten:true});
  const S=(m,p)=>send(ws,m,p,sessionId);
  await S('Runtime.enable');await S('Page.enable');
  await S('Emulation.setDeviceMetricsOverride',{width:900,height:700,deviceScaleFactor:1,mobile:false});
  await S('Page.navigate',{url});
  for(let i=0;i<340;i++){await sleep(300);const {result}=await S('Runtime.evaluate',{expression:'window.__lumenReady===true',returnByValue:true});if(result&&result.value===true)break;}
  await sleep(800);
  for(const [name,[x,y,z]] of Object.entries(views)){
    await S('Runtime.evaluate',{expression:`(()=>{window.__camera.position.set(${x},${y},${z});window.__camera.lookAt(0,0,0);return 1;})()`});
    await sleep(500);
    const {data}=await S('Page.captureScreenshot',{format:'png'});
    writeFileSync(`${prefix}-${name}.png`, Buffer.from(data,'base64'));
    console.log('shot',name);
  }
  edge.kill();process.exit(0);
})().catch(e=>{console.error(e);edge.kill();process.exit(1);});
