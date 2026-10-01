'use strict';
/* Solvability test: for each scenario, run each step's solution and verify
   the step's check() passes. Proves scenarios are completable end-to-end. */
const { Shell } = require('./engine_core.js');
const { run } = require('./interpreter.js');
const { SCENARIOS } = require('./scenarios.js');

function makeCtx(sh, line, res){
  const cmd = line.trim().split(/\s+/)[0];
  return { cmd, line: line.trim(), out: res.out, code: res.code };
}

let totalPass=0, totalFail=0, scenPass=0, scenFail=0;
for(const scen of SCENARIOS){
  const sh = new Shell();
  scen.setup(sh);
  let sceneOk = true;
  let stepFailFirst = null;
  for(let i=0;i<scen.steps.length;i++){
    const step = scen.steps[i];
    let ctx = { cmd:'', line:'', out:'', code:0 };
    // run the solution commands for this step
    for(const line of step.solution){
      const res = run(sh, line);
      ctx = makeCtx(sh, line, res);
    }
    let passed=false;
    try { passed = !!step.check(sh, ctx); } catch(e){ passed=false; ctx._err=e.message; }
    if(passed){ totalPass++; }
    else {
      totalFail++; sceneOk=false;
      if(stepFailFirst===null) stepFailFirst = {i, brief:step.brief, solution:step.solution, ctx};
    }
  }
  if(sceneOk){ scenPass++; console.log(`  [OK]   ${scen.id} — ${scen.steps.length} steps`); }
  else { scenFail++; console.log(`  [FAIL] ${scen.id} — first failing step #${stepFailFirst.i+1}: "${stepFailFirst.brief}"`);
    console.log(`         solution: ${JSON.stringify(stepFailFirst.solution)}`);
    console.log(`         ctx: cmd=${stepFailFirst.ctx.cmd} out=${JSON.stringify((stepFailFirst.ctx.out||'').slice(0,80))}` + (stepFailFirst.ctx._err?` err=${stepFailFirst.ctx._err}`:'')); }
}
console.log(`\nSCENARIOS: ${scenPass} ok, ${scenFail} failed`);
console.log(`STEPS: ${totalPass} passed, ${totalFail} failed`);
console.log(`TOTAL SCENARIOS: ${SCENARIOS.length}, TOTAL STEPS: ${SCENARIOS.reduce((a,s)=>a+s.steps.length,0)}`);
process.exit(scenFail?1:0);
