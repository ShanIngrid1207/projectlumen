import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const EDGE='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT=9800+Math.floor(Math.random()*150);
const edge=spawn(EDGE,['--headless=new','--no-sandbox','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--hide-scrollbars','--window-size=1280,850',`--remote-debugging-port=${PORT}`,'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let id=0;const pend=new Map();
const send=(ws,m,p={},s)=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});ws.send(JSON.stringify({id:i,method:m,params:p,sessionId:s}))});
(async()=>{
  let u;for(let i=0;i<60;i++){try{const j=await(await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();if(j.webSocketDebuggerUrl){u=j.webSocketDebuggerUrl;break;}}catch{}await sleep(200);}
  const ws=new WebSocket(u);await new Promise(r=>ws.onopen=r);
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){const p=pend.get(m.id);pend.delete(m.id);m.error?p.rej(new Error(JSON.stringify(m.error))):p.res(m.result);}};
  const {targetId}=await send(ws,'Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send(ws,'Target.attachToTarget',{targetId,flatten:true});
  const S=(m,p)=>send(ws,m,p,sessionId);
  await S('Runtime.enable');await S('Page.enable');
  await S('Emulation.setDeviceMetricsOverride',{width:1280,height:850,deviceScaleFactor:1,mobile:false});
  await S('Page.navigate',{url:'http://localhost:8910/index.html'});
  await sleep(2000);
  await S('Runtime.evaluate',{expression:"(()=>{const s=document.getElementById('stage');s.scrollTop=s.scrollHeight;return s.scrollHeight;})()"});
  await sleep(11000);
  const {data}=await S('Page.captureScreenshot',{format:'png'});
  writeFileSync('C:\\Users\\tagal\\OneDrive\\Documents\\draft\\quest-lumen\\shots\\index-3d.png', Buffer.from(data,'base64'));
  console.log('done');edge.kill();process.exit(0);
})().catch(e=>{console.error(e);edge.kill();process.exit(1);});
