'use strict';
/* ============================================================================
   Part B: command interpreter — parse & run a command line against a Shell.
   Returns { out:string, code:int }. Designed to feel like a real bash shell.
   ============================================================================ */
const { lines, fileLines, modeStr, octalStr, node } = require('./engine_core.js');

/* -------- tokenizer: handle quotes. Operators (| > >>) are emitted as
   {op:'...'} objects so quoted "|" stays a literal string. -------- */
function tokenize(str){
  const toks = [];
  let i = 0, cur = '', q = null, has = false;
  const flush = ()=>{ if(has || cur){ toks.push(cur); cur=''; has=false; } };
  while(i < str.length){
    const c = str[i];
    if(q){
      if(c === q){ q = null; }
      else cur += c;
    } else if(c === '"' || c === "'"){ q = c; has = true; }
    else if(/\s/.test(c)){ flush(); }
    else if(c === '|' || c === '>' || c === '<'){
      flush();
      if(c === '>' && str[i+1] === '>'){ toks.push({op:'>>'}); i++; }
      else toks.push({op:c});
    }
    else cur += c;
    i++;
  }
  flush();
  return toks;
}
function isOp(t, op){ return t && typeof t === 'object' && (op ? t.op === op : true); }

/* glob a pattern against names in a directory */
function globMatch(pattern, name){
  if(!/[*?[]/.test(pattern)) return pattern === name;
  const rx = new RegExp('^' + pattern
    .replace(/[.+^${}()|\\]/g,'\\$&')
    .replace(/\*/g,'.*').replace(/\?/g,'.')
    .replace(/\[(.+?)\]/g,'[$1]') + '$');
  return rx.test(name);
}
/* expand globs in an argument relative to shell cwd */
function expandArg(sh, arg){
  if(!/[*?[]/.test(arg)) return [arg];
  const slash = arg.lastIndexOf('/');
  const dirPart = slash >= 0 ? arg.slice(0, slash+1) : '';
  const pat = slash >= 0 ? arg.slice(slash+1) : arg;
  const dir = sh.get(dirPart || '.');
  if(!dir || dir.type !== 'dir') return [arg];
  const hits = Object.keys(dir.children)
    .filter(nm => !(nm.startsWith('.') && !pat.startsWith('.')))
    .filter(nm => globMatch(pat, nm))
    .sort()
    .map(nm => dirPart + nm);
  return hits.length ? hits : [arg];
}

/* split flags/positionals; supports combined short flags like -la */
function parseArgs(args, boolFlags, valFlags){
  boolFlags = boolFlags || '';
  valFlags = valFlags || '';
  const flags = {}; const vals = {}; const pos = [];
  for(let i=0;i<args.length;i++){
    const a = args[i];
    if(a === '--'){ pos.push(...args.slice(i+1)); break; }
    if(a.startsWith('--')){ flags[a.slice(2)] = true; continue; }
    if(a.startsWith('-') && a.length > 1){
      const body = a.slice(1);
      let consumed = false;
      for(let j=0;j<body.length;j++){
        const f = body[j];
        if(valFlags.includes(f)){
          const rest = body.slice(j+1);
          vals[f] = rest || args[++i];
          consumed = true; break;
        } else flags[f] = true;
      }
      if(consumed) continue;
      continue;
    }
    pos.push(a);
  }
  return { flags, vals, pos };
}

const ok = out => ({ out: out == null ? '' : out, code: 0 });
const err = (msg) => ({ out: msg + '\n', code: 1 });

/* ============================================================================
   command table — each returns {out, code}. Some accept stdin (array of lines).
   ============================================================================ */
const CMDS = {
  help(sh){
    return ok(
`Available commands:
  ls cd pwd cat echo touch mkdir rmdir cp mv rm
  find grep wc head tail sort uniq cut sed tr
  chmod chown stat file tree whoami hostname date
  clear history man help
Use  man <command>  for a short description. Combine with |  >  >>.`);
  },
  whoami(sh){ return ok(sh.user + '\n'); },
  hostname(sh){ return ok(sh.host + '\n'); },
  date(sh){ return ok('Mon Jan  1 09:00:00 UTC 2035\n'); },
  echo(sh, args){
    // support -n and -e minimally; join positionals
    let nl = true; const parts = [];
    for(const a of args){ if(a === '-n'){ nl = false; } else parts.push(a); }
    return ok(parts.join(' ') + (nl ? '\n' : ''));
  },
  pwd(sh){ return ok(sh.absPath(sh.get(sh.cwd)) + '\n'); },
  cd(sh, args){
    const target = args[0] || '~';
    if(target === '-'){ const p = sh.env.OLDPWD || sh.home; sh.env.OLDPWD = sh.cwd; sh.cwd = p; return ok(sh.absPath(sh.get(p))+'\n'); }
    const n = sh.get(target);
    if(!n) return err('cd: ' + target + ': No such file or directory');
    if(n.type !== 'dir') return err('cd: ' + target + ': Not a directory');
    sh.env.OLDPWD = sh.cwd; sh.cwd = sh.absPath(n); sh.env.PWD = sh.cwd;
    return ok('');
  },
  ls(sh, args, stdin, piped){
    const { flags, pos } = parseArgs(args, 'alRrht1');
    const paths = pos.length ? pos : ['.'];
    const chunks = [];
    const oneCol = flags['1'] || (piped && !flags.l);
    for(const p of paths){
      const n = sh.get(p);
      if(!n){ chunks.push('ls: cannot access \'' + p + '\': No such file or directory'); continue; }
      let entries;
      if(n.type === 'dir'){
        entries = sh.listChildren(n, flags.a);
        if(flags.a){ entries = [dotEntry(sh,n,'.'), dotEntry(sh,n,'..')].concat(entries); }
      } else entries = [n];
      if(flags.t) entries.sort((a,b)=> b.mtime - a.mtime);
      if(flags.r) entries.reverse();
      if(flags.l){
        const rows = entries.map(e => longRow(sh, e));
        chunks.push((n.type==='dir'?('total ' + entries.length + '\n'):'') + rows.join('\n'));
      } else if(flags['1'] || oneCol){
        chunks.push(entries.map(e => e.name).join('\n'));
      } else {
        chunks.push(entries.map(e => e.type==='dir' ? e.name : e.name).join('  '));
      }
    }
    return ok(chunks.filter(Boolean).join('\n') + '\n');
  },
  cat(sh, args, stdin){
    const { pos, flags } = parseArgs(args, 'n');
    if(!pos.length && stdin) { let ls = stdin.slice(); if(flags.n) ls = ls.map((l,i)=>String(i+1).padStart(6)+'  '+l); return ok(ls.join('\n')+(ls.length?'\n':'')); }
    let out = [];
    for(const p of pos){
      const n = sh.get(p);
      if(!n) return err('cat: ' + p + ': No such file or directory');
      if(n.type === 'dir') return err('cat: ' + p + ': Is a directory');
      out = out.concat(fileLines(n));
    }
    if(flags.n) out = out.map((l,i)=>String(i+1).padStart(6)+'  '+l);
    return ok(out.join('\n') + (out.length ? '\n' : ''));
  },
  echo_file(){ return ok(''); },
  touch(sh, args){
    const { pos } = parseArgs(args, '');
    if(!pos.length) return err('touch: missing file operand');
    for(const p of pos){
      const existing = sh.get(p);
      if(existing){ existing.mtime = Date.now(); continue; }
      const parent = sh.parentOf(p);
      if(!parent || parent.type !== 'dir') return err('touch: cannot touch \'' + p + '\': No such file or directory');
      sh.mkfile(p, '');
    }
    return ok('');
  },
  mkdir(sh, args){
    const { flags, pos } = parseArgs(args, 'pv');
    if(!pos.length) return err('mkdir: missing operand');
    const made = [];
    for(const p of pos){
      if(flags.p){ sh.mkdir(p); made.push(p); continue; }
      const parent = sh.parentOf(p);
      if(!parent || parent.type !== 'dir') return err('mkdir: cannot create directory \'' + p + '\': No such file or directory');
      if(sh.get(p)) return err('mkdir: cannot create directory \'' + p + '\': File exists');
      sh.mkdir(p); made.push(p);
    }
    return ok(flags.v ? made.map(m=>'mkdir: created directory \''+m+'\'').join('\n')+'\n' : '');
  },
  rmdir(sh, args){
    const { pos } = parseArgs(args, '');
    for(const p of pos){
      const n = sh.get(p);
      if(!n) return err('rmdir: failed to remove \'' + p + '\': No such file or directory');
      if(n.type !== 'dir') return err('rmdir: failed to remove \'' + p + '\': Not a directory');
      if(Object.keys(n.children).length) return err('rmdir: failed to remove \'' + p + '\': Directory not empty');
      sh.removeChild(n);
    }
    return ok('');
  },
  cp(sh, args){
    const { flags, pos } = parseArgs(args, 'rRva');
    const rec = flags.r || flags.R || flags.a;
    if(pos.length < 2) return err('cp: missing destination file operand');
    const dstPath = pos.pop();
    const dstNode = sh.get(dstPath);
    for(const srcPath of pos){
      const src = sh.get(srcPath);
      if(!src) return err('cp: cannot stat \'' + srcPath + '\': No such file or directory');
      if(src.type === 'dir' && !rec) return err('cp: -r not specified; omitting directory \'' + srcPath + '\'');
      const copy = sh.clone(src);
      if(dstNode && dstNode.type === 'dir'){ copy.name = src.name; sh.addChild(dstNode, copy); }
      else { copy.name = sh.baseName(dstPath); const parent = sh.parentOf(dstPath); if(!parent) return err('cp: cannot create \'' + dstPath + '\': No such file or directory'); sh.addChild(parent, copy); }
    }
    return ok('');
  },
  mv(sh, args){
    const { pos } = parseArgs(args, 'fv');
    if(pos.length < 2) return err('mv: missing destination file operand');
    const dstPath = pos.pop();
    const dstNode = sh.get(dstPath);
    for(const srcPath of pos){
      const src = sh.get(srcPath);
      if(!src) return err('mv: cannot stat \'' + srcPath + '\': No such file or directory');
      sh.removeChild(src);
      if(dstNode && dstNode.type === 'dir'){ sh.addChild(dstNode, src); }
      else { src.name = sh.baseName(dstPath); const parent = sh.parentOf(dstPath); if(!parent) return err('mv: cannot move: No such file or directory'); sh.addChild(parent, src); }
    }
    return ok('');
  },
  rm(sh, args){
    const { flags, pos } = parseArgs(args, 'rRfv');
    const rec = flags.r || flags.R;
    if(!pos.length && !flags.f) return err('rm: missing operand');
    for(const p of pos){
      const n = sh.get(p);
      if(!n){ if(flags.f) continue; return err('rm: cannot remove \'' + p + '\': No such file or directory'); }
      if(n === sh.root) return err('rm: it is dangerous to operate recursively on \'/\'');
      if(n.type === 'dir' && !rec) return err('rm: cannot remove \'' + p + '\': Is a directory');
      sh.removeChild(n);
    }
    return ok('');
  },
  find(sh, args){
    const start = (args[0] && !args[0].startsWith('-')) ? args[0] : '.';
    const base = sh.get(start);
    if(!base) return err('find: \'' + start + '\': No such file or directory');
    let name=null, iname=null, type=null;
    for(let i=0;i<args.length;i++){
      if(args[i]==='-name') name=args[i+1];
      if(args[i]==='-iname') iname=args[i+1];
      if(args[i]==='-type') type=args[i+1];
    }
    const results = [];
    const startDisplay = start === '.' ? '.' : start.replace(/\/$/,'');
    (function walk(n, path){
      let match = true;
      if(type) match = match && (type==='d' ? n.type==='dir' : n.type==='file');
      if(name) match = match && globMatch(name, n.name);
      if(iname) match = match && globMatch(iname.toLowerCase(), n.name.toLowerCase());
      if(match) results.push(path);
      if(n.type==='dir') Object.keys(n.children).sort().forEach(k => walk(n.children[k], path + '/' + k));
    })(base, startDisplay);
    return ok(results.join('\n') + (results.length ? '\n' : ''));
  },
  grep(sh, args, stdin){
    const { flags, pos } = parseArgs(args, 'invcrRE');
    const pattern = pos.shift();
    if(pattern === undefined) return err('usage: grep [-invcrR] PATTERN [FILE...]');
    let rx;
    try { rx = new RegExp(flags.E ? pattern : pattern.replace(/[.*+?^${}()|[\]\\]/g, m => (flags.E?m:'\\'+m)), flags.i ? 'i' : ''); }
    catch(e){ return err('grep: invalid pattern'); }
    const sources = [];
    if(pos.length){
      const collect = (p) => {
        const n = sh.get(p);
        if(!n){ sources.push({label:p, lines:null, missing:true}); return; }
        if(n.type==='dir'){
          if(flags.r || flags.R){ (function walk(d, pre){ Object.keys(d.children).sort().forEach(k=>{ const c=d.children[k]; if(c.type==='file') sources.push({label:pre+'/'+k, lines:fileLines(c)}); else walk(c, pre+'/'+k); }); })(n, p.replace(/\/$/,'')); }
          else sources.push({label:p, isdir:true});
        } else sources.push({label:p, lines:fileLines(n)});
      };
      pos.forEach(collect);
    } else if(stdin){ sources.push({label:null, lines:stdin.slice()}); }
    else return err('grep: no input');
    const multi = sources.filter(s=>s.lines).length > 1 || flags.r || flags.R;
    const out = [];
    let total = 0;
    for(const s of sources){
      if(s.missing){ out.push('grep: '+s.label+': No such file or directory'); continue; }
      if(s.isdir){ out.push('grep: '+s.label+': Is a directory'); continue; }
      let count = 0;
      s.lines.forEach((line, idx) => {
        const hit = rx.test(line);
        if(flags.v ? !hit : hit){
          count++; total++;
          if(!flags.c){
            let prefix = '';
            if(multi && s.label) prefix += s.label + ':';
            if(flags.n) prefix += (idx+1) + ':';
            out.push(prefix + line);
          }
        }
      });
      if(flags.c){ out.push((multi && s.label ? s.label+':' : '') + count); }
    }
    return { out: out.join('\n') + (out.length ? '\n' : ''), code: total ? 0 : 1 };
  },
  wc(sh, args, stdin){
    const { flags, pos } = parseArgs(args, 'lwc');
    const none = !flags.l && !flags.w && !flags.c;
    const emit = (ls, label) => {
      const text = ls.join('\n');
      const parts = [];
      if(flags.l||none) parts.push(String(ls.length).padStart(pos.length>1?7:0));
      if(flags.w||none) parts.push(String(text.split(/\s+/).filter(Boolean).length).padStart(pos.length>1?7:0));
      if(flags.c||none) parts.push(String(text.length + (ls.length?1:0)).padStart(pos.length>1?7:0));
      return parts.join(' ') + (label ? ' ' + label : '');
    };
    if(!pos.length && stdin) return ok(emit(stdin, '') + '\n');
    const out = [];
    let tl=0, tw=0, tc=0;
    for(const p of pos){
      const n = sh.get(p);
      if(!n) return err('wc: ' + p + ': No such file or directory');
      if(n.type==='dir') return err('wc: ' + p + ': Is a directory');
      const fl = fileLines(n); const text = fl.join('\n');
      tl += fl.length; tw += text.split(/\s+/).filter(Boolean).length; tc += text.length + (fl.length?1:0);
      out.push(emit(fl, p));
    }
    if(pos.length > 1){
      const parts = [];
      if(flags.l||none) parts.push(String(tl).padStart(7));
      if(flags.w||none) parts.push(String(tw).padStart(7));
      if(flags.c||none) parts.push(String(tc).padStart(7));
      out.push(parts.join(' ') + ' total');
    }
    return ok(out.join('\n') + '\n');
  },
  head(sh, args, stdin){ return headTail(sh, args, stdin, 'head'); },
  tail(sh, args, stdin){ return headTail(sh, args, stdin, 'tail'); },
  sort(sh, args, stdin){
    const { flags, pos } = parseArgs(args, 'nrufb');
    let ls = pos.length ? fileOr(sh, pos[0]) : (stdin || []);
    if(ls && ls.err) return err(ls.err);
    ls = ls.slice();
    ls.sort((a,b)=> flags.n ? (parseFloat(a)||0)-(parseFloat(b)||0) : a.localeCompare(b));
    if(flags.r) ls.reverse();
    if(flags.u) ls = ls.filter((l,i)=> i===0 || l !== ls[i-1]);
    return ok(ls.join('\n') + (ls.length?'\n':''));
  },
  uniq(sh, args, stdin){
    const { flags, pos } = parseArgs(args, 'cdu');
    let ls = pos.length ? fileOr(sh, pos[0]) : (stdin || []);
    if(ls && ls.err) return err(ls.err);
    const groups = [];
    ls.forEach(l => { if(groups.length && groups[groups.length-1].l === l) groups[groups.length-1].n++; else groups.push({l, n:1}); });
    let res = groups;
    if(flags.d) res = res.filter(g=>g.n>1);
    if(flags.u) res = res.filter(g=>g.n===1);
    const out = res.map(g => flags.c ? String(g.n).padStart(7)+' '+g.l : g.l);
    return ok(out.join('\n') + (out.length?'\n':''));
  },
  cut(sh, args, stdin){
    const { vals, pos } = parseArgs(args, '', 'dfc');
    const delim = vals.d != null ? vals.d : '\t';
    let ls = pos.length ? fileOr(sh, pos[0]) : (stdin || []);
    if(ls && ls.err) return err(ls.err);
    const range = spec => { const s=new Set(); (spec||'').split(',').forEach(p=>{ if(p.includes('-')){ const[a,b]=p.split('-'); const lo=+a||1, hi=+b||99; for(let i=lo;i<=hi;i++) s.add(i);} else s.add(+p); }); return [...s].sort((a,b)=>a-b); };
    let out;
    if(vals.f != null){ const set = range(vals.f); out = ls.map(l => { const cols = l.split(delim); return set.map(i=>cols[i-1]).filter(x=>x!==undefined).join(delim); }); }
    else if(vals.c != null){ const set = range(vals.c); out = ls.map(l => set.map(i=>l[i-1]||'').join('')); }
    else return err('cut: you must specify a list of bytes, characters, or fields');
    return ok(out.join('\n') + (out.length?'\n':''));
  },
  tr(sh, args, stdin){
    const { flags, pos } = parseArgs(args, 'ds');
    let ls = stdin || [];
    let text = ls.join('\n');
    const expand = s => {
      let out = '';
      for(let i=0;i<s.length;i++){
        if(s[i+1]==='-' && s[i+2]!==undefined){ const a=s.charCodeAt(i), b=s.charCodeAt(i+2); for(let c=a;c<=b;c++) out+=String.fromCharCode(c); i+=2; }
        else out += s[i];
      }
      return out;
    };
    if(flags.d && pos[0]){ const set = expand(pos[0]); text = text.split('').filter(c=>!set.includes(c)).join(''); }
    else if(pos.length>=2){ const from=expand(pos[0]), to=expand(pos[1]); text = text.split('').map(c=>{ const i=from.indexOf(c); return i>=0 ? (to[i]||to[to.length-1]) : c; }).join(''); }
    return ok(text + (ls.length?'\n':''));
  },
  sed(sh, args, stdin){
    const { flags, pos } = parseArgs(args, 'in');
    const expr = pos.shift();
    const m = /^s([\/|#])(.*)\1(.*)\1([gip]*)$/.exec(expr || '');
    if(!m) return err('sed: -e expression: unsupported (use s/old/new/[g])');
    const [, , pat, rep, fl] = m;
    let rx;
    try { rx = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), fl.includes('g') ? 'g' : ''); } catch(e){ return err('sed: bad regex'); }
    let src, target=null;
    if(pos.length){ const n = sh.get(pos[0]); if(!n) return err('sed: can\'t read ' + pos[0] + ': No such file or directory'); if(n.type==='dir') return err('sed: read error on '+pos[0]+': Is a directory'); src = fileLines(n); target = n; }
    else src = stdin || [];
    const out = src.map(l => l.replace(rx, rep));
    if(flags.i && target){ target.content = out.join('\n') + (out.length?'\n':''); return ok(''); }
    return ok(out.join('\n') + (out.length?'\n':''));
  },
  chmod(sh, args){
    const { flags, pos } = parseArgs(args, 'Rv');
    const spec = pos.shift();
    if(!spec || !pos.length) return err('chmod: missing operand');
    for(const p of pos){
      const n = sh.get(p);
      if(!n) return err('chmod: cannot access \'' + p + '\': No such file or directory');
      const apply = (target) => {
        if(/^[0-7]{3,4}$/.test(spec)) target.mode = parseInt(spec,8) & 0o777;
        else {
          for(const part of spec.split(',')){
            const mm = /^([ugoa]*)([+\-=])([rwx]*)$/.exec(part);
            if(!mm) return false;
            let who = mm[1] || 'a'; if(who==='a') who='ugo';
            let bits=0; if(mm[3].includes('r'))bits|=4; if(mm[3].includes('w'))bits|=2; if(mm[3].includes('x'))bits|=1;
            let mask=0; if(who.includes('u'))mask|=bits<<6; if(who.includes('g'))mask|=bits<<3; if(who.includes('o'))mask|=bits;
            if(mm[2]==='+') target.mode|=mask;
            else if(mm[2]==='-') target.mode&=~mask;
            else { let clr=0; if(who.includes('u'))clr|=0o700; if(who.includes('g'))clr|=0o070; if(who.includes('o'))clr|=0o007; target.mode=(target.mode&~clr)|mask; }
          }
        }
        return true;
      };
      if(!apply(n)) return err('chmod: invalid mode: \'' + spec + '\'');
      if(flags.R && n.type==='dir'){ (function walk(d){ Object.values(d.children).forEach(c=>{ apply(c); if(c.type==='dir') walk(c); }); })(n); }
    }
    return ok('');
  },
  chown(sh, args){
    const { flags, pos } = parseArgs(args, 'R');
    const spec = pos.shift();
    if(!spec || !pos.length) return err('chown: missing operand');
    const [ownerN, groupN] = spec.split(':');
    for(const p of pos){
      const n = sh.get(p);
      if(!n) return err('chown: cannot access \'' + p + '\': No such file or directory');
      const apply = t => { if(ownerN) t.owner = ownerN; if(groupN) t.group = groupN; };
      apply(n);
      if(flags.R && n.type==='dir'){ (function walk(d){ Object.values(d.children).forEach(c=>{ apply(c); if(c.type==='dir') walk(c); }); })(n); }
    }
    return ok('');
  },
  stat(sh, args){
    const n = sh.get(args[0] || '.');
    if(!n) return err('stat: cannot stat \'' + args[0] + '\': No such file or directory');
    return ok(`  File: ${n.name}\n  Type: ${n.type==='dir'?'directory':'regular file'}\nAccess: (${octalStr(n.mode)}/${modeStr(n)})  Uid: (${n.owner})  Gid: (${n.group})\n`);
  },
  file(sh, args){
    const n = sh.get(args[0]||'');
    if(!n) return err(args[0] + ': cannot open (No such file or directory)');
    if(n.type==='dir') return ok(args[0] + ': directory\n');
    const c = n.content || '';
    return ok(args[0] + ': ' + (/^#!/.test(c) ? 'script text executable' : c==='' ? 'empty' : 'ASCII text') + '\n');
  },
  tree(sh, args){
    const start = args[0] || '.';
    const base = sh.get(start);
    if(!base) return err(start + ' [error opening dir]');
    const out = [sh.pretty(base)];
    let dirs=0, files=0;
    (function walk(n, prefix){
      const kids = sh.listChildren(n, false);
      kids.forEach((c, i) => {
        const last = i === kids.length-1;
        out.push(prefix + (last ? '└── ' : '├── ') + c.name);
        if(c.type==='dir'){ dirs++; walk(c, prefix + (last ? '    ' : '│   ')); }
        else files++;
      });
    })(base, '');
    out.push('\n' + dirs + ' directories, ' + files + ' files');
    return ok(out.join('\n') + '\n');
  },
  clear(){ return { out:'', code:0, clear:true }; },
  history(sh){ return ok(sh.history.map((h,i)=>String(i+1).padStart(5)+'  '+h).join('\n') + '\n'); },
  man(sh, args){
    const descs = {
      ls:'list directory contents', cd:'change the working directory', pwd:'print working directory',
      cat:'concatenate and print files', echo:'display a line of text', touch:'create empty files / update timestamps',
      mkdir:'make directories', rmdir:'remove empty directories', cp:'copy files and directories',
      mv:'move (rename) files', rm:'remove files or directories', find:'search for files in a directory hierarchy',
      grep:'print lines matching a pattern', wc:'count lines, words, and bytes', head:'output the first part of files',
      tail:'output the last part of files', sort:'sort lines of text', uniq:'report or omit repeated lines',
      cut:'remove sections from each line', sed:'stream editor for filtering and transforming text',
      tr:'translate or delete characters', chmod:'change file mode bits', chown:'change file owner and group',
      stat:'display file status', file:'determine file type', tree:'list contents as a tree'
    };
    const c = args[0];
    if(!c) return err('What manual page do you want?');
    if(!descs[c]) return err('No manual entry for ' + c);
    return ok(`${c.toUpperCase()}(1)\n\nNAME\n    ${c} - ${descs[c]}\n`);
  }
};

/* helpers used by several commands */
function dotEntry(sh, dir, which){ const n = which==='.'? dir : (dir.parent||dir); const clone = Object.assign({}, n); clone.name = which; return clone; }
function longRow(sh, e){
  const size = e.type==='dir' ? 4096 : (e.content ? e.content.length : 0);
  return `${modeStr(e)} 1 ${e.owner} ${e.group} ${String(size).padStart(6)} Jan  1 09:00 ${e.name}`;
}
function fileOr(sh, p){ const n = sh.get(p); if(!n) return {err: 'cannot read: ' + p + ': No such file or directory'}; if(n.type==='dir') return {err:p+': Is a directory'}; return fileLines(n); }
function headTail(sh, args, stdin, which){
  const { vals, pos } = parseArgs(args, '', 'nc');
  let n = 10; if(vals.n != null) n = parseInt(vals.n,10);
  // support -N
  for(const a of args){ if(/^-\d+$/.test(a)) n = parseInt(a.slice(1),10); }
  let ls = pos.length ? fileOr(sh, pos[0]) : (stdin || []);
  if(ls && ls.err) return err(which + ': cannot open \'' + pos[0] + '\' for reading: No such file or directory');
  const out = which==='head' ? ls.slice(0, n) : ls.slice(Math.max(0, ls.length - n));
  return ok(out.join('\n') + (out.length?'\n':''));
}

/* ============================================================================
   run a full command line (pipes + redirects) against the shell
   ============================================================================ */
function run(sh, line){
  const trimmed = line.trim();
  if(trimmed === '') return { out:'', code:0 };
  sh.history.push(trimmed);

  // split into pipeline segments on top-level '|'
  const toks = tokenize(trimmed);
  const segments = [[]];
  let redirect = null;
  for(let i=0;i<toks.length;i++){
    const t = toks[i];
    if(isOp(t,'|')){ segments.push([]); continue; }
    if(isOp(t,'>') || isOp(t,'>>')){ const f = toks[++i]; redirect = { mode:t.op, file: typeof f==='object'?f.op:f }; continue; }
    if(isOp(t)) continue; // stray operator, ignore
    segments[segments.length-1].push(t);
  }

  let stdin = null;
  let out = '';
  let code = 0;
  let clear = false;
  for(let s=0;s<segments.length;s++){
    const seg = segments[s];
    if(!seg.length) continue;
    const cmd = seg[0];
    // expand globs in args
    let rawArgs = seg.slice(1);
    let args = [];
    for(const a of rawArgs){ args = args.concat(expandArg(sh, a)); }
    const fn = CMDS[cmd];
    if(!fn){ out = ''; return { out: cmd + ': command not found\n', code:127 }; }
    const piped = (s < segments.length - 1) || (s === segments.length - 1 && !!redirect);
    const res = fn(sh, args, stdin, piped);
    if(res.clear) clear = true;
    code = res.code;
    if(s < segments.length - 1){ stdin = res.out === '' ? [] : lines(res.out); out=''; }
    else out = res.out;
  }

  if(redirect){
    const target = sh.get(redirect.file);
    if(target && target.type === 'dir') return { out:'bash: ' + redirect.file + ': Is a directory\n', code:1 };
    if(redirect.mode === '>'){ sh.mkfile(redirect.file, out); }
    else { const ex = sh.get(redirect.file); const prev = ex ? ex.content : ''; sh.mkfile(redirect.file, prev + out); }
    return { out:'', code, clear };
  }
  return { out, code, clear };
}

module.exports = { run, tokenize, CMDS, parseArgs, globMatch, expandArg };
