/* runner：把 /tmp/absurd_sets.json 内嵌进产品档，跑 inject_absurd.js，抓 pre#absurd-out */
const fs = require('fs'), cp = require('child_process');
const file = process.env.F || '/sandbox/workspace/output/index.html';
const setsFile = process.env.SETS || '/tmp/absurd_sets.json';
const sets = JSON.parse(fs.readFileSync(setsFile, 'utf8'));
let html = fs.readFileSync(file, 'utf8');
const inj = fs.readFileSync(__dirname + '/inject_absurd.js', 'utf8');
const payload = '<script>' + inj + '\nwindow.__INJ_ABSURD__(' + JSON.stringify(sets) + ');</script>';
html = html.replace('</body>', payload + '</body>');
const tmp = '/tmp/absurd_probe.html';
fs.writeFileSync(tmp, html);
const r = cp.spawnSync('chromium', ['--headless=new', '--no-sandbox', '--disable-gpu',
  '--enable-unsafe-swiftshader', '--virtual-time-budget=120000', '--dump-dom', 'file://' + tmp],
  { maxBuffer: 1024 * 1024 * 200, encoding: 'utf8' });
const m = /<pre id="absurd-out">([\s\S]*?)<\/pre>/.exec(r.stdout || '');
if (!m) { console.log('NO-OUT len', (r.stdout || '').length); process.exit(1); }
const j = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
const camp = {};
j.rows.forEach(x => { camp[x.kind] = (camp[x.kind] || 0) + 1; });
console.log('组数', j.rows.length, JSON.stringify(camp));
j.rows.filter(x => x.kind === 'PARTIAL-LOSS').forEach(x =>
  console.log('  漏解', x.tag, x.combo, 'bin', x.bin, '整组', x.full, '→ 最佳子集', x.bestSubset, '(' + x.subset + ')'));
fs.writeFileSync('/sandbox/workspace/output/absurd_recheck.csv',
  'tag,combo,bin,full,bestSubset,subset,kind\n' +
  j.rows.map(x => [x.tag, '"' + x.combo + '"', x.bin, x.full, x.bestSubset, '"' + x.subset + '"', x.kind].join(',')).join('\n') + '\n');
console.log('CSV /sandbox/workspace/output/absurd_recheck.csv');
