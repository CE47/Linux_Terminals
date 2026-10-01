'use strict';
/* ============================================================================
   runtime.js — UI glue for Terminal Quest. Assumes Shell, run, SCENARIOS are
   already defined in scope (they will be, once inlined into game.html).
   Exposes GAME for headless testing.
   ============================================================================ */
(function(){
  const D = id => document.getElementById(id);
  const $ = {
    term:D('term'), form:D('form'), input:D('cmd'), ps1:D('ps1'),
    tree:D('tree'), treeScroll:D('treeScroll'), crumbs:D('crumbs'),
    objective:D('objective'), objBadge:D('objBadge'), objText:D('objText'),
    hintBtn:D('hintBtn'), hintbar:D('hintbar'), questList:D('questList'), questSub:D('questSub'),
    stepStat:D('stepStat'), xpStat:D('xpStat'), rankStat:D('rankStat'), termSub:D('termSub'),
    bootOverlay:D('bootOverlay'), bootLog:D('bootLog'),
    selectOverlay:D('selectOverlay'), scenGrid:D('scenGrid'), filters:D('filters'),
    briefOverlay:D('briefOverlay'), briefTitle:D('briefTitle'), briefStory:D('briefStory'), briefGoal:D('briefGoal'),
    briefStart:D('briefStart'), briefBack:D('briefBack'), briefKicker:D('briefKicker'),
    victoryOverlay:D('victoryOverlay'), vicTitle:D('vicTitle'), vicStars:D('vicStars'),
    vicTasks:D('vicTasks'), vicXp:D('vicXp'), vicPerfect:D('vicPerfect'),
    vicMenu:D('vicMenu'), vicNext:D('vicNext'), menuBtn:D('menuBtn')
  };
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const DIFF_COLORS = {Rookie:'#4ade80','Field Agent':'#38bdf8',Specialist:'#a78bfa',Master:'#fbbf24',Expert:'#fb7185'};
  const RANKS = [ [0,'Rookie'],[300,'Operator'],[800,'Engineer'],[1500,'Specialist'],[2600,'Sysadmin'],[4000,'Shell Master'],[6000,'Grandmaster'] ];

  const GAME = {
    sh:null, scen:null, stepIdx:0, attempts:0, xp:0, cleared:{}, rowOf:null, treeInner:null, blob:null,
    history:[], histIdx:-1, perfectCount:0, sessionXp:0
  };

  /* ---------- persistence ---------- */
  const SAVE_KEY = 'terminalQuest.v1';
  function load(){ try{ const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}'); GAME.xp=s.xp||0; GAME.cleared=s.cleared||{}; }catch(e){} }
  function save(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify({xp:GAME.xp, cleared:GAME.cleared})); }catch(e){} }
  function rankFor(xp){ let r='Rookie'; for(const [t,name] of RANKS){ if(xp>=t) r=name; } return r; }
  function updateHeaderStats(){
    $.xpStat.textContent = GAME.xp;
    $.rankStat.textContent = rankFor(GAME.xp);
    if(GAME.scen) $.stepStat.textContent = Math.min(GAME.stepIdx,GAME.scen.steps.length)+'/'+GAME.scen.steps.length;
  }

  /* ---------- terminal output ---------- */
  function log(html, cls){ const d=document.createElement('div'); d.className='tline '+(cls||''); d.innerHTML=html; $.term.appendChild(d); $.term.scrollTop=$.term.scrollHeight; return d; }
  function promptStr(){ const sh=GAME.sh; return `<span class="prompt"><span class="u">${sh.user}</span>@<span class="h">${sh.host}</span>:<span class="p">${esc(sh.pretty(sh.cwd))}</span>$</span>`; }
  function setPs1(){ const sh=GAME.sh; $.ps1.innerHTML = `<span class="u">${sh.user}</span>@<span class="h">${sh.host}</span>:<span class="p">${esc(sh.pretty(sh.cwd))}</span>$`; }
  function shake(){ $.form.classList.remove('shake'); void $.form.offsetWidth; $.form.classList.add('shake'); }

  /* ============================================================
     TREE + BLOB
     ============================================================ */
  function buildTree(){
    GAME.rowOf = new Map();
    $.tree.innerHTML='';
    GAME.treeInner = document.createElement('div'); GAME.treeInner.className='tree-inner';
    $.tree.appendChild(GAME.treeInner);
    renderNode(GAME.sh.root, GAME.treeInner);
    GAME.blob = document.createElement('div'); GAME.blob.className='blob';
    GAME.blob.innerHTML='<div class="body"><span class="eyes"><i></i><i></i></span></div>';
    GAME.treeInner.appendChild(GAME.blob);
  }
  function renderNode(n, parentEl){
    const wrap=document.createElement('div'); wrap.className='tnode';
    const row=document.createElement('div'); row.className='trow '+n.type;
    const icon=document.createElement('span'); icon.className='ticon '+n.type;
    const label=document.createElement('span'); label.className='tlabel'; label.textContent = n===GAME.sh.root?'/':n.name;
    row.append(icon,label);
    wrap.appendChild(row);
    GAME.rowOf.set(n,row);
    if(n.children){
      const kids=GAME.sh.listChildren(n,true);
      if(kids.length){ const kd=document.createElement('div'); kd.className='tkids'; kids.forEach(c=>renderNode(c,kd)); wrap.appendChild(kd); }
    }
    parentEl.appendChild(wrap);
  }
  function currentNode(){ return GAME.sh.get(GAME.sh.cwd); }
  function paintCurrent(){ const cur=currentNode(); GAME.rowOf.forEach((row,n)=>row.classList.toggle('current', n===cur)); }
  function blobTarget(n){ const row=GAME.rowOf.get(n); if(!row||!GAME.treeInner) return {x:0,y:0}; const lab=row.querySelector('.tlabel'); const ir=GAME.treeInner.getBoundingClientRect(); const lr=lab.getBoundingClientRect(); return {x:lr.right-ir.left+8, y:lr.top-ir.top+lr.height/2-13}; }
  function moveBlob(animate){ if(!GAME.blob) return; const cur=currentNode(); const {x,y}=blobTarget(cur); if(!animate) GAME.blob.style.transition='none'; GAME.blob.style.transform=`translate(${x}px,${y}px)`; if(!animate) requestAnimationFrame(()=>{GAME.blob.style.transition='';}); }
  function hopBlob(){ if(!GAME.blob) return; moveBlob(true); GAME.blob.classList.remove('hop'); void GAME.blob.offsetWidth; GAME.blob.classList.add('hop'); const cur=currentNode(); const row=GAME.rowOf.get(cur); if(row){ const rr=row.getBoundingClientRect(), ir=GAME.treeInner.getBoundingClientRect(); const p=document.createElement('div'); p.className='ping'; p.style.transform=`translate(${rr.left-ir.left+12}px,${rr.top-ir.top+rr.height/2}px)`; p.innerHTML='<i></i>'; GAME.treeInner.appendChild(p); setTimeout(()=>p.remove(),750); row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); scrollToCurrent(); } }
  function scrollToCurrent(){ const row=GAME.rowOf.get(currentNode()); if(!row) return; const rr=row.getBoundingClientRect(), ir=GAME.treeInner.getBoundingClientRect(); const target=(rr.top-ir.top)+rr.height/2-$.treeScroll.clientHeight/2; $.treeScroll.scrollTo({top:Math.max(0,target),behavior:'smooth'}); }
  function renderCrumbs(){ $.crumbs.innerHTML=''; const p=GAME.sh.pretty(GAME.sh.cwd); let parts = p==='/'?['/']:(p.startsWith('/')?['/',...p.split('/').filter(Boolean)]:p.split('/').filter(Boolean)); parts.forEach((part,i)=>{ if(i){const s=document.createElement('span');s.className='crumb-sep';s.textContent='›';$.crumbs.appendChild(s);} const c=document.createElement('span'); c.className='crumb'; c.style.animationDelay=(i*40)+'ms'; c.textContent=part; $.crumbs.appendChild(c); }); }
  function refreshTreeFull(){ buildTree(); requestAnimationFrame(()=>{ moveBlob(false); paintCurrent(); }); }

  /* ============================================================
     MISSION / QUEST LOG
     ============================================================ */
  function renderQuestLog(){
    $.questList.innerHTML='';
    GAME.scen.steps.forEach((step,i)=>{
      const it=document.createElement('div');
      let cls='quest-item'; if(i<GAME.stepIdx) cls+=' done'; else if(i===GAME.stepIdx) cls+=' active'; else cls+=' locked';
      it.className=cls;
      const dot = i<GAME.stepIdx ? '✓' : (i+1);
      it.innerHTML = `<span class="qdot">${dot}</span><span>${i<=GAME.stepIdx?step.brief:'• • •'}</span>`;
      $.questList.appendChild(it);
    });
    $.questSub.textContent = GAME.scen.title;
    const active=$.questList.querySelector('.active'); if(active) active.scrollIntoView({block:'nearest'});
  }
  function renderObjective(){
    const step=GAME.scen.steps[GAME.stepIdx];
    $.objective.classList.remove('done');
    $.objBadge.textContent = `Task ${GAME.stepIdx+1} / ${GAME.scen.steps.length}`;
    $.objText.innerHTML = step.brief;
    $.hintbar.classList.remove('show'); $.hintbar.innerHTML='';
  }

  /* ============================================================
     COMMAND EXECUTION + STEP CHECK
     ============================================================ */
  function execute(raw){
    const line=raw.trim();
    if(!line) return;
    GAME.history.push(line); GAME.histIdx=-1;
    log(`${promptStr()} <span class="cmd">${esc(line)}</span>`);
    let res;
    try{ res = run(GAME.sh, line); } catch(e){ res={out:'error: '+e.message+'\n', code:1}; }
    if(res.clear){ $.term.innerHTML=''; }
    else if(res.out){ res.out.replace(/\n$/,'').split('\n').forEach(l=> log(esc(l), res.code===0?'out':'out')); }
    // sync UI to any fs/cwd changes
    const before = GAME._lastCwd;
    setPs1(); renderCrumbs();
    if(GAME.sh.cwd !== before){ refreshTreeFull(); requestAnimationFrame(hopBlob); }
    else { refreshTreeFull(); }
    GAME._lastCwd = GAME.sh.cwd;
    // build ctx and check step
    const ctx = { cmd: line.split(/\s+/)[0], line, out: res.out||'', code: res.code };
    checkStep(ctx);
    updateHeaderStats();
  }

  function checkStep(ctx){
    if(!GAME.scen || GAME.stepIdx>=GAME.scen.steps.length) return;
    const step=GAME.scen.steps[GAME.stepIdx];
    let done=false;
    try{ done = !!step.check(GAME.sh, ctx); }catch(e){ done=false; }
    if(done){
      const firstTry = GAME.attempts===0;
      if(firstTry) GAME.perfectCount++;
      const gain = firstTry?15:8;
      GAME.xp += gain; GAME.sessionXp += gain;
      $.objective.classList.add('done');
      log(`<span class="ok">✔ ${step.brief.replace(/<[^>]+>/g,'')}</span> <span class="rewardline">+${gain} XP</span>`, 'sys');
      GAME.stepIdx++; GAME.attempts=0;
      renderQuestLog();
      save();
      if(GAME.stepIdx>=GAME.scen.steps.length){ setTimeout(finishScenario, 700); }
      else { setTimeout(()=>{ renderObjective(); if(GAME.scen.steps[GAME.stepIdx].narrate) log(`<span class="narr">${GAME.scen.steps[GAME.stepIdx].narrate}</span>`,'sys'); }, 650); }
    } else {
      // only count a "real attempt" if it wasn't a pure navigation/inspection miss
      GAME.attempts++;
      if(ctx.code!==0) shake();
    }
  }

  /* ============================================================
     SCENARIO LIFECYCLE
     ============================================================ */
  function startScenario(scen){
    GAME.scen=scen; GAME.stepIdx=0; GAME.attempts=0; GAME.perfectCount=0; GAME.sessionXp=0;
    GAME.sh = new Shell(); scen.setup(GAME.sh); GAME.sh.cwd = GAME.sh.home; GAME._lastCwd=GAME.sh.home;
    $.term.innerHTML='';
    setPs1(); renderCrumbs(); refreshTreeFull();
    renderObjective(); renderQuestLog(); updateHeaderStats();
    $.termSub.textContent = scen.title;
    const expert = scen.difficulty === 'Expert';
    $.hintBtn.style.display = expert ? 'none' : '';
    log(`<span class="hl">${scen.icon} ${esc(scen.title)}</span>`,'sys');
    log(`<span class="narr">${esc(scen.story)}</span>`,'sys');
    log(``,'sys');
    if(expert) log(`<span class="sys">Expert mission — no hints. Type <b>help</b> for available commands.</span>`,'sys');
    else log(`<span class="sys">Type commands below. Use <b>Hint</b> if you get stuck. Type <b>help</b> for available commands.</span>`,'sys');
    $.input.disabled=false; $.input.value='';
    if(!('ontouchstart' in window) && window.innerWidth>980) setTimeout(()=>$.input.focus(),200);
  }

  function finishScenario(){
    const scen=GAME.scen;
    const wasCleared = !!GAME.cleared[scen.id];
    GAME.cleared[scen.id]=true; save();
    confetti();
    const total=scen.steps.length;
    const stars = GAME.perfectCount>=total ? 3 : GAME.perfectCount>=Math.ceil(total*0.6) ? 2 : 1;
    $.vicTitle.textContent = scen.icon+' '+scen.title;
    $.vicStars.innerHTML = [1,2,3].map(i=> i<=stars?'★':'<span class="off">★</span>').join('');
    $.vicTasks.textContent = total;
    $.vicXp.textContent = GAME.sessionXp;
    $.vicPerfect.textContent = GAME.perfectCount;
    updateHeaderStats();
    $.victoryOverlay.hidden=false;
    GAME._nextScen = nextScenarioAfter(scen);
    $.vicNext.style.display = GAME._nextScen ? '' : 'none';
  }
  function nextScenarioAfter(scen){ const i=SCENARIOS.indexOf(scen); return SCENARIOS[i+1]||null; }

  /* ============================================================
     SCENARIO SELECT + BRIEFING
     ============================================================ */
  let currentFilter='All';
  function renderFilters(){
    const diffs=['All',...Array.from(new Set(SCENARIOS.map(s=>s.difficulty)))];
    $.filters.innerHTML='';
    diffs.forEach(d=>{ const b=document.createElement('button'); b.type='button'; b.className='filter-pill'+(d===currentFilter?' active':''); b.textContent=d; b.onclick=()=>{ currentFilter=d; renderFilters(); renderScenGrid(); }; $.filters.appendChild(b); });
  }
  function renderScenGrid(){
    $.scenGrid.innerHTML='';
    SCENARIOS.filter(s=>currentFilter==='All'||s.difficulty===currentFilter).forEach(scen=>{
      const cleared=!!GAME.cleared[scen.id];
      const card=document.createElement('button'); card.type='button'; card.className='scen-card'+(cleared?' cleared':'');
      card.style.setProperty('--ac', DIFF_COLORS[scen.difficulty]||'#38bdf8');
      card.innerHTML =
        `<div class="scen-top"><span class="scen-icon">${scen.icon}</span><span class="scen-diff">${esc(scen.difficulty)}</span></div>`+
        `<h3>${esc(scen.title)}</h3><p>${esc(scen.brief)}</p>`+
        `<div class="scen-foot"><span class="tasks">${scen.steps.length} tasks</span><span class="status${cleared?' cleared':''}">${cleared?'cleared':'not started'}</span></div>`;
      card.onclick=()=>openBriefing(scen);
      $.scenGrid.appendChild(card);
    });
  }
  function openSelect(){ $.victoryOverlay.hidden=true; $.briefOverlay.hidden=true; renderFilters(); renderScenGrid(); $.selectOverlay.hidden=false; }
  function openBriefing(scen){
    $.selectOverlay.hidden=true;
    $.briefKicker.textContent = scen.difficulty+' · '+scen.steps.length+' tasks';
    $.briefTitle.textContent = scen.icon+'  '+scen.title;
    $.briefStory.textContent = scen.story;
    $.briefGoal.innerHTML = '<b>Goal:</b> '+esc(scen.brief);
    $.briefStart.onclick=()=>{ $.briefOverlay.hidden=true; startScenario(scen); };
    $.briefOverlay.hidden=false;
  }

  /* ============================================================
     confetti + boot
     ============================================================ */
  function confetti(){ const cs=['#4ade80','#38bdf8','#fbbf24','#f472b6','#a78bfa','#7dd3fc']; for(let i=0;i<60;i++){ const c=document.createElement('i'); c.className='confetti'; c.style.left=Math.random()*100+'%'; c.style.background=cs[i%cs.length]; c.style.animationDelay=(Math.random()*.4)+'s'; c.style.animationDuration=(1.7+Math.random()*1.3)+'s'; c.style.setProperty('--rot',(Math.random()*900-450)+'deg'); document.body.appendChild(c); setTimeout(()=>c.remove(),3400);} }

  const BOOT_LINES = [
    '<span class="d">NebulaOS 5.10.0 — booting…</span>',
    '<span class="d">[  ok  ] Mounting virtual filesystem</span>',
    '<span class="d">[  ok  ] Starting shell services</span>',
    '<span class="d">[  ok  ] Loading mission database</span>',
    '<span class="d">[  ok  ] Calibrating the blob</span>',
    '',
    'Welcome, operator. <span style="color:#7dd3fc">Terminal Quest</span> is ready.',
    'Select a mission to begin your training.'
  ];
  function runBoot(done){
    let i=0; $.bootLog.innerHTML='';
    const cursor='<span class="boot-cursor"></span>';
    function tick(){
      if(i<BOOT_LINES.length){ const d=document.createElement('div'); d.innerHTML=BOOT_LINES[i]||'&nbsp;'; $.bootLog.appendChild(d); i++; setTimeout(tick, 260); }
      else { const d=document.createElement('div'); d.innerHTML=cursor; $.bootLog.appendChild(d); setTimeout(done, 500); }
    }
    tick();
  }

  /* ============================================================
     events + init
     ============================================================ */
  $.form.addEventListener('submit', e=>{ e.preventDefault(); const v=$.input.value; $.input.value=''; if(GAME.scen) execute(v); $.input.focus(); });
  $.input.addEventListener('keydown', e=>{
    if(e.key==='ArrowUp'){ e.preventDefault(); if(GAME.histIdx<GAME.history.length-1){ GAME.histIdx++; $.input.value=GAME.history[GAME.history.length-1-GAME.histIdx]; } }
    else if(e.key==='ArrowDown'){ e.preventDefault(); if(GAME.histIdx>0){ GAME.histIdx--; $.input.value=GAME.history[GAME.history.length-1-GAME.histIdx]; } else { GAME.histIdx=-1; $.input.value=''; } }
  });
  $.hintBtn.addEventListener('click', ()=>{ if(!GAME.scen || GAME.scen.difficulty==='Expert') return; if($.hintbar.classList.contains('show')){ $.hintbar.classList.remove('show'); return; } const step=GAME.scen.steps[GAME.stepIdx]; $.hintbar.innerHTML='💡 '+(step.hint||'').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/</g,'&lt;').replace(/&lt;code&gt;/g,'<code>').replace(/&lt;\/code&gt;/g,'</code>'); $.hintbar.classList.add('show'); });
  $.menuBtn.addEventListener('click', openSelect);
  $.briefBack.addEventListener('click', openSelect);
  $.vicMenu.addEventListener('click', openSelect);
  $.vicNext.addEventListener('click', ()=>{ $.victoryOverlay.hidden=true; if(GAME._nextScen) openBriefing(GAME._nextScen); else openSelect(); });
  window.addEventListener('resize', ()=>{ if(GAME.blob) moveBlob(false); });

  function init(){
    load(); updateHeaderStats();
    runBoot(()=>{ $.bootOverlay.hidden=true; openSelect(); });
  }
  // expose for tests
  window.GAME=GAME; window.__tq={execute,startScenario,openSelect,openBriefing,finishScenario,SCENARIOS:typeof SCENARIOS!=='undefined'?SCENARIOS:null};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
