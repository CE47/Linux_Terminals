'use strict';
const { Shell } = require('./engine_core.js');
const { run } = require('./interpreter.js');

let pass=0, fail=0;
function eq(desc, got, want){
  const g = typeof got === 'string' ? got.replace(/\n$/,'') : got;
  const w = typeof want === 'string' ? want.replace(/\n$/,'') : want;
  const okk = g === w;
  console.log(`  [${okk?'PASS':'FAIL'}] ${desc}` + (okk?'':`\n     got : ${JSON.stringify(g)}\n     want: ${JSON.stringify(w)}`));
  okk?pass++:fail++;
}
function contains(desc, got, sub){ const okk = got.includes(sub); console.log(`  [${okk?'PASS':'FAIL'}] ${desc}`+(okk?'':`\n     got: ${JSON.stringify(got)}\n     want contains: ${JSON.stringify(sub)}`)); okk?pass++:fail++; }

function fresh(){
  const sh = new Shell();
  sh.mkdir('~/projects');
  sh.mkfile('~/projects/app.js', 'const x=1;\nrun();\n');
  sh.mkfile('~/projects/README.md', '# App\nusage here\nERROR notes\n');
  sh.mkfile('~/notes.txt', 'buy milk\ncall bank\nERROR disk full\nship it\n');
  sh.mkfile('~/data.csv', 'name,city\nalice,paris\nbob,berlin\ncarol,paris\n');
  sh.mkfile('~/nums.txt', '5\n3\n9\n3\n1\n9\n');
  sh.mkdir('~/logs');
  sh.mkfile('~/logs/access.log', '200 /a\n404 /b\n500 /c\n404 /d\n200 /e\n');
  sh.mkfile('~/deploy.sh', '#!/bin/sh\necho go\n');
  return sh;
}

console.log('SHELL ENGINE TESTS');
let sh = fresh();
eq('pwd is home', run(sh,'pwd').out, '/home/astra');
eq('whoami', run(sh,'whoami').out, 'astra');
eq('echo', run(sh,'echo hello world').out, 'hello world');
eq('ls home', run(sh,'ls').out, 'data.csv  deploy.sh  logs  notes.txt  nums.txt  projects');
eq('ls projects', run(sh,'ls projects').out, 'app.js  README.md');
run(sh,'cd projects');
eq('cd changes pwd', run(sh,'pwd').out, '/home/astra/projects');
run(sh,'cd ..');
eq('cd .. back home', run(sh,'pwd').out, '/home/astra');
eq('cat notes', run(sh,'cat notes.txt').out, 'buy milk\ncall bank\nERROR disk full\nship it');
eq('grep ERROR', run(sh,'grep ERROR notes.txt').out, 'ERROR disk full');
eq('grep -c 404', run(sh,'grep -c 404 logs/access.log').out, '2');
eq('grep -n', run(sh,'grep -n ERROR notes.txt').out, '3:ERROR disk full');
eq('wc -l notes', run(sh,'wc -l notes.txt').out, '4 notes.txt');
eq('head -n 2', run(sh,'head -n 2 logs/access.log').out, '200 /a\n404 /b');
eq('tail -n 2', run(sh,'tail -n 2 logs/access.log').out, '404 /d\n200 /e');
eq('tail -n2', run(sh,'tail -n 2 logs/access.log').out.trim().split('\n').length, 2);
eq('sort -n', run(sh,'sort -n nums.txt').out, '1\n3\n3\n5\n9\n9');
eq('sort -nu', run(sh,'sort -nu nums.txt').out, '1\n3\n5\n9');
eq('uniq -c', run(sh,'sort nums.txt | uniq -c').out.trim().replace(/\s+/g,' '), '1 1 2 3 1 5 2 9');
eq('cut -d, -f2', run(sh,'cut -d , -f 2 data.csv').out, 'city\nparis\nberlin\nparis');
eq('pipe cut sort uniq', run(sh,'cut -d , -f 2 data.csv | tail -n 3 | sort -u').out, 'berlin\nparis');
eq('pipe count 404', run(sh,'cat logs/access.log | grep 404 | wc -l').out.trim(), '2');
eq('sed replace', run(sh,'sed s/ERROR/WARN/ notes.txt').out, 'buy milk\ncall bank\nWARN disk full\nship it');

// mutations
run(sh,'mkdir backup');
contains('mkdir shows in ls', run(sh,'ls').out, 'backup');
run(sh,'cp notes.txt backup/');
contains('cp into dir', run(sh,'ls backup').out, 'notes.txt');
run(sh,'touch backup/empty.txt');
contains('touch creates', run(sh,'ls backup').out, 'empty.txt');
run(sh,'mv backup/empty.txt backup/renamed.txt');
contains('mv renames', run(sh,'ls backup').out, 'renamed.txt');
run(sh,'rm backup/renamed.txt');
eq('rm removes file', run(sh,'ls backup').out.includes('renamed.txt'), false);
run(sh,'rm -r backup');
eq('rm -r removes dir', run(sh,'ls').out.includes('backup'), false);

// redirect
run(sh,'echo hello > out.txt');
eq('redirect write', run(sh,'cat out.txt').out, 'hello');
run(sh,'echo world >> out.txt');
eq('redirect append', run(sh,'cat out.txt').out, 'hello\nworld');

// chmod
run(sh,'chmod 755 deploy.sh');
contains('chmod 755', run(sh,'ls -l deploy.sh').out, 'rwxr-xr-x');
run(sh,'chmod u=rw,go=r deploy.sh');
contains('chmod symbolic', run(sh,'ls -l deploy.sh').out, 'rw-r--r--');

// find
contains('find -name', run(sh,'find . -name "*.log"').out, 'access.log');
contains('find -type d', run(sh,'find . -type d').out, 'logs');

// tree
contains('tree runs', run(sh,'tree').out, '├──');

// df / du / ps
contains('df header', run(sh,'df').out, 'Filesystem');
contains('df shows full fs', run(sh,'df').out, '100%');
contains('df -h human', run(sh,'df -h').out, 'G');
eq('df | grep full | cut mount', run(sh,'df | grep 100% | cut -d " " -f 6').out, '/var');
(function(){
  const d = new Shell();
  d.mkdir('~/space'); d.mkfile('~/space/big.bin', 'B'.repeat(4096)); d.mkfile('~/space/tiny.txt','x\n');
  contains('du -s summary', run(d,'du -s ~/space').out, 'space');
  contains('du -a lists files', run(d,'du -a ~/space').out, 'big.bin');
  contains('du -ah human', run(d,'du -ah ~/space').out, 'K');
  eq('du missing path code', run(d,'du ~/nope').code, 1);
})();
contains('ps aux header', run(sh,'ps aux').out, '%CPU');
contains('ps aux runaway', run(sh,'ps aux').out, 'worker.js');
eq('ps aux grep worker.js cut pid', run(sh,'ps aux | grep worker.js | cut -d " " -f 2').out, '6971');
contains('ps -ef header', run(sh,'ps -ef').out, 'PPID');
contains('man df', run(sh,'man df').out, 'disk space');
contains('man du', run(sh,'man du').out, 'file space');
contains('man ps', run(sh,'man ps').out, 'processes');
contains('help lists df du ps', run(sh,'help').out, 'df du ps');

// errors
eq('cat missing', run(sh,'cat nope.txt').out, 'cat: nope.txt: No such file or directory');
eq('cd missing', run(sh,'cd nope').out, 'cd: nope: No such file or directory');
eq('unknown cmd', run(sh,'frobnicate').out, 'frobnicate: command not found');
eq('rm dir no -r', run(sh,'rm logs').out, 'rm: cannot remove \'logs\': Is a directory');

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
