/* tests/enum_custom.js — P0-2 隐含参数枚举（自建尺寸 / 插口箱 / 材质 / 手动侧放 / 自定义仓室）
 * 用法：node tests/enum_custom.js --file=<产物html> [--bin=202,172,177] [--out=<dir>]
 * 产出：custom_all.csv（全量） + custom_failures.csv（只落 3/3 失败 或 util<40%）
 * 关键结论：是否存在「util < 30% 却判装不下」（荒谬失败）。
 */
'use strict';
var fs = require('fs'), cp = require('child_process'), path = require('path');
var args = process.argv.slice(2);
function opt(n, d) { var h = args.filter(function (a) { return a.indexOf('--' + n + '=') === 0; })[0]; return h ? h.slice(n.length + 3) : d; }
var file = path.resolve(opt('file', '/sandbox/workspace/output/index.html'));
var bin = opt('bin', '202,172,177').split(',').map(Number);
var outDir = path.resolve(opt('out', '/sandbox/workspace/output'));
if (!fs.existsSync(file)) { console.error('产物不存在：' + file); process.exit(2); }

var CHROME_ARGS = ['--headless', '--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader',
  '--use-gl=angle', '--use-angle=swiftshader', '--hide-scrollbars', '--window-size=1280,900',
  '--virtual-time-budget=300000'];

var html = fs.readFileSync(file, 'utf8');
var inj = fs.readFileSync(path.join(__dirname, 'inject_enum_custom.js'), 'utf8');
var lim = parseInt(opt('limit', '0'), 10);
var pre = '<scr' + 'ipt>window.__CUSTOM_OPTS__=' + JSON.stringify({ bin: { l: bin[0], w: bin[1], h: bin[2] }, seed: 20261113, limit: lim, skipCB: (opt('skipcb','0')==='1'), stopAt: opt('stopat',''), sideN: parseInt(opt('siden','600'),10) }) + ';</scr' + 'ipt>';
var tag = pre + '<scr' + 'ipt>' + inj + '</scr' + 'ipt>';
var i = html.lastIndexOf('</body>');
html = (i < 0) ? html + tag : html.slice(0, i) + tag + html.slice(i);
var tmp = '/tmp/enum_custom_page.html';
fs.writeFileSync(tmp, html);
console.log('target = ' + file + '  (' + fs.statSync(file).size + ' B)');

var r = cp.spawnSync('chromium', CHROME_ARGS.concat(['--dump-dom', 'file://' + tmp]),
  { encoding: 'utf8', timeout: 900000, maxBuffer: 1024 * 1024 * 1024 });
var m = /<pre id="custom-out"[^>]*>(\{[\s\S]*?)<\/pre>/i.exec(r.stdout || '');
if (!m) {
  console.log('NO-OUTPUT status=' + r.status + ' signal=' + r.signal +
    ' outlen=' + ((r.stdout || '').length) + ' errlen=' + ((r.stderr || '').length));
  console.log('stderr tail=' + (r.stderr || '').slice(-400));
  console.log('stdout tail=' + (r.stdout || '').slice(-400));
  process.exit(3);
}
var R = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
if (!R.ok) { console.log('PAGE-ERR ' + R.err); process.exit(3); }

console.log('池规模 ' + JSON.stringify(R.poolSizes) + '  实际跑 ' + R.n + ' 组');
var head = ['tag', 'combo', 'dims', 'bin', 'count', 'total', 'util_pct', 'vol_sum_L', 'failed', 'ms', 'tight_edge', 'gap_l|w|h', 'note'];
var all = [head.join(',')], fails = [head.join(',')];
R.rows.forEach(function (x) {
  var note = (x.customOk !== undefined) ? ('custom applied=' + x.customOk + ' err=' + (x.customErr || '-')) : '';
  var line = [x.tag, '"' + x.names + '"', '"' + x.dims + '"', x.bin, x.count, x.total, x.util,
    x.vol, '"' + (x.failed || '') + '"', x.ms, x.tight, '"' + x.gap + '"', '"' + note + '"'].join(',');
  all.push(line);
  if (x.count < x.total || x.util < 40) fails.push(line);
});
fs.writeFileSync(path.join(outDir, 'custom_all.csv'), all.join('\n') + '\n', 'utf8');
fs.writeFileSync(path.join(outDir, 'custom_failures.csv'), fails.join('\n') + '\n', 'utf8');

function group(tag) {
  var g = R.rows.filter(function (x) { return x.tag === tag; });
  var full = g.filter(function (x) { return x.count === x.total; }).length;
  var bad = g.filter(function (x) { return x.count < x.total && x.util < 30; }).length;
  var low30 = g.filter(function (x) { return x.count < x.total && x.util < 30; });
  return { n: g.length, full: full, bad: bad, low30: low30, g: g };
}
console.log('\n=== 分组结果 ===');
['A', 'B', 'S'].forEach(function (t) {
  var s = group(t);
  console.log('  ' + t + '  组数 ' + s.n + '  全装下 ' + s.full + '  未全装 ' + (s.n - s.full) +
    '  荒谬失败(util<30%) ' + s.bad);
});
var cbRows = R.rows.filter(function (x) { return /^CB/.test(x.tag); });
console.log('\n=== 自定义仓室 5 种（走真实表单）===');
cbRows.forEach(function (x) {
  console.log('  ' + x.tag + ' bin=' + x.bin + '  ' + x.names + '  util=' + x.util + '%  count=' + x.count +
    '/' + x.total + '  applied=' + x.customOk + (x.customErr ? '  err=' + x.customErr : ''));
});

console.log('\n=== 路径校验（材质 / 手动）===');
R.checks.forEach(function (c) { console.log('  ' + (c.ok ? 'OK  ' : 'FAIL') + ' ' + c.k + '  ' + c.detail); });

console.log('\n=== 荒谬失败全量（util<30% 且未全装下）===');
var allBad = R.rows.filter(function (x) { return x.count < x.total && x.util < 30; });
if (!allBad.length) console.log('  无 —— 不存在「利用率<30% 却判装不下」');
allBad.slice(0, 30).forEach(function (x) {
  console.log('  ' + x.tag + '  ' + x.names + '  util=' + x.util + '%  count=' + x.count + '/' + x.total + '  failed=' + x.failed);
});

console.log('\n=== 未全装下且 util≥30%（可解释：真装不下）前 15 ===');
R.rows.filter(function (x) { return x.count < x.total && x.util >= 30; })
  .sort(function (a, b) { return b.util - a.util; }).slice(0, 15).forEach(function (x) {
    console.log('  ' + x.tag + '  ' + x.names + '  util=' + x.util + '%  count=' + x.count + '/' + x.total + '  failed=' + x.failed);
  });

console.log('\n=== 汇总 ===');
console.log('总组数 ' + R.n + '   avg ' + R.avgMs + ' ms   max ' + R.maxMs + ' ms');
console.log('全量 CSV  ' + path.join(outDir, 'custom_all.csv'));
console.log('失败 CSV  ' + path.join(outDir, 'custom_failures.csv') + '（' + (fails.length - 1) + ' 行）');
process.exit(0);
