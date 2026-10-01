'use strict';
/* ============================================================================
   game.js — Linux Terminal Quest engine (developed standalone for testing,
   later inlined into game.html)
   Part A: Virtual filesystem + shell engine
   ============================================================================ */

/* ---------- VFS node ---------- */
let __uid = 0;
function node(name, type, opts){
  opts = opts || {};
  return {
    id: ++__uid,
    name,
    type,                              // 'dir' | 'file'
    children: type === 'dir' ? {} : null,
    content: type === 'file' ? (opts.content != null ? opts.content : '') : null,
    mode: opts.mode != null ? opts.mode : (type === 'dir' ? 0o755 : 0o644),
    owner: opts.owner || 'you',
    group: opts.group || 'you',
    mtime: opts.mtime != null ? opts.mtime : Date.now(),
    parent: null
  };
}

/* A Shell owns a filesystem, cwd, env, history. Scenarios build a fresh shell. */
class Shell {
  constructor(){
    this.root = node('/', 'dir');
    this.root.parent = this.root;
    this.user = 'astra';
    this.host = 'nebula';
    this.home = '/home/' + this.user;
    this.env = { HOME: this.home, PWD: this.home, USER: this.user, SHELL: '/bin/bash', PATH: '/usr/bin:/bin' };
    this.cwd = this.home;
    this.history = [];
    this.lastExit = 0;
    this._ensure(this.home, 'dir');
  }

  /* -------- path utilities -------- */
  _split(p){ return p.split('/').filter(Boolean); }
  normalize(p){
    if(!p) return this.cwd;
    let base;
    if(p === '~' || p === '~/') return this.home;
    if(p.startsWith('~/')) { base = this.home + '/' + p.slice(2); }
    else if(p.startsWith('/')) base = p;
    else base = this.cwd + '/' + p;
    const parts = this._split(base);
    const out = [];
    for(const seg of parts){
      if(seg === '.') continue;
      if(seg === '..'){ out.pop(); continue; }
      out.push(seg);
    }
    return '/' + out.join('/');
  }
  /* get node at absolute-ish path; returns node or null */
  get(p){
    const abs = this.normalize(p);
    if(abs === '/') return this.root;
    const parts = this._split(abs);
    let cur = this.root;
    for(const seg of parts){
      if(cur.type !== 'dir' || !cur.children[seg]) return null;
      cur = cur.children[seg];
    }
    return cur;
  }
  parentOf(p){
    const abs = this.normalize(p);
    const parts = this._split(abs);
    parts.pop();
    return this.get('/' + parts.join('/'));
  }
  baseName(p){ const parts = this._split(this.normalize(p)); return parts[parts.length-1] || '/'; }
  absPath(n){
    if(n === this.root) return '/';
    const parts = [];
    let x = n;
    while(x && x !== this.root){ parts.unshift(x.name); x = x.parent; }
    return '/' + parts.join('/');
  }
  pretty(p){
    const abs = typeof p === 'string' ? this.normalize(p) : this.absPath(p);
    if(abs === this.home) return '~';
    if(abs.startsWith(this.home + '/')) return '~' + abs.slice(this.home.length);
    return abs;
  }

  /* -------- mutation helpers -------- */
  _ensure(p, type, opts){
    const parts = this._split(this.normalize(p));
    let cur = this.root;
    for(let i=0;i<parts.length;i++){
      const seg = parts[i];
      const last = i === parts.length-1;
      if(!cur.children[seg]){
        const n = node(seg, last ? type : 'dir', last ? opts : undefined);
        n.parent = cur;
        cur.children[seg] = n;
      }
      cur = cur.children[seg];
    }
    return cur;
  }
  mkfile(p, content, opts){
    const parts = this._split(this.normalize(p));
    let cur = this.root;
    for(let i=0;i<parts.length;i++){
      const seg = parts[i]; const last = i === parts.length-1;
      if(!cur.children[seg]){
        const n = node(seg, last ? 'file' : 'dir', last ? Object.assign({content:content||''}, opts||{}) : undefined);
        n.parent = cur; cur.children[seg] = n;
      }
      cur = cur.children[seg];
    }
    // ensure it is a file with the given content (overwrite existing)
    cur.type = 'file';
    if(cur.children) cur.children = null;
    cur.content = content == null ? '' : content;
    if(opts){ if(opts.mode!=null) cur.mode = opts.mode; if(opts.owner) cur.owner = opts.owner; if(opts.group) cur.group = opts.group; }
    return cur;
  }
  mkdir(p, opts){ return this._ensure(p, 'dir', opts); }

  addChild(dir, n){ n.parent = dir; dir.children[n.name] = n; }
  removeChild(n){ if(n.parent) delete n.parent.children[n.name]; }

  /* deep clone a node (for cp) */
  clone(n){
    const c = node(n.name, n.type, {content:n.content, mode:n.mode, owner:n.owner, group:n.group});
    if(n.type === 'dir'){ for(const k in n.children){ const kid = this.clone(n.children[k]); kid.parent = c; c.children[k] = kid; } }
    return c;
  }

  /* list children sorted */
  listChildren(dir, all){
    const names = Object.keys(dir.children);
    let arr = names.map(k => dir.children[k]);
    if(!all) arr = arr.filter(x => !x.name.startsWith('.'));
    arr.sort((a,b)=> a.name.localeCompare(b.name, undefined, {numeric:true, sensitivity:'base'}));
    return arr;
  }
}

/* ---------- content helpers ---------- */
function lines(str){ return str === '' ? [] : str.replace(/\n$/,'').split('\n'); }
function fileLines(n){ return n && n.type === 'file' ? lines(n.content) : []; }

/* mode helpers */
function modeStr(n){
  const t = n.type === 'dir' ? 'd' : '-';
  const m = n.mode;
  const rwx = b => (b&4?'r':'-')+(b&2?'w':'-')+(b&1?'x':'-');
  return t + rwx((m>>6)&7) + rwx((m>>3)&7) + rwx(m&7);
}
function octalStr(mode){ return (mode & 0o777).toString(8).padStart(3,'0'); }

module.exports = { Shell, node, lines, fileLines, modeStr, octalStr };
