/* tests/enum3.js — 2024 组三件全枚举（真 Chromium + 真产物页面 + 页面自己的内核）
 *
 * 用法：
 *   node tests/enum3.js                                  # 默认读 /sandbox/workspace/output/index.html，仓 202×172×177
 *   node tests/enum3.js --file=<产物html> --bin=202,172,177 --csv=<输出.csv>
 *   node tests/enum3.js --solid                          # 对照：强制实心盒体素
 *
 * 判据口径（与任务书一致）：
 *   pass = count>=3 的组数；fail = count<3 的组数；bad = 失败且 util<30% 的组数
 *   avgMs/maxMs = 单次 packOnly 耗时（页面内 performance.now() 计时）
 *
 * 退出码：0 跑通 / 2 环境缺 chromium 或产物不存在 / 3 页面无输出
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
var flag = function (name) { return args.indexOf('--' + name) >= 0; };

var file = path.resolve(opt('file', '/sandbox/workspace/output/index.html'));
var bin = (opt('bin', '202,172,177')).split(',').map(Number);
var solid = flag('solid');
var stamp = new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace(/[-:T]/g, '').slice(0, 12);
var csvPath = path.resolve(opt('csv', '/sandbox/workspace/output/enum3_2024_' + stamp + '.csv'));
var topN = parseInt(opt('top', '20'), 10);

if (!fs.existsSync(file)) { console.error('产物不存在：' + file); process.exit(2); }

var CHROME_ARGS = [
  '--headless', '--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader',
  '--use-gl=angle', '--use-angle=swiftshader', '--hide-scrollbars',
  '--window-size=1280,900', '--virtual-time-budget=300000'
];

function build() {
  var html = fs.readFileSync(file, 'utf8');
  var inj = fs.readFileSync(path.join(__dirname, 'inject_enum3.js'), 'utf8');
  var pre = '<scr' + 'ipt>window.__ENUM_OPTS__=' +
    JSON.stringify({ bin: { l: bin[0], w: bin[1], h: bin[2] }, solid: solid }) + ';</scr' + 'ipt>';
  var tag = pre + '<scr' + 'ipt>' + inj + '</scr' + 'ipt>';
  var i = html.lastIndexOf('</body>');
  html = (i < 0) ? html + tag : html.slice(0, i) + tag + html.slice(i);
  var tmp = '/tmp/enum3_page.html';
  fs.writeFileSync(tmp, html);
  return tmp;
}

console.log('target = ' + file + '  (' + fs.statSync(file).size + ' B)');
console.log('bin    = ' + bin.join('×') + (solid ? '  [solid 体素对照]' : '  [真实网格体素]'));

var tmp = build();
var a = CHROME_ARGS.concat(['--dump-dom', 'file://' + tmp]);
var r = cp.spawnSync('chromium', a, { encoding: 'utf8', timeout: 600000, maxBuffer: 512 * 1024 * 1024 });
if (r.error && String(r.error.message).indexOf('ENOENT') >= 0) {
  console.log('SKIP  本机没有 chromium — 先 apt-get install -y chromium'); process.exit(2);
}
var m = /<pre id="enum3-out"[^>]*>(\{[\s\S]*?)<\/pre>/i.exec(r.stdout || '');
if (!m) { console.log('NO-OUTPUT tail=' + (r.stdout || '').slice(-800)); process.exit(3); }
var txt = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
var R = JSON.parse(txt);
if (!R.ok) { console.log('PAGE-ERR ' + R.err); process.exit(3); }

/* 名字映射：pool 顺序即 i/j/k 下标 */
var names = R.pool.map(function (s) { return s.split('|')[0]; });
var dims = R.pool.map(function (s) { return s.split('|')[1]; });

var lines = ['i,j,k,combo,dims,vol_sum_L,count,util_pct,failed,ms,edge,vol_L'];
R.rows.forEach(function (row) {
  var combo = names[row[0]] + '+' + names[row[1]] + '+' + names[row[2]];
  var dm = dims[row[0]] + ' / ' + dims[row[1]] + ' / ' + dims[row[2]];
  lines.push([row[0], row[1], row[2], combo, '"' + dm + '"', row[6], row[3], row[4],
    '"' + (row[5] || '') + '"', row[7], row[8], row[9]].join(','));
});
fs.writeFileSync(csvPath, lines.join('\n') + '\n', 'utf8');

var n = R.n, pass = R.pass, fail = R.fail, bad = R.bad;
console.log('\n=== 汇总 ===');
console.log('组数        ' + n + '   （期望 2024 = C(22+3-1,3)）');
console.log('通过组数    ' + pass);
console.log('失败组数    ' + fail + '   ← badCount');
console.log('荒谬失败    ' + bad + '   （util<30% 且失败）');
console.log('单次 avg    ' + R.avgMs + ' ms');
console.log('单次 max    ' + R.maxMs + ' ms');
console.log('CSV         ' + csvPath);

console.log('\n=== 失败组明细（util 降序，前 ' + topN + '）===');
var fails = R.rows.filter(function (x) { return x[3] < 3; })
  .sort(function (p, q) { return q[4] - p[4]; });
fails.slice(0, topN).forEach(function (row) {
  console.log('  ' + (names[row[0]] + '+' + names[row[1]] + '+' + names[row[2]]) +
    '  util=' + row[4] + '%  vol=' + row[6] + 'L  count=' + row[3] + '  failed=' + row[5]);
});
if (fails.length > topN) console.log('  … 共 ' + fails.length + ' 组，全量见 CSV');

console.log('\n=== 荒谬失败（util<30%）===');
var bads = R.rows.filter(function (x) { return x[3] < 3 && x[4] < 30; });
if (!bads.length) console.log('  无');
bads.forEach(function (row) {
  console.log('  ' + (names[row[0]] + '+' + names[row[1]] + '+' + names[row[2]]) +
    '  util=' + row[4] + '%  vol=' + row[6] + 'L');
});
process.exit(0);
