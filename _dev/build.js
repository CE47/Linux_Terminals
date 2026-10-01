'use strict';
/* Build: inline engine_core.js + interpreter.js + scenarios.js + runtime.js
   into game.html, stripping CommonJS require/module.exports. */
const fs=require('fs'), path=require('path');
const dev=__dirname;
const root=path.join(dev,'..');

function read(f){ return fs.readFileSync(path.join(dev,f),'utf8'); }
function stripModule(src){
  return src
    .replace(/^'use strict';\s*/m,'')
    .replace(/const\s*\{[\s\S]*?\}\s*=\s*require\([^)]*\);/g,'')
    .replace(/module\.exports\s*=\s*\{[\s\S]*?\};/g,'')
    .replace(/^\s*(?:const|let|var)\s+\w+\s*=\s*require\([^)]*\);\s*$/gm,'');
}

let engine = stripModule(read('engine_core.js')) + '\n' + stripModule(read('interpreter.js'));
let scenarios = stripModule(read('scenarios.js'));
let runtime = read('runtime.js'); // IIFE, keep as-is

let html = fs.readFileSync(path.join(root,'game.html'),'utf8');
html = html.replace('/* ==== INLINED_ENGINE ==== */', ()=>engine);
html = html.replace('/* ==== INLINED_SCENARIOS ==== */', ()=>scenarios);
html = html.replace('/* ==== INLINED_RUNTIME ==== */', ()=>runtime);
fs.writeFileSync(path.join(root,'game.html'), html);
console.log('Inlined engine('+engine.length+') scenarios('+scenarios.length+') runtime('+runtime.length+') into game.html');
