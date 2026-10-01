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

/* ================================================================== *
 *  NEW SCENARIOS — ROOKIE (10)
 * ================================================================== */

/* R1. Coffee Shop Wi-Fi */
SCENARIOS.push({
  id:'coffee-wifi',
  title:'Coffee Shop Wi-Fi',
  icon:'☕',
  difficulty:'Rookie',
  story:'Working remote from a cafe, you need to jot down the Wi-Fi details and tidy your scratch folder before the battery dies.',
  brief:'Practice echo, cat, mkdir, and simple redirection.',
  setup(sh){
    sh.mkfile('~/scratch.txt','random\n');
    sh.mkdir('~/cafe');
  },
  steps:[
    { brief:'Enter the cafe folder.', hint:'cd ~/cafe', check:(sh)=> cwdIs(sh,'~/cafe'), solution:['cd ~/cafe'] },
    { brief:'Save the network name: write "ssid=BeanThere" into wifi.txt.', hint:'echo "ssid=BeanThere" > wifi.txt', check:(sh)=> has(sh,'~/cafe/wifi.txt','ssid=BeanThere'), solution:['echo "ssid=BeanThere" > wifi.txt'] },
    { brief:'Append the password line "pass=latte123" to wifi.txt.', hint:'echo "pass=latte123" >> wifi.txt', check:(sh)=> has(sh,'~/cafe/wifi.txt','pass=latte123') && linecount(sh,'~/cafe/wifi.txt')===2, solution:['echo "pass=latte123" >> wifi.txt'] },
    { brief:'Read wifi.txt back.', hint:'cat wifi.txt', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('latte123'), solution:['cat wifi.txt'] },
    { brief:'Create an empty file called receipts.txt.', hint:'touch receipts.txt', check:(sh)=> isFile(sh,'~/cafe/receipts.txt'), solution:['touch receipts.txt'] },
    { brief:'Make a notes folder here.', hint:'mkdir notes', check:(sh)=> isDir(sh,'~/cafe/notes'), solution:['mkdir notes'] },
    { brief:'Write "flat white 4.50" into notes/order.txt.', hint:'echo "flat white 4.50" > notes/order.txt', check:(sh)=> has(sh,'~/cafe/notes/order.txt','flat white 4.50'), solution:['echo "flat white 4.50" > notes/order.txt'] },
    { brief:'Count the lines in wifi.txt.', hint:'wc -l wifi.txt', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('2'), solution:['wc -l wifi.txt'] },
    { brief:'List everything in the cafe folder.', hint:'ls', check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.includes('wifi.txt') && ctx.out.includes('notes'), solution:['ls'] },
    { brief:'Show the cafe folder as a tree.', hint:'tree', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('order.txt'), solution:['tree'] }
  ]
});

/* R2. Grocery List */
SCENARIOS.push({
  id:'grocery-list',
  title:'The Grocery List',
  icon:'🛒',
  difficulty:'Rookie',
  story:'You keep forgetting items at the store. Build a tidy, sorted grocery list from the chaos in your head.',
  brief:'Build and sort a list with echo, sort, and redirection.',
  setup(sh){
    sh.mkdir('~/shopping');
    sh.mkfile('~/shopping/raw.txt', ['milk','eggs','bread','milk','apples','bread'].join('\n')+'\n');
  },
  steps:[
    { brief:'Enter the shopping folder.', hint:'cd ~/shopping', check:(sh)=> cwdIs(sh,'~/shopping'), solution:['cd ~/shopping'] },
    { brief:'Read the raw list.', hint:'cat raw.txt', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('milk'), solution:['cat raw.txt'] },
    { brief:'How many lines are in raw.txt?', hint:'wc -l raw.txt', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('6'), solution:['wc -l raw.txt'] },
    { brief:'Show the list sorted alphabetically.', hint:'sort raw.txt', check:(sh,ctx)=> ctx.cmd==='sort' && ctx.out.indexOf('apples')<ctx.out.indexOf('bread'), solution:['sort raw.txt'] },
    { brief:'Save a sorted, de-duplicated list to list.txt.', hint:'sort -u raw.txt > list.txt', check:(sh)=> isFile(sh,'~/shopping/list.txt') && linecount(sh,'~/shopping/list.txt')===4, solution:['sort -u raw.txt > list.txt'] },
    { brief:'Count the unique items.', hint:'wc -l list.txt', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('4'), solution:['wc -l list.txt'] },
    { brief:'Add "coffee" to the end of list.txt.', hint:'echo "coffee" >> list.txt', check:(sh)=> has(sh,'~/shopping/list.txt','coffee') && linecount(sh,'~/shopping/list.txt')===5, solution:['echo "coffee" >> list.txt'] },
    { brief:'Does the list contain bread? Search for it.', hint:'grep bread list.txt', check:(sh,ctx)=> ctx.cmd==='grep' && ctx.out.includes('bread'), solution:['grep bread list.txt'] },
    { brief:'Make a copy called list.bak.', hint:'cp list.txt list.bak', check:(sh)=> isFile(sh,'~/shopping/list.bak'), solution:['cp list.txt list.bak'] },
    { brief:'Read the final list.', hint:'cat list.txt', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('coffee'), solution:['cat list.txt'] }
  ]
});

/* R3. Photo Roll */
SCENARIOS.push({
  id:'photo-roll',
  title:'The Photo Roll',
  icon:'📷',
  difficulty:'Rookie',
  story:'Your camera dumped a mess of photos and a stray note into one folder. Sort the keepers from the junk.',
  brief:'Use ls wildcards, mkdir, mv, and rm.',
  setup(sh){
    sh.mkdir('~/dcim');
    ['IMG_001.jpg','IMG_002.jpg','IMG_003.jpg','thumbs.db','notes.txt'].forEach(f=> sh.mkfile('~/dcim/'+f, f+'\n'));
  },
  steps:[
    { brief:'Go into the dcim folder.', hint:'cd ~/dcim', check:(sh)=> cwdIs(sh,'~/dcim'), solution:['cd ~/dcim'] },
    { brief:'List the jpg files with a wildcard.', hint:'ls *.jpg', check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.includes('IMG_001.jpg') && !ctx.out.includes('thumbs'), solution:['ls *.jpg'] },
    { brief:'Make a folder called keep.', hint:'mkdir keep', check:(sh)=> isDir(sh,'~/dcim/keep'), solution:['mkdir keep'] },
    { brief:'Move all jpg files into keep with a wildcard.', hint:'mv *.jpg keep/', check:(sh)=> isFile(sh,'~/dcim/keep/IMG_001.jpg') && !exists(sh,'~/dcim/IMG_001.jpg'), solution:['mv *.jpg keep/'] },
    { brief:'The thumbs.db is junk. Delete it.', hint:'rm thumbs.db', check:(sh)=> !exists(sh,'~/dcim/thumbs.db'), solution:['rm thumbs.db'] },
    { brief:'Count how many photos are in keep.', hint:'ls keep | wc -l', check:(sh,ctx)=> ctx.line.includes('keep') && ctx.out.trim()==='3', solution:['ls keep | wc -l'] },
    { brief:'Rename notes.txt to README.txt.', hint:'mv notes.txt README.txt', check:(sh)=> isFile(sh,'~/dcim/README.txt') && !exists(sh,'~/dcim/notes.txt'), solution:['mv notes.txt README.txt'] },
    { brief:'Copy the first photo out as cover.jpg.', hint:'cp keep/IMG_001.jpg cover.jpg', check:(sh)=> isFile(sh,'~/dcim/cover.jpg'), solution:['cp keep/IMG_001.jpg cover.jpg'] },
    { brief:'Show the folder as a tree.', hint:'tree', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('keep') && ctx.out.includes('cover.jpg'), solution:['tree'] }
  ]
});

/* R4. Numbered Pages */
SCENARIOS.push({
  id:'numbered-pages',
  title:'Numbered Pages',
  icon:'🔢',
  difficulty:'Rookie',
  story:'A short poem file needs line numbers and a quick read in both directions for the printer.',
  brief:'Explore cat -n, nl, tac, head, and tail.',
  setup(sh){
    sh.mkdir('~/poem');
    sh.mkfile('~/poem/haiku.txt','old pond\na frog leaps in\nsound of water\nripples fade\nstillness returns\n');
  },
  steps:[
    { brief:'Enter the poem folder.', hint:'cd ~/poem', check:(sh)=> cwdIs(sh,'~/poem'), solution:['cd ~/poem'] },
    { brief:'Read the poem.', hint:'cat haiku.txt', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('old pond'), solution:['cat haiku.txt'] },
    { brief:'Show the poem with line numbers using cat.', hint:'cat -n haiku.txt', check:(sh,ctx)=> ctx.cmd==='cat' && /1\s+old pond/.test(ctx.out), solution:['cat -n haiku.txt'] },
    { brief:'Number the lines with nl instead.', hint:'nl haiku.txt', check:(sh,ctx)=> ctx.cmd==='nl' && ctx.out.includes('old pond'), solution:['nl haiku.txt'] },
    { brief:'Show only the first 2 lines.', hint:'head -n 2 haiku.txt', check:(sh,ctx)=> ctx.cmd==='head' && ctx.out.trim().split("\n").length===2, solution:['head -n 2 haiku.txt'] },
    { brief:'Show only the last 2 lines.', hint:'tail -n 2 haiku.txt', check:(sh,ctx)=> ctx.cmd==='tail' && ctx.out.trim().split("\n").length===2, solution:['tail -n 2 haiku.txt'] },
    { brief:'Print the poem in reverse line order with tac.', hint:'tac haiku.txt', check:(sh,ctx)=> ctx.cmd==='tac' && ctx.out.trim().split('\n')[0]==='stillness returns', solution:['tac haiku.txt'] },
    { brief:'Save the reversed poem to reversed.txt.', hint:'tac haiku.txt > reversed.txt', check:(sh)=> isFile(sh,'~/poem/reversed.txt') && has(sh,'~/poem/reversed.txt','stillness returns'), solution:['tac haiku.txt > reversed.txt'] },
    { brief:'Count the lines in the poem.', hint:'wc -l haiku.txt', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('5'), solution:['wc -l haiku.txt'] },
    { brief:'List the folder.', hint:'ls', check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.includes('reversed.txt'), solution:['ls'] }
  ]
});

/* R5. Count to Ten */
SCENARIOS.push({
  id:'count-ten',
  title:'Count to Ten',
  icon:'🧮',
  difficulty:'Rookie',
  story:'A tiny data task: generate some numbers, store them, and measure the result. A gentle intro to seq and pipes.',
  brief:'Generate and measure data with seq, wc, head, tail.',
  setup(sh){
    sh.mkdir('~/calc');
  },
  steps:[
    { brief:'Enter the calc folder.', hint:'cd ~/calc', check:(sh)=> cwdIs(sh,'~/calc'), solution:['cd ~/calc'] },
    { brief:'Print the numbers 1 through 5 with seq.', hint:'seq 5', check:(sh,ctx)=> ctx.cmd==='seq' && ctx.out.trim()==='1\n2\n3\n4\n5', solution:['seq 5'] },
    { brief:'Save the numbers 1 through 10 into nums.txt.', hint:'seq 10 > nums.txt', check:(sh)=> isFile(sh,'~/calc/nums.txt') && linecount(sh,'~/calc/nums.txt')===10, solution:['seq 10 > nums.txt'] },
    { brief:'Count the lines in nums.txt.', hint:'wc -l nums.txt', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('10'), solution:['wc -l nums.txt'] },
    { brief:'Show the first 3 numbers.', hint:'head -n 3 nums.txt', check:(sh,ctx)=> ctx.cmd==='head' && ctx.out.trim()==='1\n2\n3', solution:['head -n 3 nums.txt'] },
    { brief:'Show the last 3 numbers.', hint:'tail -n 3 nums.txt', check:(sh,ctx)=> ctx.cmd==='tail' && ctx.out.trim()==='8\n9\n10', solution:['tail -n 3 nums.txt'] },
    { brief:'Generate even numbers 2 to 10 (step 2) into evens.txt.', hint:'seq 2 2 10 > evens.txt', check:(sh)=> isFile(sh,'~/calc/evens.txt') && linecount(sh,'~/calc/evens.txt')===5 && has(sh,'~/calc/evens.txt','10'), solution:['seq 2 2 10 > evens.txt'] },
    { brief:'Reverse the numbers in nums.txt with tac into desc.txt.', hint:'tac nums.txt > desc.txt', check:(sh)=> isFile(sh,'~/calc/desc.txt') && fileLines(sh.get('~/calc/desc.txt'))[0]==='10', solution:['tac nums.txt > desc.txt'] },
    { brief:'Confirm evens.txt contents.', hint:'cat evens.txt', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('2') && ctx.out.includes('10'), solution:['cat evens.txt'] },
    { brief:'Tree the calc folder.', hint:'tree', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('evens.txt'), solution:['tree'] }
  ]
});

/* R6. Desktop Cleanup */
SCENARIOS.push({
  id:'desktop-cleanup',
  title:'Desktop Cleanup',
  icon:'🖥️',
  difficulty:'Rookie',
  story:'Your desktop is littered with old files. Archive the keepers, trash the junk, and leave a clean surface.',
  brief:'Organize files with mkdir, mv, cp, and rm.',
  setup(sh){
    sh.mkdir('~/Desktop');
    sh.mkfile('~/Desktop/report.docx','report\n');
    sh.mkfile('~/Desktop/draft.docx','draft\n');
    sh.mkfile('~/Desktop/untitled.txt','junk\n');
    sh.mkfile('~/Desktop/screenshot.png','png\n');
    sh.mkfile('~/Desktop/temp.tmp','temp\n');
  },
  steps:[
    { brief:'Go to the Desktop.', hint:'cd ~/Desktop', check:(sh)=> cwdIs(sh,'~/Desktop'), solution:['cd ~/Desktop'] },
    { brief:'List everything.', hint:'ls', check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.includes('report.docx'), solution:['ls'] },
    { brief:'Make an archive folder.', hint:'mkdir archive', check:(sh)=> isDir(sh,'~/Desktop/archive'), solution:['mkdir archive'] },
    { brief:'Move both .docx files into archive with a wildcard.', hint:'mv *.docx archive/', check:(sh)=> isFile(sh,'~/Desktop/archive/report.docx') && isFile(sh,'~/Desktop/archive/draft.docx'), solution:['mv *.docx archive/'] },
    { brief:'Delete the stray temp.tmp.', hint:'rm temp.tmp', check:(sh)=> !exists(sh,'~/Desktop/temp.tmp'), solution:['rm temp.tmp'] },
    { brief:'Delete untitled.txt too.', hint:'rm untitled.txt', check:(sh)=> !exists(sh,'~/Desktop/untitled.txt'), solution:['rm untitled.txt'] },
    { brief:'Make a folder called images and move the png there.', hint:'mkdir images && mv *.png images/', check:(sh)=> isFile(sh,'~/Desktop/images/screenshot.png'), solution:['mkdir images','mv *.png images/'] },
    { brief:'Count how many documents are archived.', hint:'ls archive | wc -l', check:(sh,ctx)=> ctx.line.includes('archive') && ctx.out.trim()==='2', solution:['ls archive | wc -l'] },
    { brief:'Show the cleaned Desktop as a tree.', hint:'tree', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('archive') && ctx.out.includes('images'), solution:['tree'] }
  ]
});

/* R7. Reading the Manual */
SCENARIOS.push({
  id:'read-manual',
  title:'Reading the Manual',
  icon:'📖',
  difficulty:'Rookie',
  story:'A good operator knows how to ask the shell for help. Learn to look up commands and inspect what you are dealing with.',
  brief:'Use help, man, file, stat, and whoami.',
  setup(sh){
    sh.mkdir('~/manuals');
    sh.mkfile('~/manuals/script.sh','#!/bin/sh\necho hi\n',{mode:0o755});
    sh.mkfile('~/manuals/data.txt','just text\n');
  },
  steps:[
    { brief:'Enter the manuals folder.', hint:'cd ~/manuals', check:(sh)=> cwdIs(sh,'~/manuals'), solution:['cd ~/manuals'] },
    { brief:'List the available commands with help.', hint:'help', check:(sh,ctx)=> ctx.cmd==='help' && ctx.out.includes('grep'), solution:['help'] },
    { brief:'Read the manual page for ls.', hint:'man ls', check:(sh,ctx)=> ctx.cmd==='man' && ctx.out.includes('list directory'), solution:['man ls'] },
    { brief:'Read the manual page for grep.', hint:'man grep', check:(sh,ctx)=> ctx.cmd==='man' && ctx.out.includes('pattern'), solution:['man grep'] },
    { brief:'What type of file is script.sh?', hint:'file script.sh', check:(sh,ctx)=> ctx.cmd==='file' && ctx.out.includes('script'), solution:['file script.sh'] },
    { brief:'What type of file is data.txt?', hint:'file data.txt', check:(sh,ctx)=> ctx.cmd==='file' && ctx.out.includes('ASCII text'), solution:['file data.txt'] },
    { brief:'Show the status of script.sh.', hint:'stat script.sh', check:(sh,ctx)=> ctx.cmd==='stat' && ctx.out.includes('755'), solution:['stat script.sh'] },
    { brief:'Who are you?', hint:'whoami', check:(sh,ctx)=> ctx.cmd==='whoami' && ctx.out.includes('astra'), solution:['whoami'] },
    { brief:'What host are you on?', hint:'hostname', check:(sh,ctx)=> ctx.cmd==='hostname' && ctx.out.includes('nebula'), solution:['hostname'] }
  ]
});

/* R8. The Scavenger Hunt */
SCENARIOS.push({
  id:'scavenger',
  title:'The Scavenger Hunt',
  icon:'🧭',
  difficulty:'Rookie',
  story:'A playful intro folder hides a few treasures across a small tree. Navigate, peek, and collect them.',
  brief:'Navigate and inspect with cd, ls, cat, and find.',
  setup(sh){
    sh.mkdir('~/hunt/cave');
    sh.mkdir('~/hunt/forest');
    sh.mkfile('~/hunt/map.txt','treasure is in the cave\n');
    sh.mkfile('~/hunt/cave/gold.txt','you found the gold!\n');
    sh.mkfile('~/hunt/forest/leaves.txt','just leaves\n');
    sh.mkdir('~/loot');
  },
  steps:[
    { brief:'Enter the hunt folder.', hint:'cd ~/hunt', check:(sh)=> cwdIs(sh,'~/hunt'), solution:['cd ~/hunt'] },
    { brief:'Read the map.', hint:'cat map.txt', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('cave'), solution:['cat map.txt'] },
    { brief:'Show the whole hunt tree.', hint:'tree', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('cave'), solution:['tree'] },
    { brief:'Go into the cave.', hint:'cd cave', check:(sh)=> cwdIs(sh,'~/hunt/cave'), solution:['cd cave'] },
    { brief:'Read the gold.', hint:'cat gold.txt', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('found the gold'), solution:['cat gold.txt'] },
    { brief:'Go back up to the hunt root.', hint:'cd ..', check:(sh)=> cwdIs(sh,'~/hunt'), solution:['cd ..'] },
    { brief:'Find every .txt file in the hunt tree.', hint:'find . -name "*.txt"', check:(sh,ctx)=> ctx.cmd==='find' && ctx.out.includes('gold.txt') && ctx.out.includes('map.txt'), solution:['find . -name "*.txt"'] },
    { brief:'Copy the gold into your loot folder.', hint:'cp cave/gold.txt ~/loot/', check:(sh)=> isFile(sh,'~/loot/gold.txt'), solution:['cp cave/gold.txt ~/loot/'] },
    { brief:'Confirm the loot.', hint:'cat ~/loot/gold.txt', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('gold'), solution:['cat ~/loot/gold.txt'] }
  ]
});

/* R9. Journal Entry */
SCENARIOS.push({
  id:'journal',
  title:'Dear Diary',
  icon:'📔',
  difficulty:'Rookie',
  story:'Start a simple daily journal: create the folder, write entries, and review the week.',
  brief:'Append-based journaling with echo, cat, wc, and grep.',
  setup(sh){
    sh.mkdir('~/journal');
  },
  steps:[
    { brief:'Enter the journal folder.', hint:'cd ~/journal', check:(sh)=> cwdIs(sh,'~/journal'), solution:['cd ~/journal'] },
    { brief:'Start today: write "Monday: started Linux" into week.txt.', hint:'echo "Monday: started Linux" > week.txt', check:(sh)=> has(sh,'~/journal/week.txt','Monday: started Linux'), solution:['echo "Monday: started Linux" > week.txt'] },
    { brief:'Append "Tuesday: learned pipes" to week.txt.', hint:'echo "Tuesday: learned pipes" >> week.txt', check:(sh)=> has(sh,'~/journal/week.txt','Tuesday: learned pipes'), solution:['echo "Tuesday: learned pipes" >> week.txt'] },
    { brief:'Append "Wednesday: wrote a script" to week.txt.', hint:'echo "Wednesday: wrote a script" >> week.txt', check:(sh)=> has(sh,'~/journal/week.txt','Wednesday') && linecount(sh,'~/journal/week.txt')===3, solution:['echo "Wednesday: wrote a script" >> week.txt'] },
    { brief:'Read the whole week.', hint:'cat week.txt', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('Wednesday'), solution:['cat week.txt'] },
    { brief:'Count how many days you journaled.', hint:'wc -l week.txt', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('3'), solution:['wc -l week.txt'] },
    { brief:'Find the entry that mentions "pipes".', hint:'grep pipes week.txt', check:(sh,ctx)=> ctx.cmd==='grep' && ctx.out.includes('Tuesday'), solution:['grep pipes week.txt'] },
    { brief:'Back up the journal to week.bak.', hint:'cp week.txt week.bak', check:(sh)=> isFile(sh,'~/journal/week.bak'), solution:['cp week.txt week.bak'] },
    { brief:'List the folder.', hint:'ls', check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.includes('week.txt') && ctx.out.includes('week.bak'), solution:['ls'] }
  ]
});

/* R10. Rename Rally */
SCENARIOS.push({
  id:'rename-rally',
  title:'Rename Rally',
  icon:'🏁',
  difficulty:'Rookie',
  story:'A batch of files landed with sloppy names. Rename them one by one into a consistent scheme.',
  brief:'Practice precise renaming and tidy structure with mv and mkdir.',
  setup(sh){
    sh.mkdir('~/files');
    sh.mkfile('~/files/doc1','first\n');
    sh.mkfile('~/files/doc2','second\n');
    sh.mkfile('~/files/DATA','data\n');
    sh.mkfile('~/files/notes','notes\n');
  },
  steps:[
    { brief:'Enter the files folder.', hint:'cd ~/files', check:(sh)=> cwdIs(sh,'~/files'), solution:['cd ~/files'] },
    { brief:'List what is here.', hint:'ls', check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.includes('doc1'), solution:['ls'] },
    { brief:'Rename doc1 to report1.txt.', hint:'mv doc1 report1.txt', check:(sh)=> isFile(sh,'~/files/report1.txt') && !exists(sh,'~/files/doc1'), solution:['mv doc1 report1.txt'] },
    { brief:'Rename doc2 to report2.txt.', hint:'mv doc2 report2.txt', check:(sh)=> isFile(sh,'~/files/report2.txt'), solution:['mv doc2 report2.txt'] },
    { brief:'Rename DATA to data.csv.', hint:'mv DATA data.csv', check:(sh)=> isFile(sh,'~/files/data.csv') && !exists(sh,'~/files/DATA'), solution:['mv DATA data.csv'] },
    { brief:'Rename notes to notes.txt.', hint:'mv notes notes.txt', check:(sh)=> isFile(sh,'~/files/notes.txt'), solution:['mv notes notes.txt'] },
    { brief:'Make a reports folder.', hint:'mkdir reports', check:(sh)=> isDir(sh,'~/files/reports'), solution:['mkdir reports'] },
    { brief:'Move both report files into reports with a wildcard.', hint:'mv report*.txt reports/', check:(sh)=> isFile(sh,'~/files/reports/report1.txt') && isFile(sh,'~/files/reports/report2.txt'), solution:['mv report*.txt reports/'] },
    { brief:'List the reports folder.', hint:'ls reports', check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.includes('report1.txt'), solution:['ls reports'] },
    { brief:'Tree the files folder.', hint:'tree', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('reports') && ctx.out.includes('data.csv'), solution:['tree'] }
  ]
});

/* ================================================================== *
 *  NEW SCENARIOS — FIELD AGENT (10)
 * ================================================================== */

/* F1. The Access Audit */
SCENARIOS.push({
  id:'access-audit',
  title:'The Access Audit',
  icon:'🔑',
  difficulty:'Field Agent',
  story:'Security asked for a quick audit of who logged in and from where. Slice the login records and tally the sources.',
  brief:'Audit logs with cut, sort, uniq, and grep.',
  setup(sh){
    sh.mkdir('~/audit');
    sh.mkfile('~/audit/logins.csv', ['user,ip,result','alice,10.0.0.1,ok','bob,10.0.0.2,ok','alice,10.0.0.1,fail','carol,10.0.0.3,ok','bob,10.0.0.2,fail','alice,10.0.0.1,ok'].join('\n')+'\n');
    sh.mkdir('~/audit/out');
  },
  steps:[
    { brief:'Enter the audit folder.', hint:'cd ~/audit', check:(sh)=> cwdIs(sh,'~/audit'), solution:['cd ~/audit'] },
    { brief:'Read the login records.', hint:'cat logins.csv', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('alice'), solution:['cat logins.csv'] },
    { brief:'Extract the user column (field 1).', hint:'cut -d , -f 1 logins.csv', check:(sh,ctx)=> ctx.cmd==='cut' && ctx.out.includes('alice'), solution:['cut -d , -f 1 logins.csv'] },
    { brief:'List unique users (skip the header) sorted into out/users.txt.', hint:'cut -d , -f 1 logins.csv | grep -v user | sort -u > out/users.txt', check:(sh)=>{ const ls=fileLines(sh.get('~/audit/out/users.txt')||{type:'file',content:''}); return ls.length===3 && ls.includes('alice') && ls.includes('carol'); }, solution:['cut -d , -f 1 logins.csv | grep -v user | sort -u > out/users.txt'] },
    { brief:'Count how many login records failed.', hint:'grep -c fail logins.csv', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.trim()==='2', solution:['grep -c fail logins.csv'] },
    { brief:'Tally logins per user: cut user, skip header, sort, uniq -c into out/per_user.txt.', hint:'cut -d , -f 1 logins.csv | grep -v user | sort | uniq -c > out/per_user.txt', check:(sh)=> isFile(sh,'~/audit/out/per_user.txt') && has(sh,'~/audit/out/per_user.txt','alice'), solution:['cut -d , -f 1 logins.csv | grep -v user | sort | uniq -c > out/per_user.txt'] },
    { brief:'List the distinct IPs (field 2), skip header, sorted.', hint:'cut -d , -f 2 logins.csv | grep -v ip | sort -u', check:(sh,ctx)=> ctx.line.includes('cut') && ctx.out.includes('10.0.0.1') && ctx.out.includes('10.0.0.3'), solution:['cut -d , -f 2 logins.csv | grep -v ip | sort -u'] },
    { brief:'Save only the failed records to out/failures.csv.', hint:'grep fail logins.csv > out/failures.csv', check:(sh)=> isFile(sh,'~/audit/out/failures.csv') && linecount(sh,'~/audit/out/failures.csv')===2, solution:['grep fail logins.csv > out/failures.csv'] },
    { brief:'Write a headline "2 failed logins" into out/summary.txt.', hint:'echo "2 failed logins" > out/summary.txt', check:(sh)=> has(sh,'~/audit/out/summary.txt','2 failed logins'), solution:['echo "2 failed logins" > out/summary.txt'] },
    { brief:'Tree the out folder.', hint:'tree out', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('summary.txt'), solution:['tree out'] }
  ]
});

/* F2. Extract the Signal (grep -o) */
SCENARIOS.push({
  id:'extract-signal',
  title:'Extract the Signal',
  icon:'📡',
  difficulty:'Field Agent',
  story:'A noisy log hides useful tokens inside long lines. Pull just the matching pieces out and tally them.',
  brief:'Isolate matches with grep -o, -w, and counts.',
  setup(sh){
    sh.mkdir('~/signal');
    sh.mkfile('~/signal/app.log', [
      'request id=REQ100 status=OK',
      'request id=REQ101 status=ERR',
      'request id=REQ102 status=OK',
      'heartbeat ok',
      'request id=REQ103 status=ERR'
    ].join('\n')+'\n');
  },
  steps:[
    { brief:'Enter the signal folder.', hint:'cd ~/signal', check:(sh)=> cwdIs(sh,'~/signal'), solution:['cd ~/signal'] },
    { brief:'Show the lines that contain "request".', hint:'grep request app.log', check:(sh,ctx)=> ctx.cmd==='grep' && ctx.out.includes('REQ100') && !ctx.out.includes('heartbeat'), solution:['grep request app.log'] },
    { brief:'Count the request lines.', hint:'grep -c request app.log', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.trim()==='4', solution:['grep -c request app.log'] },
    { brief:'Extract just the whole word "ERR" wherever it appears, using grep -ow.', hint:'grep -ow ERR app.log', check:(sh,ctx)=> ctx.line.includes('-o') && ctx.out.trim().split('\n').length===2 && ctx.out.trim().split('\n').every(l=>l==='ERR'), solution:['grep -ow ERR app.log'] },
    { brief:'Extract every REQ id token with grep -oE "REQ[0-9]+".', hint:'grep -oE "REQ[0-9]+" app.log', check:(sh,ctx)=> ctx.line.includes('-o') && ctx.out.includes('REQ100') && ctx.out.includes('REQ103'), solution:['grep -oE "REQ[0-9]+" app.log'] },
    { brief:'Save the extracted ids to ids.txt.', hint:'grep -oE "REQ[0-9]+" app.log > ids.txt', check:(sh)=> isFile(sh,'~/signal/ids.txt') && linecount(sh,'~/signal/ids.txt')===4, solution:['grep -oE "REQ[0-9]+" app.log > ids.txt'] },
    { brief:'Count how many ids you extracted.', hint:'wc -l ids.txt', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('4'), solution:['wc -l ids.txt'] },
    { brief:'How many lines had status OK? (grep -c OK, whole word).', hint:'grep -cw OK app.log', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.trim()==='2', solution:['grep -cw OK app.log'] },
    { brief:'Save only the ERR lines to errors.txt.', hint:'grep ERR app.log > errors.txt', check:(sh)=> isFile(sh,'~/signal/errors.txt') && linecount(sh,'~/signal/errors.txt')===2, solution:['grep ERR app.log > errors.txt'] },
    { brief:'List the signal folder.', hint:'ls', check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.includes('ids.txt') && ctx.out.includes('errors.txt'), solution:['ls'] }
  ]
});

/* F3. Column Keys (sort -t -k) */
SCENARIOS.push({
  id:'column-keys',
  title:'Sort by the Right Column',
  icon:'🗂️',
  difficulty:'Field Agent',
  story:'A scoreboard CSV needs sorting by score, not by name. Learn to sort on a specific key and field separator.',
  brief:'Sort structured data with sort -t and -k.',
  setup(sh){
    sh.mkdir('~/scores');
    sh.mkfile('~/scores/board.csv', ['zoe,42','amy,88','max,15','bea,67','leo,88'].join('\n')+'\n');
  },
  steps:[
    { brief:'Enter the scores folder.', hint:'cd ~/scores', check:(sh)=> cwdIs(sh,'~/scores'), solution:['cd ~/scores'] },
    { brief:'Read the scoreboard.', hint:'cat board.csv', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('amy'), solution:['cat board.csv'] },
    { brief:'Sort alphabetically by name (default sort).', hint:'sort board.csv', check:(sh,ctx)=> ctx.cmd==='sort' && ctx.out.indexOf('amy')<ctx.out.indexOf('zoe'), solution:['sort board.csv'] },
    { brief:'Sort by the score column numerically: sort -t , -k 2 -n.', hint:'sort -t , -k 2 -n board.csv', check:(sh,ctx)=> ctx.line.includes('-k 2') && ctx.out.trim().split('\n')[0].startsWith('max'), solution:['sort -t , -k 2 -n board.csv'] },
    { brief:'Save the ascending-by-score board to by_score.csv.', hint:'sort -t , -k 2 -n board.csv > by_score.csv', check:(sh)=> isFile(sh,'~/scores/by_score.csv') && fileLines(sh.get('~/scores/by_score.csv'))[0].startsWith('max'), solution:['sort -t , -k 2 -n board.csv > by_score.csv'] },
    { brief:'Now sort by score descending with -r into top.csv.', hint:'sort -t , -k 2 -nr board.csv > top.csv', check:(sh)=> isFile(sh,'~/scores/top.csv') && fileLines(sh.get('~/scores/top.csv'))[0].split(',')[1]==='88', solution:['sort -t , -k 2 -nr board.csv > top.csv'] },
    { brief:'Extract just the names column (field 1) from board.csv.', hint:'cut -d , -f 1 board.csv', check:(sh,ctx)=> ctx.cmd==='cut' && ctx.out.includes('zoe'), solution:['cut -d , -f 1 board.csv'] },
    { brief:'How many players scored 88? Count with grep.', hint:'grep -c ,88 board.csv', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.trim()==='2', solution:['grep -c ,88 board.csv'] },
    { brief:'Show the single top scorer (head of the descending list).', hint:'head -n 1 top.csv', check:(sh,ctx)=> ctx.cmd==='head' && ctx.out.includes('88'), solution:['head -n 1 top.csv'] },
    { brief:'Tree the scores folder.', hint:'tree', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('by_score.csv'), solution:['tree'] }
  ]
});

/* F4. Byte Budget (head/tail -c) */
SCENARIOS.push({
  id:'byte-budget',
  title:'The Byte Budget',
  icon:'📏',
  difficulty:'Field Agent',
  story:'A fixed-width export needs trimming to an exact byte budget and a quick measurement pass.',
  brief:'Measure and slice by bytes with wc and head -c.',
  setup(sh){
    sh.mkdir('~/export');
    sh.mkfile('~/export/blob.txt','abcdefghijklmnopqrstuvwxyz\n');
    sh.mkfile('~/export/widths.txt','short\na longer line here\ntiny\n');
  },
  steps:[
    { brief:'Enter the export folder.', hint:'cd ~/export', check:(sh)=> cwdIs(sh,'~/export'), solution:['cd ~/export'] },
    { brief:'Count the bytes in blob.txt.', hint:'wc -c blob.txt', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('27'), solution:['wc -c blob.txt'] },
    { brief:'Take the first 5 bytes of blob.txt.', hint:'head -c 5 blob.txt', check:(sh,ctx)=> ctx.cmd==='head' && ctx.out.replace(/\n$/,'')==='abcde', solution:['head -c 5 blob.txt'] },
    { brief:'Save the first 10 bytes to head10.txt.', hint:'head -c 10 blob.txt > head10.txt', check:(sh)=> isFile(sh,'~/export/head10.txt') && has(sh,'~/export/head10.txt','abcdefghij'), solution:['head -c 10 blob.txt > head10.txt'] },
    { brief:'Measure the longest line in widths.txt with wc -L.', hint:'wc -L widths.txt', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('18'), solution:['wc -L widths.txt'] },
    { brief:'Count the lines in widths.txt.', hint:'wc -l widths.txt', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('3'), solution:['wc -l widths.txt'] },
    { brief:'Count the words in widths.txt.', hint:'wc -w widths.txt', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('6'), solution:['wc -w widths.txt'] },
    { brief:'Reverse the characters of blob.txt with rev into rev.txt.', hint:'rev blob.txt > rev.txt', check:(sh)=> isFile(sh,'~/export/rev.txt') && has(sh,'~/export/rev.txt','zyxwv'), solution:['rev blob.txt > rev.txt'] },
    { brief:'Confirm head10.txt contents.', hint:'cat head10.txt', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('abcdefghij'), solution:['cat head10.txt'] },
    { brief:'List the folder.', hint:'ls', check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.includes('rev.txt'), solution:['ls'] }
  ]
});

/* F5. Dedup the Mailing List (uniq -i) */
SCENARIOS.push({
  id:'mailing-list',
  title:'Clean the Mailing List',
  icon:'📧',
  difficulty:'Field Agent',
  story:'Marketing imported a mailing list full of case-variant duplicates. Normalize and deduplicate it before the send.',
  brief:'Deduplicate case-insensitively with tr, sort, and uniq -i.',
  setup(sh){
    sh.mkdir('~/mail');
    sh.mkfile('~/mail/emails.txt', ['Al@x.com','al@x.com','BOB@x.com','carol@x.com','Bob@x.com','carol@x.com'].join('\n')+'\n');
  },
  steps:[
    { brief:'Enter the mail folder.', hint:'cd ~/mail', check:(sh)=> cwdIs(sh,'~/mail'), solution:['cd ~/mail'] },
    { brief:'Read the raw list.', hint:'cat emails.txt', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('carol@x.com'), solution:['cat emails.txt'] },
    { brief:'Count the raw entries.', hint:'wc -l emails.txt', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('6'), solution:['wc -l emails.txt'] },
    { brief:'Lowercase everything with tr into lower.txt.', hint:'cat emails.txt | tr A-Z a-z > lower.txt', check:(sh)=> isFile(sh,'~/mail/lower.txt') && !has(sh,'~/mail/lower.txt','BOB') && has(sh,'~/mail/lower.txt','bob@x.com'), solution:['cat emails.txt | tr A-Z a-z > lower.txt'] },
    { brief:'Sort and dedupe lower.txt into clean.txt.', hint:'sort -u lower.txt > clean.txt', check:(sh)=> isFile(sh,'~/mail/clean.txt') && linecount(sh,'~/mail/clean.txt')===3, solution:['sort -u lower.txt > clean.txt'] },
    { brief:'Count how many unique addresses remain.', hint:'wc -l clean.txt', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('3'), solution:['wc -l clean.txt'] },
    { brief:'Show case-insensitive duplicates on the sorted raw list with uniq -i -d.', hint:'sort emails.txt | uniq -i -d', check:(sh,ctx)=> ctx.line.includes('uniq') && ctx.out.length>0, solution:['sort emails.txt | uniq -i -d'] },
    { brief:'Which addresses are on domain x.com? Count them in clean.txt.', hint:'grep -c x.com clean.txt', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.trim()==='3', solution:['grep -c x.com clean.txt'] },
    { brief:'Back up the clean list to clean.bak.', hint:'cp clean.txt clean.bak', check:(sh)=> isFile(sh,'~/mail/clean.bak'), solution:['cp clean.txt clean.bak'] },
    { brief:'Read the final clean list.', hint:'cat clean.txt', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('carol@x.com'), solution:['cat clean.txt'] }
  ]
});

/* F6. Safe Copy (cp -n) */
SCENARIOS.push({
  id:'safe-copy',
  title:'Safe Copy',
  icon:'🧷',
  difficulty:'Field Agent',
  story:'You are syncing config into a destination that already has some files. Copy without clobbering what is already there.',
  brief:'Use cp -n (no-clobber) and verify untouched files.',
  setup(sh){
    sh.mkdir('~/src'); sh.mkdir('~/dst');
    sh.mkfile('~/src/a.conf','new-a\n');
    sh.mkfile('~/src/b.conf','new-b\n');
    sh.mkfile('~/src/c.conf','new-c\n');
    sh.mkfile('~/dst/a.conf','ORIGINAL-a\n');
  },
  steps:[
    { brief:'Go to your home.', hint:'cd ~', check:(sh)=> cwdIs(sh,'~'), solution:['cd ~'] },
    { brief:'List what is already in dst.', hint:'ls dst', check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.includes('a.conf'), solution:['ls dst'] },
    { brief:'Confirm the existing a.conf content.', hint:'cat dst/a.conf', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('ORIGINAL-a'), solution:['cat dst/a.conf'] },
    { brief:'Copy b.conf into dst.', hint:'cp src/b.conf dst/', check:(sh)=> isFile(sh,'~/dst/b.conf') && has(sh,'~/dst/b.conf','new-b'), solution:['cp src/b.conf dst/'] },
    { brief:'Copy c.conf into dst.', hint:'cp src/c.conf dst/', check:(sh)=> isFile(sh,'~/dst/c.conf'), solution:['cp src/c.conf dst/'] },
    { brief:'Now sync a.conf WITHOUT overwriting the original (cp -n).', hint:'cp -n src/a.conf dst/', check:(sh)=> has(sh,'~/dst/a.conf','ORIGINAL-a'), solution:['cp -n src/a.conf dst/'] },
    { brief:'Verify a.conf still holds the original content.', hint:'cat dst/a.conf', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('ORIGINAL-a') && !ctx.out.includes('new-a'), solution:['cat dst/a.conf'] },
    { brief:'Count how many files are now in dst.', hint:'ls dst | wc -l', check:(sh,ctx)=> ctx.line.includes('dst') && ctx.out.trim()==='3', solution:['ls dst | wc -l'] },
    { brief:'Tree the dst folder.', hint:'tree dst', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('c.conf'), solution:['tree dst'] }
  ]
});

/* F7. Depth-Limited Search (find -maxdepth) */
SCENARIOS.push({
  id:'shallow-search',
  title:'Shallow Search',
  icon:'🔦',
  difficulty:'Field Agent',
  story:'A deep project tree is slow to scan. Limit your searches to the top levels to find configs fast.',
  brief:'Search efficiently with find -maxdepth and -type.',
  setup(sh){
    sh.mkdir('~/proj/a/b/c');
    sh.mkfile('~/proj/root.conf','root\n');
    sh.mkfile('~/proj/a/mid.conf','mid\n');
    sh.mkfile('~/proj/a/b/deep.conf','deep\n');
    sh.mkfile('~/proj/a/b/c/deepest.conf','deepest\n');
    sh.mkfile('~/proj/a/notes.txt','notes\n');
  },
  steps:[
    { brief:'Enter the proj folder.', hint:'cd ~/proj', check:(sh)=> cwdIs(sh,'~/proj'), solution:['cd ~/proj'] },
    { brief:'Find all .conf files anywhere in the tree.', hint:'find . -name "*.conf"', check:(sh,ctx)=> ctx.cmd==='find' && ctx.out.includes('deepest.conf') && ctx.out.includes('root.conf'), solution:['find . -name "*.conf"'] },
    { brief:'Now find .conf files only at the top level (maxdepth 1).', hint:'find . -maxdepth 1 -name "*.conf"', check:(sh,ctx)=> ctx.line.includes('-maxdepth') && ctx.out.includes('root.conf') && !ctx.out.includes('mid.conf'), solution:['find . -maxdepth 1 -name "*.conf"'] },
    { brief:'Find .conf files down to depth 2.', hint:'find . -maxdepth 2 -name "*.conf"', check:(sh,ctx)=> ctx.line.includes('-maxdepth 2') && ctx.out.includes('mid.conf') && !ctx.out.includes('deep.conf'), solution:['find . -maxdepth 2 -name "*.conf"'] },
    { brief:'Find all directories at depth 1.', hint:'find . -maxdepth 1 -type d', check:(sh,ctx)=> ctx.line.includes('-maxdepth 1') && ctx.out.includes('./a'), solution:['find . -maxdepth 1 -type d'] },
    { brief:'Save the top-level conf list to top_confs.txt.', hint:'find . -maxdepth 1 -name "*.conf" > top_confs.txt', check:(sh)=> isFile(sh,'~/proj/top_confs.txt') && has(sh,'~/proj/top_confs.txt','root.conf'), solution:['find . -maxdepth 1 -name "*.conf" > top_confs.txt'] },
    { brief:'Count all .conf files in the tree.', hint:'find . -name "*.conf" | wc -l', check:(sh,ctx)=> ctx.line.includes('wc') && ctx.out.trim()==='4', solution:['find . -name "*.conf" | wc -l'] },
    { brief:'Read the deepest config.', hint:'cat a/b/c/deepest.conf', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('deepest'), solution:['cat a/b/c/deepest.conf'] },
    { brief:'Tree the proj folder.', hint:'tree', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('deepest.conf'), solution:['tree'] }
  ]
});

/* F8. Invoice Math */
SCENARIOS.push({
  id:'invoice-math',
  title:'Invoice Reconciliation',
  icon:'🧾',
  difficulty:'Field Agent',
  story:'Finance handed you a pipe-delimited invoice dump. Extract amounts, sort them, and flag the big ones.',
  brief:'Process delimited data with cut, sort -n, and grep.',
  setup(sh){
    sh.mkdir('~/finance');
    sh.mkfile('~/finance/invoices.txt', ['INV1|acme|120','INV2|globex|999','INV3|acme|45','INV4|initech|300','INV5|globex|999'].join('\n')+'\n');
    sh.mkdir('~/finance/out');
  },
  steps:[
    { brief:'Enter the finance folder.', hint:'cd ~/finance', check:(sh)=> cwdIs(sh,'~/finance'), solution:['cd ~/finance'] },
    { brief:'Read the invoices.', hint:'cat invoices.txt', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('globex'), solution:['cat invoices.txt'] },
    { brief:'Extract the amount column (field 3, pipe-delimited).', hint:'cut -d "|" -f 3 invoices.txt', check:(sh,ctx)=> ctx.cmd==='cut' && ctx.out.includes('999') && ctx.out.includes('45'), solution:['cut -d "|" -f 3 invoices.txt'] },
    { brief:'List the amounts sorted numerically into amounts.txt.', hint:'cut -d "|" -f 3 invoices.txt | sort -n > amounts.txt', check:(sh)=> isFile(sh,'~/finance/amounts.txt') && fileLines(sh.get('~/finance/amounts.txt'))[0]==='45', solution:['cut -d "|" -f 3 invoices.txt | sort -n > amounts.txt'] },
    { brief:'List the distinct amounts, numeric, unique.', hint:'cut -d "|" -f 3 invoices.txt | sort -nu', check:(sh,ctx)=> ctx.line.includes('sort -nu') && ctx.out.split('\n').filter(Boolean).join(',')==='45,120,300,999', solution:['cut -d "|" -f 3 invoices.txt | sort -nu'] },
    { brief:'Sort the whole file by amount (field 3) descending into by_amount.txt.', hint:'sort -t "|" -k 3 -nr invoices.txt > by_amount.txt', check:(sh)=> isFile(sh,'~/finance/by_amount.txt') && fileLines(sh.get('~/finance/by_amount.txt'))[0].includes('999'), solution:['sort -t "|" -k 3 -nr invoices.txt > by_amount.txt'] },
    { brief:'How many invoices are from globex? Count them.', hint:'grep -c globex invoices.txt', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.trim()==='2', solution:['grep -c globex invoices.txt'] },
    { brief:'Save the globex invoices to out/globex.txt.', hint:'grep globex invoices.txt > out/globex.txt', check:(sh)=> isFile(sh,'~/finance/out/globex.txt') && linecount(sh,'~/finance/out/globex.txt')===2, solution:['grep globex invoices.txt > out/globex.txt'] },
    { brief:'Show the top invoice by amount.', hint:'head -n 1 by_amount.txt', check:(sh,ctx)=> ctx.cmd==='head' && ctx.out.includes('999'), solution:['head -n 1 by_amount.txt'] },
    { brief:'Tree the finance folder.', hint:'tree', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('amounts.txt'), solution:['tree'] }
  ]
});

/* F9. Template Factory (echo -e, basename, dirname) */
SCENARIOS.push({
  id:'template-factory',
  title:'The Template Factory',
  icon:'🏭',
  difficulty:'Field Agent',
  story:'Stamp out a few boilerplate files with multi-line content, and learn to pull paths apart.',
  brief:'Generate multi-line files with echo -e and inspect paths with basename/dirname.',
  setup(sh){
    sh.mkdir('~/factory');
  },
  steps:[
    { brief:'Enter the factory folder.', hint:'cd ~/factory', check:(sh)=> cwdIs(sh,'~/factory'), solution:['cd ~/factory'] },
    { brief:'Create a 3-line README using echo -e: "# Title\\nline1\\nline2".', hint:'echo -e "# Title\\nline1\\nline2" > README.md', check:(sh)=> isFile(sh,'~/factory/README.md') && linecount(sh,'~/factory/README.md')===3, solution:['echo -e "# Title\\nline1\\nline2" > README.md'] },
    { brief:'Confirm the README has 3 lines.', hint:'wc -l README.md', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('3'), solution:['wc -l README.md'] },
    { brief:'Create a tab-separated row with echo -e: "name\\tvalue" into row.tsv.', hint:'echo -e "name\\tvalue" > row.tsv', check:(sh)=> isFile(sh,'~/factory/row.tsv') && has(sh,'~/factory/row.tsv','name\tvalue'), solution:['echo -e "name\\tvalue" > row.tsv'] },
    { brief:'Extract the first tab field from row.tsv with cut.', hint:'cut -f 1 row.tsv', check:(sh,ctx)=> ctx.cmd==='cut' && ctx.out.includes('name'), solution:['cut -f 1 row.tsv'] },
    { brief:'Get the base filename of /etc/nginx/nginx.conf with basename.', hint:'basename /etc/nginx/nginx.conf', check:(sh,ctx)=> ctx.cmd==='basename' && ctx.out.trim()==='nginx.conf', solution:['basename /etc/nginx/nginx.conf'] },
    { brief:'Strip the .conf suffix: basename /etc/nginx/nginx.conf .conf.', hint:'basename /etc/nginx/nginx.conf .conf', check:(sh,ctx)=> ctx.cmd==='basename' && ctx.out.trim()==='nginx', solution:['basename /etc/nginx/nginx.conf .conf'] },
    { brief:'Get the directory of /etc/nginx/nginx.conf with dirname.', hint:'dirname /etc/nginx/nginx.conf', check:(sh,ctx)=> ctx.cmd==='dirname' && ctx.out.trim()==='/etc/nginx', solution:['dirname /etc/nginx/nginx.conf'] },
    { brief:'Make a copy of README.md as README.bak.', hint:'cp README.md README.bak', check:(sh)=> isFile(sh,'~/factory/README.bak'), solution:['cp README.md README.bak'] },
    { brief:'List the factory folder.', hint:'ls', check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.includes('row.tsv') && ctx.out.includes('README.md'), solution:['ls'] }
  ]
});

/* F10. Rotate the Logs */
SCENARIOS.push({
  id:'rotate-logs',
  title:'Rotate the Logs',
  icon:'🔄',
  difficulty:'Field Agent',
  story:'Nightly log rotation is manual tonight. Archive the current log, start a fresh one, and prune the oldest.',
  brief:'Rotate files with mv, cp, touch, and rm.',
  setup(sh){
    sh.mkdir('~/logs');
    sh.mkfile('~/logs/app.log', 'line1\nline2\nline3\n');
    sh.mkfile('~/logs/app.log.1', 'old1\n');
    sh.mkfile('~/logs/app.log.2', 'old2\n');
    sh.mkfile('~/logs/app.log.3', 'oldest\n');
  },
  steps:[
    { brief:'Enter the logs folder.', hint:'cd ~/logs', check:(sh)=> cwdIs(sh,'~/logs'), solution:['cd ~/logs'] },
    { brief:'List the rotation set.', hint:'ls', check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.includes('app.log.3'), solution:['ls'] },
    { brief:'The oldest, app.log.3, is past retention. Delete it.', hint:'rm app.log.3', check:(sh)=> !exists(sh,'~/logs/app.log.3'), solution:['rm app.log.3'] },
    { brief:'Age app.log.2 to app.log.3.', hint:'mv app.log.2 app.log.3', check:(sh)=> isFile(sh,'~/logs/app.log.3') && !exists(sh,'~/logs/app.log.2'), solution:['mv app.log.2 app.log.3'] },
    { brief:'Age app.log.1 to app.log.2.', hint:'mv app.log.1 app.log.2', check:(sh)=> isFile(sh,'~/logs/app.log.2') && !exists(sh,'~/logs/app.log.1'), solution:['mv app.log.1 app.log.2'] },
    { brief:'Archive the current log: move app.log to app.log.1.', hint:'mv app.log app.log.1', check:(sh)=> isFile(sh,'~/logs/app.log.1') && !exists(sh,'~/logs/app.log'), solution:['mv app.log app.log.1'] },
    { brief:'Start a fresh empty app.log.', hint:'touch app.log', check:(sh)=> isFile(sh,'~/logs/app.log') && linecount(sh,'~/logs/app.log')===0, solution:['touch app.log'] },
    { brief:'Confirm the archived log kept its 3 lines.', hint:'wc -l app.log.1', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('3'), solution:['wc -l app.log.1'] },
    { brief:'Count how many rotation files remain (app.log*).', hint:'ls app.log* | wc -l', check:(sh,ctx)=> ctx.line.includes('app.log') && ctx.out.trim()==='4', solution:['ls app.log* | wc -l'] },
    { brief:'Tree the logs folder.', hint:'tree', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('app.log.3'), solution:['tree'] }
  ]
});

/* ================================================================== *
 *  NEW SCENARIOS — SPECIALIST (10)
 * ================================================================== */

/* S1. Access Log Forensics */
SCENARIOS.push({
  id:'access-forensics',
  title:'Access Log Forensics',
  icon:'🔬',
  difficulty:'Specialist',
  story:'A spike in traffic needs explaining. Dissect the access log: top IPs, status distribution, and the busiest path.',
  brief:'Multi-stage analysis with cut, sort, uniq -c, grep, and redirection.',
  setup(sh){
    sh.mkdir('~/forensics');
    const rows=[
      '10.0.0.1 GET /home 200','10.0.0.2 GET /login 200','10.0.0.1 POST /login 401',
      '10.0.0.1 GET /home 200','10.0.0.3 GET /home 200','10.0.0.2 POST /login 401',
      '10.0.0.1 GET /cart 500','10.0.0.1 GET /home 200','10.0.0.2 GET /home 200'
    ];
    sh.mkfile('~/forensics/access.log', rows.join('\n')+'\n');
    sh.mkdir('~/forensics/out');
  },
  steps:[
    { brief:'Enter the forensics folder.', hint:'cd ~/forensics', check:(sh)=> cwdIs(sh,'~/forensics'), solution:['cd ~/forensics'] },
    { brief:'Count total requests.', hint:'wc -l access.log', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('9'), solution:['wc -l access.log'] },
    { brief:'Extract the IP column (field 1).', hint:'cut -d " " -f 1 access.log', check:(sh,ctx)=> ctx.cmd==='cut' && ctx.out.includes('10.0.0.1'), solution:['cut -d " " -f 1 access.log'] },
    { brief:'Tally requests per IP: cut IP, sort, uniq -c into out/ips.txt.', hint:'cut -d " " -f 1 access.log | sort | uniq -c > out/ips.txt', check:(sh)=> isFile(sh,'~/forensics/out/ips.txt') && has(sh,'~/forensics/out/ips.txt','10.0.0.1'), solution:['cut -d " " -f 1 access.log | sort | uniq -c > out/ips.txt'] },
    { brief:'Find the busiest IP: tally, sort by count descending, keep the top line.', hint:'cut -d " " -f 1 access.log | sort | uniq -c | sort -nr | head -n 1', check:(sh,ctx)=> ctx.line.includes('uniq -c') && ctx.line.includes('sort -nr') && ctx.out.includes('10.0.0.1'), solution:['cut -d " " -f 1 access.log | sort | uniq -c | sort -nr | head -n 1'] },
    { brief:'How many requests returned 200? Count with grep -w.', hint:'grep -cw 200 access.log', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.trim()==='6', solution:['grep -cw 200 access.log'] },
    { brief:'Tally the status codes (field 4) into out/status.txt.', hint:'cut -d " " -f 4 access.log | sort | uniq -c > out/status.txt', check:(sh)=> isFile(sh,'~/forensics/out/status.txt') && has(sh,'~/forensics/out/status.txt','200'), solution:['cut -d " " -f 4 access.log | sort | uniq -c > out/status.txt'] },
    { brief:'Save all the error (401 or 500) lines to out/errors.log.', hint:'grep -E "401|500" access.log > out/errors.log', check:(sh)=> isFile(sh,'~/forensics/out/errors.log') && linecount(sh,'~/forensics/out/errors.log')===3, solution:['grep -E "401|500" access.log > out/errors.log'] },
    { brief:'Write the headline "top IP 10.0.0.1" into out/summary.txt.', hint:'echo "top IP 10.0.0.1" > out/summary.txt', check:(sh)=> has(sh,'~/forensics/out/summary.txt','top IP 10.0.0.1'), solution:['echo "top IP 10.0.0.1" > out/summary.txt'] },
    { brief:'Tree the out folder.', hint:'tree out', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('status.txt'), solution:['tree out'] }
  ]
});

/* S2. CSV Surgeon */
SCENARIOS.push({
  id:'csv-surgeon',
  title:'CSV Surgeon',
  icon:'📊',
  difficulty:'Specialist',
  story:'A sales CSV needs reshaping: pull select columns, sort by revenue, and summarize per region — all in the shell.',
  brief:'Reshape CSV data with cut, sort -t -k, uniq, and pipes.',
  setup(sh){
    sh.mkdir('~/sales');
    sh.mkfile('~/sales/data.csv', ['region,rep,amount','west,amy,300','east,bob,150','west,cal,450','east,dan,150','west,amy,200','south,eve,500'].join('\n')+'\n');
    sh.mkdir('~/sales/out');
  },
  steps:[
    { brief:'Enter the sales folder.', hint:'cd ~/sales', check:(sh)=> cwdIs(sh,'~/sales'), solution:['cd ~/sales'] },
    { brief:'Read the data.', hint:'cat data.csv', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('west'), solution:['cat data.csv'] },
    { brief:'Extract region and amount (fields 1 and 3).', hint:'cut -d , -f 1,3 data.csv', check:(sh,ctx)=> ctx.cmd==='cut' && ctx.out.includes('west,300'), solution:['cut -d , -f 1,3 data.csv'] },
    { brief:'List the distinct regions (field 1), skip header, sorted into out/regions.txt.', hint:'cut -d , -f 1 data.csv | grep -v region | sort -u > out/regions.txt', check:(sh)=>{ const ls=fileLines(sh.get('~/sales/out/regions.txt')||{type:'file',content:''}); return ls.length===3 && ls.includes('west') && ls.includes('south'); }, solution:['cut -d , -f 1 data.csv | grep -v region | sort -u > out/regions.txt'] },
    { brief:'Sort the rows by amount descending (field 3) into out/by_amount.csv.', hint:'sort -t , -k 3 -nr data.csv > out/by_amount.csv', check:(sh)=> isFile(sh,'~/sales/out/by_amount.csv') && fileLines(sh.get('~/sales/out/by_amount.csv'))[0].includes('500'), solution:['sort -t , -k 3 -nr data.csv > out/by_amount.csv'] },
    { brief:'Count rows per region: cut region, skip header, sort, uniq -c into out/per_region.txt.', hint:'cut -d , -f 1 data.csv | grep -v region | sort | uniq -c > out/per_region.txt', check:(sh)=> isFile(sh,'~/sales/out/per_region.txt') && has(sh,'~/sales/out/per_region.txt','west'), solution:['cut -d , -f 1 data.csv | grep -v region | sort | uniq -c > out/per_region.txt'] },
    { brief:'How many west rows are there? Count with grep.', hint:'grep -c "^west," data.csv', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.trim()==='3', solution:['grep -c "^west," data.csv'] },
    { brief:'Save just the west rows to out/west.csv.', hint:'grep "^west," data.csv > out/west.csv', check:(sh)=> isFile(sh,'~/sales/out/west.csv') && linecount(sh,'~/sales/out/west.csv')===3, solution:['grep "^west," data.csv > out/west.csv'] },
    { brief:'Show the single top sale.', hint:'head -n 1 out/by_amount.csv', check:(sh,ctx)=> ctx.cmd==='head' && ctx.out.includes('500'), solution:['head -n 1 out/by_amount.csv'] },
    { brief:'Tree the out folder.', hint:'tree out', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('per_region.txt'), solution:['tree out'] }
  ]
});

/* S3. Dependency Untangler */
SCENARIOS.push({
  id:'dep-untangler',
  title:'Dependency Untangler',
  icon:'🧶',
  difficulty:'Specialist',
  story:'A build manifest lists dependencies with duplicates and version noise. Produce a clean, sorted, unique dependency set.',
  brief:'Normalize and dedupe lists with grep, cut, sort, uniq.',
  setup(sh){
    sh.mkdir('~/build');
    sh.mkfile('~/build/deps.txt', ['react@18','lodash@4','react@18','axios@1','lodash@4','# comment','express@4','axios@1'].join('\n')+'\n');
    sh.mkdir('~/build/out');
  },
  steps:[
    { brief:'Enter the build folder.', hint:'cd ~/build', check:(sh)=> cwdIs(sh,'~/build'), solution:['cd ~/build'] },
    { brief:'Read the raw deps.', hint:'cat deps.txt', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('react@18'), solution:['cat deps.txt'] },
    { brief:'Count the raw lines.', hint:'wc -l deps.txt', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('8'), solution:['wc -l deps.txt'] },
    { brief:'Drop the comment lines (starting with #) using grep -v.', hint:'grep -v "^#" deps.txt', check:(sh,ctx)=> /grep/.test(ctx.line) && !ctx.out.includes('# comment') && ctx.out.includes('react@18'), solution:['grep -v "^#" deps.txt'] },
    { brief:'Produce the clean, sorted, unique dep list into out/clean.txt.', hint:'grep -v "^#" deps.txt | sort -u > out/clean.txt', check:(sh)=> isFile(sh,'~/build/out/clean.txt') && linecount(sh,'~/build/out/clean.txt')===4, solution:['grep -v "^#" deps.txt | sort -u > out/clean.txt'] },
    { brief:'Count the unique dependencies.', hint:'wc -l out/clean.txt', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('4'), solution:['wc -l out/clean.txt'] },
    { brief:'Extract just the package names (before @) with cut.', hint:'cut -d @ -f 1 out/clean.txt', check:(sh,ctx)=> ctx.cmd==='cut' && ctx.out.includes('react') && !ctx.out.includes('@'), solution:['cut -d @ -f 1 out/clean.txt'] },
    { brief:'Save the bare package names to out/names.txt.', hint:'cut -d @ -f 1 out/clean.txt | sort > out/names.txt', check:(sh)=> isFile(sh,'~/build/out/names.txt') && has(sh,'~/build/out/names.txt','express'), solution:['cut -d @ -f 1 out/clean.txt | sort > out/names.txt'] },
    { brief:'Find the duplicated raw entries: sort then uniq -d.', hint:'sort deps.txt | uniq -d', check:(sh,ctx)=> ctx.line.includes('uniq -d') && ctx.out.includes('@'), solution:['sort deps.txt | uniq -d'] },
    { brief:'Tree the out folder.', hint:'tree out', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('clean.txt'), solution:['tree out'] }
  ]
});

/* S4. The Refactor */
SCENARIOS.push({
  id:'the-refactor',
  title:'The Big Refactor',
  icon:'♻️',
  difficulty:'Specialist',
  story:'A rename ripples across the codebase: the old function name must become the new one in every source file, with backups.',
  brief:'Rename symbols across files with sed -i, grep -r, and backups.',
  setup(sh){
    sh.mkdir('~/code/src');
    sh.mkfile('~/code/src/main.js', 'import {fetchData} from "./api"\nfetchData()\n');
    sh.mkfile('~/code/src/api.js', 'export function fetchData(){ return 1 }\n');
    sh.mkfile('~/code/src/util.js', 'const x = 1\n');
    sh.mkdir('~/code/backup');
  },
  steps:[
    { brief:'Enter the code folder.', hint:'cd ~/code', check:(sh)=> cwdIs(sh,'~/code'), solution:['cd ~/code'] },
    { brief:'Find every usage of fetchData recursively.', hint:'grep -r fetchData src', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.includes('main.js') && ctx.out.includes('api.js'), solution:['grep -r fetchData src'] },
    { brief:'Count how many files mention fetchData (recursive count).', hint:'grep -rc fetchData src', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.includes('2'), solution:['grep -rc fetchData src'] },
    { brief:'Back up main.js before editing.', hint:'cp src/main.js backup/main.js', check:(sh)=> isFile(sh,'~/code/backup/main.js'), solution:['cp src/main.js backup/main.js'] },
    { brief:'Back up api.js too.', hint:'cp src/api.js backup/api.js', check:(sh)=> isFile(sh,'~/code/backup/api.js'), solution:['cp src/api.js backup/api.js'] },
    { brief:'Rename fetchData to loadData in main.js (in place, global).', hint:'sed -i s/fetchData/loadData/g src/main.js', check:(sh)=> has(sh,'~/code/src/main.js','loadData') && !has(sh,'~/code/src/main.js','fetchData'), solution:['sed -i s/fetchData/loadData/g src/main.js'] },
    { brief:'Rename it in api.js too.', hint:'sed -i s/fetchData/loadData/g src/api.js', check:(sh)=> has(sh,'~/code/src/api.js','loadData') && !has(sh,'~/code/src/api.js','fetchData'), solution:['sed -i s/fetchData/loadData/g src/api.js'] },
    { brief:'Verify no fetchData remains in src (recursive grep finds nothing).', hint:'grep -r fetchData src', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.code===1, solution:['grep -r fetchData src'] },
    { brief:'Confirm loadData is now present in src.', hint:'grep -r loadData src', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.includes('loadData'), solution:['grep -r loadData src'] },
    { brief:'Tree the code folder.', hint:'tree', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('backup'), solution:['tree'] }
  ]
});

/* S5. Report Builder */
SCENARIOS.push({
  id:'report-builder',
  title:'The Report Builder',
  icon:'📈',
  difficulty:'Specialist',
  story:'Assemble a daily metrics report by combining several data snippets, numbering sections, and finalizing a read-only copy.',
  brief:'Assemble documents with cat, nl, sed, and chmod.',
  setup(sh){
    sh.mkdir('~/report/parts');
    sh.mkfile('~/report/parts/users.txt','users: 1200\n');
    sh.mkfile('~/report/parts/errors.txt','errors: 5\n');
    sh.mkfile('~/report/parts/latency.txt','latency: 120ms\n');
    sh.mkfile('~/report/template.txt','DAILY REPORT - DATE\nstatus: DRAFT\n');
  },
  steps:[
    { brief:'Enter the report folder.', hint:'cd ~/report', check:(sh)=> cwdIs(sh,'~/report'), solution:['cd ~/report'] },
    { brief:'List the parts.', hint:'ls parts', check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.includes('users.txt'), solution:['ls parts'] },
    { brief:'Combine the three parts into body.txt (users, errors, latency).', hint:'cat parts/users.txt parts/errors.txt parts/latency.txt > body.txt', check:(sh)=> isFile(sh,'~/report/body.txt') && linecount(sh,'~/report/body.txt')===3 && has(sh,'~/report/body.txt','latency'), solution:['cat parts/users.txt parts/errors.txt parts/latency.txt > body.txt'] },
    { brief:'Number the lines of body.txt into numbered.txt.', hint:'nl body.txt > numbered.txt', check:(sh)=> isFile(sh,'~/report/numbered.txt') && has(sh,'~/report/numbered.txt','users'), solution:['nl body.txt > numbered.txt'] },
    { brief:'Fill the date in the template: replace DATE with 2035-01-01 in place.', hint:'sed -i s/DATE/2035-01-01/ template.txt', check:(sh)=> has(sh,'~/report/template.txt','2035-01-01'), solution:['sed -i s/DATE/2035-01-01/ template.txt'] },
    { brief:'Promote the template from DRAFT to FINAL in place.', hint:'sed -i s/DRAFT/FINAL/ template.txt', check:(sh)=> has(sh,'~/report/template.txt','FINAL') && !has(sh,'~/report/template.txt','DRAFT'), solution:['sed -i s/DRAFT/FINAL/ template.txt'] },
    { brief:'Assemble the final report: template header then the body into report.txt.', hint:'cat template.txt body.txt > report.txt', check:(sh)=> isFile(sh,'~/report/report.txt') && has(sh,'~/report/report.txt','FINAL') && has(sh,'~/report/report.txt','users: 1200'), solution:['cat template.txt body.txt > report.txt'] },
    { brief:'Count the total lines in the final report.', hint:'wc -l report.txt', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('5'), solution:['wc -l report.txt'] },
    { brief:'Make the report read-only (chmod 444).', hint:'chmod 444 report.txt', check:(sh)=> mode(sh,'~/report/report.txt')===0o444, solution:['chmod 444 report.txt'] },
    { brief:'Read the finished report.', hint:'cat report.txt', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('2035-01-01') && ctx.out.includes('errors: 5'), solution:['cat report.txt'] }
  ]
});

/* S6. Quarantine Protocol */
SCENARIOS.push({
  id:'quarantine',
  title:'Quarantine Protocol',
  icon:'☣️',
  difficulty:'Specialist',
  story:'Scanner flagged suspicious files scattered in a workspace. Isolate them into quarantine, lock them down, and log what you moved.',
  brief:'Isolate and lock files with find, mv, chmod, and manifests.',
  setup(sh){
    sh.mkdir('~/ws/sub');
    sh.mkfile('~/ws/report.doc','clean\n');
    sh.mkfile('~/ws/evil.exe','malware\n');
    sh.mkfile('~/ws/sub/trojan.exe','malware2\n');
    sh.mkfile('~/ws/sub/notes.txt','clean notes\n');
    sh.mkdir('~/quarantine');
  },
  steps:[
    { brief:'Enter the workspace.', hint:'cd ~/ws', check:(sh)=> cwdIs(sh,'~/ws'), solution:['cd ~/ws'] },
    { brief:'Find every .exe in the workspace tree.', hint:'find . -name "*.exe"', check:(sh,ctx)=> ctx.cmd==='find' && ctx.out.includes('evil.exe') && ctx.out.includes('trojan.exe'), solution:['find . -name "*.exe"'] },
    { brief:'Record the suspicious list into ~/quarantine/manifest.txt.', hint:'find . -name "*.exe" > ~/quarantine/manifest.txt', check:(sh)=> isFile(sh,'~/quarantine/manifest.txt') && linecount(sh,'~/quarantine/manifest.txt')===2, solution:['find . -name "*.exe" > ~/quarantine/manifest.txt'] },
    { brief:'Move the top-level evil.exe into quarantine.', hint:'mv evil.exe ~/quarantine/', check:(sh)=> isFile(sh,'~/quarantine/evil.exe') && !exists(sh,'~/ws/evil.exe'), solution:['mv evil.exe ~/quarantine/'] },
    { brief:'Move the nested trojan.exe into quarantine.', hint:'mv sub/trojan.exe ~/quarantine/', check:(sh)=> isFile(sh,'~/quarantine/trojan.exe') && !exists(sh,'~/ws/sub/trojan.exe'), solution:['mv sub/trojan.exe ~/quarantine/'] },
    { brief:'Confirm no .exe remain in the workspace.', hint:'find . -name "*.exe"', check:(sh,ctx)=> ctx.cmd==='find' && ctx.out.trim()==='', solution:['find . -name "*.exe"'] },
    { brief:'Lock the quarantine folder so nothing executes: chmod -R 400.', hint:'chmod -R 400 ~/quarantine', check:(sh)=> mode(sh,'~/quarantine/evil.exe')===0o400 && mode(sh,'~/quarantine/trojan.exe')===0o400, solution:['chmod -R 400 ~/quarantine'] },
    { brief:'Count the quarantined files.', hint:'ls ~/quarantine | wc -l', check:(sh,ctx)=> ctx.line.includes('quarantine') && ctx.out.trim()==='3', solution:['ls ~/quarantine | wc -l'] },
    { brief:'Append "quarantine complete" to the manifest.', hint:'echo "quarantine complete" >> ~/quarantine/manifest.txt', check:(sh)=> has(sh,'~/quarantine/manifest.txt','quarantine complete'), solution:['echo "quarantine complete" >> ~/quarantine/manifest.txt'] },
    { brief:'Tree the quarantine folder.', hint:'tree ~/quarantine', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('manifest.txt'), solution:['tree ~/quarantine'] }
  ]
});

/* S7. Word Frequency */
SCENARIOS.push({
  id:'word-frequency',
  title:'Word Frequency',
  icon:'🔠',
  difficulty:'Specialist',
  story:'An editor wants the most common words in a passage. Normalize case, split into words, and rank them by frequency.',
  brief:'Classic word-frequency pipeline with tr, sort, uniq -c.',
  setup(sh){
    sh.mkdir('~/text');
    sh.mkfile('~/text/passage.txt','the cat sat\nThe dog ran\nthe CAT jumped\nthe end\n');
  },
  steps:[
    { brief:'Enter the text folder.', hint:'cd ~/text', check:(sh)=> cwdIs(sh,'~/text'), solution:['cd ~/text'] },
    { brief:'Read the passage.', hint:'cat passage.txt', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('cat'), solution:['cat passage.txt'] },
    { brief:'Lowercase the passage with tr into lower.txt.', hint:'cat passage.txt | tr A-Z a-z > lower.txt', check:(sh)=> isFile(sh,'~/text/lower.txt') && has(sh,'~/text/lower.txt','the cat sat') && !has(sh,'~/text/lower.txt','The'), solution:['cat passage.txt | tr A-Z a-z > lower.txt'] },
    { brief:'Split into one word per line: translate spaces to newlines into words.txt.', hint:'cat lower.txt | tr " " "\\n" > words.txt', check:(sh)=> isFile(sh,'~/text/words.txt') && linecount(sh,'~/text/words.txt')>8, solution:['cat lower.txt | tr " " "\\n" > words.txt'] },
    { brief:'Count how many total words there are.', hint:'wc -l words.txt', check:(sh,ctx)=> ctx.cmd==='wc' && parseInt(ctx.out.trim())>=10, solution:['wc -l words.txt'] },
    { brief:'Tally word frequencies: sort then uniq -c into freq.txt.', hint:'sort words.txt | uniq -c > freq.txt', check:(sh)=> isFile(sh,'~/text/freq.txt') && has(sh,'~/text/freq.txt','the'), solution:['sort words.txt | uniq -c > freq.txt'] },
    { brief:'Rank the frequencies, most common first (sort -nr).', hint:'sort -nr freq.txt', check:(sh,ctx)=> ctx.line.includes('sort -nr') && ctx.out.includes('the'), solution:['sort -nr freq.txt'] },
    { brief:'Keep only the single most common word line into top.txt.', hint:'sort -nr freq.txt | head -n 1 > top.txt', check:(sh)=> isFile(sh,'~/text/top.txt') && has(sh,'~/text/top.txt','the'), solution:['sort -nr freq.txt | head -n 1 > top.txt'] },
    { brief:'How many times does "cat" appear? Count whole-word in words.txt.', hint:'grep -cw cat words.txt', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.trim()==='2', solution:['grep -cw cat words.txt'] },
    { brief:'Tree the text folder.', hint:'tree', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('freq.txt'), solution:['tree'] }
  ]
});

/* S8. The Staging Pipeline */
SCENARIOS.push({
  id:'staging-pipeline',
  title:'The Staging Pipeline',
  icon:'🚦',
  difficulty:'Specialist',
  story:'Promote a build from source to a staging directory: select the right files, transform a config, and freeze the result.',
  brief:'Stage a release with find, cp, sed, chmod, and verification.',
  setup(sh){
    sh.mkdir('~/app/src');
    sh.mkfile('~/app/src/index.html','<h1>App</h1>\n');
    sh.mkfile('~/app/src/app.js','var env="dev";\n');
    sh.mkfile('~/app/src/style.css','body{}\n');
    sh.mkfile('~/app/src/debug.log','noise\n');
    sh.mkfile('~/app/src/test.spec.js','test()\n');
    sh.mkdir('~/staging');
  },
  steps:[
    { brief:'Enter the app source.', hint:'cd ~/app/src', check:(sh)=> cwdIs(sh,'~/app/src'), solution:['cd ~/app/src'] },
    { brief:'List the source files.', hint:'ls', check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.includes('index.html'), solution:['ls'] },
    { brief:'Copy the html into staging.', hint:'cp index.html ~/staging/', check:(sh)=> isFile(sh,'~/staging/index.html'), solution:['cp index.html ~/staging/'] },
    { brief:'Copy the js and css into staging (two files, one command).', hint:'cp app.js style.css ~/staging/', check:(sh)=> isFile(sh,'~/staging/app.js') && isFile(sh,'~/staging/style.css'), solution:['cp app.js style.css ~/staging/'] },
    { brief:'Flip the environment in the staged app.js: dev becomes staging, in place.', hint:'sed -i s/dev/staging/ ~/staging/app.js', check:(sh)=> has(sh,'~/staging/app.js','staging') && !has(sh,'~/staging/app.js','"dev"'), solution:['sed -i s/dev/staging/ ~/staging/app.js'] },
    { brief:'Confirm the debug.log and tests did NOT get staged.', hint:'find ~/staging -name "*.log"', check:(sh,ctx)=> ctx.cmd==='find' && ctx.out.trim()==='', solution:['find ~/staging -name "*.log"'] },
    { brief:'Write a VERSION file "1.0-staging" into staging.', hint:'echo "1.0-staging" > ~/staging/VERSION', check:(sh)=> has(sh,'~/staging/VERSION','1.0-staging'), solution:['echo "1.0-staging" > ~/staging/VERSION'] },
    { brief:'Count the files staged.', hint:'ls ~/staging | wc -l', check:(sh,ctx)=> ctx.line.includes('staging') && ctx.out.trim()==='4', solution:['ls ~/staging | wc -l'] },
    { brief:'Freeze staging read-only recursively (chmod -R 500).', hint:'chmod -R 500 ~/staging', check:(sh)=> mode(sh,'~/staging/app.js')===0o500, solution:['chmod -R 500 ~/staging'] },
    { brief:'Tree the staging folder.', hint:'tree ~/staging', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('VERSION'), solution:['tree ~/staging'] }
  ]
});

/* S9. Metrics Rollup */
SCENARIOS.push({
  id:'metrics-rollup',
  title:'Metrics Rollup',
  icon:'📟',
  difficulty:'Specialist',
  story:'Hourly metric samples arrived as plain numbers. Roll them up: count, extremes, and a sorted snapshot for the dashboard.',
  brief:'Numeric wrangling with sort -n, head, tail, and uniq.',
  setup(sh){
    sh.mkdir('~/metrics');
    sh.mkfile('~/metrics/samples.txt', ['42','17','88','17','5','99','42','63'].join('\n')+'\n');
    sh.mkdir('~/metrics/out');
  },
  steps:[
    { brief:'Enter the metrics folder.', hint:'cd ~/metrics', check:(sh)=> cwdIs(sh,'~/metrics'), solution:['cd ~/metrics'] },
    { brief:'Count the samples.', hint:'wc -l samples.txt', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('8'), solution:['wc -l samples.txt'] },
    { brief:'Sort the samples numerically into sorted.txt.', hint:'sort -n samples.txt > sorted.txt', check:(sh)=> isFile(sh,'~/metrics/sorted.txt') && fileLines(sh.get('~/metrics/sorted.txt'))[0]==='5', solution:['sort -n samples.txt > sorted.txt'] },
    { brief:'Find the minimum: first line of the sorted file.', hint:'head -n 1 sorted.txt', check:(sh,ctx)=> ctx.cmd==='head' && ctx.out.trim()==='5', solution:['head -n 1 sorted.txt'] },
    { brief:'Find the maximum: last line of the sorted file.', hint:'tail -n 1 sorted.txt', check:(sh,ctx)=> ctx.cmd==='tail' && ctx.out.trim()==='99', solution:['tail -n 1 sorted.txt'] },
    { brief:'List the distinct sample values (numeric, unique) into distinct.txt.', hint:'sort -nu samples.txt > distinct.txt', check:(sh)=> isFile(sh,'~/metrics/distinct.txt') && linecount(sh,'~/metrics/distinct.txt')===6, solution:['sort -nu samples.txt > distinct.txt'] },
    { brief:'Find values that occur more than once: sort then uniq -d.', hint:'sort samples.txt | uniq -d', check:(sh,ctx)=> ctx.line.includes('uniq -d') && (ctx.out.includes('17')||ctx.out.includes('42')), solution:['sort samples.txt | uniq -d'] },
    { brief:'Save the top 3 highest values to out/top3.txt.', hint:'sort -nr samples.txt | head -n 3 > out/top3.txt', check:(sh)=> isFile(sh,'~/metrics/out/top3.txt') && linecount(sh,'~/metrics/out/top3.txt')===3 && has(sh,'~/metrics/out/top3.txt','99'), solution:['sort -nr samples.txt | head -n 3 > out/top3.txt'] },
    { brief:'Write "max=99 min=5" into out/summary.txt.', hint:'echo "max=99 min=5" > out/summary.txt', check:(sh)=> has(sh,'~/metrics/out/summary.txt','max=99 min=5'), solution:['echo "max=99 min=5" > out/summary.txt'] },
    { brief:'Tree the out folder.', hint:'tree out', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('top3.txt'), solution:['tree out'] }
  ]
});

/* S10. The Great Reorg */
SCENARIOS.push({
  id:'great-reorg',
  title:'The Great Reorg',
  icon:'🗃️',
  difficulty:'Specialist',
  story:'A flat dump of mixed files must become a tidy, typed directory structure, with a generated index and the originals cleared.',
  brief:'Restructure by file type using mkdir, mv wildcards, find, and an index.',
  setup(sh){
    sh.mkdir('~/dump');
    ['a.jpg','b.jpg','c.png','r1.pdf','r2.pdf','s1.js','s2.js','s3.js','readme.md'].forEach(f=> sh.mkfile('~/dump/'+f, f+'\n'));
  },
  steps:[
    { brief:'Enter the dump folder.', hint:'cd ~/dump', check:(sh)=> cwdIs(sh,'~/dump'), solution:['cd ~/dump'] },
    { brief:'Create typed folders in one command: images docs code.', hint:'mkdir images docs code', check:(sh)=> isDir(sh,'~/dump/images') && isDir(sh,'~/dump/docs') && isDir(sh,'~/dump/code'), solution:['mkdir images docs code'] },
    { brief:'Move all images (jpg and png) — do jpg first.', hint:'mv *.jpg images/', check:(sh)=> isFile(sh,'~/dump/images/a.jpg') && isFile(sh,'~/dump/images/b.jpg'), solution:['mv *.jpg images/'] },
    { brief:'Move the png into images too.', hint:'mv *.png images/', check:(sh)=> isFile(sh,'~/dump/images/c.png'), solution:['mv *.png images/'] },
    { brief:'Move all pdf and md docs into docs.', hint:'mv *.pdf *.md docs/', check:(sh)=> isFile(sh,'~/dump/docs/r1.pdf') && isFile(sh,'~/dump/docs/readme.md'), solution:['mv *.pdf *.md docs/'] },
    { brief:'Move all .js into code.', hint:'mv *.js code/', check:(sh)=> isFile(sh,'~/dump/code/s1.js') && isFile(sh,'~/dump/code/s3.js'), solution:['mv *.js code/'] },
    { brief:'Count the code files.', hint:'ls code | wc -l', check:(sh,ctx)=> ctx.line.includes('code') && ctx.out.trim()==='3', solution:['ls code | wc -l'] },
    { brief:'Build an index of all files in the tree into INDEX.txt.', hint:'find . -type f > INDEX.txt', check:(sh)=> isFile(sh,'~/dump/INDEX.txt') && has(sh,'~/dump/INDEX.txt','images/a.jpg'), solution:['find . -type f > INDEX.txt'] },
    { brief:'How many files total are indexed? (minus the index itself, just count lines).', hint:'wc -l INDEX.txt', check:(sh,ctx)=> ctx.cmd==='wc' && parseInt(ctx.out.trim())>=9, solution:['wc -l INDEX.txt'] },
    { brief:'Tree the reorganized dump.', hint:'tree', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('images') && ctx.out.includes('code'), solution:['tree'] }
  ]
});

/* ================================================================== *
 *  NEW SCENARIOS — MASTER (10)
 * ================================================================== */

/* M1. Breach Investigation */
SCENARIOS.push({
  id:'breach-investigation',
  title:'Breach Investigation',
  icon:'🕳️',
  difficulty:'Master',
  story:'An intrusion is suspected. Correlate auth and web logs, isolate the attacker IP, enumerate its targets, and file a locked forensic report.',
  brief:'Full forensic pipeline: grep, cut, sort, uniq -c, redirection, chmod.',
  setup(sh){
    sh.mkdir('~/case/logs'); sh.mkdir('~/case/evidence');
    const auth=[];
    for(let i=0;i<8;i++) auth.push('Failed password for root from 185.1.1.9');
    for(let i=0;i<4;i++) auth.push('Failed password for admin from 185.1.1.9');
    auth.push('Accepted password for astra from 10.0.0.5');
    for(let i=0;i<2;i++) auth.push('Failed password for astra from 10.0.0.9');
    sh.mkfile('~/case/logs/auth.log', auth.join('\n')+'\n');
    sh.mkfile('~/case/logs/web.log', ['185.1.1.9 GET /admin 403','10.0.0.5 GET /home 200','185.1.1.9 GET /admin 403','185.1.1.9 POST /login 401'].join('\n')+'\n');
  },
  steps:[
    { brief:'Enter the case folder.', hint:'cd ~/case', check:(sh)=> cwdIs(sh,'~/case'), solution:['cd ~/case'] },
    { brief:'Count total failed auth attempts.', hint:'grep -c "Failed password" logs/auth.log', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.trim()==='14', solution:['grep -c "Failed password" logs/auth.log'] },
    { brief:'The attacker hammers 185.1.1.9. Count its failed attempts.', hint:'grep 185.1.1.9 logs/auth.log | grep -c Failed', check:(sh,ctx)=> ctx.out.trim()==='12', solution:['grep 185.1.1.9 logs/auth.log | grep -c Failed'] },
    { brief:'Save all 185.1.1.9 auth lines to evidence/suspect.txt.', hint:'grep 185.1.1.9 logs/auth.log > evidence/suspect.txt', check:(sh)=> isFile(sh,'~/case/evidence/suspect.txt') && linecount(sh,'~/case/evidence/suspect.txt')===12, solution:['grep 185.1.1.9 logs/auth.log > evidence/suspect.txt'] },
    { brief:'Enumerate which accounts were targeted: cut field 4, sort unique into evidence/targets.txt.', hint:'grep 185.1.1.9 logs/auth.log | cut -d " " -f 4 | sort -u > evidence/targets.txt', check:(sh)=>{ const n=sh.get('~/case/evidence/targets.txt'); if(!n) return false; const c=n.content||''; return c.includes('root') && c.includes('admin') && fileLines(n).length===2; }, solution:['grep 185.1.1.9 logs/auth.log | cut -d " " -f 4 | sort -u > evidence/targets.txt'] },
    { brief:'Cross-check the web log: how many hits from the attacker IP?', hint:'grep -c 185.1.1.9 logs/web.log', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.trim()==='3', solution:['grep -c 185.1.1.9 logs/web.log'] },
    { brief:'Tally web status codes (field 4) across the web log into evidence/web_status.txt.', hint:'cut -d " " -f 4 logs/web.log | sort | uniq -c > evidence/web_status.txt', check:(sh)=> isFile(sh,'~/case/evidence/web_status.txt') && has(sh,'~/case/evidence/web_status.txt','403'), solution:['cut -d " " -f 4 logs/web.log | sort | uniq -c > evidence/web_status.txt'] },
    { brief:'Start the report: write "ATTACKER 185.1.1.9" into evidence/report.txt.', hint:'echo "ATTACKER 185.1.1.9" > evidence/report.txt', check:(sh)=> has(sh,'~/case/evidence/report.txt','ATTACKER 185.1.1.9'), solution:['echo "ATTACKER 185.1.1.9" > evidence/report.txt'] },
    { brief:'Append "failed attempts: 12" to the report.', hint:'echo "failed attempts: 12" >> evidence/report.txt', check:(sh)=> has(sh,'~/case/evidence/report.txt','failed attempts: 12') && linecount(sh,'~/case/evidence/report.txt')===2, solution:['echo "failed attempts: 12" >> evidence/report.txt'] },
    { brief:'Lock the whole evidence folder read-only recursively (chmod -R 400).', hint:'chmod -R 400 evidence', check:(sh)=> mode(sh,'~/case/evidence/report.txt')===0o400 && mode(sh,'~/case/evidence/suspect.txt')===0o400, solution:['chmod -R 400 evidence'] }
  ]
});

/* M2. The ETL Job */
SCENARIOS.push({
  id:'etl-job',
  title:'The ETL Job',
  icon:'🔧',
  difficulty:'Master',
  story:'Build a small extract-transform-load by hand: pull raw rows, normalize, filter, aggregate, and emit tidy outputs for the warehouse.',
  brief:'Chain the full toolkit: tr, cut, grep, sort, uniq, sed, redirection.',
  setup(sh){
    sh.mkdir('~/etl');
    sh.mkfile('~/etl/raw.csv', ['ID;NAME;REGION','1;Alice;WEST','2;BOB;east','3;carol;WEST','4;Dave;EAST','5;eve;west'].join('\n')+'\n');
    sh.mkdir('~/etl/warehouse');
  },
  steps:[
    { brief:'Enter the etl folder.', hint:'cd ~/etl', check:(sh)=> cwdIs(sh,'~/etl'), solution:['cd ~/etl'] },
    { brief:'The file is semicolon-delimited. Extract the region column (field 3).', hint:'cut -d ";" -f 3 raw.csv', check:(sh,ctx)=> ctx.cmd==='cut' && ctx.out.includes('WEST'), solution:['cut -d ";" -f 3 raw.csv'] },
    { brief:'Convert the whole file to comma-delimited with tr into comma.csv.', hint:'cat raw.csv | tr ";" "," > comma.csv', check:(sh)=> isFile(sh,'~/etl/comma.csv') && has(sh,'~/etl/comma.csv','1,Alice,WEST') && !has(sh,'~/etl/comma.csv',';'), solution:['cat raw.csv | tr ";" "," > comma.csv'] },
    { brief:'Normalize the region column to lowercase: extract field 3, skip header, lowercase, into regions.txt.', hint:'cut -d , -f 3 comma.csv | grep -v REGION | tr A-Z a-z > regions.txt', check:(sh)=>{ const n=sh.get('~/etl/regions.txt'); if(!n) return false; const c=n.content||''; return c.includes('west') && c.includes('east') && !c.includes('WEST'); }, solution:['cut -d , -f 3 comma.csv | grep -v REGION | tr A-Z a-z > regions.txt'] },
    { brief:'Aggregate: count records per region, sort, uniq -c into warehouse/region_counts.txt.', hint:'sort regions.txt | uniq -c > warehouse/region_counts.txt', check:(sh)=> isFile(sh,'~/etl/warehouse/region_counts.txt') && has(sh,'~/etl/warehouse/region_counts.txt','west'), solution:['sort regions.txt | uniq -c > warehouse/region_counts.txt'] },
    { brief:'List the distinct normalized regions.', hint:'sort -u regions.txt', check:(sh,ctx)=> ctx.cmd==='sort' && ctx.out.trim().split('\n').filter(Boolean).sort().join(',')==='east,west', solution:['sort -u regions.txt'] },
    { brief:'How many records are in the west region?', hint:'grep -cw west regions.txt', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.trim()==='3', solution:['grep -cw west regions.txt'] },
    { brief:'Load just the WEST rows into warehouse/west.csv (from comma.csv).', hint:'grep WEST comma.csv > warehouse/west.csv', check:(sh)=> isFile(sh,'~/etl/warehouse/west.csv') && linecount(sh,'~/etl/warehouse/west.csv')===2, solution:['grep WEST comma.csv > warehouse/west.csv'] },
    { brief:'Mark the load done: write "ETL OK" into warehouse/_SUCCESS.', hint:'echo "ETL OK" > warehouse/_SUCCESS', check:(sh)=> has(sh,'~/etl/warehouse/_SUCCESS','ETL OK'), solution:['echo "ETL OK" > warehouse/_SUCCESS'] },
    { brief:'Tree the warehouse folder.', hint:'tree warehouse', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('region_counts.txt'), solution:['tree warehouse'] }
  ]
});

/* M3. Monorepo Migration */
SCENARIOS.push({
  id:'monorepo',
  title:'Monorepo Migration',
  icon:'🏗️',
  difficulty:'Master',
  story:'Three separate services must merge into one monorepo with a shared layout. Migrate code, rename packages, and leave the legacy trees empty.',
  brief:'Large-scale restructure with mkdir -p, mv, sed -i, find, rmdir.',
  setup(sh){
    sh.mkdir('~/legacy/svc-a'); sh.mkdir('~/legacy/svc-b');
    sh.mkfile('~/legacy/svc-a/index.js','package="svc-a"\n');
    sh.mkfile('~/legacy/svc-a/config.json','{"name":"svc-a"}\n');
    sh.mkfile('~/legacy/svc-b/index.js','package="svc-b"\n');
    sh.mkfile('~/legacy/svc-b/config.json','{"name":"svc-b"}\n');
  },
  steps:[
    { brief:'Build the monorepo skeleton in one command: ~/mono/packages/a ~/mono/packages/b.', hint:'mkdir -p ~/mono/packages/a ~/mono/packages/b', check:(sh)=> isDir(sh,'~/mono/packages/a') && isDir(sh,'~/mono/packages/b'), solution:['mkdir -p ~/mono/packages/a ~/mono/packages/b'] },
    { brief:'Enter svc-a.', hint:'cd ~/legacy/svc-a', check:(sh)=> cwdIs(sh,'~/legacy/svc-a'), solution:['cd ~/legacy/svc-a'] },
    { brief:'Move both svc-a files into packages/a (wildcard).', hint:'mv * ~/mono/packages/a/', check:(sh)=> isFile(sh,'~/mono/packages/a/index.js') && isFile(sh,'~/mono/packages/a/config.json') && !exists(sh,'~/legacy/svc-a/index.js'), solution:['mv * ~/mono/packages/a/'] },
    { brief:'Enter svc-b and move its files into packages/b.', hint:'cd ~/legacy/svc-b && mv * ~/mono/packages/b/', check:(sh)=> isFile(sh,'~/mono/packages/b/index.js') && isFile(sh,'~/mono/packages/b/config.json'), solution:['cd ~/legacy/svc-b','mv * ~/mono/packages/b/'] },
    { brief:'Rename the package in a/index.js: svc-a becomes @mono/a (use # as the sed delimiter).', hint:'sed -i s#svc-a#@mono/a# ~/mono/packages/a/index.js', check:(sh)=> has(sh,'~/mono/packages/a/index.js','@mono/a'), solution:['sed -i s#svc-a#@mono/a# ~/mono/packages/a/index.js'] },
    { brief:'Rename it in a/config.json too.', hint:'sed -i s#svc-a#@mono/a# ~/mono/packages/a/config.json', check:(sh)=> has(sh,'~/mono/packages/a/config.json','@mono/a') && !has(sh,'~/mono/packages/a/config.json','svc-a'), solution:['sed -i s#svc-a#@mono/a# ~/mono/packages/a/config.json'] },
    { brief:'Verify the legacy svc-a folder is empty.', hint:'ls ~/legacy/svc-a', check:(sh,ctx)=> ctx.cmd==='ls' && ctx.out.trim()==='', solution:['ls ~/legacy/svc-a'] },
    { brief:'Remove the empty legacy service directories.', hint:'rmdir ~/legacy/svc-a ~/legacy/svc-b', check:(sh)=> !exists(sh,'~/legacy/svc-a') && !exists(sh,'~/legacy/svc-b'), solution:['rmdir ~/legacy/svc-a ~/legacy/svc-b'] },
    { brief:'Find every index.js now in the monorepo.', hint:'find ~/mono -name index.js', check:(sh,ctx)=> ctx.cmd==='find' && ctx.out.includes('packages/a/index.js') && ctx.out.includes('packages/b/index.js'), solution:['find ~/mono -name index.js'] },
    { brief:'Tree the monorepo.', hint:'tree ~/mono', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('packages'), solution:['tree ~/mono'] }
  ]
});

/* M4. Log Rotation Automation */
SCENARIOS.push({
  id:'log-rotation-pro',
  title:'Rotation at Scale',
  icon:'🌀',
  difficulty:'Master',
  story:'A fleet of logs needs rotating, analyzing, and archiving in one sitting. Measure volume, extract the worst offenders, and lock an archive.',
  brief:'Volume analysis + archival: wc, grep -o, sort, uniq -c, cp -r, chmod.',
  setup(sh){
    sh.mkdir('~/fleet/logs'); sh.mkdir('~/fleet/archive');
    sh.mkfile('~/fleet/logs/web1.log', ['ERROR db timeout','INFO ok','ERROR db timeout','WARN slow','ERROR auth fail'].join('\n')+'\n');
    sh.mkfile('~/fleet/logs/web2.log', ['INFO ok','ERROR auth fail','INFO ok','ERROR db timeout'].join('\n')+'\n');
  },
  steps:[
    { brief:'Enter the fleet folder.', hint:'cd ~/fleet', check:(sh)=> cwdIs(sh,'~/fleet'), solution:['cd ~/fleet'] },
    { brief:'Count the lines across both logs at once.', hint:'wc -l logs/web1.log logs/web2.log', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.includes('total'), solution:['wc -l logs/web1.log logs/web2.log'] },
    { brief:'Count all ERROR lines recursively across logs.', hint:'grep -rc ERROR logs', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.includes('web1.log'), solution:['grep -rc ERROR logs'] },
    { brief:'Gather every ERROR line from both logs into errors.txt.', hint:'grep -r ERROR logs > errors.txt', check:(sh)=> isFile(sh,'~/fleet/errors.txt') && linecount(sh,'~/fleet/errors.txt')===5, solution:['grep -r ERROR logs > errors.txt'] },
    { brief:'Extract the error reason (everything after "ERROR "): grep -oE "ERROR .*" errors.txt into reasons.txt.', hint:'grep -oE "ERROR .*" errors.txt > reasons.txt', check:(sh)=> isFile(sh,'~/fleet/reasons.txt') && has(sh,'~/fleet/reasons.txt','ERROR db timeout'), solution:['grep -oE "ERROR .*" errors.txt > reasons.txt'] },
    { brief:'Rank the error reasons by frequency: sort, uniq -c, sort -nr into ranked.txt.', hint:'sort reasons.txt | uniq -c | sort -nr > ranked.txt', check:(sh)=> isFile(sh,'~/fleet/ranked.txt') && has(sh,'~/fleet/ranked.txt','db timeout'), solution:['sort reasons.txt | uniq -c | sort -nr > ranked.txt'] },
    { brief:'The top reason is first. Show just that line.', hint:'head -n 1 ranked.txt', check:(sh,ctx)=> ctx.cmd==='head' && ctx.out.includes('db timeout'), solution:['head -n 1 ranked.txt'] },
    { brief:'Archive the entire logs directory into archive (recursive copy).', hint:'cp -r logs archive/logs', check:(sh)=> isDir(sh,'~/fleet/archive/logs') && isFile(sh,'~/fleet/archive/logs/web1.log'), solution:['cp -r logs archive/logs'] },
    { brief:'Freeze the archive read-only recursively (chmod -R 400).', hint:'chmod -R 400 archive', check:(sh)=> mode(sh,'~/fleet/archive/logs/web1.log')===0o400, solution:['chmod -R 400 archive'] },
    { brief:'Tree the fleet folder.', hint:'tree', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('ranked.txt') && ctx.out.includes('archive'), solution:['tree'] }
  ]
});

/* M5. The Data Pipeline Championship */
SCENARIOS.push({
  id:'data-championship',
  title:'Data Pipeline Championship',
  icon:'🏆',
  difficulty:'Master',
  story:'The ultimate shell data challenge: from a messy events log, answer five analytics questions, each with a single pipeline, and emit a scorecard.',
  brief:'Advanced multi-stage pipelines over a realistic event log.',
  setup(sh){
    sh.mkdir('~/champ');
    const ev=[
      'click user1 /home','view user2 /home','click user1 /cart',
      'buy user1 /checkout','view user3 /home','click user2 /cart',
      'buy user2 /checkout','view user1 /home','click user3 /cart','buy user1 /checkout'
    ];
    sh.mkfile('~/champ/events.log', ev.join('\n')+'\n');
    sh.mkdir('~/champ/out');
  },
  steps:[
    { brief:'Enter the champ folder.', hint:'cd ~/champ', check:(sh)=> cwdIs(sh,'~/champ'), solution:['cd ~/champ'] },
    { brief:'How many total events are logged?', hint:'wc -l events.log', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('10'), solution:['wc -l events.log'] },
    { brief:'Count the "buy" events (whole word).', hint:'grep -cw buy events.log', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.trim()==='3', solution:['grep -cw buy events.log'] },
    { brief:'Tally events by type (field 1): cut, sort, uniq -c into out/by_type.txt.', hint:'cut -d " " -f 1 events.log | sort | uniq -c > out/by_type.txt', check:(sh)=> isFile(sh,'~/champ/out/by_type.txt') && has(sh,'~/champ/out/by_type.txt','click'), solution:['cut -d " " -f 1 events.log | sort | uniq -c > out/by_type.txt'] },
    { brief:'Find the most active user: cut field 2, sort, uniq -c, sort -nr, head -1.', hint:'cut -d " " -f 2 events.log | sort | uniq -c | sort -nr | head -n 1', check:(sh,ctx)=> ctx.line.includes('uniq -c') && ctx.line.includes('sort -nr') && ctx.out.includes('user1'), solution:['cut -d " " -f 2 events.log | sort | uniq -c | sort -nr | head -n 1'] },
    { brief:'List the distinct pages visited (field 3), sorted unique, into out/pages.txt.', hint:'cut -d " " -f 3 events.log | sort -u > out/pages.txt', check:(sh)=>{ const n=sh.get('~/champ/out/pages.txt'); if(!n) return false; const ls=fileLines(n); return ls.length===3 && ls.includes('/cart'); }, solution:['cut -d " " -f 3 events.log | sort -u > out/pages.txt'] },
    { brief:'How many unique users are there? Count distinct field-2 values.', hint:'cut -d " " -f 2 events.log | sort -u | wc -l', check:(sh,ctx)=> ctx.line.includes('sort -u') && ctx.out.trim()==='3', solution:['cut -d " " -f 2 events.log | sort -u | wc -l'] },
    { brief:'Which users made a purchase? From buy events cut the user, unique, into out/buyers.txt.', hint:'grep "^buy " events.log | cut -d " " -f 2 | sort -u > out/buyers.txt', check:(sh)=>{ const n=sh.get('~/champ/out/buyers.txt'); if(!n) return false; const ls=fileLines(n); return ls.includes('user1') && ls.includes('user2') && ls.length===2; }, solution:['grep "^buy " events.log | cut -d " " -f 2 | sort -u > out/buyers.txt'] },
    { brief:'Write the scorecard: "events=10 buyers=2" into out/scorecard.txt.', hint:'echo "events=10 buyers=2" > out/scorecard.txt', check:(sh)=> has(sh,'~/champ/out/scorecard.txt','events=10 buyers=2'), solution:['echo "events=10 buyers=2" > out/scorecard.txt'] },
    { brief:'Tree the out folder.', hint:'tree out', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('buyers.txt') && ctx.out.includes('pages.txt'), solution:['tree out'] }
  ]
});

/* M6. Disaster Recovery */
SCENARIOS.push({
  id:'disaster-recovery',
  title:'Disaster Recovery Drill',
  icon:'🧯',
  difficulty:'Master',
  story:'A corrupted deploy must be rolled back from backups, configs repaired, services verified, and the recovery documented — against the clock.',
  brief:'Capstone recovery: cp, sed, grep, chmod, find, redirection.',
  setup(sh){
    sh.mkdir('~/prod/config'); sh.mkdir('~/prod/bin'); sh.mkdir('~/backups/good/config'); sh.mkdir('~/recovery');
    sh.mkfile('~/prod/config/app.conf', ['mode=broken','port=0','replicas=0'].join('\n')+'\n');
    sh.mkfile('~/backups/good/config/app.conf', ['mode=live','port=8080','replicas=3'].join('\n')+'\n');
    sh.mkfile('~/prod/bin/run.sh', '#!/bin/sh\nstart\n', {mode:0o644});
    sh.mkfile('~/prod/corrupt.dat', 'XXXX\n');
  },
  steps:[
    { brief:'Enter the prod folder.', hint:'cd ~/prod', check:(sh)=> cwdIs(sh,'~/prod'), solution:['cd ~/prod'] },
    { brief:'Confirm the current config is broken.', hint:'grep broken config/app.conf', check:(sh,ctx)=> ctx.cmd==='grep' && ctx.out.includes('mode=broken'), solution:['grep broken config/app.conf'] },
    { brief:'Snapshot the broken config into ~/recovery/broken.conf for the postmortem.', hint:'cp config/app.conf ~/recovery/broken.conf', check:(sh)=> isFile(sh,'~/recovery/broken.conf') && has(sh,'~/recovery/broken.conf','mode=broken'), solution:['cp config/app.conf ~/recovery/broken.conf'] },
    { brief:'Restore the good config from backup over the broken one.', hint:'cp ~/backups/good/config/app.conf config/app.conf', check:(sh)=> has(sh,'~/prod/config/app.conf','mode=live') && has(sh,'~/prod/config/app.conf','port=8080'), solution:['cp ~/backups/good/config/app.conf config/app.conf'] },
    { brief:'Scale further: bump replicas=3 to replicas=5 in place.', hint:'sed -i s/replicas=3/replicas=5/ config/app.conf', check:(sh)=> has(sh,'~/prod/config/app.conf','replicas=5'), solution:['sed -i s/replicas=3/replicas=5/ config/app.conf'] },
    { brief:'Delete the corrupt data file.', hint:'rm corrupt.dat', check:(sh)=> !exists(sh,'~/prod/corrupt.dat'), solution:['rm corrupt.dat'] },
    { brief:'Make the run script executable.', hint:'chmod +x bin/run.sh', check:(sh)=> (mode(sh,'~/prod/bin/run.sh')&0o111)!==0, solution:['chmod +x bin/run.sh'] },
    { brief:'Verify no "broken" or "port=0" remains in the live config.', hint:'grep -E "broken|port=0" config/app.conf', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.code===1, solution:['grep -E "broken|port=0" config/app.conf'] },
    { brief:'Document success: write "RECOVERED" into ~/recovery/status.txt.', hint:'echo "RECOVERED" > ~/recovery/status.txt', check:(sh)=> has(sh,'~/recovery/status.txt','RECOVERED'), solution:['echo "RECOVERED" > ~/recovery/status.txt'] },
    { brief:'Read the restored config end to end.', hint:'cat config/app.conf', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('mode=live') && ctx.out.includes('replicas=5'), solution:['cat config/app.conf'] }
  ]
});

/* M7. The Compliance Sweep */
SCENARIOS.push({
  id:'compliance-sweep',
  title:'The Compliance Sweep',
  icon:'📋',
  difficulty:'Master',
  story:'An auditor is coming. Sweep the system for secrets, fix insecure permissions, prove the fixes, and hand over a signed manifest.',
  brief:'Security sweep: find, grep -r, chmod, stat, redirection.',
  setup(sh){
    sh.mkdir('~/sys/app'); sh.mkdir('~/sys/etc'); sh.mkdir('~/sys/audit');
    sh.mkfile('~/sys/app/app.js','const KEY="secret123"\n');
    sh.mkfile('~/sys/etc/db.conf','password=hunter2\n', {mode:0o644});
    sh.mkfile('~/sys/etc/id_rsa','PRIVATE\n', {mode:0o644});
    sh.mkfile('~/sys/app/public.txt','nothing secret\n');
  },
  steps:[
    { brief:'Enter the sys folder.', hint:'cd ~/sys', check:(sh)=> cwdIs(sh,'~/sys'), solution:['cd ~/sys'] },
    { brief:'Sweep recursively for the word "password".', hint:'grep -r password .', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.includes('db.conf'), solution:['grep -r password .'] },
    { brief:'Also sweep for hard-coded secrets (the word "secret").', hint:'grep -ri secret .', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.includes('app.js'), solution:['grep -ri secret .'] },
    { brief:'Record every line mentioning a secret into audit/findings.txt (recursive, case-insensitive).', hint:'grep -ri secret . > audit/findings.txt', check:(sh)=> isFile(sh,'~/sys/audit/findings.txt') && has(sh,'~/sys/audit/findings.txt','app.js'), solution:['grep -ri secret . > audit/findings.txt'] },
    { brief:'Find the private key file.', hint:'find . -name id_rsa', check:(sh,ctx)=> ctx.cmd==='find' && ctx.out.includes('id_rsa'), solution:['find . -name id_rsa'] },
    { brief:'Lock the private key to owner-only (chmod 600).', hint:'chmod 600 etc/id_rsa', check:(sh)=> mode(sh,'~/sys/etc/id_rsa')===0o600, solution:['chmod 600 etc/id_rsa'] },
    { brief:'Lock the db config too (chmod 600).', hint:'chmod 600 etc/db.conf', check:(sh)=> mode(sh,'~/sys/etc/db.conf')===0o600, solution:['chmod 600 etc/db.conf'] },
    { brief:'Prove the key is now owner-only via its long listing.', hint:'ls -l etc/id_rsa', check:(sh,ctx)=> ctx.cmd==='ls' && /rw-------/.test(ctx.out), solution:['ls -l etc/id_rsa'] },
    { brief:'Verify the key permissions with stat.', hint:'stat etc/id_rsa', check:(sh,ctx)=> ctx.cmd==='stat' && ctx.out.includes('600'), solution:['stat etc/id_rsa'] },
    { brief:'Sign off: write "COMPLIANT" into audit/signoff.txt.', hint:'echo "COMPLIANT" > audit/signoff.txt', check:(sh)=> has(sh,'~/sys/audit/signoff.txt','COMPLIANT'), solution:['echo "COMPLIANT" > audit/signoff.txt'] }
  ]
});

/* M8. Build the Changelog */
SCENARIOS.push({
  id:'changelog-master',
  title:'Automate the Changelog',
  icon:'📜',
  difficulty:'Master',
  story:'Generate a release changelog straight from commit messages: filter, categorize, dedupe, number, and freeze the final document.',
  brief:'Text engineering: grep, sort, uniq, nl, sed, cat, chmod.',
  setup(sh){
    sh.mkdir('~/release');
    sh.mkfile('~/release/commits.txt', [
      'feat: add login','fix: null crash','feat: add logout','chore: bump deps',
      'fix: null crash','feat: dark mode','docs: update readme','fix: cors header'
    ].join('\n')+'\n');
    sh.mkdir('~/release/dist');
  },
  steps:[
    { brief:'Enter the release folder.', hint:'cd ~/release', check:(sh)=> cwdIs(sh,'~/release'), solution:['cd ~/release'] },
    { brief:'Count the raw commits.', hint:'wc -l commits.txt', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('8'), solution:['wc -l commits.txt'] },
    { brief:'Extract the feature commits (lines starting with feat).', hint:'grep "^feat" commits.txt', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.includes('add login') && !ctx.out.includes('fix:'), solution:['grep "^feat" commits.txt'] },
    { brief:'Save sorted, unique features into features.txt.', hint:'grep "^feat" commits.txt | sort -u > features.txt', check:(sh)=> isFile(sh,'~/release/features.txt') && linecount(sh,'~/release/features.txt')===3, solution:['grep "^feat" commits.txt | sort -u > features.txt'] },
    { brief:'Save sorted, unique fixes into fixes.txt.', hint:'grep "^fix" commits.txt | sort -u > fixes.txt', check:(sh)=> isFile(sh,'~/release/fixes.txt') && linecount(sh,'~/release/fixes.txt')===2, solution:['grep "^fix" commits.txt | sort -u > fixes.txt'] },
    { brief:'How many unique fixes are there?', hint:'wc -l fixes.txt', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('2'), solution:['wc -l fixes.txt'] },
    { brief:'Assemble the changelog body: features then fixes into body.txt.', hint:'cat features.txt fixes.txt > body.txt', check:(sh)=> isFile(sh,'~/release/body.txt') && linecount(sh,'~/release/body.txt')===5, solution:['cat features.txt fixes.txt > body.txt'] },
    { brief:'Number the changelog lines into dist/CHANGELOG.txt.', hint:'nl body.txt > dist/CHANGELOG.txt', check:(sh)=> isFile(sh,'~/release/dist/CHANGELOG.txt') && has(sh,'~/release/dist/CHANGELOG.txt','add login'), solution:['nl body.txt > dist/CHANGELOG.txt'] },
    { brief:'Tag the release: strip the "feat: " prefix noise is optional, but add a header. Write "== v2.0 ==" to the top via a new file then append — just append the header line to CHANGELOG.', hint:'echo "== v2.0 ==" >> dist/CHANGELOG.txt', check:(sh)=> has(sh,'~/release/dist/CHANGELOG.txt','== v2.0 =='), solution:['echo "== v2.0 ==" >> dist/CHANGELOG.txt'] },
    { brief:'Freeze the changelog read-only (chmod 444).', hint:'chmod 444 dist/CHANGELOG.txt', check:(sh)=> mode(sh,'~/release/dist/CHANGELOG.txt')===0o444, solution:['chmod 444 dist/CHANGELOG.txt'] }
  ]
});

/* M9. Capacity Planning */
SCENARIOS.push({
  id:'capacity-planning',
  title:'Capacity Planning',
  icon:'📶',
  difficulty:'Master',
  story:'Capacity review day. From per-host usage samples, find the hot hosts, compute distributions, and produce a prioritized action list.',
  brief:'Analytics over tabular data with cut, sort -t -k -n, uniq, grep.',
  setup(sh){
    sh.mkdir('~/capacity');
    sh.mkfile('~/capacity/usage.csv', ['host,cpu,mem','web1,90,70','web2,40,30','db1,95,88','cache1,20,60','web3,85,55','db2,60,91'].join('\n')+'\n');
    sh.mkdir('~/capacity/out');
  },
  steps:[
    { brief:'Enter the capacity folder.', hint:'cd ~/capacity', check:(sh)=> cwdIs(sh,'~/capacity'), solution:['cd ~/capacity'] },
    { brief:'Read the usage table.', hint:'cat usage.csv', check:(sh,ctx)=> ctx.cmd==='cat' && ctx.out.includes('web1'), solution:['cat usage.csv'] },
    { brief:'Sort hosts by CPU (field 2) descending into out/by_cpu.csv.', hint:'sort -t , -k 2 -nr usage.csv > out/by_cpu.csv', check:(sh)=> isFile(sh,'~/capacity/out/by_cpu.csv') && fileLines(sh.get('~/capacity/out/by_cpu.csv'))[0].includes('db1'), solution:['sort -t , -k 2 -nr usage.csv > out/by_cpu.csv'] },
    { brief:'The hottest CPU host is on top. Show it.', hint:'head -n 1 out/by_cpu.csv', check:(sh,ctx)=> ctx.cmd==='head' && ctx.out.includes('db1'), solution:['head -n 1 out/by_cpu.csv'] },
    { brief:'Sort hosts by memory (field 3) descending into out/by_mem.csv.', hint:'sort -t , -k 3 -nr usage.csv > out/by_mem.csv', check:(sh)=> isFile(sh,'~/capacity/out/by_mem.csv') && fileLines(sh.get('~/capacity/out/by_mem.csv'))[0].includes('db2'), solution:['sort -t , -k 3 -nr usage.csv > out/by_mem.csv'] },
    { brief:'List just the web hosts (host column starts with web).', hint:'grep "^web" usage.csv', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.includes('web1') && !ctx.out.includes('db1'), solution:['grep "^web" usage.csv'] },
    { brief:'How many web hosts are there?', hint:'grep -c "^web" usage.csv', check:(sh,ctx)=> /grep/.test(ctx.line) && ctx.out.trim()==='3', solution:['grep -c "^web" usage.csv'] },
    { brief:'Extract hostnames with CPU >= 85: grep those rows, cut field 1, into out/hot.txt. (grep for 9x or 85)', hint:'grep -E ",9[0-9],|,85," usage.csv | cut -d , -f 1 > out/hot.txt', check:(sh)=>{ const n=sh.get('~/capacity/out/hot.txt'); if(!n) return false; const ls=fileLines(n); return ls.includes('web1') && ls.includes('db1') && ls.includes('web3'); }, solution:['grep -E ",9[0-9],|,85," usage.csv | cut -d , -f 1 > out/hot.txt'] },
    { brief:'Write the action headline "scale db1 web1 web3" into out/actions.txt.', hint:'echo "scale db1 web1 web3" > out/actions.txt', check:(sh)=> has(sh,'~/capacity/out/actions.txt','scale db1 web1 web3'), solution:['echo "scale db1 web1 web3" > out/actions.txt'] },
    { brief:'Tree the out folder.', hint:'tree out', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('by_cpu.csv'), solution:['tree out'] }
  ]
});

/* M10. The Final Exam */
SCENARIOS.push({
  id:'final-exam',
  title:'The Final Exam',
  icon:'🎓',
  difficulty:'Master',
  story:'Everything you have learned, one mission. Navigate, build, transform, search, secure, and ship — a complete operator workflow from empty home to finished deliverable.',
  brief:'A grand capstone touching the full command set.',
  setup(sh){
    sh.mkdir('~/exam');
    sh.mkfile('~/exam/raw.txt', ['Zeta 50','alpha 90','Beta 70','alpha 90','gamma 30','Delta 60'].join('\n')+'\n');
  },
  steps:[
    { brief:'Enter the exam folder.', hint:'cd ~/exam', check:(sh)=> cwdIs(sh,'~/exam'), solution:['cd ~/exam'] },
    { brief:'Build a project skeleton in one command: src data out.', hint:'mkdir src data out', check:(sh)=> isDir(sh,'~/exam/src') && isDir(sh,'~/exam/data') && isDir(sh,'~/exam/out'), solution:['mkdir src data out'] },
    { brief:'Move raw.txt into data/.', hint:'mv raw.txt data/', check:(sh)=> isFile(sh,'~/exam/data/raw.txt') && !exists(sh,'~/exam/raw.txt'), solution:['mv raw.txt data/'] },
    { brief:'Normalize to lowercase, sorted-unique, into data/clean.txt.', hint:'cat data/raw.txt | tr A-Z a-z | sort -u > data/clean.txt', check:(sh)=>{ const n=sh.get('~/exam/data/clean.txt'); if(!n) return false; const ls=fileLines(n); return ls.length===5 && ls.some(l=>l.startsWith('alpha')); }, solution:['cat data/raw.txt | tr A-Z a-z | sort -u > data/clean.txt'] },
    { brief:'Sort the clean data by the numeric score (field 2) descending into out/ranked.txt.', hint:'sort -k 2 -nr data/clean.txt > out/ranked.txt', check:(sh)=> isFile(sh,'~/exam/out/ranked.txt') && fileLines(sh.get('~/exam/out/ranked.txt'))[0].startsWith('alpha'), solution:['sort -k 2 -nr data/clean.txt > out/ranked.txt'] },
    { brief:'Extract just the names (field 1, space-delimited) into out/names.txt.', hint:'cut -d " " -f 1 out/ranked.txt > out/names.txt', check:(sh)=> isFile(sh,'~/exam/out/names.txt') && has(sh,'~/exam/out/names.txt','alpha'), solution:['cut -d " " -f 1 out/ranked.txt > out/names.txt'] },
    { brief:'Number the ranked list into out/report.txt.', hint:'nl out/ranked.txt > out/report.txt', check:(sh)=> isFile(sh,'~/exam/out/report.txt') && has(sh,'~/exam/out/report.txt','alpha'), solution:['nl out/ranked.txt > out/report.txt'] },
    { brief:'How many distinct entries are in the clean data?', hint:'wc -l data/clean.txt', check:(sh,ctx)=> ctx.cmd==='wc' && ctx.out.trim().startsWith('5'), solution:['wc -l data/clean.txt'] },
    { brief:'Freeze the out folder read-only recursively (chmod -R 500).', hint:'chmod -R 500 out', check:(sh)=> mode(sh,'~/exam/out/report.txt')===0o500, solution:['chmod -R 500 out'] },
    { brief:'Final tree of the whole exam project.', hint:'tree', check:(sh,ctx)=> ctx.cmd==='tree' && ctx.out.includes('report.txt') && ctx.out.includes('data'), solution:['tree'] }
  ]
});

module.exports = { SCENARIOS, helpers:{ exists,isFile,isDir,content,has,linecount,mode,cwdIs } };
