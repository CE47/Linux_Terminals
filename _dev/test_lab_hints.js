'use strict';
/* Deep hint/chip validation for df/du/ps labs.
   For each lab: load inline script in a stubbed DOM, then for each mission
   extract the command(s) inside the hint's <code>…</code> tags and verify:
     (a) running them does not error, and
     (b) the mission's check passes after running them (advances missionIndex).
   Also runs every chip in chipPool to ensure none throw / hit "command not found".
*/
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const labs = process.argv.slice(2).length ? process.argv.slice(2) : ['df.html','du.html','ps.html'];

function makeEl(){
  const el = {
    children:[], style:{setProperty(){}}, dataset:{}, hidden:false, disabled:false,
    value:'', textContent:'', _html:'',
    get innerHTML(){return this._html;}, set innerHTML(v){ this._html=v; if(v==='') this.children=[]; },
    classList:{ _s:new Set(), add(...c){c.forEach(x=>this._s.add(x));}, remove(...c){c.forEach(x=>this._s.delete(x));},
      toggle(c,f){ f=f===undefined?!this._s.has(c):f; f?this._s.add(c):this._s.delete(c); return f; }, contains(c){return this._s.has(c);} },
    appendChild(c){ this.children.push(c); return c; }, append(...cs){ cs.forEach(c=>this.children.push(c)); },
    querySelector(){ return makeEl(); }, querySelectorAll(){ return []; },
    addEventListener(){}, removeEventListener(){}, setAttribute(){}, focus(){}, remove(){},
    scrollIntoView(){}, scrollTo(){}, setSelectionRange(){},
    getBoundingClientRect(){ return {left:0,top:0,right:0,bottom:0,width:10,height:10}; }, get offsetWidth(){ return 0; }
  };
  return el;
}
function freshSandbox(){
  const store = {};
  const document = { getElementById(id){ return store[id] || (store[id] = makeEl()); }, createElement(){ return makeEl(); }, addEventListener(){}, body: makeEl(), readyState:'complete' };
  const sb = { document, window:{ addEventListener(){}, innerWidth:1200 }, console,
    requestAnimationFrame: fn => { if(typeof fn==='function') fn(); return 0; },
    setTimeout: fn => { if(typeof fn==='function') fn(); return 0; }, clearTimeout(){},
    Math, JSON, Date, RegExp, parseInt, parseFloat, isNaN };
  sb.window.requestAnimationFrame = sb.requestAnimationFrame;
  vm.createContext(sb);
  return sb;
}
function load(file){
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if(!m) throw new Error('no inline script');
  const sb = freshSandbox();
  vm.runInContext(m[1], sb, { filename:file });
  return sb;
}
// extract every <code>…</code> command from a hint string
function hintCommands(hint){
  const out = []; const re = /<code>([\s\S]*?)<\/code>/g; let mm;
  while((mm = re.exec(hint))){
    // decode minimal HTML entities that might appear in hints
    const cmd = mm[1].replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
    out.push(cmd);
  }
  return out;
}

let totalOk=0, totalBad=0;
for(const file of labs){
  console.log(`\n=== ${file} ===`);
  // --- Part 1: every hint command advances its mission in a fresh run ---
  let sb = load(file);
  const missions = vm.runInContext('missions', sb);
  let labBad = 0;
  for(let i=0;i<missions.length;i++){
    // fresh sandbox per mission, then fast-forward missionIndex to i by
    // playing earlier missions' answers (deterministic), then run hint cmds.
    const s = load(file);
    for(let j=0;j<i;j++){ vm.runInContext(`execute(${JSON.stringify(missions[j].answer)})`, s); }
    const beforeIdx = vm.runInContext('missionIndex', s);
    if(beforeIdx !== i){ console.log(`  [FAIL] mission ${i+1}: could not reach it (idx=${beforeIdx})`); labBad++; totalBad++; continue; }
    const cmds = hintCommands(missions[i].hint);
    if(!cmds.length){ console.log(`  [WARN] mission ${i+1}: no <code> command in hint`); }
    // run the LAST code snippet in the hint (the full command for the task);
    // but also run every snippet to ensure none throw.
    let threw = null;
    for(const cmd of cmds){
      try { vm.runInContext(`execute(${JSON.stringify(cmd)})`, s); }
      catch(e){ threw = { cmd, err:e.message }; break; }
    }
    const afterIdx = vm.runInContext('missionIndex', s);
    if(threw){ console.log(`  [FAIL] mission ${i+1}: hint cmd threw: ${JSON.stringify(threw.cmd)} -> ${threw.err}`); labBad++; totalBad++; }
    else if(afterIdx > beforeIdx){ console.log(`  [OK]   mission ${i+1}: hint "${cmds[cmds.length-1]}" completes it`); totalOk++; }
    else { console.log(`  [FAIL] mission ${i+1}: hint "${cmds[cmds.length-1]}" did NOT complete the mission`); labBad++; totalBad++; }
  }
  // --- Part 2: every chip command runs without "command not found" / throw ---
  const chipPool = vm.runInContext('chipPool', sb);
  const sc = load(file);
  // capture terminal output by wrapping log via re-reading term children is hard;
  // instead, assert no exception is thrown and that lastCtx updates for command chips.
  for(const chip of chipPool){
    if(chip === 'help') continue; // help has no lastCtx; it just prints
    try {
      vm.runInContext(`execute(${JSON.stringify(chip)})`, sc);
    } catch(e){ console.log(`  [FAIL] chip ${JSON.stringify(chip)} threw: ${e.message}`); labBad++; totalBad++; continue; }
    const ctx = vm.runInContext('lastCtx', sc);
    if(!ctx){ console.log(`  [FAIL] chip ${JSON.stringify(chip)} produced no context (likely command-not-found)`); labBad++; totalBad++; }
    else { console.log(`  [OK]   chip ${JSON.stringify(chip)} ran`); totalOk++; }
  }
  if(!labBad) console.log(`  ${file}: all hint + chip commands OK`);
}
console.log(`\nRESULT: ${totalOk} ok, ${totalBad} failed`);
process.exit(totalBad?1:0);
