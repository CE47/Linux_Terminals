'use strict';
/* Headless smoke test of the ASSEMBLED game.html:
   extract the inline <script>, stub a DOM, boot, then play every scenario
   through __tq.execute using each step's solution, asserting completion. */
const fs=require('fs'), path=require('path'), vm=require('vm');

const html=fs.readFileSync(path.join(__dirname,'..','game.html'),'utf8');
const m=html.match(/<script>([\s\S]*?)<\/script>/);
if(!m){ console.error('no inline script found'); process.exit(1); }
let code=m[1];

/* ---- DOM stub ---- */
function makeEl(){ const el={ children:[], _cls:new Set(), style:{setProperty(){}}, dataset:{}, hidden:false, disabled:false, value:'', textContent:'', _html:'',
  get innerHTML(){return this._html;}, set innerHTML(v){this._html=v; if(v==='') this.children=[];},
  classList:{ _s:new Set(), add(...c){c.forEach(x=>this._s.add(x));}, remove(...c){c.forEach(x=>this._s.delete(x));}, toggle(c,f){f=f===undefined?!this._s.has(c):f; f?this._s.add(c):this._s.delete(c); return f;}, contains(c){return this._s.has(c);} },
  appendChild(c){this.children.push(c);return c;}, append(...cs){cs.forEach(c=>this.children.push(c));},
  querySelector(){return makeEl();}, querySelectorAll(){return [];},
  addEventListener(){}, removeEventListener(){}, setAttribute(){}, focus(){}, remove(){}, scrollIntoView(){}, scrollTo(){},
  getBoundingClientRect(){return {left:0,top:0,right:0,bottom:0,width:10,height:10};}, get offsetWidth(){return 0;}, setSelectionRange(){} }; return el; }
const store={};
global.document={ getElementById(id){ return store[id]||(store[id]=makeEl()); }, createElement(){return makeEl();}, addEventListener(){}, body:makeEl(), readyState:'complete', fonts:{ready:Promise.resolve()} };
global.window={ addEventListener(){}, innerWidth:1200, requestAnimationFrame:fn=>fn() };
global.requestAnimationFrame=fn=>fn();
global.setTimeout=(fn)=>{ if(typeof fn==='function') fn(); return 0; };
global.localStorage={ _d:{}, getItem(k){return this._d[k]||null;}, setItem(k,v){this._d[k]=v;}, removeItem(k){delete this._d[k];} };
global.console=console;
store['form']=makeEl();
store['form'].querySelector=()=>makeEl();

/* form/input listeners are attached inside the IIFE; we call __tq directly */
try{ vm.runInThisContext(code, {filename:'game.inline.js'}); }
catch(e){ console.error('LOAD ERROR:', e.message, '\n', e.stack); process.exit(1); }

const tq = global.window.__tq;
const SCEN = tq && tq.SCENARIOS;
if(!SCEN){ console.error('SCENARIOS not exposed'); process.exit(1); }
console.log('Boot OK. Scenarios loaded:', SCEN.length);
const G = global.window.GAME;

/* play every scenario with its solutions via the real execute() path */
let okScen=0, badScen=0, totalSteps=0;
for(const scen of SCEN){
  tq.startScenario(scen);
  let stuck=null;
  for(let i=0;i<scen.steps.length;i++){
    const before=G.stepIdx;
    for(const cmd of scen.steps[i].solution){ tq.execute(cmd); }
    totalSteps++;
    if(G.stepIdx<=before){ stuck={i, brief:scen.steps[i].brief, sol:scen.steps[i].solution}; break; }
  }
  const complete = G.stepIdx>=scen.steps.length && !stuck;
  if(complete){ okScen++; console.log('  [OK]  '+scen.id+' ('+scen.steps.length+' steps, cleared='+(!!G.cleared[scen.id])+')'); }
  else { badScen++; console.log('  [FAIL] '+scen.id+' stuck at step '+((stuck&&stuck.i+1))+': '+(stuck&&stuck.brief)); console.log('         sol: '+JSON.stringify(stuck&&stuck.sol)); }
}
console.log('\nXP after full run:', G.xp, ' rank chip:', store['rankStat'].textContent);
console.log('RESULT via game.html runtime: '+okScen+' ok, '+badScen+' failed  ('+totalSteps+' steps executed)');
process.exit(badScen?1:0);
