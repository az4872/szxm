/* tests/guard200.js — 200ms 性能守卫实测（P0-1-c）
 * 用法：node tests/guard200.js --file=<产物html> [--bin=202,172,177] [--csv=...]
 * 判据：每条 wall_ms ≤ PACK_MS_CAP + 合理余量（一次 packCore 的粒度，实测控制在 cap×2 内），
 *       ret._ms 必须回填，超限组 _guard 应为 'timeout'。
 */
'use strict';
var fs = require('fs'), cp = require('child_process'), path = require('path');
var args = process.argv.slice(2);
function opt(n, d) { var h = args.filter(function (a) { return a.indexOf('--' + n + '=') === 0; })[0]; return h ? h.slice(n.length + 3) : d; }
var file = path.resolve(opt('file', '/sandbox/workspace/output/index.html'));
var bin = opt('bin', '202,172,177').split(',').map(Number);
var csvPath = path.resolve(opt('csv', '/sandbox/workspace/output/guard200.csv'));
if (!fs.existsSync(file)) { console.error('产物不存在：' + file); process.exit(2); }

var CHROME_ARGS = ['--headless', '--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader',
  '--use-gl=angle', '--use-angle=swiftshader', '--hide-scrollbars', '--window-size=1280,900',
  '--virtual-time-budget=300000'];

var html = fs.readFileSync(file, 'utf8');
var inj = fs.readFileSync(path.join(__dirname, 'inject_guard.js'), 'utf8');
var pre = '<scr' + 'ipt>window.__ENUM66_OPTS__=' + JSON.stringify({ bin: { l: bin[0], w: bin[1], h: bin[2] }, seed: 20261113 }) + ';</scr' + 'ipt>';
var tag = pre + '<scr' + 'ipt>' + inj + '</scr' + 'ipt>';
var i = html.lastIndexOf('</body>');
html = (i < 0) ? html + tag : html.slice(0, i) + tag + html.slice(i);
var tmp = '/tmp/guard_page.html';
fs.writeFileSync(tmp, html);
console.log('target = ' + file + '  (' + fs.statSync(file).size + ' B)');

var r = cp.spawnSync('chromium', CHROME_ARGS.concat(['--dump-dom', 'file://' + tmp]),
  { encoding: 'utf8', timeout: 600000, maxBuffer: 512 * 1024 * 1024 });
var m = /<pre id="guard-out"[^>]*>(\{[\s\S]*?)<\/pre>/i.exec(r.stdout || '');
if (!m) { console.log('NO-OUTPUT tail=' + (r.stdout || '').slice(-600)); process.exit(3); }
var R = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
if (!R.ok) { console.log('PAGE-ERR ' + R.err); process.exit(3); }

console.log('PACK_MS_CAP = ' + R.cap + ' ms');
var lines = ['n,group,count,failed_n,ret_ms,wall_ms,guard,err,combo'];
R.rows.forEach(function (x) { lines.push(x.join(',')); });
fs.writeFileSync(csvPath, lines.join('\n') + '\n', 'utf8');

console.log('\n n   组  count failed  ret._ms  wall_ms  guard');
R.rows.forEach(function (x) {
  console.log('  ' + String(x[0]).padEnd(3) + String(x[1]).padStart(2) + '  ' +
    String(x[2]).padStart(3) + String(x[3]).padStart(7) + String(x[4]).padStart(9) +
    String(x[5]).padStart(9) + '  ' + (x[6] || '-') + (x[7] ? '  ERR:' + x[7] : ''));
});
var walls = R.rows.map(function (x) { return x[5]; });
var mx = Math.max.apply(null, walls);
var over = R.rows.filter(function (x) { return x[5] > R.cap; }).length;
var guards = R.rows.filter(function (x) { return x[6] === 'timeout'; }).length;
var noMs = R.rows.filter(function (x) { return x[4] < 0; }).length;
console.log('\n=== 汇总 ===');
console.log('20 组  wall max = ' + mx.toFixed(1) + ' ms   （cap ' + R.cap + '）');
console.log('超 cap 组数   = ' + over);
console.log('_guard=timeout 组数 = ' + guards);
console.log('缺 _ms 字段组数 = ' + noMs + '   （必须为 0）');
console.log('CSV ' + csvPath);
process.exit(0);
