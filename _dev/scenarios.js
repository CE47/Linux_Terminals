'use strict';
/* ============================================================================
   scenarios.js — quest definitions + completion checks.
   Each scenario: { id, title, icon, difficulty, story, brief, setup(sh),
                    steps:[ { brief, hint, check(sh), solution:[cmds] } ] }
   `check` inspects shell/filesystem state. `solution` is used ONLY by the
   headless solvability test (never shown to players).
   ============================================================================ */
const { fileLines } = require('./engine_core.js');

/* small helpers usable by checks */
function exists(sh, p){ return !!sh.get(p); }
function isFile(sh, p){ const n=sh.get(p); return n && n.type==='file'; }
function isDir(sh, p){ const n=sh.get(p); return n && n.type==='dir'; }
function content(sh, p){ const n=sh.get(p); return n && n.type==='file' ? n.content : null; }
function has(sh, p, sub){ const c=content(sh,p); return c!=null && c.includes(sub); }
function linecount(sh, p){ const n=sh.get(p); return n&&n.type==='file'?fileLines(n).length:-1; }
function mode(sh, p){ const n=sh.get(p); return n ? (n.mode & 0o777) : -1; }
function cwdIs(sh, p){ return sh.cwd === sh.normalize(p); }

const SCENARIOS = [];

/* ------------------------------------------------------------------ *
 * 1. First Day on the Job — onboarding basics
 * ------------------------------------------------------------------ */
SCENARIOS.push({
  id:'first-day',
  title:'First Day on the Job',
  icon:'🧑‍💻',
  difficulty:'Rookie',
  story:'You just joined Nebula Labs as a junior engineer. Your team lead left you a workstation and a welcome note. Get your bearings and set up your workspace.',
  brief:'Learn to look around, read files, and organize a home directory.',
  setup(sh){
    sh.mkfile('~/WELCOME.txt', 'Welcome to Nebula Labs!\nRead onboarding/tasks.txt to get started.\nYour home is yours to organize.\n');
    sh.mkdir('~/onboarding');
    sh.mkfile('~/onboarding/tasks.txt', '1. Create a workspace folder\n2. Move the welcome note into docs\n3. Make a notes file for yourself\n');
    sh.mkfile('~/onboarding/team.txt', 'Lead: Mara\nYou: astra\nMentor: Kite\n');
    sh.mkfile('~/.bashrc', 'export EDITOR=nano\n');
  },
  steps:[
    { brief:'Find out who you are logged in as.',
      hint:'The command is literally a question: who am i?',
      check:(sh,ctx)=> ctx.cmd==='whoami',
      solution:['whoami'] },
    { brief:'Print your current location in the filesystem.',
      hint:'Print Working Directory.',
      check:(sh,ctx)=> ctx.cmd==='pwd',
      solution:['pwd'] },
    { brief:'List everything in your home directory, including hidden files.',
      hint:'ls has a flag to show all entries, even dotfiles.',
      check:(sh,ctx)=> ctx.cmd==='ls' && /(^|\s)-\w*a/.test(ctx.line) && ctx.out.includes('.bashrc'),
      solution:['ls -a'] },
    { brief:'Read the WELCOME.txt note.',
      hint:'cat prints a file to the screen.',
      check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('Welcome to Nebula Labs'),
      solution:['cat WELCOME.txt'] },
    { brief:'Read the onboarding task list at onboarding/tasks.txt.',
      hint:'cat can take a path with folders in it.',
      check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('Create a workspace folder'),
      solution:['cat onboarding/tasks.txt'] },
    { brief:'Create a folder called workspace in your home directory.',
      hint:'mkdir makes a directory.',
      check:(sh)=> isDir(sh,'~/workspace'),
      solution:['mkdir ~/workspace'] },
    { brief:'Create a docs folder too.',
      hint:'mkdir docs',
      check:(sh)=> isDir(sh,'~/docs'),
      solution:['mkdir docs'] },
    { brief:'Move WELCOME.txt into the docs folder.',
      hint:'mv SOURCE DESTINATION',
      check:(sh)=> isFile(sh,'~/docs/WELCOME.txt') && !exists(sh,'~/WELCOME.txt'),
      solution:['mv WELCOME.txt docs/'] },
    { brief:'Create an empty file called notes.txt in workspace.',
      hint:'touch creates an empty file.',
      check:(sh)=> isFile(sh,'~/workspace/notes.txt'),
      solution:['touch workspace/notes.txt'] },
    { brief:'Write the line "day one done" into workspace/notes.txt.',
      hint:'Use echo with a redirect: echo "text" > file',
      check:(sh)=> has(sh,'~/workspace/notes.txt','day one done'),
      solution:['echo "day one done" > workspace/notes.txt'] },
    { brief:'Move into the workspace directory.',
      hint:'cd workspace',
      check:(sh)=> cwdIs(sh,'~/workspace'),
      solution:['cd workspace'] },
    { brief:'Confirm your notes file is here by listing the directory.',
      hint:'Just ls.',
      check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.includes('notes.txt') && cwdIs(sh,'~/workspace'),
      solution:['ls'] }
  ]
});

/* ------------------------------------------------------------------ *
 * 2. The Case of the Full Disk — log triage
 * ------------------------------------------------------------------ */
SCENARIOS.push({
  id:'full-disk',
  title:'The Case of the Full Disk',
  icon:'💾',
  difficulty:'Rookie',
  story:'Alerts are firing: the app server\'s disk is nearly full. Logs are the usual suspect. Investigate the log directory, find the noise, and clean it up safely.',
  brief:'Inspect logs, count problems, and reclaim space.',
  setup(sh){
    sh.mkdir('/var/log');
    sh.mkfile('/var/log/app.log', Array.from({length:12},(_,i)=> (i%3===0?'ERROR':'INFO')+' event '+(i+1)).join('\n')+'\n');
    sh.mkfile('/var/log/app.log.1', 'old rotated log\n'.repeat(3));
    sh.mkfile('/var/log/app.log.2', 'older rotated log\n'.repeat(3));
    sh.mkfile('/var/log/debug.log', 'DEBUG spam\n'.repeat(20));
    sh.mkfile('/var/log/access.log', ['200 /','404 /x','500 /y','200 /z','404 /q','500 /w','200 /a'].join('\n')+'\n');
    sh.mkdir('~/report');
  },
  steps:[
    { brief:'Go to the log directory /var/log.',
      hint:'cd with an absolute path starting at /.',
      check:(sh)=> cwdIs(sh,'/var/log'),
      solution:['cd /var/log'] },
    { brief:'List the logs in long format so you can see sizes.',
      hint:'ls -l',
      check:(sh,ctx)=> ctx.cmd==='ls' && /l/.test(ctx.line.replace(/[^-]*/,'')) && ctx.out.includes('app.log'),
      solution:['ls -l'] },
    { brief:'Show the first 5 lines of app.log.',
      hint:'head -n 5',
      check:(sh,ctx)=> ctx.cmd==='head' && ctx.out.trim().split('\n').length===5,
      solution:['head -n 5 app.log'] },
    { brief:'Show the last 3 lines of app.log.',
      hint:'tail -n 3',
      check:(sh,ctx)=> ctx.cmd==='tail' && ctx.out.trim().split('\n').length===3,
      solution:['tail -n 3 app.log'] },
    { brief:'Count how many lines in app.log contain ERROR.',
      hint:'grep -c ERROR app.log',
      check:(sh,ctx)=> ctx.line.includes('grep') && /ERROR/.test(ctx.line) && ctx.out.trim()==='4',
      solution:['grep -c ERROR app.log'] },
    { brief:'Count how many 500 errors are in access.log using a pipe.',
      hint:'cat access.log | grep 500 | wc -l',
      check:(sh,ctx)=> ctx.line.includes('|') && /500/.test(ctx.line) && ctx.out.trim()==='2',
      solution:['cat access.log | grep 500 | wc -l'] },
    { brief:'Save all ERROR lines from app.log into ~/report/errors.txt.',
      hint:'grep ERROR app.log > ~/report/errors.txt',
      check:(sh)=> isFile(sh,'~/report/errors.txt') && linecount(sh,'~/report/errors.txt')===4,
      solution:['grep ERROR app.log > ~/report/errors.txt'] },
    { brief:'The rotated logs app.log.1 and app.log.2 are safe to delete. Remove both with a single wildcard.',
      hint:'rm app.log.[12]  or  rm app.log.1 app.log.2',
      check:(sh)=> !exists(sh,'/var/log/app.log.1') && !exists(sh,'/var/log/app.log.2') && exists(sh,'/var/log/app.log'),
      solution:['rm app.log.1 app.log.2'] },
    { brief:'debug.log is pure noise. Delete it.',
      hint:'rm debug.log',
      check:(sh)=> !exists(sh,'/var/log/debug.log'),
      solution:['rm debug.log'] },
    { brief:'List the directory as a tree to confirm the cleanup.',
      hint:'tree',
      check:(sh,ctx)=> ctx.cmd==='tree',
      solution:['tree'] },
    { brief:'Append the line "cleanup complete" to ~/report/errors.txt.',
      hint:'echo "cleanup complete" >> ~/report/errors.txt',
      check:(sh)=> has(sh,'~/report/errors.txt','cleanup complete') && linecount(sh,'~/report/errors.txt')===5,
      solution:['echo "cleanup complete" >> ~/report/errors.txt'] }
  ]
});

/* ------------------------------------------------------------------ *
 * 3. Ship the Landing Page
 * ------------------------------------------------------------------ */
SCENARIOS.push({
  id:'deploy-site',
  title:'Ship the Landing Page',
  icon:'🚀',
  difficulty:'Rookie',
  story:'Marketing needs the new landing page live today. The raw files are scattered in your downloads. Assemble a clean site directory, wire it up, and prepare it for release.',
  brief:'Assemble a website from scattered files and stage it for release.',
  setup(sh){
    sh.mkdir('~/Downloads');
    sh.mkfile('~/Downloads/index.html', '<h1>Nebula</h1>\n<p>Coming soon</p>\n');
    sh.mkfile('~/Downloads/style.css', 'body{font-family:sans-serif}\n');
    sh.mkfile('~/Downloads/logo.png', 'PNGDATA\n');
    sh.mkfile('~/Downloads/cat-meme.jpg', 'JPGDATA\n');
    sh.mkfile('~/Downloads/todo.txt', 'unrelated\n');
  },
  steps:[
    { brief:'Create a folder called site in your home directory.',
      hint:'mkdir ~/site', check:(sh)=> isDir(sh,'~/site'), solution:['mkdir ~/site'] },
    { brief:'Inside site, create an assets subfolder in one command.',
      hint:'mkdir -p ~/site/assets', check:(sh)=> isDir(sh,'~/site/assets'), solution:['mkdir -p ~/site/assets'] },
    { brief:'Go into your Downloads folder.',
      hint:'cd ~/Downloads', check:(sh)=> cwdIs(sh,'~/Downloads'), solution:['cd ~/Downloads'] },
    { brief:'List what is here.',
      hint:'ls', check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.includes('index.html'), solution:['ls'] },
    { brief:'Copy index.html into ~/site.',
      hint:'cp index.html ~/site/', check:(sh)=> isFile(sh,'~/site/index.html'), solution:['cp index.html ~/site/'] },
    { brief:'Copy style.css into ~/site.',
      hint:'cp style.css ~/site/', check:(sh)=> isFile(sh,'~/site/style.css'), solution:['cp style.css ~/site/'] },
    { brief:'Move logo.png into ~/site/assets (it belongs with the site now).',
      hint:'mv logo.png ~/site/assets/', check:(sh)=> isFile(sh,'~/site/assets/logo.png') && !exists(sh,'~/Downloads/logo.png'), solution:['mv logo.png ~/site/assets/'] },
    { brief:'The cat meme does not belong. Delete cat-meme.jpg.',
      hint:'rm cat-meme.jpg', check:(sh)=> !exists(sh,'~/Downloads/cat-meme.jpg'), solution:['rm cat-meme.jpg'] },
    { brief:'Go into ~/site.',
      hint:'cd ~/site', check:(sh)=> cwdIs(sh,'~/site'), solution:['cd ~/site'] },
    { brief:'Add a footer line to index.html: append "<footer>(c) Nebula</footer>".',
      hint:'echo "<footer>(c) Nebula</footer>" >> index.html', check:(sh)=> has(sh,'~/site/index.html','<footer>(c) Nebula</footer>'), solution:['echo "<footer>(c) Nebula</footer>" >> index.html'] },
    { brief:'Create a release note file: write "v1.0 ready" into RELEASE.txt.',
      hint:'echo "v1.0 ready" > RELEASE.txt', check:(sh)=> has(sh,'~/site/RELEASE.txt','v1.0 ready'), solution:['echo "v1.0 ready" > RELEASE.txt'] },
    { brief:'Make index.html readable by all but writable only by you (mode 644).',
      hint:'chmod 644 index.html', check:(sh)=> mode(sh,'~/site/index.html')===0o644, solution:['chmod 644 index.html'] },
    { brief:'Show the finished site as a tree.',
      hint:'tree', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('assets'), solution:['tree'] }
  ]
});

/* ------------------------------------------------------------------ *
 * 4. The 3 AM Incident
 * ------------------------------------------------------------------ */
SCENARIOS.push({
  id:'incident',
  title:'The 3 AM Incident',
  icon:'🚨',
  difficulty:'Field Agent',
  story:'A pager wakes you at 3 AM. Something is hammering the auth service. Comb through the logs, identify the attacker, and file an incident report before standup.',
  brief:'Investigate auth logs, isolate the attacker, and document findings.',
  setup(sh){
    sh.mkdir('/var/log/auth');
    const L=[];
    for(let i=0;i<6;i++) L.push('Accepted password for astra from 10.0.0.5');
    for(let i=0;i<9;i++) L.push('Failed password for root from 203.0.113.66');
    for(let i=0;i<3;i++) L.push('Failed password for admin from 203.0.113.66');
    L.push('Accepted password for mara from 10.0.0.6');
    for(let i=0;i<2;i++) L.push('Failed password for astra from 198.51.100.2');
    sh.mkfile('/var/log/auth/auth.log', L.join('\n')+'\n');
    sh.mkdir('~/incident');
  },
  steps:[
    { brief:'Navigate to /var/log/auth.',
      hint:'cd /var/log/auth', check:(sh)=> cwdIs(sh,'/var/log/auth'), solution:['cd /var/log/auth'] },
    { brief:'Count the total lines in auth.log.',
      hint:'wc -l auth.log', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('21'), solution:['wc -l auth.log'] },
    { brief:'Show only the failed login attempts.',
      hint:'grep "Failed password" auth.log', check:(sh,ctx)=> ctx.cmd==='grep' && ctx.out.includes('Failed password') && !ctx.out.includes('Accepted'), solution:['grep "Failed password" auth.log'] },
    { brief:'Count how many failed attempts there are in total.',
      hint:'grep -c "Failed password" auth.log', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.trim()==='14', solution:['grep -c "Failed password" auth.log'] },
    { brief:'Count failed attempts coming from 203.0.113.66.',
      hint:'grep 203.0.113.66 auth.log | grep -c Failed', check:(sh,ctx)=> ctx.out.trim()==='12', solution:['grep 203.0.113.66 auth.log | grep -c Failed'] },
    { brief:'Save every line mentioning 203.0.113.66 into ~/incident/suspect.txt.',
      hint:'grep 203.0.113.66 auth.log > ~/incident/suspect.txt', check:(sh)=> isFile(sh,'~/incident/suspect.txt') && linecount(sh,'~/incident/suspect.txt')===12, solution:['grep 203.0.113.66 auth.log > ~/incident/suspect.txt'] },
    { brief:'List which accounts the attacker targeted: from the suspect lines, cut the username (field 4, space-delimited), sorted unique, into ~/incident/targets.txt.',
      hint:'grep 203.0.113.66 auth.log | cut -d " " -f 4 | sort -u > ~/incident/targets.txt',
      check:(sh)=>{ const n=sh.get('~/incident/targets.txt'); if(!n) return false; const c=n.content||''; return c.includes('root') && c.includes('admin') && fileLines(n).length===2; },
      solution:['grep 203.0.113.66 auth.log | cut -d " " -f 4 | sort -u > ~/incident/targets.txt'] },
    { brief:'Start an incident report: write the header "INCIDENT REPORT" into ~/incident/report.txt.',
      hint:'echo "INCIDENT REPORT" > ~/incident/report.txt', check:(sh)=> has(sh,'~/incident/report.txt','INCIDENT REPORT'), solution:['echo "INCIDENT REPORT" > ~/incident/report.txt'] },
    { brief:'Append the line "Attacker: 203.0.113.66" to the report.',
      hint:'echo "Attacker: 203.0.113.66" >> ~/incident/report.txt', check:(sh)=> has(sh,'~/incident/report.txt','Attacker: 203.0.113.66'), solution:['echo "Attacker: 203.0.113.66" >> ~/incident/report.txt'] },
    { brief:'Append the line "Failed attempts: 12" to the report.',
      hint:'echo "Failed attempts: 12" >> ~/incident/report.txt', check:(sh)=> has(sh,'~/incident/report.txt','Failed attempts: 12') && linecount(sh,'~/incident/report.txt')===3, solution:['echo "Failed attempts: 12" >> ~/incident/report.txt'] },
    { brief:'Lock the report so only you can read or write it (mode 600).',
      hint:'chmod 600 ~/incident/report.txt', check:(sh)=> mode(sh,'~/incident/report.txt')===0o600, solution:['chmod 600 ~/incident/report.txt'] },
    { brief:'Read back the final report to confirm.',
      hint:'cat ~/incident/report.txt', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('Attacker: 203.0.113.66') && ctx.out.includes('Failed attempts: 12'), solution:['cat ~/incident/report.txt'] }
  ]
});

/* ------------------------------------------------------------------ *
 * 5. Data Janitor
 * ------------------------------------------------------------------ */
SCENARIOS.push({
  id:'data-janitor',
  title:'Data Janitor',
  icon:'🧹',
  difficulty:'Field Agent',
  story:'Analytics dumped a messy customer export and asked you to make it usable. Slice out the columns they need, dedupe it, sort it, and hand back a clean file.',
  brief:'Wrangle a CSV with cut, sort, uniq, grep, and pipes.',
  setup(sh){
    sh.mkdir('~/analytics');
    sh.mkfile('~/analytics/customers.csv',
      ['id,name,city,plan',
       '1,alice,paris,pro',
       '2,bob,berlin,free',
       '3,carol,paris,pro',
       '4,dave,berlin,free',
       '5,erin,paris,free',
       '3,carol,paris,pro',
       '2,bob,berlin,free'].join('\n')+'\n');
  },
  steps:[
    { brief:'Enter the analytics folder.',
      hint:'cd ~/analytics', check:(sh)=> cwdIs(sh,'~/analytics'), solution:['cd ~/analytics'] },
    { brief:'Look at the whole file first.',
      hint:'cat customers.csv', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('alice'), solution:['cat customers.csv'] },
    { brief:'How many lines total (including the header)?',
      hint:'wc -l customers.csv', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('8'), solution:['wc -l customers.csv'] },
    { brief:'The file has duplicate rows. Show it sorted so duplicates sit together.',
      hint:'sort customers.csv', check:(sh,ctx)=> ctx.cmd==='sort', solution:['sort customers.csv'] },
    { brief:'Produce the unique rows only, sorted, and save to clean.csv.',
      hint:'sort -u customers.csv > clean.csv', check:(sh)=> isFile(sh,'~/analytics/clean.csv') && linecount(sh,'~/analytics/clean.csv')===6, solution:['sort -u customers.csv > clean.csv'] },
    { brief:'Extract just the city column (field 3) from clean.csv.',
      hint:'cut -d , -f 3 clean.csv', check:(sh,ctx)=> ctx.cmd==='cut' && ctx.out.includes('paris'), solution:['cut -d , -f 3 clean.csv'] },
    { brief:'Build a list of unique cities (skip the header) into cities.txt.',
      hint:'cut -d , -f 3 clean.csv | grep -v city | sort -u > cities.txt',
      check:(sh)=>{ const n=sh.get('~/analytics/cities.txt'); if(!n) return false; const ls=fileLines(n); return ls.length===2 && ls.includes('berlin') && ls.includes('paris'); },
      solution:['cut -d , -f 3 clean.csv | grep -v city | sort -u > cities.txt'] },
    { brief:'Extract name (field 2) and plan (field 4) together from clean.csv.',
      hint:'cut -d , -f 2,4 clean.csv', check:(sh,ctx)=> ctx.cmd==='cut' && ctx.out.includes('alice,pro'), solution:['cut -d , -f 2,4 clean.csv'] },
    { brief:'Count how many customers are on the "pro" plan in clean.csv.',
      hint:'grep -c pro clean.csv', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.trim()==='2', solution:['grep -c pro clean.csv'] },
    { brief:'Save the pro customers to pro.csv.',
      hint:'grep pro clean.csv > pro.csv', check:(sh)=> isFile(sh,'~/analytics/pro.csv') && linecount(sh,'~/analytics/pro.csv')===2, solution:['grep pro clean.csv > pro.csv'] },
    { brief:'Rename clean.csv to customers_clean.csv for the handoff.',
      hint:'mv clean.csv customers_clean.csv', check:(sh)=> isFile(sh,'~/analytics/customers_clean.csv') && !exists(sh,'~/analytics/clean.csv'), solution:['mv clean.csv customers_clean.csv'] }
  ]
});

/* ------------------------------------------------------------------ *
 * 6. Permission Panic
 * ------------------------------------------------------------------ */
SCENARIOS.push({
  id:'perm-panic',
  title:'Permission Panic',
  icon:'🔐',
  difficulty:'Field Agent',
  story:'A botched script left permissions in chaos. Private keys are world-readable, scripts will not run, and a shared folder is locked. Restore sane permissions across the project.',
  brief:'Repair file modes with chmod (octal and symbolic) and chown.',
  setup(sh){
    sh.mkdir('~/proj');
    sh.mkfile('~/proj/run.sh', '#!/bin/sh\necho running\n', {mode:0o644});
    sh.mkfile('~/proj/backup.sh', '#!/bin/sh\necho backup\n', {mode:0o644});
    sh.mkfile('~/proj/id_rsa', 'PRIVATE KEY\n', {mode:0o644});
    sh.mkfile('~/proj/notes.md', '# notes\n', {mode:0o600});
    sh.mkdir('~/proj/shared', {mode:0o700});
  },
  steps:[
    { brief:'Enter the project folder.',
      hint:'cd ~/proj', check:(sh)=> cwdIs(sh,'~/proj'), solution:['cd ~/proj'] },
    { brief:'Inspect the current permissions in long format.',
      hint:'ls -l', check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.includes('run.sh'), solution:['ls -l'] },
    { brief:'The private key id_rsa must be readable/writable by you only. Set it to 600.',
      hint:'chmod 600 id_rsa', check:(sh)=> mode(sh,'~/proj/id_rsa')===0o600, solution:['chmod 600 id_rsa'] },
    { brief:'Make run.sh executable by everyone (mode 755).',
      hint:'chmod 755 run.sh', check:(sh)=> mode(sh,'~/proj/run.sh')===0o755, solution:['chmod 755 run.sh'] },
    { brief:'Make backup.sh executable too, but add the execute bit symbolically.',
      hint:'chmod +x backup.sh', check:(sh)=> (mode(sh,'~/proj/backup.sh')&0o111)===0o111, solution:['chmod +x backup.sh'] },
    { brief:'notes.md should be readable by the group as well. Add group read symbolically.',
      hint:'chmod g+r notes.md', check:(sh)=> (mode(sh,'~/proj/notes.md')&0o040)===0o040, solution:['chmod g+r notes.md'] },
    { brief:'Open the shared folder for the group: set it to 750.',
      hint:'chmod 750 shared', check:(sh)=> mode(sh,'~/proj/shared')===0o750, solution:['chmod 750 shared'] },
    { brief:'Put a file in shared: create shared/hello.txt containing "team".',
      hint:'echo "team" > shared/hello.txt', check:(sh)=> has(sh,'~/proj/shared/hello.txt','team'), solution:['echo "team" > shared/hello.txt'] },
    { brief:'Verify id_rsa is no longer world-readable by checking its long listing.',
      hint:'ls -l id_rsa', check:(sh,ctx)=> ctx.cmd==='ls' && /rw-------/.test(ctx.out), solution:['ls -l id_rsa'] },
    { brief:'Give run.sh and backup.sh a consistent group: change group of both to "devs" (chown :devs).',
      hint:'chown :devs run.sh backup.sh', check:(sh)=>{ const a=sh.get('~/proj/run.sh'), b=sh.get('~/proj/backup.sh'); return a.group==='devs' && b.group==='devs'; }, solution:['chown :devs run.sh backup.sh'] },
    { brief:'Confirm the final permissions with a long listing.',
      hint:'ls -l', check:(sh,ctx)=> ctx.cmd==='ls' && /rwxr-xr-x/.test(ctx.out), solution:['ls -l'] }
  ]
});

/* ------------------------------------------------------------------ *
 * 7. Lost & Found
 * ------------------------------------------------------------------ */
SCENARIOS.push({
  id:'lost-found',
  title:'Lost & Found',
  icon:'🔎',
  difficulty:'Field Agent',
  story:'A colleague swears the quarterly figures are "somewhere in the project". The tree is deep and messy. Use find and grep to track down the right file and rescue it.',
  brief:'Hunt through a directory tree with find and recursive grep.',
  setup(sh){
    sh.mkdir('~/project/src/utils');
    sh.mkdir('~/project/docs/old');
    sh.mkdir('~/project/data/2034');
    sh.mkdir('~/project/data/2035');
    sh.mkfile('~/project/README.md', '# Project\n');
    sh.mkfile('~/project/src/main.js', 'console.log(1)\n');
    sh.mkfile('~/project/src/utils/math.js', 'export const add=(a,b)=>a+b\n');
    sh.mkfile('~/project/docs/old/notes.txt', 'misc\n');
    sh.mkfile('~/project/data/2034/report.csv', 'q,val\nQ1,10\nQ2,20\n');
    sh.mkfile('~/project/data/2035/report.csv', 'q,val\nQ1,revenue 999\nQ2,30\n');
    sh.mkfile('~/project/data/2035/summary.txt', 'revenue up\n');
    sh.mkdir('~/rescued');
  },
  steps:[
    { brief:'Go to the project root ~/project.',
      hint:'cd ~/project', check:(sh)=> cwdIs(sh,'~/project'), solution:['cd ~/project'] },
    { brief:'Show the whole tree to understand the layout.',
      hint:'tree', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('utils'), solution:['tree'] },
    { brief:'Find every .js file under the project.',
      hint:'find . -name "*.js"', check:(sh,ctx)=> ctx.cmd==='find' && ctx.out.includes('math.js') && ctx.out.includes('main.js'), solution:['find . -name "*.js"'] },
    { brief:'Find every report.csv file in the tree.',
      hint:'find . -name report.csv', check:(sh,ctx)=> ctx.cmd==='find' && ctx.out.includes('2034/report.csv') && ctx.out.includes('2035/report.csv'), solution:['find . -name report.csv'] },
    { brief:'Find every directory under data.',
      hint:'find data -type d', check:(sh,ctx)=> ctx.cmd==='find' && ctx.out.includes('2034') && ctx.out.includes('2035'), solution:['find data -type d'] },
    { brief:'The figures mention "revenue". Search all files recursively for revenue.',
      hint:'grep -r revenue .', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.includes('revenue'), solution:['grep -r revenue .'] },
    { brief:'Which file has "revenue 999"? Search recursively for that exact phrase.',
      hint:'grep -r "revenue 999" .', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.includes('2035/report.csv'), solution:['grep -r "revenue 999" .'] },
    { brief:'Copy the 2035 report to ~/rescued/figures.csv.',
      hint:'cp data/2035/report.csv ~/rescued/figures.csv', check:(sh)=> isFile(sh,'~/rescued/figures.csv') && has(sh,'~/rescued/figures.csv','revenue 999'), solution:['cp data/2035/report.csv ~/rescued/figures.csv'] },
    { brief:'The docs/old folder is junk. Show its contents first.',
      hint:'ls docs/old', check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.includes('notes.txt'), solution:['ls docs/old'] },
    { brief:'Delete the entire docs/old directory and everything in it.',
      hint:'rm -r docs/old', check:(sh)=> !exists(sh,'~/project/docs/old'), solution:['rm -r docs/old'] },
    { brief:'Confirm figures.csv landed safely in rescued.',
      hint:'cat ~/rescued/figures.csv', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('revenue 999'), solution:['cat ~/rescued/figures.csv'] }
  ]
});

/* ------------------------------------------------------------------ *
 * 8. Backup Before the Storm
 * ------------------------------------------------------------------ */
SCENARIOS.push({
  id:'backup-storm',
  title:'Backup Before the Storm',
  icon:'⛈️',
  difficulty:'Field Agent',
  story:'Maintenance is scheduled with a real risk of data loss. Snapshot the critical config, keep only what matters, and leave a manifest behind.',
  brief:'Copy, organize, and document a backup set.',
  setup(sh){
    sh.mkdir('~/app/config');
    sh.mkfile('~/app/config/db.conf', 'host=localhost\nport=5432\n');
    sh.mkfile('~/app/config/app.conf', 'name=nebula\nenv=prod\n');
    sh.mkfile('~/app/config/cache.tmp', 'temp junk\n');
    sh.mkfile('~/app/app.js', 'start()\n');
    sh.mkfile('~/app/debug.log', 'noise\n'.repeat(5));
  },
  steps:[
    { brief:'Create a backups directory in your home.',
      hint:'mkdir ~/backups', check:(sh)=> isDir(sh,'~/backups'), solution:['mkdir ~/backups'] },
    { brief:'Make a dated snapshot folder ~/backups/2035-01-01 in one command.',
      hint:'mkdir -p ~/backups/2035-01-01', check:(sh)=> isDir(sh,'~/backups/2035-01-01'), solution:['mkdir -p ~/backups/2035-01-01'] },
    { brief:'Copy the entire config folder into the snapshot (recursively).',
      hint:'cp -r ~/app/config ~/backups/2035-01-01/', check:(sh)=> isDir(sh,'~/backups/2035-01-01/config') && isFile(sh,'~/backups/2035-01-01/config/db.conf'), solution:['cp -r ~/app/config ~/backups/2035-01-01/'] },
    { brief:'Go into the snapshot config folder.',
      hint:'cd ~/backups/2035-01-01/config', check:(sh)=> cwdIs(sh,'~/backups/2035-01-01/config'), solution:['cd ~/backups/2035-01-01/config'] },
    { brief:'The cache.tmp file should not be in a backup. Delete it.',
      hint:'rm cache.tmp', check:(sh)=> !exists(sh,'~/backups/2035-01-01/config/cache.tmp'), solution:['rm cache.tmp'] },
    { brief:'List the two remaining conf files (they end in .conf).',
      hint:'ls *.conf', check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.includes('db.conf') && ctx.out.includes('app.conf') && !ctx.out.includes('cache'), solution:['ls *.conf'] },
    { brief:'Go up to the snapshot folder ~/backups/2035-01-01.',
      hint:'cd ..', check:(sh)=> cwdIs(sh,'~/backups/2035-01-01'), solution:['cd ..'] },
    { brief:'Create a manifest: list the config files into MANIFEST.txt.',
      hint:'ls config > MANIFEST.txt', check:(sh)=> isFile(sh,'~/backups/2035-01-01/MANIFEST.txt') && has(sh,'~/backups/2035-01-01/MANIFEST.txt','db.conf'), solution:['ls config > MANIFEST.txt'] },
    { brief:'Append "backup ok" to MANIFEST.txt.',
      hint:'echo "backup ok" >> MANIFEST.txt', check:(sh)=> has(sh,'~/backups/2035-01-01/MANIFEST.txt','backup ok'), solution:['echo "backup ok" >> MANIFEST.txt'] },
    { brief:'Protect the snapshot: recursively set it to read/execute for you (chmod -R 500).',
      hint:'chmod -R 500 ~/backups/2035-01-01', check:(sh)=> mode(sh,'~/backups/2035-01-01')===0o500 && mode(sh,'~/backups/2035-01-01/config/db.conf')===0o500, solution:['chmod -R 500 ~/backups/2035-01-01'] },
    { brief:'Verify the snapshot as a tree.',
      hint:'tree ~/backups/2035-01-01', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('MANIFEST.txt'), solution:['tree ~/backups/2035-01-01'] }
  ]
});

/* ------------------------------------------------------------------ *
 * 9. Release Engineer
 * ------------------------------------------------------------------ */
SCENARIOS.push({
  id:'release-eng',
  title:'Cut the Release',
  icon:'🏷️',
  difficulty:'Field Agent',
  story:'It is release day. Bump the version, assemble a changelog from commit notes, tag the build, and package the release directory. No mistakes — the whole company ships on this.',
  brief:'Prepare a versioned release using sed, sort, and redirection.',
  setup(sh){
    sh.mkdir('~/repo');
    sh.mkfile('~/repo/VERSION', 'version=1.2.0\n');
    sh.mkfile('~/repo/commits.txt', ['fix login bug','add dark mode','fix crash on start','improve perf','add dark mode'].join('\n')+'\n');
    sh.mkfile('~/repo/app.js', 'const VERSION="1.2.0";\nboot();\n');
    sh.mkdir('~/repo/dist');
  },
  steps:[
    { brief:'Enter the repo.',
      hint:'cd ~/repo', check:(sh)=> cwdIs(sh,'~/repo'), solution:['cd ~/repo'] },
    { brief:'Read the current VERSION file.',
      hint:'cat VERSION', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('1.2.0'), solution:['cat VERSION'] },
    { brief:'Bump the version in VERSION from 1.2.0 to 1.3.0 in place with sed.',
      hint:'sed -i s/1.2.0/1.3.0/ VERSION', check:(sh)=> has(sh,'~/repo/VERSION','1.3.0') && !has(sh,'~/repo/VERSION','1.2.0'), solution:['sed -i s/1.2.0/1.3.0/ VERSION'] },
    { brief:'Update the version string inside app.js too (1.2.0 -> 1.3.0), in place.',
      hint:'sed -i s/1.2.0/1.3.0/ app.js', check:(sh)=> has(sh,'~/repo/app.js','1.3.0'), solution:['sed -i s/1.2.0/1.3.0/ app.js'] },
    { brief:'The commit notes have a duplicate. Show them sorted and deduped.',
      hint:'sort -u commits.txt', check:(sh,ctx)=> ctx.cmd==='sort' && ctx.out.split('\n').filter(Boolean).length===4, solution:['sort -u commits.txt'] },
    { brief:'Write the deduped, sorted notes to CHANGELOG.txt.',
      hint:'sort -u commits.txt > CHANGELOG.txt', check:(sh)=> isFile(sh,'~/repo/CHANGELOG.txt') && linecount(sh,'~/repo/CHANGELOG.txt')===4, solution:['sort -u commits.txt > CHANGELOG.txt'] },
    { brief:'Prepend nothing, but add a title line by appending "-- release 1.3.0 --" to CHANGELOG.txt.',
      hint:'echo "-- release 1.3.0 --" >> CHANGELOG.txt', check:(sh)=> has(sh,'~/repo/CHANGELOG.txt','-- release 1.3.0 --'), solution:['echo "-- release 1.3.0 --" >> CHANGELOG.txt'] },
    { brief:'Copy app.js into the dist folder.',
      hint:'cp app.js dist/', check:(sh)=> isFile(sh,'~/repo/dist/app.js'), solution:['cp app.js dist/'] },
    { brief:'Copy VERSION and CHANGELOG.txt into dist as well (two files, one command).',
      hint:'cp VERSION CHANGELOG.txt dist/', check:(sh)=> isFile(sh,'~/repo/dist/VERSION') && isFile(sh,'~/repo/dist/CHANGELOG.txt'), solution:['cp VERSION CHANGELOG.txt dist/'] },
    { brief:'Tag the build: write "1.3.0" into dist/TAG.',
      hint:'echo "1.3.0" > dist/TAG', check:(sh)=> has(sh,'~/repo/dist/TAG','1.3.0'), solution:['echo "1.3.0" > dist/TAG'] },
    { brief:'Freeze dist: make everything read-only for you recursively (chmod -R 400).',
      hint:'chmod -R 400 dist', check:(sh)=> mode(sh,'~/repo/dist/TAG')===0o400 && mode(sh,'~/repo/dist/app.js')===0o400, solution:['chmod -R 400 dist'] },
    { brief:'Show the dist tree to confirm the release package.',
      hint:'tree dist', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('TAG') && ctx.out.includes('CHANGELOG.txt'), solution:['tree dist'] }
  ]
});

/* ------------------------------------------------------------------ *
 * 10. Inbox Zero
 * ------------------------------------------------------------------ */
SCENARIOS.push({
  id:'inbox-zero',
  title:'Inbox Zero',
  icon:'📥',
  difficulty:'Rookie',
  story:'Your downloads and desktop are a disaster. Sort the chaos into a sane folder structure: images, docs, and code each in their own home. Achieve inbox zero.',
  brief:'Sort a pile of files into categorized folders.',
  setup(sh){
    sh.mkdir('~/inbox');
    ['photo1.png','photo2.jpg','resume.pdf','budget.csv','app.js','server.js','readme.md','screenshot.png'].forEach(f=> sh.mkfile('~/inbox/'+f, f+' content\n'));
  },
  steps:[
    { brief:'Go into the inbox.',
      hint:'cd ~/inbox', check:(sh)=> cwdIs(sh,'~/inbox'), solution:['cd ~/inbox'] },
    { brief:'See the mess: list everything.',
      hint:'ls', check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.includes('photo1.png'), solution:['ls'] },
    { brief:'Create three folders in one command: images docs code.',
      hint:'mkdir images docs code', check:(sh)=> isDir(sh,'~/inbox/images') && isDir(sh,'~/inbox/docs') && isDir(sh,'~/inbox/code'), solution:['mkdir images docs code'] },
    { brief:'List just the PNG files using a wildcard.',
      hint:'ls *.png', check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.includes('photo1.png') && ctx.out.includes('screenshot.png') && !ctx.out.includes('resume'), solution:['ls *.png'] },
    { brief:'Move all .png files into images with one wildcard command.',
      hint:'mv *.png images/', check:(sh)=> isFile(sh,'~/inbox/images/photo1.png') && isFile(sh,'~/inbox/images/screenshot.png') && !exists(sh,'~/inbox/photo1.png'), solution:['mv *.png images/'] },
    { brief:'Move the jpg into images too.',
      hint:'mv *.jpg images/', check:(sh)=> isFile(sh,'~/inbox/images/photo2.jpg'), solution:['mv *.jpg images/'] },
    { brief:'Move the .js files into code with a wildcard.',
      hint:'mv *.js code/', check:(sh)=> isFile(sh,'~/inbox/code/app.js') && isFile(sh,'~/inbox/code/server.js'), solution:['mv *.js code/'] },
    { brief:'Move the pdf, csv, and md docs into docs (three files, one command).',
      hint:'mv resume.pdf budget.csv readme.md docs/', check:(sh)=> isFile(sh,'~/inbox/docs/resume.pdf') && isFile(sh,'~/inbox/docs/budget.csv') && isFile(sh,'~/inbox/docs/readme.md'), solution:['mv resume.pdf budget.csv readme.md docs/'] },
    { brief:'Count how many files ended up in images.',
      hint:'ls images | wc -l', check:(sh,ctx)=> ctx.line.includes('images') && ctx.out.trim()==='3', solution:['ls images | wc -l'] },
    { brief:'Confirm the inbox root now only holds the three folders.',
      hint:'ls', check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.trim()==='code  docs  images', solution:['ls'] },
    { brief:'Celebrate with a tree view of your organized inbox.',
      hint:'tree', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('images') && ctx.out.includes('resume.pdf'), solution:['tree'] }
  ]
});

/* ------------------------------------------------------------------ *
 * 11. Log Detective
 * ------------------------------------------------------------------ */
SCENARIOS.push({
  id:'log-detective',
  title:'Log Detective',
  icon:'🕵️',
  difficulty:'Specialist',
  story:'The checkout page is throwing errors and nobody knows why. Dive into the web server logs, quantify the failures, find the worst offender endpoint, and build a summary for the postmortem.',
  brief:'Analyze web logs with pipes: grep, cut, sort, uniq, wc.',
  setup(sh){
    sh.mkdir('~/web');
    const rows=[
      '200 GET /home','200 GET /home','500 POST /checkout','404 GET /old',
      '500 POST /checkout','200 GET /cart','500 POST /checkout','404 GET /old',
      '200 GET /home','500 GET /cart','200 GET /cart','500 POST /checkout'
    ];
    sh.mkfile('~/web/server.log', rows.join('\n')+'\n');
    sh.mkdir('~/web/postmortem');
  },
  steps:[
    { brief:'Enter the web folder.',
      hint:'cd ~/web', check:(sh)=> cwdIs(sh,'~/web'), solution:['cd ~/web'] },
    { brief:'How many total requests were logged?',
      hint:'wc -l server.log', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('12'), solution:['wc -l server.log'] },
    { brief:'Show only the 500 error lines.',
      hint:'grep 500 server.log', check:(sh,ctx)=> ctx.cmd==='grep' && ctx.out.includes('500') && !ctx.out.includes('200'), solution:['grep "500" server.log'] },
    { brief:'Count the 500 errors.',
      hint:'grep -c 500 server.log', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.trim()==='5', solution:['grep -c 500 server.log'] },
    { brief:'Extract just the status codes (field 1, space-delimited).',
      hint:'cut -d " " -f 1 server.log', check:(sh,ctx)=> ctx.cmd==='cut' && ctx.out.includes('200') && ctx.out.includes('500'), solution:['cut -d " " -f 1 server.log'] },
    { brief:'Tally each status code with counts: cut the code, sort, then uniq -c.',
      hint:'cut -d " " -f 1 server.log | sort | uniq -c', check:(sh,ctx)=> ctx.line.includes('uniq -c') && /5\s/.test(ctx.out) && ctx.out.includes('500'), solution:['cut -d " " -f 1 server.log | sort | uniq -c'] },
    { brief:'Save that status tally to postmortem/status_counts.txt.',
      hint:'cut -d " " -f 1 server.log | sort | uniq -c > postmortem/status_counts.txt', check:(sh)=> isFile(sh,'~/web/postmortem/status_counts.txt') && has(sh,'~/web/postmortem/status_counts.txt','500'), solution:['cut -d " " -f 1 server.log | sort | uniq -c > postmortem/status_counts.txt'] },
    { brief:'Which endpoints are failing? From the 500 lines, cut the endpoint (field 3) and dedupe.',
      hint:'grep 500 server.log | cut -d " " -f 3 | sort -u', check:(sh,ctx)=> ctx.line.includes('cut') && ctx.out.includes('/checkout') && ctx.out.includes('/cart'), solution:['grep 500 server.log | cut -d " " -f 3 | sort -u'] },
    { brief:'Find the single worst endpoint: from 500 lines cut field 3, sort, count, into postmortem/worst.txt.',
      hint:'grep 500 server.log | cut -d " " -f 3 | sort | uniq -c > postmortem/worst.txt',
      check:(sh)=> isFile(sh,'~/web/postmortem/worst.txt') && has(sh,'~/web/postmortem/worst.txt','/checkout'), solution:['grep 500 server.log | cut -d " " -f 3 | sort | uniq -c > postmortem/worst.txt'] },
    { brief:'Add a headline to the postmortem: write "Checkout is the top failure" into postmortem/summary.txt.',
      hint:'echo "Checkout is the top failure" > postmortem/summary.txt', check:(sh)=> has(sh,'~/web/postmortem/summary.txt','Checkout is the top failure'), solution:['echo "Checkout is the top failure" > postmortem/summary.txt'] },
    { brief:'Append the total 500 count line "500 errors: 5" to the summary.',
      hint:'echo "500 errors: 5" >> postmortem/summary.txt', check:(sh)=> has(sh,'~/web/postmortem/summary.txt','500 errors: 5') && linecount(sh,'~/web/postmortem/summary.txt')===2, solution:['echo "500 errors: 5" >> postmortem/summary.txt'] },
    { brief:'Review the postmortem folder as a tree.',
      hint:'tree postmortem', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('summary.txt') && ctx.out.includes('worst.txt'), solution:['tree postmortem'] }
  ]
});

/* ------------------------------------------------------------------ *
 * 12. Config Surgeon
 * ------------------------------------------------------------------ */
SCENARIOS.push({
  id:'config-surgeon',
  title:'Config Surgeon',
  icon:'🩺',
  difficulty:'Specialist',
  story:'A service will not start because its config points at the old staging server and has debug mode left on. Operate carefully with sed to migrate the config to production without breaking it.',
  brief:'Edit configuration files precisely with sed in-place.',
  setup(sh){
    sh.mkdir('~/svc');
    sh.mkfile('~/svc/app.conf', ['host=staging.internal','port=8080','debug=true','workers=2','host_backup=staging.internal'].join('\n')+'\n');
    sh.mkfile('~/svc/db.conf', ['db_host=staging-db','db_pool=5'].join('\n')+'\n');
  },
  steps:[
    { brief:'Enter the service folder.',
      hint:'cd ~/svc', check:(sh)=> cwdIs(sh,'~/svc'), solution:['cd ~/svc'] },
    { brief:'Read app.conf to see what needs changing.',
      hint:'cat app.conf', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('staging.internal'), solution:['cat app.conf'] },
    { brief:'Back up app.conf to app.conf.bak before editing.',
      hint:'cp app.conf app.conf.bak', check:(sh)=> isFile(sh,'~/svc/app.conf.bak') && has(sh,'~/svc/app.conf.bak','staging.internal'), solution:['cp app.conf app.conf.bak'] },
    { brief:'How many lines mention staging.internal? Count them.',
      hint:'grep -c staging.internal app.conf', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.trim()==='2', solution:['grep -c staging.internal app.conf'] },
    { brief:'Replace ALL occurrences of staging.internal with prod.internal in app.conf (in place, global).',
      hint:'sed -i s/staging.internal/prod.internal/g app.conf', check:(sh)=> has(sh,'~/svc/app.conf','prod.internal') && !has(sh,'~/svc/app.conf','staging.internal') && has(sh,'~/svc/app.conf','host_backup=prod.internal'), solution:['sed -i s/staging.internal/prod.internal/g app.conf'] },
    { brief:'Turn debug off: replace debug=true with debug=false in place.',
      hint:'sed -i s/debug=true/debug=false/ app.conf', check:(sh)=> has(sh,'~/svc/app.conf','debug=false'), solution:['sed -i s/debug=true/debug=false/ app.conf'] },
    { brief:'Scale up: change workers=2 to workers=8 in place.',
      hint:'sed -i s/workers=2/workers=8/ app.conf', check:(sh)=> has(sh,'~/svc/app.conf','workers=8'), solution:['sed -i s/workers=2/workers=8/ app.conf'] },
    { brief:'Migrate the database host in db.conf: staging-db becomes prod-db, in place.',
      hint:'sed -i s/staging-db/prod-db/ db.conf', check:(sh)=> has(sh,'~/svc/db.conf','prod-db') && !has(sh,'~/svc/db.conf','staging-db'), solution:['sed -i s/staging-db/prod-db/ db.conf'] },
    { brief:'Verify no staging references remain anywhere: recursive grep for staging.',
      hint:'grep -r staging .', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.includes('app.conf.bak') && !ctx.out.includes('app.conf:') , solution:['grep -r staging .'] },
    { brief:'The backup still has staging refs (that is fine). Confirm the live app.conf is clean.',
      hint:'grep staging app.conf', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.code===1 && ctx.out.trim()==='', solution:['grep staging app.conf'] },
    { brief:'Read the finished app.conf.',
      hint:'cat app.conf', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('prod.internal') && ctx.out.includes('debug=false') && ctx.out.includes('workers=8'), solution:['cat app.conf'] }
  ]
});

/* ------------------------------------------------------------------ *
 * 13. The Archivist
 * ------------------------------------------------------------------ */
SCENARIOS.push({
  id:'archivist',
  title:'The Archivist',
  icon:'📚',
  difficulty:'Specialist',
  story:'Legal wants three years of records archived and indexed. Consolidate scattered yearly reports, build a master index, and lock the archive so nothing can be altered.',
  brief:'Consolidate files, build an index with pipes, and protect the archive.',
  setup(sh){
    sh.mkdir('~/records/2033'); sh.mkdir('~/records/2034'); sh.mkdir('~/records/2035');
    sh.mkfile('~/records/2033/q1.txt','2033 q1 revenue 100\n');
    sh.mkfile('~/records/2033/q2.txt','2033 q2 revenue 120\n');
    sh.mkfile('~/records/2034/q1.txt','2034 q1 revenue 140\n');
    sh.mkfile('~/records/2034/q2.txt','2034 q2 revenue 160\n');
    sh.mkfile('~/records/2035/q1.txt','2035 q1 revenue 200\n');
    sh.mkfile('~/records/scratch.tmp','ignore me\n');
  },
  steps:[
    { brief:'Go to the records folder.',
      hint:'cd ~/records', check:(sh)=> cwdIs(sh,'~/records'), solution:['cd ~/records'] },
    { brief:'Show the whole records tree.',
      hint:'tree', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('2033'), solution:['tree'] },
    { brief:'Find every .txt record in the tree.',
      hint:'find . -name "*.txt"', check:(sh,ctx)=> ctx.cmd==='find' && ctx.out.includes('2033/q1.txt') && ctx.out.includes('2035/q1.txt'), solution:['find . -name "*.txt"'] },
    { brief:'Create an archive folder.',
      hint:'mkdir ~/archive', check:(sh)=> isDir(sh,'~/archive'), solution:['mkdir ~/archive'] },
    { brief:'Delete the stray scratch.tmp first.',
      hint:'rm scratch.tmp', check:(sh)=> !exists(sh,'~/records/scratch.tmp'), solution:['rm scratch.tmp'] },
    { brief:'Copy the entire 2033 folder into the archive (recursive).',
      hint:'cp -r 2033 ~/archive/', check:(sh)=> isDir(sh,'~/archive/2033') && isFile(sh,'~/archive/2033/q1.txt'), solution:['cp -r 2033 ~/archive/'] },
    { brief:'Copy 2034 and 2035 into the archive too (recursive, one command).',
      hint:'cp -r 2034 2035 ~/archive/', check:(sh)=> isDir(sh,'~/archive/2034') && isDir(sh,'~/archive/2035'), solution:['cp -r 2034 2035 ~/archive/'] },
    { brief:'Build a master revenue index: recursively grep "revenue" across the archive, sorted, into ~/archive/INDEX.txt.',
      hint:'grep -r revenue ~/archive | sort > ~/archive/INDEX.txt',
      check:(sh)=> isFile(sh,'~/archive/INDEX.txt') && has(sh,'~/archive/INDEX.txt','revenue 200') && linecount(sh,'~/archive/INDEX.txt')>=5, solution:['grep -r revenue ~/archive | sort > ~/archive/INDEX.txt'] },
    { brief:'Count how many records made it into the index.',
      hint:'wc -l ~/archive/INDEX.txt', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('5'), solution:['wc -l ~/archive/INDEX.txt'] },
    { brief:'Lock the archive: recursively make it read-only for you (chmod -R 400).',
      hint:'chmod -R 400 ~/archive', check:(sh)=> mode(sh,'~/archive/INDEX.txt')===0o400 && mode(sh,'~/archive/2033/q1.txt')===0o400, solution:['chmod -R 400 ~/archive'] },
    { brief:'Verify the finished archive as a tree.',
      hint:'tree ~/archive', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('INDEX.txt') && ctx.out.includes('2035'), solution:['tree ~/archive'] }
  ]
});

/* ------------------------------------------------------------------ *
 * 14. Environment Explorer
 * ------------------------------------------------------------------ */
SCENARIOS.push({
  id:'env-explorer',
  title:'Know Your Machine',
  icon:'🧭',
  difficulty:'Rookie',
  story:'Before you can fix anything, you need to know the lay of the land. Explore who you are, where you are, and how the system is laid out — the reflexes every operator needs.',
  brief:'Build core navigation and inspection reflexes.',
  setup(sh){
    sh.mkdir('/etc'); sh.mkfile('/etc/hostname','nebula\n'); sh.mkfile('/etc/motd','Welcome to Nebula\n');
    sh.mkdir('/usr/bin'); sh.mkfile('/usr/bin/note','#!/bin/sh\necho note\n',{mode:0o755});
    sh.mkfile('~/.profile','umask 022\n');
    sh.mkfile('~/todo.txt','explore the system\n');
  },
  steps:[
    { brief:'Who are you?',
      hint:'whoami', check:(sh,ctx)=> ctx.cmd==='whoami', solution:['whoami'] },
    { brief:'What machine are you on?',
      hint:'hostname', check:(sh,ctx)=> ctx.cmd==='hostname', solution:['hostname'] },
    { brief:'Where are you right now?',
      hint:'pwd', check:(sh,ctx)=> ctx.cmd==='pwd' && ctx.out.includes('/home/astra'), solution:['pwd'] },
    { brief:'List your home, including hidden dotfiles.',
      hint:'ls -a', check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.includes('.profile'), solution:['ls -a'] },
    { brief:'Go to the root of the filesystem.',
      hint:'cd /', check:(sh)=> sh.cwd==='/', solution:['cd /'] },
    { brief:'List what lives at the root.',
      hint:'ls', check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.includes('etc'), solution:['ls'] },
    { brief:'Go into /etc.',
      hint:'cd /etc  (or cd etc)', check:(sh)=> cwdIs(sh,'/etc'), solution:['cd etc'] },
    { brief:'Read the machine hostname file.',
      hint:'cat hostname', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('nebula'), solution:['cat hostname'] },
    { brief:'Jump straight back home using the shortcut.',
      hint:'cd ~   (or just cd)', check:(sh)=> cwdIs(sh,'~'), solution:['cd ~'] },
    { brief:'Go back to the previous directory you were in.',
      hint:'cd -', check:(sh)=> cwdIs(sh,'/etc'), solution:['cd -'] },
    { brief:'Check the file type of /usr/bin/note.',
      hint:'file /usr/bin/note', check:(sh,ctx)=> ctx.cmd==='file' && ctx.out.includes('script'), solution:['file /usr/bin/note'] },
    { brief:'Show your command history for the session.',
      hint:'history', check:(sh,ctx)=> ctx.cmd==='history' && ctx.out.includes('whoami'), solution:['history'] }
  ]
});

/* ------------------------------------------------------------------ *
 * 15. Migration Day
 * ------------------------------------------------------------------ */
SCENARIOS.push({
  id:'migration',
  title:'Migration Day',
  icon:'📦',
  difficulty:'Specialist',
  story:'The team is moving from the old "legacy" layout to a new "app" structure. Carefully migrate source, tests, and docs into the new home, rename as you go, and leave the legacy tree empty.',
  brief:'Restructure a project directory with mkdir, mv, and cp.',
  setup(sh){
    sh.mkdir('~/legacy');
    sh.mkfile('~/legacy/main.py','print("hi")\n');
    sh.mkfile('~/legacy/helpers.py','def h(): pass\n');
    sh.mkfile('~/legacy/test_main.py','assert True\n');
    sh.mkfile('~/legacy/readme','old readme\n');
    sh.mkfile('~/legacy/config.ini','[app]\nname=old\n');
  },
  steps:[
    { brief:'Create the new structure in one command: ~/app/src ~/app/tests ~/app/docs (use -p per path).',
      hint:'mkdir -p ~/app/src ~/app/tests ~/app/docs', check:(sh)=> isDir(sh,'~/app/src') && isDir(sh,'~/app/tests') && isDir(sh,'~/app/docs'), solution:['mkdir -p ~/app/src ~/app/tests ~/app/docs'] },
    { brief:'Go into legacy.',
      hint:'cd ~/legacy', check:(sh)=> cwdIs(sh,'~/legacy'), solution:['cd ~/legacy'] },
    { brief:'Move the test file into ~/app/tests first (before the wildcard grabs it).',
      hint:'mv test_main.py ~/app/tests/', check:(sh)=> isFile(sh,'~/app/tests/test_main.py'), solution:['mv test_main.py ~/app/tests/'] },
    { brief:'Move the remaining Python source files into ~/app/src with a wildcard.',
      hint:'mv *.py ~/app/src/', check:(sh)=> isFile(sh,'~/app/src/main.py') && isFile(sh,'~/app/src/helpers.py') && !exists(sh,'~/legacy/main.py'), solution:['mv *.py ~/app/src/'] },
    { brief:'Move the config into the app root (not src): mv config.ini ~/app/.',
      hint:'mv config.ini ~/app/', check:(sh)=> isFile(sh,'~/app/config.ini'), solution:['mv config.ini ~/app/'] },
    { brief:'Rename the old "readme" to README.md as you move it into docs.',
      hint:'mv readme ~/app/docs/README.md', check:(sh)=> isFile(sh,'~/app/docs/README.md') && !exists(sh,'~/legacy/readme'), solution:['mv readme ~/app/docs/README.md'] },
    { brief:'Update the config: change name=old to name=new in place.',
      hint:'sed -i s/name=old/name=new/ ~/app/config.ini', check:(sh)=> has(sh,'~/app/config.ini','name=new'), solution:['sed -i s/name=old/name=new/ ~/app/config.ini'] },
    { brief:'The legacy folder should now be empty. Confirm with ls.',
      hint:'ls ~/legacy', check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.trim()==='', solution:['ls ~/legacy'] },
    { brief:'Remove the now-empty legacy directory.',
      hint:'rmdir ~/legacy', check:(sh)=> !exists(sh,'~/legacy'), solution:['rmdir ~/legacy'] },
    { brief:'Count how many source files made it to src.',
      hint:'ls ~/app/src | wc -l', check:(sh,ctx)=> ctx.line.includes('src') && ctx.out.trim()==='2', solution:['ls ~/app/src | wc -l'] },
    { brief:'Show the new app tree.',
      hint:'tree ~/app', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('src') && ctx.out.includes('README.md'), solution:['tree ~/app'] }
  ]
});

/* ------------------------------------------------------------------ *
 * 16. Word Count Wizard
 * ------------------------------------------------------------------ */
SCENARIOS.push({
  id:'wordcount',
  title:'The Manuscript',
  icon:'✍️',
  difficulty:'Field Agent',
  story:'A novelist friend needs help with their manuscript: chapter word counts, finding a character who must be renamed, and assembling the chapters into a single file for the editor.',
  brief:'Measure and manipulate prose with wc, sed, cat, and sort.',
  setup(sh){
    sh.mkdir('~/book/chapters');
    sh.mkfile('~/book/chapters/ch1.txt','It was a dark night\nElara walked alone\nThe wind howled loud\n');
    sh.mkfile('~/book/chapters/ch2.txt','Elara found a door\nBehind it waited fate\n');
    sh.mkfile('~/book/chapters/ch3.txt','The end drew near\nElara was ready now\nShe stepped through slow\nAnd vanished into light\n');
    sh.mkfile('~/book/title.txt','THE LONG NIGHT\n');
  },
  steps:[
    { brief:'Enter the chapters folder.',
      hint:'cd ~/book/chapters', check:(sh)=> cwdIs(sh,'~/book/chapters'), solution:['cd ~/book/chapters'] },
    { brief:'Count the lines in each chapter at once (wc on all .txt).',
      hint:'wc -l *.txt', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.includes('ch1.txt') && ctx.out.includes('total'), solution:['wc -l *.txt'] },
    { brief:'Count the words in chapter 3.',
      hint:'wc -w ch3.txt', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('16'), solution:['wc -w ch3.txt'] },
    { brief:'Find every line mentioning the character Elara across all chapters.',
      hint:'grep Elara *.txt', check:(sh,ctx)=> ctx.cmd==='grep' && ctx.out.includes('Elara') && ctx.out.includes('ch1.txt'), solution:['grep Elara *.txt'] },
    { brief:'Count how many lines mention Elara in total.',
      hint:'grep Elara *.txt | wc -l', check:(sh,ctx)=> ctx.line.includes('wc -l') && ctx.out.trim()==='3', solution:['grep Elara *.txt | wc -l'] },
    { brief:'The author renamed Elara to Mira. Fix ch1.txt in place.',
      hint:'sed -i s/Elara/Mira/g ch1.txt', check:(sh)=> has(sh,'~/book/chapters/ch1.txt','Mira') && !has(sh,'~/book/chapters/ch1.txt','Elara'), solution:['sed -i s/Elara/Mira/g ch1.txt'] },
    { brief:'Fix ch2.txt too.',
      hint:'sed -i s/Elara/Mira/g ch2.txt', check:(sh)=> has(sh,'~/book/chapters/ch2.txt','Mira'), solution:['sed -i s/Elara/Mira/g ch2.txt'] },
    { brief:'And ch3.txt.',
      hint:'sed -i s/Elara/Mira/g ch3.txt', check:(sh)=> has(sh,'~/book/chapters/ch3.txt','Mira') && !has(sh,'~/book/chapters/ch3.txt','Elara'), solution:['sed -i s/Elara/Mira/g ch3.txt'] },
    { brief:'Assemble the full manuscript: concatenate ch1, ch2, ch3 into ~/book/manuscript.txt.',
      hint:'cat ch1.txt ch2.txt ch3.txt > ~/book/manuscript.txt', check:(sh)=> isFile(sh,'~/book/manuscript.txt') && linecount(sh,'~/book/manuscript.txt')===9 && has(sh,'~/book/manuscript.txt','Mira'), solution:['cat ch1.txt ch2.txt ch3.txt > ~/book/manuscript.txt'] },
    { brief:'Count the total lines in the finished manuscript.',
      hint:'wc -l ~/book/manuscript.txt', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('9'), solution:['wc -l ~/book/manuscript.txt'] },
    { brief:'Confirm no "Elara" survives anywhere in the book (recursive grep should find nothing).',
      hint:'grep -r Elara ~/book', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.code===1, solution:['grep -r Elara ~/book'] }
  ]
});

/* ------------------------------------------------------------------ *
 * 17. Onboarding Bot
 * ------------------------------------------------------------------ */
SCENARIOS.push({
  id:'onboarding-bot',
  title:'Provision the New Hire',
  icon:'🤖',
  difficulty:'Specialist',
  story:'A new engineer starts Monday. Provision their home directory: standard folders, a starter config, correct permissions, and a welcome message. Do it right so IT does not have to redo it.',
  brief:'Provision a user environment with mkdir, echo, chmod, chown.',
  setup(sh){
    sh.mkdir('/home/newhire');
  },
  steps:[
    { brief:'Go to the new hire home /home/newhire.',
      hint:'cd /home/newhire', check:(sh)=> cwdIs(sh,'/home/newhire'), solution:['cd /home/newhire'] },
    { brief:'Create the standard folders in one command: Documents Downloads projects .config.',
      hint:'mkdir Documents Downloads projects .config', check:(sh)=> isDir(sh,'/home/newhire/Documents') && isDir(sh,'/home/newhire/.config') && isDir(sh,'/home/newhire/projects'), solution:['mkdir Documents Downloads projects .config'] },
    { brief:'Create a starter shell config: write "export EDITOR=vim" into .bashrc.',
      hint:'echo "export EDITOR=vim" > .bashrc', check:(sh)=> has(sh,'/home/newhire/.bashrc','export EDITOR=vim'), solution:['echo "export EDITOR=vim" > .bashrc'] },
    { brief:'Append "alias ll=\'ls -la\'" to .bashrc.',
      hint:'echo "alias ll=\'ls -la\'" >> .bashrc', check:(sh)=> has(sh,'/home/newhire/.bashrc','alias ll') && linecount(sh,'/home/newhire/.bashrc')===2, solution:["echo \"alias ll='ls -la'\" >> .bashrc"] },
    { brief:'Write a welcome note: "Welcome to the team!" into WELCOME.txt.',
      hint:'echo "Welcome to the team!" > WELCOME.txt', check:(sh)=> has(sh,'/home/newhire/WELCOME.txt','Welcome to the team!'), solution:['echo "Welcome to the team!" > WELCOME.txt'] },
    { brief:'Put a starter config file: write "theme=dark" into .config/settings.conf.',
      hint:'echo "theme=dark" > .config/settings.conf', check:(sh)=> has(sh,'/home/newhire/.config/settings.conf','theme=dark'), solution:['echo "theme=dark" > .config/settings.conf'] },
    { brief:'List everything including dotfiles to review the setup.',
      hint:'ls -a', check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.includes('.bashrc') && ctx.out.includes('.config'), solution:['ls -a'] },
    { brief:'Hand the whole home to the new user: recursively chown to newhire.',
      hint:'chown -R newhire /home/newhire', check:(sh)=>{ const a=sh.get('/home/newhire/.bashrc'), b=sh.get('/home/newhire/Documents'); return a.owner==='newhire' && b.owner==='newhire'; }, solution:['chown -R newhire /home/newhire'] },
    { brief:'Secure the .config dir so only the owner can enter it (chmod 700 .config).',
      hint:'chmod 700 .config', check:(sh)=> mode(sh,'/home/newhire/.config')===0o700, solution:['chmod 700 .config'] },
    { brief:'Make .bashrc owner read/write only (chmod 600 .bashrc).',
      hint:'chmod 600 .bashrc', check:(sh)=> mode(sh,'/home/newhire/.bashrc')===0o600, solution:['chmod 600 .bashrc'] },
    { brief:'Verify the provisioned home as a tree (show hidden with a plain tree of the dir).',
      hint:'tree', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('Documents'), solution:['tree'] }
  ]
});

/* ------------------------------------------------------------------ *
 * 18. Disk Space Hunt
 * ------------------------------------------------------------------ */
SCENARIOS.push({
  id:'space-hunt',
  title:'Who Ate My Disk?',
  icon:'🍕',
  difficulty:'Specialist',
  story:'The build server is out of space again. Track down the space hogs across the filesystem, verify which are safe to remove, purge the junk, and prove you reclaimed room.',
  brief:'Locate and remove large/temporary files across a tree.',
  setup(sh){
    sh.mkdir('~/cache/tmp'); sh.mkdir('~/cache/builds');
    sh.mkfile('~/cache/tmp/a.tmp', 'x'.repeat(500));
    sh.mkfile('~/cache/tmp/b.tmp', 'x'.repeat(800));
    sh.mkfile('~/cache/builds/build1.log', 'log\n'.repeat(50));
    sh.mkfile('~/cache/builds/build2.log', 'log\n'.repeat(30));
    sh.mkfile('~/cache/builds/artifact.bin', 'B'.repeat(2000));
    sh.mkfile('~/cache/keep.txt', 'important\n');
  },
  steps:[
    { brief:'Enter the cache folder.',
      hint:'cd ~/cache', check:(sh)=> cwdIs(sh,'~/cache'), solution:['cd ~/cache'] },
    { brief:'Map the whole cache as a tree.',
      hint:'tree', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('tmp'), solution:['tree'] },
    { brief:'Find every .tmp file in the tree.',
      hint:'find . -name "*.tmp"', check:(sh,ctx)=> ctx.cmd==='find' && ctx.out.includes('a.tmp') && ctx.out.includes('b.tmp'), solution:['find . -name "*.tmp"'] },
    { brief:'Find every .log file in the tree.',
      hint:'find . -name "*.log"', check:(sh,ctx)=> ctx.cmd==='find' && ctx.out.includes('build1.log'), solution:['find . -name "*.log"'] },
    { brief:'Inspect sizes with a long listing of the builds folder.',
      hint:'ls -l builds', check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.includes('artifact.bin'), solution:['ls -l builds'] },
    { brief:'The .tmp files are safe to purge. Delete both with a wildcard.',
      hint:'rm tmp/*.tmp', check:(sh)=> !exists(sh,'~/cache/tmp/a.tmp') && !exists(sh,'~/cache/tmp/b.tmp'), solution:['rm tmp/*.tmp'] },
    { brief:'The tmp folder is empty now — remove it.',
      hint:'rmdir tmp', check:(sh)=> !exists(sh,'~/cache/tmp'), solution:['rmdir tmp'] },
    { brief:'The big artifact.bin is regenerable. Delete it.',
      hint:'rm builds/artifact.bin', check:(sh)=> !exists(sh,'~/cache/builds/artifact.bin'), solution:['rm builds/artifact.bin'] },
    { brief:'Purge all build logs with a wildcard.',
      hint:'rm builds/*.log', check:(sh)=> !exists(sh,'~/cache/builds/build1.log') && !exists(sh,'~/cache/builds/build2.log'), solution:['rm builds/*.log'] },
    { brief:'Confirm keep.txt survived the cleanup.',
      hint:'cat keep.txt', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('important'), solution:['cat keep.txt'] },
    { brief:'Final tree to prove the cache is lean.',
      hint:'tree', check:(sh,ctx)=> ctx.cmd==='tree' && !ctx.out.includes('.tmp') && ctx.out.includes('keep.txt'), solution:['tree'] }
  ]
});

/* ------------------------------------------------------------------ *
 * 19. The Pipeline Master
 * ------------------------------------------------------------------ */
SCENARIOS.push({
  id:'pipeline-master',
  title:'The Pipeline Master',
  icon:'⚙️',
  difficulty:'Master',
  story:'Sales dropped a raw transaction log on your desk and wants answers in five minutes. No spreadsheets — just the shell. Chain commands into pipelines to extract every insight they need.',
  brief:'Answer business questions using multi-stage pipelines.',
  setup(sh){
    sh.mkdir('~/sales');
    const rows=[
      'paris,pro,120','berlin,free,0','paris,pro,120','tokyo,pro,200',
      'berlin,pro,120','paris,free,0','tokyo,free,0','paris,pro,120',
      'berlin,pro,120','tokyo,pro,200','paris,pro,120','berlin,free,0'
    ];
    sh.mkfile('~/sales/tx.csv', rows.join('\n')+'\n');
    sh.mkdir('~/sales/out');
  },
  steps:[
    { brief:'Enter the sales folder.',
      hint:'cd ~/sales', check:(sh)=> cwdIs(sh,'~/sales'), solution:['cd ~/sales'] },
    { brief:'How many transactions are there?',
      hint:'wc -l tx.csv', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('12'), solution:['wc -l tx.csv'] },
    { brief:'List the unique cities (field 1), sorted.',
      hint:'cut -d , -f 1 tx.csv | sort -u', check:(sh,ctx)=> ctx.line.includes('cut') && ctx.out.includes('berlin') && ctx.out.includes('tokyo') && ctx.out.includes('paris'), solution:['cut -d , -f 1 tx.csv | sort -u'] },
    { brief:'Count transactions per city: cut city, sort, uniq -c.',
      hint:'cut -d , -f 1 tx.csv | sort | uniq -c', check:(sh,ctx)=> ctx.line.includes('uniq -c') && ctx.out.includes('paris'), solution:['cut -d , -f 1 tx.csv | sort | uniq -c'] },
    { brief:'How many transactions came from paris? (grep the city, count)',
      hint:'cut -d , -f 1 tx.csv | grep -c paris', check:(sh,ctx)=> ctx.out.trim()==='5', solution:['cut -d , -f 1 tx.csv | grep -c paris'] },
    { brief:'How many were on the pro plan (field 2)?',
      hint:'cut -d , -f 2 tx.csv | grep -c pro', check:(sh,ctx)=> ctx.out.trim()==='8', solution:['cut -d , -f 2 tx.csv | grep -c pro'] },
    { brief:'Save the pro-plan transactions to out/pro.csv.',
      hint:'grep pro tx.csv > out/pro.csv', check:(sh)=> isFile(sh,'~/sales/out/pro.csv') && linecount(sh,'~/sales/out/pro.csv')===8, solution:['grep pro tx.csv > out/pro.csv'] },
    { brief:'List the distinct revenue amounts (field 3) sorted numerically, unique.',
      hint:'cut -d , -f 3 tx.csv | sort -nu', check:(sh,ctx)=> ctx.line.includes('sort -nu') && ctx.out.split('\n').filter(Boolean).join(',')==='0,120,200', solution:['cut -d , -f 3 tx.csv | sort -nu'] },
    { brief:'Build a per-plan tally saved to out/plan_counts.txt: cut plan, sort, uniq -c.',
      hint:'cut -d , -f 2 tx.csv | sort | uniq -c > out/plan_counts.txt', check:(sh)=> isFile(sh,'~/sales/out/plan_counts.txt') && has(sh,'~/sales/out/plan_counts.txt','pro'), solution:['cut -d , -f 2 tx.csv | sort | uniq -c > out/plan_counts.txt'] },
    { brief:'Find the busiest city tally into out/city_counts.txt (cut, sort, uniq -c).',
      hint:'cut -d , -f 1 tx.csv | sort | uniq -c > out/city_counts.txt', check:(sh)=> isFile(sh,'~/sales/out/city_counts.txt') && has(sh,'~/sales/out/city_counts.txt','paris'), solution:['cut -d , -f 1 tx.csv | sort | uniq -c > out/city_counts.txt'] },
    { brief:'Write the headline "paris leads with 5 tx" into out/summary.txt.',
      hint:'echo "paris leads with 5 tx" > out/summary.txt', check:(sh)=> has(sh,'~/sales/out/summary.txt','paris leads with 5 tx'), solution:['echo "paris leads with 5 tx" > out/summary.txt'] },
    { brief:'Show the out folder as a tree to wrap up.',
      hint:'tree out', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('summary.txt') && ctx.out.includes('plan_counts.txt'), solution:['tree out'] }
  ]
});

/* ------------------------------------------------------------------ *
 * 20. Rescue the Server
 * ------------------------------------------------------------------ */
SCENARIOS.push({
  id:'rescue-server',
  title:'Rescue the Server',
  icon:'🛟',
  difficulty:'Master',
  story:'Production is down. A bad deploy left a broken config, a runaway log, and a missing symlinked script. You have shell access and a very nervous manager watching. Bring it back online, step by step.',
  brief:'A capstone incident: diagnose and repair a broken deployment.',
  setup(sh){
    sh.mkdir('/srv/app/config'); sh.mkdir('/srv/app/bin'); sh.mkdir('/srv/app/logs');
    sh.mkfile('/srv/app/config/app.conf', ['listen=0.0.0.0','port=0','mode=maintenance','db=prod-db'].join('\n')+'\n');
    sh.mkfile('/srv/app/bin/start.sh', '#!/bin/sh\necho starting\n', {mode:0o644});
    sh.mkfile('/srv/app/logs/error.log', Array.from({length:8},(_,i)=> (i%2? 'INFO ok':'ERROR port 0 invalid')).join('\n')+'\n');
    sh.mkfile('/srv/app/logs/huge.log', 'spam\n'.repeat(100));
    sh.mkdir('~/rescue');
  },
  steps:[
    { brief:'Get to the app root /srv/app.',
      hint:'cd /srv/app', check:(sh)=> cwdIs(sh,'/srv/app'), solution:['cd /srv/app'] },
    { brief:'Survey the damage with a full tree.',
      hint:'tree', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('config'), solution:['tree'] },
    { brief:'Check the error log for the failure reason.',
      hint:'grep ERROR logs/error.log', check:(sh,ctx)=> ctx.cmd==='grep' && ctx.out.includes('port 0 invalid'), solution:['grep ERROR logs/error.log'] },
    { brief:'Count how many ERROR lines there are.',
      hint:'grep -c ERROR logs/error.log', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.trim()==='4', solution:['grep -c ERROR logs/error.log'] },
    { brief:'Read the current config.',
      hint:'cat config/app.conf', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('port=0'), solution:['cat config/app.conf'] },
    { brief:'Back up the config before touching it.',
      hint:'cp config/app.conf config/app.conf.bak', check:(sh)=> isFile(sh,'/srv/app/config/app.conf.bak'), solution:['cp config/app.conf config/app.conf.bak'] },
    { brief:'Fix the port: change port=0 to port=8080 in place.',
      hint:'sed -i s/port=0/port=8080/ config/app.conf', check:(sh)=> has(sh,'/srv/app/config/app.conf','port=8080'), solution:['sed -i s/port=0/port=8080/ config/app.conf'] },
    { brief:'Take it out of maintenance: change mode=maintenance to mode=live in place.',
      hint:'sed -i s/mode=maintenance/mode=live/ config/app.conf', check:(sh)=> has(sh,'/srv/app/config/app.conf','mode=live'), solution:['sed -i s/mode=maintenance/mode=live/ config/app.conf'] },
    { brief:'The start script is not executable. Make it runnable (chmod +x).',
      hint:'chmod +x bin/start.sh', check:(sh)=> (mode(sh,'/srv/app/bin/start.sh')&0o111)!==0, solution:['chmod +x bin/start.sh'] },
    { brief:'The runaway huge.log is eating disk. Delete it.',
      hint:'rm logs/huge.log', check:(sh)=> !exists(sh,'/srv/app/logs/huge.log'), solution:['rm logs/huge.log'] },
    { brief:'Snapshot the fixed config into your ~/rescue folder for the postmortem.',
      hint:'cp config/app.conf ~/rescue/fixed.conf', check:(sh)=> isFile(sh,'~/rescue/fixed.conf') && has(sh,'~/rescue/fixed.conf','port=8080'), solution:['cp config/app.conf ~/rescue/fixed.conf'] },
    { brief:'Verify the live config is fully fixed: no port=0 and no maintenance left.',
      hint:'grep -E "port=0|maintenance" config/app.conf', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.code===1, solution:['grep port=0 config/app.conf'] },
    { brief:'Write "SERVER RESTORED" into ~/rescue/status.txt to close the incident.',
      hint:'echo "SERVER RESTORED" > ~/rescue/status.txt', check:(sh)=> has(sh,'~/rescue/status.txt','SERVER RESTORED'), solution:['echo "SERVER RESTORED" > ~/rescue/status.txt'] },
    { brief:'Final confirmation: read the repaired config end to end.',
      hint:'cat config/app.conf', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('port=8080') && ctx.out.includes('mode=live'), solution:['cat config/app.conf'] }
  ]
});

/* ------------------------------------------------------------------ *
 * 21. Text Alchemist
 * ------------------------------------------------------------------ */
SCENARIOS.push({
  id:'text-alchemist',
  title:'Text Alchemist',
  icon:'⚗️',
  difficulty:'Master',
  story:'You inherited a pile of inconsistent text data: mixed case, wrong delimiters, stray whitespace, and duplicates. Transform it into clean, normalized output using the full text-processing toolkit.',
  brief:'Transform messy text with tr, sed, sort, uniq, cut, and pipes.',
  setup(sh){
    sh.mkdir('~/alch');
    sh.mkfile('~/alch/names.txt', ['Alice','BOB','alice','Carol','bob','CAROL','dave'].join('\n')+'\n');
    sh.mkfile('~/alch/pipes.txt', ['a|1','b|2','c|3'].join('\n')+'\n');
    sh.mkfile('~/alch/tags.csv', 'RED,car\nBLUE,sky\nRED,apple\ngreen,leaf\nBLUE,ocean\n');
  },
  steps:[
    { brief:'Enter the alch folder.',
      hint:'cd ~/alch', check:(sh)=> cwdIs(sh,'~/alch'), solution:['cd ~/alch'] },
    { brief:'The names have mixed case. Lowercase everything using tr.',
      hint:'cat names.txt | tr A-Z a-z', check:(sh,ctx)=> ctx.line.includes('tr') && ctx.out.includes('alice') && ctx.out.includes('bob') && !ctx.out.includes('BOB'), solution:['cat names.txt | tr A-Z a-z'] },
    { brief:'Lowercase, sort, and dedupe the names into clean_names.txt.',
      hint:'cat names.txt | tr A-Z a-z | sort -u > clean_names.txt',
      check:(sh)=>{ const n=sh.get('~/alch/clean_names.txt'); if(!n) return false; const ls=fileLines(n); return ls.length===4 && ls.includes('alice') && ls.includes('dave'); }, solution:['cat names.txt | tr A-Z a-z | sort -u > clean_names.txt'] },
    { brief:'Count how many unique names remain.',
      hint:'wc -l clean_names.txt', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('4'), solution:['wc -l clean_names.txt'] },
    { brief:'The pipes.txt uses | as a delimiter. Convert every | to a comma using tr, into csv_pipes.txt.',
      hint:'cat pipes.txt | tr "|" "," > csv_pipes.txt', check:(sh)=> isFile(sh,'~/alch/csv_pipes.txt') && has(sh,'~/alch/csv_pipes.txt','a,1') && !has(sh,'~/alch/csv_pipes.txt','a|1'), solution:['cat pipes.txt | tr "|" "," > csv_pipes.txt'] },
    { brief:'From tags.csv, extract just the color (field 1).',
      hint:'cut -d , -f 1 tags.csv', check:(sh,ctx)=> ctx.cmd==='cut' && ctx.out.includes('RED') && ctx.out.includes('green'), solution:['cut -d , -f 1 tags.csv'] },
    { brief:'Normalize colors to lowercase, dedupe, sort, into colors.txt.',
      hint:'cut -d , -f 1 tags.csv | tr A-Z a-z | sort -u > colors.txt',
      check:(sh)=>{ const n=sh.get('~/alch/colors.txt'); if(!n) return false; const ls=fileLines(n); return ls.length===3 && ls.includes('red') && ls.includes('blue') && ls.includes('green'); }, solution:['cut -d , -f 1 tags.csv | tr A-Z a-z | sort -u > colors.txt'] },
    { brief:'Replace every RED with CRIMSON in tags.csv (in place, global).',
      hint:'sed -i s/RED/CRIMSON/g tags.csv', check:(sh)=> has(sh,'~/alch/tags.csv','CRIMSON') && !has(sh,'~/alch/tags.csv','RED'), solution:['sed -i s/RED/CRIMSON/g tags.csv'] },
    { brief:'How many CRIMSON rows are there now?',
      hint:'grep -c CRIMSON tags.csv', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.trim()==='2', solution:['grep -c CRIMSON tags.csv'] },
    { brief:'Build a combined report: concatenate clean_names.txt and colors.txt into report.txt.',
      hint:'cat clean_names.txt colors.txt > report.txt', check:(sh)=> isFile(sh,'~/alch/report.txt') && linecount(sh,'~/alch/report.txt')===7, solution:['cat clean_names.txt colors.txt > report.txt'] },
    { brief:'Sort the combined report uniquely into report_sorted.txt and count the lines.',
      hint:'sort -u report.txt > report_sorted.txt', check:(sh)=> isFile(sh,'~/alch/report_sorted.txt') && linecount(sh,'~/alch/report_sorted.txt')>=6, solution:['sort -u report.txt > report_sorted.txt'] },
    { brief:'Show the alch folder as a tree to admire your work.',
      hint:'tree', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('report_sorted.txt'), solution:['tree'] }
  ]
});

module.exports = { SCENARIOS, helpers:{ exists,isFile,isDir,content,has,linecount,mode,cwdIs } };
