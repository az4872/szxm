/* tests/enum56.js — 5 件 / 6 件各 20 组，真 Chromium + 真产物页面 + 页面自己的内核
 * 用途：P0-1-b「>4 件失败件局部回溯」改动前/改动后对比。
 * 用法：
 *   node tests/enum56.js --file=<产物html> [--csv=<out.csv>] [--solid] [--label=before]
 * 判据：全装下组数（count==件数）越多越好；maxMs 必须 < PACK_MS_CAP+余量。
 */
'use strict';
var fs = require('fs');
var cp = require('child_process');
var path = require('path');

var args = process.argv.slice(2);
function opt(name, def) {
  var hit = args.filter(function (a) { return a.indexOf('--' + name + '=') === 0; })[0];
  return hit ? hit.slice(name.length + 3) : def;
}
var flag = function (n) { return args.indexOf('--' + n) >= 0; };

var file = path.resolve(opt('file', '/sandbox/workspace/output/index.html'));
var bin = opt('bin', '202,172,177').split(',').map(Number);
var solid = flag('solid');
var seed = parseInt(opt('seed', '20261113'), 10);
var label = opt('label', 'run');
var stamp = new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace(/[-:T]/g, '').slice(0, 12);
var csvPath = path.resolve(opt('csv', '/sandbox/workspace/output/enum56_' + label + '_' + stamp + '.csv'));

if (!fs.existsSync(file)) { console.error('产物不存在：' + file); process.exit(2); }

var CHROME_ARGS = [
  '--headless', '--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader',
  '--use-gl=angle', '--use-angle=swiftshader', '--hide-scrollbars',
  '--window-size=1280,900', '--virtual-time-budget=300000'
];

function build() {
  var html = fs.readFileSync(file, 'utf8');
  var inj = fs.readFileSync(path.join(__dirname, 'inject_enum56.js'), 'utf8');
  var pre = '<scr' + 'ipt>window.__ENUM56_OPTS__=' +
    JSON.stringify({ bin: { l: bin[0], w: bin[1], h: bin[2] }, solid: solid, seed: seed }) + ';</scr' + 'ipt>';
  var tag = pre + '<scr' + 'ipt>' + inj + '</scr' + 'ipt>';
  var i = html.lastIndexOf('</body>');
  html = (i < 0) ? html + tag : html.slice(0, i) + tag + html.slice(i);
  var tmp = '/tmp/enum56_page_' + label + '.html';
  fs.writeFileSync(tmp, html);
  return tmp;
}

console.log('target = ' + file + '  (' + fs.statSync(file).size + ' B)  label=' + label +
  '  ' + (solid ? '[solid]' : '[mesh]') + '  seed=' + seed);

var tmp = build();
var a = CHROME_ARGS.concat(['--dump-dom', 'file://' + tmp]);
var r = cp.spawnSync('chromium', a, { encoding: 'utf8', timeout: 600000, maxBuffer: 512 * 1024 * 1024 });
if (r.error && String(r.error.message).indexOf('ENOENT') >= 0) {
  console.log('SKIP  本机没有 chromium'); process.exit(2);
}
var m = /<pre id="enum56-out"[^>]*>(\{[\s\S]*?)<\/pre>/i.exec(r.stdout || '');
if (!m) { console.log('NO-OUTPUT tail=' + (r.stdout || '').slice(-600)); process.exit(3); }
var txt = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
var R = JSON.parse(txt);
if (!R.ok) { console.log('PAGE-ERR ' + R.err); process.exit(3); }

var names = R.pool.map(function (s) { return s.split('|')[0]; });
var dims = R.pool.map(function (s) { return s.split('|')[1]; });
var lines = ['n,group,idx,combo,dims,vol_sum_L,count,util_pct,failed,wall_ms,ret_ms,guard'];
R.rows.forEach(function (row) {
  var idx = row[2].split('-').map(Number);
  var combo = idx.map(function (i) { return names[i]; }).join('+');
  var dm = idx.map(function (i) { return dims[i]; }).join(' / ');
  lines.push([row[0], row[1], '"' + row[2] + '"', combo, '"' + dm + '"', row[5], row[3], row[4],
    '"' + (row[7] || '') + '"', row[6], row[8], row[9]].join(','));
});
fs.writeFileSync(csvPath, lines.join('\n') + '\n', 'utf8');

function stat(k) {
  var g = R.rows.filter(function (x) { return x[0] === k; });
  var full = g.filter(function (x) { return x[3] === k; }).length;
  var cnt = g.reduce(function (s, x) { return s + x[3]; }, 0);
  var mx = Math.max.apply(null, g.map(function (x) { return x[6]; }));
  return { n: g.length, full: full, cnt: cnt, mx: mx };
}
var s5 = stat(5), s6 = stat(6);
console.log('\n=== ' + label + ' ===');
console.log('5 件：全装下 ' + s5.full + '/20，总件数 ' + s5.cnt + '/100，单组最大 ' + s5.mx.toFixed(1) + ' ms');
console.log('6 件：全装下 ' + s6.full + '/20，总件数 ' + s6.cnt + '/120，单组最大 ' + s6.mx.toFixed(1) + ' ms');
console.log('全部 40 组 avg ' + R.avgMs + ' ms  max ' + R.maxMs + ' ms');
console.log('CSV ' + csvPath);
console.log('\n未全装下的组：');
R.rows.filter(function (x) { return x[3] < x[0]; }).forEach(function (row) {
  var idx = row[2].split('-').map(Number);
  console.log('  n=' + row[0] + ' #' + row[1] + '  ' + idx.map(function (i) { return names[i]; }).join('+') +
    '  util=' + row[4] + '%  count=' + row[3] + '  failed=' + row[7]);
});
process.exit(0);
