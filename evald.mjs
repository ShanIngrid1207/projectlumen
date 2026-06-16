// node evald.mjs <url> <expr> [readyFlag]
import { spawn } from 'node:child_process';
const [,, url, expr, ready='window.__lumenReady===true||window.__diag!==undefined'] = process.argv;
const EDGE='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT=9555+Math.floor(Math.random()*200);
const edge=spawn(EDGE,['--headless=new','--no-sandbox','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader',`--remote-debugging-port=${PORT}`,'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let id=0;const pend=new Map();
const send=(ws,m,p={},s)=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});ws.send(JSON.stringify({id:i,method:m,params:p,sessionId:s}))});
(async()=>{
  let wsUrl;for(let i=0;i<60;i++){try{const j=await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();if(j.webSocketDebuggerUrl){wsUrl=j.webSocketDebuggerUrl;break;}}catch{}await sleep(200);}
  const ws=new WebSocket(wsUrl);await new Promise(r=>ws.onopen=r);
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){const p=pend.get(m.id);pend.delete(m.id);m.error?p.rej(new Error(JSON.stringify(m.error))):p.res(m.result);}};
  const {targetId}=await send(ws,'Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send(ws,'Target.attachToTarget',{targetId,flatten:true});
  const S=(m,p)=>send(ws,m,p,sessionId);
  await S('Runtime.enable');await S('Page.enable');
  const errs=[];
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errs.push('EXC: '+(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text));if(m.method==='Runtime.consoleAPICalled')errs.push(m.params.type+': '+m.params.args.map(a=>a.value||a.description||JSON.stringify(a.preview?.properties)).join(' '));});
  await S('Page.navigate',{url});
  for(let i=0;i<340;i++){await sleep(300);try{const {result}=await S('Runtime.evaluate',{expression:ready,returnByValue:true});if(result&&result.value===true)break;}catch{}}
  await sleep(600);
  const {result}=await S('Runtime.evaluate',{expression:`JSON.stringify(${expr})`,returnByValue:true});
  console.log('RESULT:',result.value);
  if(errs.length)console.log('ERRORS:\n'+errs.join('\n'));
  edge.kill();process.exit(0);
})().catch(e=>{console.error(e);edge.kill();process.exit(1);});
