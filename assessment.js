'use strict';
/* ==================================================================
   Visual Linux — Command Assessment
   Part 1: filesystem model + rendering
   ================================================================== */

/* ---------- filesystem node factory ---------- */
let uid = 0;
function mk(name, type, extra){
  return Object.assign({
    id: ++uid, name, type: type || 'dir',
    children: type === 'file' ? null : [],
    parent: null,
    content: null,            // array of lines for files
    mode: type === 'file' ? 0o644 : 0o755
  }, extra || {});
}

/* We rebuild the tree fresh each run so tasks that mutate (mkdir/cp/mv/rm)
   start from a known state. buildFs() returns a map of handy references. */
function buildFs(){
  uid = 0;
  const ROOT = mk('/', 'dir');
  const home = mk('home', 'dir');
  const you  = mk('you', 'dir');
  const etc  = mk('etc', 'dir');

  const projects  = mk('projects', 'dir');
  const documents = mk('documents', 'dir');
  const logs      = mk('logs', 'dir');
  const backup    = mk('backup', 'dir');
  const config    = mk('.config', 'dir');

  const notes = mk('notes.txt', 'file', {content:[
    'buy milk','call the bank','ERROR disk almost full','ship the release','review pull request'
  ]});
  const readme = mk('README.md', 'file', {content:[
    '# Project','','Install and run the server.','ERROR handling is documented below.'
  ]});
  const server = mk('server.js', 'file', {mode:0o644, content:[
    'const port = 3000;','startServer(port);'
  ]});
  const access = mk('access.log', 'file', {content:[
    '200 GET /index.html','404 GET /missing','500 GET /crash','200 GET /about','404 GET /nope','500 GET /boom'
  ]});
  const users = mk('users.csv', 'file', {content:[
    'name,role,city','alice,admin,paris','bob,user,berlin','carol,user,paris','dave,admin,berlin'
  ]});
  const nums = mk('scores.txt', 'file', {content:[
    '42','7','19','7','88','19','3'
  ]});
  const deploy = mk('deploy.sh', 'file', {mode:0o644, content:[
    '#!/bin/sh','echo deploying','rsync -a build/ server:/var/www'
  ]});
  const oldNote = mk('old.txt', 'file', {content:['archived note','keep for records']});
  const secret = mk('.env', 'file', {content:['TOKEN=abc123','DEBUG=false']});

  ROOT.children      = [home, etc];
  home.children      = [you];
  you.children       = [projects, documents, logs, backup, config, notes, deploy];
  projects.children  = [readme, server, users, nums];
  documents.children = [oldNote];
  logs.children      = [access];
  backup.children    = [];
  config.children    = [secret];
  etc.children       = [mk('hosts','file',{content:['127.0.0.1 localhost']})];

  (function link(n,p){ n.parent = p; if(n.children) n.children.forEach(c=>link(c,n)); })(ROOT,null);

  return {ROOT, home, you, etc, projects, documents, logs, backup, config,
          notes, readme, server, access, users, nums, deploy, oldNote, secret};
}

/* ---------- global state ---------- */
let FS, ROOT, HOME;
let cwd, prevDir;
let SILENT = false;   // when true, command engine runs without touching the DOM

const esc = s => String(s).replace(/[&<>"']/g,
  c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- path helpers ---------- */
function absPath(n){
  if(n === ROOT) return '/';
  const parts=[]; let x=n;
  while(x && x!==ROOT){ parts.unshift(x.name); x=x.parent; }
  return '/'+parts.join('/');
}
function prettyPath(n){
  const a = absPath(n);
  if(a === '/home/you') return '~';
  if(a.startsWith('/home/you/')) return '~'+a.slice(9);
  return a;
}
function resolvePath(input, base){
  let cur, rest;
  if(input === '~' || input.startsWith('~/')){ cur=HOME; rest=input.slice(1); }
  else if(input.startsWith('/')){ cur=ROOT; rest=input.slice(1); }
  else { cur=base; rest=input; }
  const segs = rest.split('/').filter(Boolean);
  for(let i=0;i<segs.length;i++){
    const s = segs[i];
    if(s === '.') continue;
    if(s === '..'){ cur = cur.parent || ROOT; continue; }
    if(cur.type !== 'dir') return {error:'notdir', name:s};
    const next = cur.children.find(c=>c.name===s);
    if(!next) return {error:'missing', name:s};
    cur = next;
  }
  return {node:cur};
}
/* resolve the parent dir + final name for create/move targets */
function resolveParent(input, base){
  const segs = (input.startsWith('/') ? input.slice(1)
             : input.startsWith('~/') ? input.slice(2)
             : input === '~' ? '' : input).split('/').filter(Boolean);
  let start = input.startsWith('/') ? ROOT : (input === '~' || input.startsWith('~/')) ? HOME : base;
  if(!segs.length) return {parent:start.parent||ROOT, name:start.name, node:start};
  const name = segs.pop();
  let cur = start;
  for(const s of segs){
    if(s === '.') continue;
    if(s === '..'){ cur = cur.parent||ROOT; continue; }
    const next = cur.children && cur.children.find(c=>c.name===s);
    if(!next) return {error:'missing', name:s};
    if(next.type!=='dir') return {error:'notdir', name:s};
    cur = next;
  }
  const existing = cur.children ? cur.children.find(c=>c.name===name) : null;
  return {parent:cur, name, node:existing||null};
}

/* ==================================================================
   DOM refs
   ================================================================== */
const D = id => document.getElementById(id);
const treeEl=D('tree'), treeScroll=D('treeScroll'), term=D('term'), crumbs=D('crumbs');
const form=D('form'), input=D('cmd'), sendBtn=form.querySelector('.send');
const ps1=D('ps1'), psPath=D('psPath'), stepsEl=D('steps');
const missionEl=D('mission'), missionBadge=D('missionBadge'), missionText=D('missionText');
const attemptsBox=D('attemptsBox'), livesStat=D('livesStat'), scoreStat=D('scoreStat'), playerTag=D('playerTag');

let treeInner, avatarEl;
const rowOf = new Map();   // node -> row element
const nodeOf = new Map();  // node -> wrapper element

/* ==================================================================
   Tree rendering (re-buildable)
   ================================================================== */
function buildTree(){
  rowOf.clear(); nodeOf.clear();
  treeEl.innerHTML = '';
  treeInner = document.createElement('div');
  treeInner.className = 'tree-inner';
  treeEl.appendChild(treeInner);
  renderNode(ROOT, treeInner);
  avatarEl = document.createElement('div');
  avatarEl.className = 'avatar';
  avatarEl.innerHTML = '<div class="body"><span class="eyes"><i></i><i></i></span></div>';
  treeInner.appendChild(avatarEl);
}
function renderNode(node, parentEl){
  const wrap = document.createElement('div');
  wrap.className = 'node';
  const row = document.createElement('div');
  row.className = 'row ' + node.type;
  const icon = document.createElement('span');
  icon.className = 'icon ' + node.type;
  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = node === ROOT ? '/' : node.name;
  row.append(icon, label);
  if(node === HOME){
    const tag = document.createElement('span');
    tag.className='tag'; tag.textContent='~';
    row.appendChild(tag);
  }
  if(node.type === 'dir') row.addEventListener('click', ()=>onNodeClick(node));
  wrap.appendChild(row);
  rowOf.set(node,row); nodeOf.set(node,wrap);
  if(node.children && node.children.length){
    const kids = document.createElement('div');
    kids.className='children';
    node.children.forEach(c=>renderNode(c,kids));
    wrap.appendChild(kids);
  }
  parentEl.appendChild(wrap);
}
function rerenderTree(){
  if(SILENT) return;
  buildTree();
  requestAnimationFrame(()=>{ moveAvatar(false); paintCurrent(); });
}

/* ---------- avatar movement ---------- */
function avatarTarget(node){
  const row = rowOf.get(node); if(!row) return {x:0,y:0};
  const label = row.querySelector('.label');
  const ir = treeInner.getBoundingClientRect();
  const lr = label.getBoundingClientRect();
  return { x: lr.right - ir.left + 9, y: lr.top - ir.top + lr.height/2 - 15 };
}
function moveAvatar(animate, node){
  if(SILENT || !avatarEl) return;
  node = node || cwd;
  const {x,y} = avatarTarget(node);
  if(!animate) avatarEl.style.transition = 'none';
  avatarEl.style.transform = `translate(${x}px, ${y}px)`;
  if(!animate) requestAnimationFrame(()=>{ avatarEl.style.transition=''; });
}
function ping(x,y){
  const el = document.createElement('div');
  el.className='ping'; el.style.transform=`translate(${x}px,${y}px)`;
  el.innerHTML='<i></i>'; treeInner.appendChild(el);
  setTimeout(()=>el.remove(),800);
}
function scrollToRow(node){
  const row = rowOf.get(node); if(!row) return;
  const rr = row.getBoundingClientRect(), ir = treeInner.getBoundingClientRect();
  const rel = rr.top - ir.top;
  const target = rel + rr.height/2 - treeScroll.clientHeight/2;
  treeScroll.scrollTo({top:Math.max(0,target), behavior:'smooth'});
}
function animateMove(to){
  if(SILENT) return;
  moveAvatar(true,to);
  avatarEl.classList.remove('hop'); void avatarEl.offsetWidth; avatarEl.classList.add('hop');
  const row = rowOf.get(to);
  if(row){
    const rr=row.getBoundingClientRect(), ir=treeInner.getBoundingClientRect();
    ping(rr.left-ir.left+14, rr.top-ir.top+rr.height/2);
    row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash');
  }
  scrollToRow(to);
}
function paintCurrent(){
  if(SILENT) return;
  rowOf.forEach((row,node)=>row.classList.toggle('current', node===cwd));
}
'use strict';
/* ==================================================================
   Part 2: command engine
   Each command runs against the live FS and returns:
     { ok:bool, out:[lines], sig:{...}, mutated:bool, err:string }
   `sig` is a normalized signature used to compare equivalence with the
   reference answer, so different commands giving the same result pass.
   ================================================================== */

/* ---- tokenizer (handles quotes) ---- */
function tokenize(line){
  return (line.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [])
    .map(t => t.replace(/^"|"$/g,'').replace(/^'|'$/g,''));
}

/* ---- list a directory's entries (for ls / signatures) ---- */
function listNames(node, {all=false, dirsSlash=true}={}){
  if(!node || node.type!=='dir') return node ? [displayName(node,dirsSlash)] : [];
  let entries = node.children.slice();
  if(!all) entries = entries.filter(e=>!e.name.startsWith('.'));
  entries.sort((a,b)=>a.name.localeCompare(b.name, undefined, {numeric:true,sensitivity:'base'}));
  return entries.map(e=>displayName(e,dirsSlash));
}
function displayName(n, slash){ return n.type==='dir' && slash ? n.name+'/' : n.name; }
function fileLines(node){ return node && node.type==='file' ? (node.content||[]).slice() : null; }

/* ---- normalize a set/array to a stable signature string ---- */
function sig(kind, data){ return JSON.stringify({kind, data}); }

/* ==================================================================
   Individual command handlers. Return {out, sig, mutated, err}
   ================================================================== */
function runLs(args){
  const flags={a:false,l:false,t:false,r:false,one:false}; const paths=[];
  for(const a of args){
    if(a.startsWith('--')){ const m={'--all':'a','--long':'l','--reverse':'r'}[a]; if(m) flags[m]=true; continue; }
    if(a.startsWith('-')&&a.length>1){ for(const f of a.slice(1)){ if(f==='1'){flags.one=true;continue;} if(f in flags) flags[f]=true; } continue; }
    paths.push(a);
  }
  const p = paths[0]||'.';
  const r = resolvePath(p, cwd);
  if(r.error) return {err:`ls: cannot access '${p}': ${r.error==='missing'?'No such file or directory':'Not a directory'}`};
  let names = listNames(r.node, {all:flags.a});
  if(flags.r) names = names.slice().reverse();
  const out = names.length ? [names.join('   ')] : ['(empty)'];
  // signature: the SET of names shown (order-independent unless -r/-t asked)
  const key = [...names].sort();
  return {out, sig: sig('ls', {dir:absPath(r.node), all:flags.a, names:key})};
}

function runPwd(){ return {out:[absPath(cwd)], sig: sig('pwd', {p:absPath(cwd)})}; }

function runCd(args){
  const arg = args[0]!==undefined ? args[0] : '';
  let target;
  if(arg==='' || arg==='~') target=HOME;
  else if(arg==='-'){ if(!prevDir) return {err:'bash: cd: OLDPWD not set'}; target=prevDir; }
  else{
    const r=resolvePath(arg,cwd);
    if(r.error==='missing') return {err:`bash: cd: ${arg}: No such file or directory`};
    if(r.error==='notdir'||r.node.type!=='dir') return {err:`bash: cd: ${arg}: Not a directory`};
    target=r.node;
  }
  prevDir=cwd; const from=cwd; cwd=target;
  if(target!==from) animateMove(target);
  paintCurrent(); updatePrompt(); renderCrumbs();
  return {out:[], sig: sig('cd', {p:absPath(cwd)}), moved:true};
}

function runCat(args){
  const files=args.filter(a=>!a.startsWith('-'));
  const nFlag = args.includes('-n');
  if(!files.length) return {err:'cat: missing file operand'};
  let out=[]; let all=[];
  for(const f of files){
    const r=resolvePath(f,cwd);
    if(r.error) return {err:`cat: ${f}: No such file or directory`};
    if(r.node.type!=='file') return {err:`cat: ${f}: Is a directory`};
    const lines=fileLines(r.node); all=all.concat(lines);
    out=out.concat(lines);
  }
  if(nFlag) out=out.map((l,i)=>String(i+1).padStart(6)+'  '+l);
  return {out, sig: sig('cat', {lines:all})};
}

function runMkdir(args){
  const p=args.includes('-p'); const targets=args.filter(a=>!a.startsWith('-'));
  if(!targets.length) return {err:'mkdir: missing operand'};
  let made=[];
  for(const t of targets){
    if(p){
      let base = t.startsWith('/')?ROOT : (t.startsWith('~/')||t==='~')?HOME : cwd;
      const segs=(t.startsWith('/')?t.slice(1):t.startsWith('~/')?t.slice(2):t).split('/').filter(Boolean);
      for(const s of segs){
        let next = base.children.find(c=>c.name===s);
        if(!next){ next=mk(s,'dir'); next.parent=base; base.children.push(next); made.push(next); }
        else if(next.type!=='dir') return {err:`mkdir: cannot create directory '${t}': Not a directory`};
        base=next;
      }
    } else {
      const rp=resolveParent(t,cwd);
      if(rp.error) return {err:`mkdir: cannot create directory '${t}': No such file or directory`};
      if(rp.node) return {err:`mkdir: cannot create directory '${t}': File exists`};
      const d=mk(rp.name,'dir'); d.parent=rp.parent; rp.parent.children.push(d); made.push(d);
    }
  }
  rerenderTree();
  return {out:[], mutated:true, sig: sig('mkdir', {dirs: made.map(m=>absPath(m)).sort()})};
}

function cloneNode(n){
  const c=mk(n.name,n.type,{mode:n.mode, content:n.content?n.content.slice():null});
  if(n.type==='dir'){ c.children=n.children.map(k=>{const kk=cloneNode(k);kk.parent=c;return kk;}); }
  return c;
}
function runCp(args){
  const rec=args.includes('-r')||args.includes('-R')||args.includes('-a');
  const ops=args.filter(a=>!a.startsWith('-'));
  if(ops.length<2) return {err:'cp: missing destination file operand'};
  const src=resolvePath(ops[0],cwd);
  if(src.error) return {err:`cp: cannot stat '${ops[0]}': No such file or directory`};
  if(src.node.type==='dir'&&!rec) return {err:`cp: -r not specified; omitting directory '${ops[0]}'`};
  const dst=resolveParent(ops[1],cwd);
  if(dst.error) return {err:`cp: cannot create '${ops[1]}': No such file or directory`};
  const copy=cloneNode(src.node);
  let placedIn, finalName;
  if(dst.node && dst.node.type==='dir'){ copy.parent=dst.node; dst.node.children.push(copy); placedIn=dst.node; finalName=copy.name; }
  else { copy.name=dst.name; copy.parent=dst.parent; const ex=dst.parent.children.findIndex(c=>c.name===dst.name); if(ex>=0) dst.parent.children.splice(ex,1); dst.parent.children.push(copy); placedIn=dst.parent; finalName=dst.name; }
  rerenderTree();
  return {out:[], mutated:true, sig: sig('cp', {into:absPath(placedIn), name:finalName, srcExists:true})};
}
function runMv(args){
  const ops=args.filter(a=>!a.startsWith('-'));
  if(ops.length<2) return {err:'mv: missing destination file operand'};
  const src=resolvePath(ops[0],cwd);
  if(src.error) return {err:`mv: cannot stat '${ops[0]}': No such file or directory`};
  const dst=resolveParent(ops[1],cwd);
  if(dst.error) return {err:`mv: cannot move '${ops[0]}': No such file or directory`};
  // detach
  const oldParent=src.node.parent;
  oldParent.children.splice(oldParent.children.indexOf(src.node),1);
  let placedIn, finalName;
  if(dst.node && dst.node.type==='dir'){ src.node.parent=dst.node; dst.node.children.push(src.node); placedIn=dst.node; finalName=src.node.name; }
  else { const ex=dst.parent.children.findIndex(c=>c.name===dst.name); if(ex>=0) dst.parent.children.splice(ex,1); src.node.name=dst.name; src.node.parent=dst.parent; dst.parent.children.push(src.node); placedIn=dst.parent; finalName=dst.name; }
  rerenderTree();
  return {out:[], mutated:true, sig: sig('mv', {into:absPath(placedIn), name:finalName})};
}
function runRm(args){
  const rec=args.includes('-r')||args.includes('-R')||args.includes('-rf')||args.includes('-f');
  const recFlag=args.some(a=>/^-.*r/i.test(a));
  const targets=args.filter(a=>!a.startsWith('-'));
  if(!targets.length) return {err:'rm: missing operand'};
  let removed=[];
  for(const t of targets){
    const r=resolvePath(t,cwd);
    if(r.error) return {err:`rm: cannot remove '${t}': No such file or directory`};
    if(r.node.type==='dir'&&!recFlag) return {err:`rm: cannot remove '${t}': Is a directory`};
    if(r.node===ROOT||r.node===HOME) return {err:`rm: refusing to remove protected directory`};
    const p=r.node.parent; p.children.splice(p.children.indexOf(r.node),1); removed.push(absPath(r.node));
  }
  rerenderTree();
  return {out:[], mutated:true, sig: sig('rm', {gone:removed.sort()})};
}

/* ---- collect all descendants for find ---- */
function walk(node, acc, rel){
  acc.push({node, path: rel});
  if(node.children) node.children.forEach(c=>walk(c, acc, rel+'/'+c.name));
}
function runFind(args){
  const start = (args[0] && !args[0].startsWith('-')) ? args[0] : '.';
  const r=resolvePath(start,cwd);
  if(r.error) return {err:`find: '${start}': No such file or directory`};
  let name=null, type=null;
  for(let i=0;i<args.length;i++){
    if(args[i]==='-name') name=args[i+1];
    if(args[i]==='-type') type=args[i+1]; // f or d
  }
  const acc=[]; walk(r.node, acc, start==='.'?'.':start);
  let res=acc;
  if(type) res=res.filter(x=> type==='d'?x.node.type==='dir':x.node.type==='file');
  if(name){
    const rx=new RegExp('^'+name.replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*').replace(/\?/g,'.')+'$');
    res=res.filter(x=>rx.test(x.node.name));
  }
  const paths=res.map(x=>x.path);
  return {out:paths.slice(), sig: sig('find', {start:absPath(r.node), name:name||null, type:type||null, hits:paths.slice().sort()})};
}

function runGrep(args){
  let i=false,n=false,c=false,rf=false,v=false; const rest=[];
  for(const a of args){
    if(a.startsWith('-')&&a.length>1&&!a.startsWith('--')){ for(const f of a.slice(1)){ if(f==='i')i=true; else if(f==='n')n=true; else if(f==='c')c=true; else if(f==='r'||f==='R')rf=true; else if(f==='v')v=true; } }
    else rest.push(a);
  }
  const pattern=rest[0]; const files=rest.slice(1);
  if(pattern===undefined) return {err:'usage: grep PATTERN FILE'};
  const rx=new RegExp(pattern.replace(/[.+^${}()|[\]\\]/g,'\\$&'), i?'i':'');
  let targets=[];
  if(rf){ const base=files[0]?resolvePath(files[0],cwd):{node:cwd}; if(base.error) return {err:`grep: ${files[0]}: No such file or directory`}; const acc=[]; walk(base.node,acc,files[0]||'.'); targets=acc.filter(x=>x.node.type==='file').map(x=>({node:x.node,label:x.path})); }
  else if(files.length){ for(const f of files){ const r=resolvePath(f,cwd); if(r.error) return {err:`grep: ${f}: No such file or directory`}; if(r.node.type!=='file') return {err:`grep: ${f}: Is a directory`}; targets.push({node:r.node,label:f}); } }
  else return {err:'grep: no input file'};
  const multi=targets.length>1;
  let matched=[]; const out=[];
  targets.forEach(t=>{
    (t.node.content||[]).forEach((line,idx)=>{
      const hit=rx.test(line); if(v?!hit:hit){ matched.push(t.label+':'+line); if(!c){ out.push((multi?t.label+':':'')+(n?(idx+1)+':':'')+line); } }
    });
  });
  if(c){ targets.forEach(t=>{ const cnt=(t.node.content||[]).filter(l=>{const h=rx.test(l);return v?!h:h;}).length; out.push((multi?t.label+':':'')+cnt); }); }
  return {out, sig: sig('grep', {pattern, i, v, matched: matched.slice().sort()})};
}

function runWc(args){
  let l=false,w=false,c=false; const files=[];
  for(const a of args){ if(a.startsWith('-')&&a.length>1){ for(const f of a.slice(1)){ if(f==='l')l=true; if(f==='w')w=true; if(f==='c')c=true; } } else files.push(a); }
  if(!files.length) return {err:'wc: missing file operand'};
  const none=!l&&!w&&!c;
  const out=[]; const totals=[];
  for(const f of files){
    const r=resolvePath(f,cwd); if(r.error) return {err:`wc: ${f}: No such file or directory`};
    if(r.node.type!=='file') return {err:`wc: ${f}: Is a directory`};
    const lines=fileLines(r.node); const text=lines.join('\n');
    const lc=lines.length, wc=text.split(/\s+/).filter(Boolean).length, cc=text.length+(lines.length?1:0);
    const parts=[]; if(l||none)parts.push(lc); if(w||none)parts.push(wc); if(c||none)parts.push(cc);
    out.push(parts.join(' ')+' '+f);
    totals.push({f, lc, wc, cc});
  }
  return {out, sig: sig('wc', {want:{l:l||none,w:w||none,c:c||none}, totals})};
}

function runHeadTail(cmd,args){
  let n=10; const files=[];
  for(let i=0;i<args.length;i++){ const a=args[i]; if(a==='-n'){ n=parseInt(args[++i],10); } else if(/^-\d+$/.test(a)){ n=parseInt(a.slice(1),10); } else if(!a.startsWith('-')) files.push(a); }
  if(!files.length) return {err:`${cmd}: missing file operand`};
  const r=resolvePath(files[0],cwd); if(r.error) return {err:`${cmd}: cannot open '${files[0]}'`};
  if(r.node.type!=='file') return {err:`${cmd}: ${files[0]}: Is a directory`};
  const lines=fileLines(r.node);
  const out = cmd==='head'? lines.slice(0,n) : lines.slice(Math.max(0,lines.length-n));
  return {out, sig: sig(cmd, {file:absPath(r.node), n, lines:out.slice()})};
}

function runSort(args){
  let num=false,rev=false,uniq=false; const files=[];
  for(const a of args){ if(a.startsWith('-')&&a.length>1){ for(const f of a.slice(1)){ if(f==='n')num=true; if(f==='r')rev=true; if(f==='u')uniq=true; } } else files.push(a); }
  if(!files.length) return {err:'sort: missing file operand'};
  const r=resolvePath(files[0],cwd); if(r.error) return {err:`sort: cannot read: ${files[0]}`};
  let lines=fileLines(r.node).slice();
  lines.sort((a,b)=> num ? (parseFloat(a)-parseFloat(b)) : a.localeCompare(b));
  if(rev) lines.reverse();
  if(uniq){ lines=lines.filter((l,i)=>i===0||l!==lines[i-1]); }
  return {out:lines.slice(), sig: sig('sort', {lines:lines.slice()})};
}
function runUniq(args){
  let c=false,d=false; const files=[];
  for(const a of args){ if(a.startsWith('-')&&a.length>1){ for(const f of a.slice(1)){ if(f==='c')c=true; if(f==='d')d=true; } } else files.push(a); }
  if(!files.length) return {err:'uniq: missing file operand'};
  const r=resolvePath(files[0],cwd); if(r.error) return {err:`uniq: ${files[0]}: No such file or directory`};
  const lines=fileLines(r.node);
  const groups=[]; lines.forEach(l=>{ if(groups.length&&groups[groups.length-1].l===l) groups[groups.length-1].n++; else groups.push({l,n:1}); });
  let res=groups; if(d) res=res.filter(g=>g.n>1);
  const out=res.map(g=> c? String(g.n).padStart(4)+' '+g.l : g.l);
  return {out, sig: sig('uniq', {out:out.slice()})};
}

function runCut(args){
  let delim='\t', fields=null, chars=null; const files=[];
  for(let i=0;i<args.length;i++){ const a=args[i];
    if(a==='-d'){ delim=args[++i]; }
    else if(a.startsWith('-d')){ delim=a.slice(2); }
    else if(a==='-f'){ fields=args[++i]; }
    else if(a.startsWith('-f')){ fields=a.slice(2); }
    else if(a==='-c'){ chars=args[++i]; }
    else if(a.startsWith('-c')){ chars=a.slice(2); }
    else if(!a.startsWith('-')) files.push(a);
  }
  if(!files.length) return {err:'cut: missing file operand'};
  const r=resolvePath(files[0],cwd); if(r.error) return {err:`cut: ${files[0]}: No such file or directory`};
  const lines=fileLines(r.node);
  const parseRange = spec => { const set=new Set(); spec.split(',').forEach(p=>{ if(p.includes('-')){ const[a,b]=p.split('-'); for(let i=+a;i<=+b;i++) set.add(i);} else set.add(+p); }); return set; };
  let out;
  if(fields!==null){ const set=parseRange(fields); out=lines.map(l=>{ const cols=l.split(delim); return [...set].sort((a,b)=>a-b).map(i=>cols[i-1]).filter(x=>x!==undefined).join(delim); }); }
  else if(chars!==null){ const set=parseRange(chars); out=lines.map(l=>[...set].sort((a,b)=>a-b).map(i=>l[i-1]||'').join('')); }
  else return {err:'cut: you must specify a list of bytes, characters, or fields'};
  return {out, sig: sig('cut', {out:out.slice()})};
}

function runSed(args){
  const ops=args.filter(a=>!a.startsWith('-')); const inPlace=args.includes('-i');
  const expr=ops[0]; const file=ops[1];
  const m=/^s\/(.*)\/(.*)\/([gip]*)$/.exec(expr||'');
  if(!m) return {err:'sed: unsupported expression (use s/old/new/[g])'};
  if(!file) return {err:'sed: no input file'};
  const r=resolvePath(file,cwd); if(r.error) return {err:`sed: can't read ${file}: No such file or directory`};
  const [,pat,rep,flags]=m; const rx=new RegExp(pat.replace(/[.+^${}()|[\]\\]/g,'\\$&'), flags.includes('g')?'g':'');
  const lines=fileLines(r.node);
  const out=lines.map(l=>l.replace(rx,rep));
  if(inPlace){ r.node.content=out.slice(); }
  return {out, sig: sig('sed', {out:out.slice(), inPlace}), mutated:inPlace};
}

function octal(mode){ return (mode & 0o777).toString(8).padStart(3,'0'); }
function applySymbolic(mode, spec){
  const m=/^([ugoa]*)([+\-=])([rwx]+)$/.exec(spec); if(!m) return null;
  let [,who,op,perms]=m; if(!who||who==='a') who='ugo';
  let bits=0; if(perms.includes('r'))bits|=4; if(perms.includes('w'))bits|=2; if(perms.includes('x'))bits|=1;
  let mask=0; if(who.includes('u'))mask|=bits<<6; if(who.includes('g'))mask|=bits<<3; if(who.includes('o'))mask|=bits;
  if(op==='+') return mode|mask;
  if(op==='-') return mode&~mask;
  // '=' : clear the who-classes then set
  let clr=0; if(who.includes('u'))clr|=0o700; if(who.includes('g'))clr|=0o070; if(who.includes('o'))clr|=0o007;
  return (mode&~clr)|mask;
}
function runChmod(args){
  const rec=args.some(a=>/^-.*R/i.test(a));
  const rest=args.filter(a=>!a.startsWith('-'));
  const spec=rest[0]; const targets=rest.slice(1);
  if(!spec||!targets.length) return {err:'chmod: missing operand'};
  const changed=[];
  for(const t of targets){
    const r=resolvePath(t,cwd); if(r.error) return {err:`chmod: cannot access '${t}': No such file or directory`};
    const apply=node=>{
      let mode=node.mode;
      if(/^[0-7]{3,4}$/.test(spec)) mode=parseInt(spec,8)&0o777;
      else { for(const part of spec.split(',')){ const nm=applySymbolic(mode,part); if(nm===null) return false; mode=nm; } }
      node.mode=mode; changed.push({p:absPath(node), mode:octal(mode)}); return true;
    };
    if(!apply(r.node)) return {err:`chmod: invalid mode: '${spec}'`};
    if(rec&&r.node.children){ const acc=[]; walk(r.node,acc,''); acc.slice(1).forEach(x=>apply(x.node)); }
  }
  return {out:[], mutated:true, sig: sig('chmod', {changed: changed.slice().sort((a,b)=>a.p.localeCompare(b.p))})};
}

/* ==================================================================
   dispatch a single (non-piped) command
   ================================================================== */
function runSingle(cmdLine){
  const parts=tokenize(cmdLine); const cmd=parts[0]; const args=parts.slice(1);
  switch(cmd){
    case 'ls': return runLs(args);
    case 'pwd': return runPwd();
    case 'cd': return runCd(args);
    case 'cat': return runCat(args);
    case 'mkdir': return runMkdir(args);
    case 'cp': return runCp(args);
    case 'mv': return runMv(args);
    case 'rm': return runRm(args);
    case 'find': return runFind(args);
    case 'grep': return runGrep(args);
    case 'wc': return runWc(args);
    case 'head': return runHeadTail('head',args);
    case 'tail': return runHeadTail('tail',args);
    case 'sort': return runSort(args);
    case 'uniq': return runUniq(args);
    case 'cut': return runCut(args);
    case 'sed': return runSed(args);
    case 'chmod': return runChmod(args);
    default: return {err:`bash: ${cmd}: command not found`};
  }
}

/* Run stdin-driven variants for pipelines (operate on provided lines). */
function runOnLines(cmdLine, lines){
  const parts=tokenize(cmdLine); const cmd=parts[0]; const args=parts.slice(1);
  const asFile=()=>({type:'file', content:lines.slice(), name:'-'});
  switch(cmd){
    case 'grep':{ let i=false,n=false,c=false,v=false; const rest=[]; for(const a of args){ if(a.startsWith('-')&&a.length>1){for(const f of a.slice(1)){if(f==='i')i=true;else if(f==='n')n=true;else if(f==='c')c=true;else if(f==='v')v=true;}} else rest.push(a);} const rx=new RegExp((rest[0]||'').replace(/[.+^${}()|[\]\\]/g,'\\$&'),i?'i':''); let m=lines.filter(l=>{const h=rx.test(l);return v?!h:h;}); if(c) return {out:[String(m.length)]}; if(n) m=m.map((l,idx)=>(idx+1)+':'+l); return {out:m}; }
    case 'wc':{ let l=false,w=false,ch=false; for(const a of args){if(a.startsWith('-')){for(const f of a.slice(1)){if(f==='l')l=true;if(f==='w')w=true;if(f==='c')ch=true;}}} const none=!l&&!w&&!ch; const text=lines.join('\n'); const parts2=[]; if(l||none)parts2.push(lines.length); if(w||none)parts2.push(text.split(/\s+/).filter(Boolean).length); if(ch||none)parts2.push(text.length+(lines.length?1:0)); return {out:[parts2.join(' ')]}; }
    case 'sort':{ let num=false,rev=false,u=false; for(const a of args){if(a.startsWith('-')){for(const f of a.slice(1)){if(f==='n')num=true;if(f==='r')rev=true;if(f==='u')u=true;}}} let s=lines.slice().sort((a,b)=>num?parseFloat(a)-parseFloat(b):a.localeCompare(b)); if(rev)s.reverse(); if(u)s=s.filter((l,i)=>i===0||l!==s[i-1]); return {out:s}; }
    case 'uniq':{ let c=false; for(const a of args){if(a.startsWith('-')){for(const f of a.slice(1)){if(f==='c')c=true;}}} const g=[]; lines.forEach(l=>{if(g.length&&g[g.length-1].l===l)g[g.length-1].n++;else g.push({l,n:1});}); return {out:g.map(x=>c?String(x.n).padStart(4)+' '+x.l:x.l)}; }
    case 'head':{ let n=10; for(let i=0;i<args.length;i++){if(args[i]==='-n')n=+args[++i];else if(/^-\d+$/.test(args[i]))n=+args[i].slice(1);} return {out:lines.slice(0,n)}; }
    case 'tail':{ let n=10; for(let i=0;i<args.length;i++){if(args[i]==='-n')n=+args[++i];else if(/^-\d+$/.test(args[i]))n=+args[i].slice(1);} return {out:lines.slice(-n)}; }
    case 'cut':{ const g=runCut(args.concat(['-']).filter(a=>a!=='-')); // fall back: run on lines directly
      let delim='\t',fields=null,chars=null; for(let i=0;i<args.length;i++){const a=args[i]; if(a==='-d')delim=args[++i];else if(a.startsWith('-d'))delim=a.slice(2);else if(a==='-f')fields=args[++i];else if(a.startsWith('-f'))fields=a.slice(2);else if(a==='-c')chars=args[++i];else if(a.startsWith('-c'))chars=a.slice(2);}
      const range=spec=>{const set=new Set();spec.split(',').forEach(p=>{if(p.includes('-')){const[x,y]=p.split('-');for(let i=+x;i<=+y;i++)set.add(i);}else set.add(+p);});return[...set].sort((a,b)=>a-b);};
      if(fields!==null){const set=range(fields);return {out:lines.map(l=>{const cols=l.split(delim);return set.map(i=>cols[i-1]).filter(x=>x!==undefined).join(delim);})};}
      if(chars!==null){const set=range(chars);return {out:lines.map(l=>set.map(i=>l[i-1]||'').join(''))};}
      return {out:lines}; }
    case 'sed':{ const expr=args.find(a=>!a.startsWith('-')); const m=/^s\/(.*)\/(.*)\/([gip]*)$/.exec(expr||''); if(!m)return{out:lines}; const rx=new RegExp(m[1].replace(/[.+^${}()|[\]\\]/g,'\\$&'),m[3].includes('g')?'g':''); return {out:lines.map(l=>l.replace(rx,m[2]))}; }
    default: return {err:`bash: ${cmd}: command not found`};
  }
}

/* ==================================================================
   full pipeline runner (supports  |   >   >>)
   returns {out, sig, mutated, err}
   ================================================================== */
function runPipeline(cmdLine){
  // split redirect first
  let redirect=null, body=cmdLine;
  const rm=/\s(>>|>)\s*([^\s|><]+)\s*$/.exec(cmdLine);
  if(rm){ redirect={mode:rm[1], file:rm[2]}; body=cmdLine.slice(0,rm.index); }
  const stages=body.split('|').map(s=>s.trim()).filter(Boolean);
  if(!stages.length) return {err:'bash: syntax error'};

  let lines=null; let lastSig=null; let mutated=false; let firstOut=null;
  for(let i=0;i<stages.length;i++){
    let res;
    if(i===0){ res=runSingle(stages[i]); if(res.err) return res; lines=res.out.slice(); lastSig=res.sig; mutated=mutated||!!res.mutated; }
    else { res=runOnLines(stages[i], lines); if(res.err) return res; lines=res.out.slice(); lastSig=null; }
  }
  let out=lines.slice();
  if(redirect){
    const rp=resolveParent(redirect.file,cwd);
    if(rp.error) return {err:`bash: ${redirect.file}: No such file or directory`};
    let node=rp.node;
    if(!node){ node=mk(rp.name,'file',{content:[]}); node.parent=rp.parent; rp.parent.children.push(node); }
    if(node.type!=='file') return {err:`bash: ${redirect.file}: Is a directory`};
    if(redirect.mode==='>') node.content=out.slice();
    else node.content=(node.content||[]).concat(out);
    mutated=true; rerenderTree();
    const finalOut=[];  // redirect swallows stdout
    return {out:finalOut, mutated:true,
      sig: sig('redirect', {mode:redirect.mode, file:absPath(node), content:node.content.slice()})};
  }
  // multi-stage pipeline: signature is the final output lines
  if(stages.length>1) return {out, mutated, sig: sig('pipe', {out:out.slice()})};
  return {out, mutated, sig:lastSig};
}
'use strict';
/* ==================================================================
   Part 3: task bank, runtime, scoring, results, export
   Each task: {cmds:[tag], difficulty, prompt, ref, setupNote}
   `ref` is the reference command. On start we run ref against a
   throwaway FS clone to capture the expected signature, then compare
   the student's signature to it. Any command matching the signature
   is accepted (equivalence).
   ================================================================== */

/* Task templates. `ref` = a canonical correct command.
   `accepts` (optional) = extra explicit strings also considered "best/valid".
   Difficulty tiers: 1 easy, 2 medium, 3 hard. */
const TASK_BANK = [
  // ---- easy (tier 1) ----
  {tier:1, tags:['ls'], prompt:'List the visible entries in the current folder.', ref:'ls', start:'projects'},
  {tier:1, tags:['ls'], prompt:'List <b>everything</b> in the current folder, including hidden entries.', ref:'ls -a', start:'you'},
  {tier:1, tags:['pwd'], prompt:'Print the full absolute path of where you are right now.', ref:'pwd', start:'logs'},
  {tier:1, tags:['cd'], prompt:'Move into the <b>projects</b> folder.', ref:'cd projects', start:'you'},
  {tier:1, tags:['cd'], prompt:'Go up one level to the parent folder.', ref:'cd ..', start:'projects'},
  {tier:1, tags:['cd'], prompt:'Jump straight to your home folder.', ref:'cd ~', start:'logs'},
  {tier:1, tags:['cat'], prompt:'Show the contents of <b>notes.txt</b>.', ref:'cat notes.txt', start:'you'},
  {tier:1, tags:['mkdir'], prompt:'Create a new folder called <b>archive</b> here.', ref:'mkdir archive', start:'you'},

  // ---- medium (tier 2) ----
  {tier:2, tags:['ls'], prompt:'List entries here in the long format (permissions, owner, size, date).', ref:'ls -l', start:'projects'},
  {tier:2, tags:['grep'], prompt:'Find every line containing <b>ERROR</b> in <b>notes.txt</b>.', ref:'grep ERROR notes.txt', start:'you'},
  {tier:2, tags:['grep'], prompt:'Count how many lines in <b>access.log</b> contain <b>404</b>.', ref:'grep -c 404 access.log', start:'logs'},
  {tier:2, tags:['wc'], prompt:'Count the number of lines in <b>scores.txt</b>.', ref:'wc -l scores.txt', start:'projects'},
  {tier:2, tags:['head'], prompt:'Show only the first <b>2</b> lines of <b>access.log</b>.', ref:'head -n 2 access.log', start:'logs'},
  {tier:2, tags:['tail'], prompt:'Show only the last <b>2</b> lines of <b>access.log</b>.', ref:'tail -n 2 access.log', start:'logs'},
  {tier:2, tags:['cp'], prompt:'Copy <b>notes.txt</b> into the <b>backup</b> folder.', ref:'cp notes.txt backup', start:'you'},
  {tier:2, tags:['mv'], prompt:'Rename <b>old.txt</b> to <b>history.txt</b> (you are in documents).', ref:'mv old.txt history.txt', start:'documents'},
  {tier:2, tags:['rm'], prompt:'Delete the file <b>scores.txt</b>.', ref:'rm scores.txt', start:'projects'},
  {tier:2, tags:['find'], prompt:'Find all files named <b>*.log</b> anywhere under the current folder.', ref:'find . -name "*.log"', start:'you'},
  {tier:2, tags:['sort'], prompt:'Sort the numbers in <b>scores.txt</b> numerically (smallest first).', ref:'sort -n scores.txt', start:'projects'},
  {tier:2, tags:['chmod'], prompt:'Make <b>deploy.sh</b> executable for everyone (add execute for user, group, other).', ref:'chmod +x deploy.sh', start:'you'},

  // ---- hard (tier 3) ----
  {tier:3, tags:['grep','-i'], prompt:'Find lines with <b>error</b> in <b>README.md</b>, ignoring case, with line numbers.', ref:'grep -in error README.md', start:'projects'},
  {tier:3, tags:['find'], prompt:'Find every <b>directory</b> under your home folder.', ref:'find . -type d', start:'you'},
  {tier:3, tags:['cut'], prompt:'Extract just the <b>role</b> column (field 2) from <b>users.csv</b> (comma delimited).', ref:'cut -d , -f 2 users.csv', start:'projects'},
  {tier:3, tags:['sed'], prompt:'In <b>notes.txt</b> replace the first <b>ERROR</b> on each line with <b>WARN</b> (print only, do not save).', ref:'sed s/ERROR/WARN/ notes.txt', start:'you'},
  {tier:3, tags:['sort','uniq'], prompt:'Sort <b>scores.txt</b> numerically and remove duplicate values.', ref:'sort -nu scores.txt', start:'projects'},
  {tier:3, tags:['pipe','wc'], prompt:'Count how many lines in <b>access.log</b> contain <b>500</b>, using a pipe.', ref:'cat access.log | grep 500 | wc -l', start:'logs'},
  {tier:3, tags:['pipe','sort'], prompt:'List the unique HTTP status codes in <b>access.log</b>, one per line, sorted. (hint: cut field 1 on space, then sort -u)', ref:'cut -d " " -f 1 access.log | sort -u', start:'logs'},
  {tier:3, tags:['redirect'], prompt:'Write the text of <b>notes.txt</b> into a new file named <b>copy.txt</b> using redirection.', ref:'cat notes.txt > copy.txt', start:'you'},
  {tier:3, tags:['pipe','grep'], prompt:'From <b>users.csv</b>, show only the lines for people in <b>paris</b>.', ref:'grep paris users.csv', start:'projects'},
  {tier:3, tags:['chmod'], prompt:'Set <b>deploy.sh</b> to exactly mode <b>755</b>.', ref:'chmod 755 deploy.sh', start:'you'},
];

const DIFF_COUNT = {easy:6, medium:9, hard:12};
const DIFF_TIERS = {easy:[1], medium:[1,2], hard:[1,2,3]};

/* ---------- runtime state ---------- */
let player='', difficulty='medium';
let tasks=[], taskIdx=0;
let attemptsLeft=3, score=0, maxScore=0;
let record=[];               // per-task: {prompt, ref, tries:[{cmd,ok}], solvedWith, awarded, tier}
let currentExpectedSig=null;
let started=false;

const ATTEMPT_POINTS=[100,60,30]; // 1st/2nd/3rd try

/* ---------- helpers to (re)position player at task start ---------- */
function nodeByStart(key){ return FS[key] || HOME; }

/* Capture expected signature by running ref on a fresh clone of the FS,
   positioned at the same start dir, WITHOUT touching the real UI. */
function computeExpected(task){
  const savedFS=FS, savedROOT=ROOT, savedHOME=HOME, savedCwd=cwd, savedPrev=prevDir;
  SILENT=true;
  FS=buildFs(); ROOT=FS.ROOT; HOME=FS.you;
  cwd=nodeByStart(task.start); prevDir=null;
  let expSig=null, err=null;
  try{ const r=runPipeline(task.ref); if(r.err) err=r.err; else expSig=r.sig; }
  catch(e){ err=String(e); }
  // restore
  FS=savedFS; ROOT=savedROOT; HOME=savedHOME; cwd=savedCwd; prevDir=savedPrev;
  SILENT=false;
  return {expSig, err};
}

/* ==================================================================
   terminal output helpers
   ================================================================== */
function log(html, cls){
  const d=document.createElement('div');
  d.className='line '+(cls||''); d.innerHTML=html;
  term.appendChild(d); term.scrollTop=term.scrollHeight;
}
function shakeInput(){ form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); }
function updatePrompt(){ if(SILENT) return; psPath.textContent=prettyPath(cwd); }
function renderCrumbs(){
  if(SILENT) return;
  crumbs.innerHTML='';
  const p=prettyPath(cwd);
  let parts;
  if(p==='/') parts=['/'];
  else { const segs=p.split('/').filter(Boolean); parts=p.startsWith('/')?['/',...segs]:segs; }
  parts.forEach((part,i)=>{
    if(i){ const s=document.createElement('span'); s.className='sep'; s.textContent='›'; crumbs.appendChild(s); }
    const pill=document.createElement('span'); pill.className='crumb'; pill.style.animationDelay=(i*45)+'ms'; pill.textContent=part; crumbs.appendChild(pill);
  });
}
function onNodeClick(node){ if(!started) return; input.focus(); }

/* ==================================================================
   mission / attempts UI
   ================================================================== */
function renderAttempts(){
  attemptsBox.innerHTML='<span class="attempts-label">tries</span>';
  for(let i=0;i<3;i++){ const d=document.createElement('i'); if(i>=attemptsLeft) d.classList.add('used'); attemptsBox.appendChild(d); }
  livesStat.textContent=attemptsLeft;
}
function buildSteps(){
  stepsEl.innerHTML='';
  tasks.forEach((_,i)=>{ const d=document.createElement('i'); if(i===0) d.classList.add('active'); stepsEl.appendChild(d); });
}
function renderTask(){
  const t=tasks[taskIdx];
  missionEl.classList.remove('complete','miss');
  missionBadge.textContent=`Task ${taskIdx+1} / ${tasks.length}`;
  missionText.innerHTML=t.prompt;
  attemptsLeft=3; renderAttempts();
  [...stepsEl.children].forEach((d,i)=>{ d.classList.toggle('active', i===taskIdx); });
  // position avatar at the task's start dir
  cwd=nodeByStart(t.start); prevDir=null;
  paintCurrent(); updatePrompt(); renderCrumbs();
  animateMove(cwd);
  const {expSig,err}=computeExpected(t);
  currentExpectedSig=expSig;
  if(err){ /* should not happen; log for safety */ console.warn('ref failed',t.ref,err); }
  log('');
  log(`<span class="hl">Task ${taskIdx+1}:</span> ${t.prompt}`);
  log(`<span class="dim">You are in <b>${esc(prettyPath(cwd))}</b>. Type the command that does it.</span>`);
}

/* ==================================================================
   submit handler
   ================================================================== */
function handleSubmit(raw){
  const cmdLine=raw.trim();
  if(!cmdLine || !started || taskIdx>=tasks.length) return;
  const t=tasks[taskIdx];
  log(`<span class="p">you@linux:${esc(prettyPath(cwd))}$</span> <span class="c">${esc(cmdLine)}</span>`);

  let res;
  try{ res=runPipeline(cmdLine); }
  catch(e){ res={err:'error: '+e.message}; }

  const rec=record[taskIdx];

  if(res.err){
    log(res.err,'err');
    rec.tries.push({cmd:cmdLine, ok:false});
    consumeAttempt(t);
    return;
  }
  // print output
  if(res.out && res.out.length) res.out.forEach(l=>log(esc(l)));
  else if(!res.mutated) log('<span class="dim">(no output)</span>');

  const correct = currentExpectedSig!==null && res.sig===currentExpectedSig;
  rec.tries.push({cmd:cmdLine, ok:correct});

  if(correct){
    const used=3-attemptsLeft;           // tries already spent before this
    const awarded=ATTEMPT_POINTS[used]||0;
    score+=awarded; scoreStat.textContent=score;
    rec.solvedWith=cmdLine; rec.awarded=awarded;
    missionEl.classList.add('complete');
    stepsEl.children[taskIdx].classList.remove('active');
    stepsEl.children[taskIdx].classList.add('done');
    log(`<span class="ok">✓ Correct! +${awarded} points.</span>`);
    lockInput(true);
    setTimeout(nextTask, 1050);
  } else {
    log('<span class="warn">That runs, but it is not the result the task asked for.</span>','tip-line');
    consumeAttempt(t);
  }
}
function consumeAttempt(t){
  attemptsLeft--; renderAttempts(); shakeInput();
  const rec=record[taskIdx];
  if(attemptsLeft<=0){
    missionEl.classList.add('miss');
    stepsEl.children[taskIdx].classList.remove('active');
    stepsEl.children[taskIdx].classList.add('fail');
    rec.solvedWith=null; rec.awarded=0;
    log('<span class="err">✗ Out of attempts for this task.</span>');
    lockInput(true);
    setTimeout(nextTask, 1200);
  } else {
    log(`<span class="dim">${attemptsLeft} ${attemptsLeft===1?'attempt':'attempts'} left.</span>`);
  }
}
function lockInput(disabled){
  input.disabled=disabled; sendBtn.disabled=disabled;
  if(!disabled) input.focus();
}
function nextTask(){
  taskIdx++;
  if(taskIdx>=tasks.length){ finish(); return; }
  lockInput(false);
  renderTask();
}

/* ==================================================================
   scoring / results
   ================================================================== */
function grade(pct){
  if(pct>=90) return {g:'A · Shell master', c:'#86efac'};
  if(pct>=75) return {g:'B · Confident', c:'#7dd3fc'};
  if(pct>=60) return {g:'C · Getting there', c:'#fcd34d'};
  if(pct>=40) return {g:'D · Keep practicing', c:'#fbbf24'};
  return {g:'F · Back to the labs', c:'#fb7185'};
}
function finish(){
  started=false; lockInput(true);
  const pct = maxScore? Math.round((score/maxScore)*100) : 0;
  const solved=record.filter(r=>r.solvedWith).length;
  confetti();
  // ring
  const circ=2*Math.PI*52;
  const arc=D('ringArc'); arc.style.strokeDasharray=circ.toFixed(1);
  arc.style.strokeDashoffset=(circ*(1-pct/100)).toFixed(1);
  const gr=grade(pct);
  arc.style.stroke=gr.c;
  D('ringPct').textContent=pct+'%';
  D('ringPct').style.color=gr.c;
  D('gradeText').textContent=gr.g;
  D('gradeText').style.color=gr.c;
  D('scoreLine').innerHTML=`<b style="color:#e6edf7">${player||'Player'}</b> solved <b style="color:#86efac">${solved}/${tasks.length}</b> tasks · ${score} of ${maxScore} points · ${difficulty} difficulty.`;
  D('resTitle').textContent = pct>=75? 'Impressive work.' : pct>=50? 'Solid effort.' : 'Room to grow.';
  // per-task list
  const list=D('resList'); list.innerHTML='';
  record.forEach((r,i)=>{
    const ok=!!r.solvedWith;
    const item=document.createElement('div');
    item.className='res-item '+(ok?'ok':'miss');
    const tries=r.tries.map((tr,ti)=>`<div class="res-try ${tr.ok?'good':'bad'}"><span class="tn">try ${ti+1}</span><code>${esc(tr.cmd)}</code></div>`).join('')
      || '<div class="res-try"><span class="tn">—</span><code>(no command entered)</code></div>';
    const best = r.solvedWith ? r.solvedWith : r.ref;
    const bestLabel = r.solvedWith ? 'your solution' : 'a correct answer';
    item.innerHTML =
      `<div class="res-head"><span class="qn">Q${i+1}</span><span class="qtask">${r.prompt}</span>`+
      `<span class="qmark">${ok?'+'+r.awarded:'missed'}</span></div>`+
      `<div class="res-tries">${tries}</div>`+
      `<div class="res-best">Best command (${bestLabel}): <code>${esc(best)}</code></div>`;
    list.appendChild(item);
  });
  D('resultsOverlay').hidden=false;
}

/* ---------- export evaluation ---------- */
function buildReport(){
  const pct = maxScore? Math.round((score/maxScore)*100):0;
  const solved=record.filter(r=>r.solvedWith).length;
  const gr=grade(pct);
  const L=[];
  L.push('VISUAL LINUX — COMMAND ASSESSMENT REPORT');
  L.push('='.repeat(48));
  L.push('Player     : '+(player||'(unnamed)'));
  L.push('Difficulty : '+difficulty);
  L.push('Date       : '+new Date().toLocaleString());
  L.push('Tasks      : '+tasks.length);
  L.push('Solved     : '+solved+' / '+tasks.length);
  L.push('Score      : '+score+' / '+maxScore+' ('+pct+'%)');
  L.push('Grade      : '+gr.g);
  L.push('');
  L.push('-'.repeat(48));
  record.forEach((r,i)=>{
    L.push(`Q${i+1}. `+r.prompt.replace(/<[^>]+>/g,''));
    if(r.tries.length){
      r.tries.forEach((tr,ti)=>{ L.push(`   try ${ti+1}: ${tr.cmd}   [${tr.ok?'ACCEPTED':'not accepted'}]`); });
    } else {
      L.push('   (no command entered)');
    }
    L.push(`   result       : ${r.solvedWith?('SOLVED (+'+r.awarded+' pts)'):'MISSED'}`);
    L.push(`   best command : ${r.solvedWith?r.solvedWith:r.ref}`+(r.solvedWith?'  (your answer)':'  (a correct answer)'));
    L.push('');
  });
  L.push('-'.repeat(48));
  L.push('Scoring: 1st try = 100 · 2nd try = 60 · 3rd try = 30 · missed = 0');
  L.push('Alternate commands producing the required result were accepted.');
  return L.join('\n');
}
function exportReport(){
  const text=buildReport();
  const blob=new Blob([text],{type:'text/plain'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const safe=(player||'player').replace(/[^a-z0-9]+/gi,'_').toLowerCase();
  a.href=url; a.download=`assessment_${safe}_${difficulty}.txt`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

/* ==================================================================
   start / init
   ================================================================== */
function pickTasks(diff){
  const tiers=DIFF_TIERS[diff]; const count=DIFF_COUNT[diff];
  const pool=TASK_BANK.filter(t=>tiers.includes(t.tier));
  // shuffle
  const arr=pool.slice();
  for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
  // weight toward higher tiers for hard: ensure spread but simple slice is fine
  return arr.slice(0, Math.min(count, arr.length));
}
function startAssessment(){
  const nameV=D('nameInput').value.trim();
  if(!nameV){ D('startErr').textContent='Please enter a player name to begin.'; D('nameInput').focus(); return; }
  player=nameV; 
  tasks=pickTasks(difficulty);
  maxScore=tasks.length*100;
  taskIdx=0; score=0; attemptsLeft=3;
  record=tasks.map(t=>({prompt:t.prompt, ref:t.ref, tier:t.tier, tries:[], solvedWith:null, awarded:0}));
  // fresh fs
  FS=buildFs(); ROOT=FS.ROOT; HOME=FS.you; prevDir=null;
  cwd=HOME;
  rerenderTree();
  term.innerHTML='';
  scoreStat.textContent='0';
  playerTag.textContent=player;
  buildSteps();
  D('startOverlay').hidden=true;
  D('resultsOverlay').hidden=true;
  started=true;
  lockInput(false);
  log('<span class="hl">Assessment started.</span> Good luck, '+esc(player)+'!');
  log('<span class="dim">3 attempts per task · no answers shown · equivalent commands accepted.</span>');
  renderTask();
}

function confetti(){
  const colors=['#38bdf8','#4ade80','#fbbf24','#f472b6','#a78bfa','#7dd3fc'];
  for(let i=0;i<55;i++){
    const c=document.createElement('i'); c.className='confetti';
    c.style.left=Math.random()*100+'%'; c.style.background=colors[i%colors.length];
    c.style.animationDelay=(Math.random()*0.45)+'s'; c.style.animationDuration=(1.7+Math.random()*1.3)+'s';
    c.style.setProperty('--rot',(Math.random()*900-450)+'deg');
    document.body.appendChild(c); setTimeout(()=>c.remove(),3600);
  }
}

/* ---------- wire up events ---------- */
function init(){
  // difficulty selection
  D('diffGrid').querySelectorAll('.diff-opt').forEach(btn=>{
    btn.addEventListener('click',()=>{
      D('diffGrid').querySelectorAll('.diff-opt').forEach(b=>b.classList.remove('sel'));
      btn.classList.add('sel'); difficulty=btn.dataset.diff;
    });
  });
  D('startBtn').addEventListener('click', startAssessment);
  D('nameInput').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); startAssessment(); } });
  D('retryBtn').addEventListener('click',()=>{ D('resultsOverlay').hidden=true; D('startOverlay').hidden=false; D('nameInput').value=player; D('startErr').textContent=''; });
  D('exportBtn').addEventListener('click', exportReport);
  form.addEventListener('submit',e=>{ e.preventDefault(); const v=input.value; input.value=''; handleSubmit(v); input.focus(); });
  // build an initial (idle) tree so the panel isn't empty behind the overlay
  FS=buildFs(); ROOT=FS.ROOT; HOME=FS.you; cwd=HOME; prevDir=null;
  rerenderTree(); renderCrumbs(); updatePrompt();
  D('nameInput').focus();
  window.addEventListener('resize',()=>{ if(avatarEl) moveAvatar(false); });
}
document.addEventListener('DOMContentLoaded', init);
