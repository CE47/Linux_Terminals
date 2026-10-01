'use strict';
/* Validate standalone lab pages (df/du/ps): extract inline <script>, stub DOM,
   run it, then drive execute() with each mission's `answer` and assert all
   missions complete. Also asserts no JS syntax/runtime errors on load. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const labs = process.argv.slice(2).length ? process.argv.slice(2) : ['df.html','du.html','ps.html'];

function makeEl(){
  const el = {
    children:[], style:{setProperty(){}}, dataset:{}, hidden:false, disabled:false,
    value:'', textContent:'', _html:'',
    get innerHTML(){return this._html;},
    set innerHTML(v){ this._html=v; if(v==='') this.children=[]; },
    classList:{ _s:new Set(), add(...c){c.forEach(x=>this._s.add(x));}, remove(...c){c.forEach(x=>this._s.delete(x));},
      toggle(c,f){ f=f===undefined?!this._s.has(c):f; f?this._s.add(c):this._s.delete(c); return f; }, contains(c){return this._s.has(c);} },
    appendChild(c){ this.children.push(c); return c; },
    append(...cs){ cs.forEach(c=>this.children.push(c)); },
    querySelector(){ return makeEl(); }, querySelectorAll(){ return []; },
    addEventListener(ev,fn){ this._handlers=this._handlers||{}; this._handlers[ev]=fn; },
    removeEventListener(){}, setAttribute(){}, focus(){}, remove(){}, scrollIntoView(){}, scrollTo(){},
    setSelectionRange(){}, getBoundingClientRect(){ return {left:0,top:0,right:0,bottom:0,width:10,height:10}; },
    get offsetWidth(){ return 0; }
  };
  return el;
}

function validate(file){
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if(!m){ console.log(`  [FAIL] ${file}: no inline script found`); return false; }
  const code = m[1];

  const store = {};
  const document = {
    getElementById(id){ return store[id] || (store[id] = makeEl()); },
    createElement(){ return makeEl(); },
    addEventListener(){}, body: makeEl(), readyState:'complete'
  };
  const windowStub = { addEventListener(){}, innerWidth:1200 };
  const sandbox = {
    document, window: windowStub, console,
    requestAnimationFrame: fn => { if(typeof fn==='function') fn(); return 0; },
    setTimeout: fn => { if(typeof fn==='function') fn(); return 0; },
    clearTimeout(){}, Math, JSON, Date, RegExp, parseInt, parseFloat, isNaN
  };
  sandbox.window.requestAnimationFrame = sandbox.requestAnimationFrame;
  vm.createContext(sandbox);
  try { vm.runInContext(code, sandbox, { filename: file + '.inline.js' }); }
  catch(e){ console.log(`  [FAIL] ${file}: load error: ${e.message}`); return false; }

  // Pull missions + execute from the sandbox global scope.
  let missions, execute;
  try {
    missions = vm.runInContext('typeof missions !== "undefined" ? missions : null', sandbox);
    execute  = vm.runInContext('typeof execute === "function" ? execute : null', sandbox);
  } catch(e){ console.log(`  [FAIL] ${file}: cannot access internals: ${e.message}`); return false; }
  if(!missions || !execute){ console.log(`  [FAIL] ${file}: missions/execute not found`); return false; }

  const total = missions.length;
  // Drive each mission's answer in order; the lab advances missionIndex internally.
  // We read missionIndex after each to detect progress.
  let stuck = null;
  for(let i=0;i<total;i++){
    const before = vm.runInContext('missionIndex', sandbox);
    const answer = missions[i].answer;
    try { vm.runInContext(`execute(${JSON.stringify(answer)})`, sandbox); }
    catch(e){ stuck = { i, answer, err:e.message }; break; }
    const after = vm.runInContext('missionIndex', sandbox);
    if(after <= before){ stuck = { i, answer }; break; }
  }
  const finalIdx = vm.runInContext('missionIndex', sandbox);
  const done = finalIdx >= total && !stuck;
  if(done){ console.log(`  [OK]   ${file} — ${total}/${total} missions completable`); return true; }
  console.log(`  [FAIL] ${file} — stuck at mission ${(stuck&&stuck.i+1)} (answer: ${JSON.stringify(stuck&&stuck.answer)})` + (stuck&&stuck.err?` err=${stuck.err}`:''));
  return false;
}

let ok=0, bad=0;
console.log('LAB PAGE VALIDATION');
for(const f of labs){ validate(f) ? ok++ : bad++; }
console.log(`\nRESULT: ${ok} ok, ${bad} failed`);
process.exit(bad?1:0);
