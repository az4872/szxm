/* tests/run_regress.js — 第13轮（任务书 v7_202611132030）R-1~R-6 回归用例
   用法：node tests/run_regress.js [html]
   输出：每行一条 PASS/FAIL/BLOCKED，末行汇总，供 run_all.sh 调用 */
'use strict';
var L = require('./lib.js');
var path = require('path');
var htmlPath = process.argv[2] || path.join(__dirname, '..', '..', 'output', 'index.html');
var A = L.loadArtifact(htmlPath);
var CAT = {};
A.CATALOG.forEach(function (c) { CAT[c.name] = c; });

var pass = 0, fail = 0, blocked = 0;
function rep(id, ok, label, detail) {
  if (ok === null) { blocked++; console.log('BLOCKED ' + id + ' ' + label + (detail ? '  [' + detail + ']' : '')); return; }
  if (ok) { pass++; console.log('PASS ' + id + ' ' + label + (detail ? '  [' + detail + ']' : '')); }
  else { fail++; console.log('FAIL ' + id + ' ' + label + (detail ? '  [' + detail + ']' : '')); }
}

/* 按「品类名×数量」组单，装入指定仓 */
function packIn(binId, list) {
  var bin = L.storeBin(A, binId); A.setBin(bin);
  var inst = [];
  list.forEach(function (kv) {
    var c = CAT[kv[0]];
    if (!c) throw new Error('无此品类 ' + kv[0]);
    for (var q = 0; q < kv[1]; q++) {
      inst.push({ name: kv[0] + '#' + q, l: c.l, w: c.w, h: c.h, soft: !!c.soft, upright: !!c.upright, cat: c });
    }
  });
  var r = A.pack({ l: bin.l, w: bin.w, h: bin.h }, inst);
  return { bin: bin, r: r, total: inst.length, util: r.util };
}

console.log('== R-1~R-6 回归（第13轮 · 任务书 v7_202611132030）· ' + htmlPath + ' ==');

/* R-1 迷你仓 L + 自行车 + 纸箱×2：3/3 全装，util≈22%，占用率 <40% 不得出现「装不下」 */
(function () {
  var o = packIn('L', [['自行车', 1], ['纸箱', 2]]);
  var utilPct = Math.round(o.util * 1000) / 10;
  rep('R-1', o.r.count === 3 && o.r.failed.length === 0,
      '迷你仓L+自行车+纸箱×2 全装（期望 3/3）', o.r.count + '/' + o.total + ' util ' + utilPct + '%');
})();

/* R-2 迷你仓 L + 衣柜×3：≥2 件 */
(function () {
  var o = packIn('L', [['衣柜', 3]]);
  rep('R-2', o.r.count >= 2, '迷你仓L+衣柜×3 ≥2 件', o.r.count + '/' + o.total);
})();

/* R-3 迷你仓 L + 沙发 + 衣柜×2：≥2 件 */
(function () {
  var o = packIn('L', [['沙发', 1], ['衣柜', 2]]);
  rep('R-3', o.r.count >= 2, '迷你仓L+沙发+衣柜×2 ≥2 件', o.r.count + '/' + o.total);
})();

/* R-4 迷你仓 L + 跑步机×2 + 衣柜：≥2 件 */
(function () {
  var o = packIn('L', [['跑步机', 2], ['衣柜', 1]]);
  rep('R-4', o.r.count >= 2, '迷你仓L+跑步机×2+衣柜 ≥2 件', o.r.count + '/' + o.total);
})();

/* R-5 L06 速度分边界：0 秒 = 5900（D-2 生效后）、30 秒内不衰减、超时按 4 分/秒衰减 */
(function () {
  var LV = A.LEVELS.filter(function (x) { return x.id === 'L06'; })[0];
  var bin = L.storeBin(A, LV.bin); A.setBin(bin);
  var cart = L.cartOfLevel(A, LV);
  var inst = L.instFromCart(A, cart);
  var r = A.pack({ l: bin.l, w: bin.w, h: bin.h }, inst);
  var p0 = L.levelScore(bin, LV, r, 0, 0).pts;
  var p12 = L.levelScore(bin, LV, r, 0, 12).pts;
  var p45 = L.levelScore(bin, LV, r, 0, 45).pts;
  var p60 = L.levelScore(bin, LV, r, 0, 60).pts;
  var ok = (p0 === 5900 && p12 === 5900 && p45 === 5840 && p60 === 5780);
  rep('R-5', ok, 'L06 速度分边界 0/12/45/60 秒 = 5900/5900/5840/5780',
      [p0, p12, p45, p60].join('/'));
  rep('R-5d', A.scoreDrift && A.scoreDrift.ok, '评分复刻与产物边界未漂移',
      A.scoreDrift ? ('产物 ' + A.scoreDrift.artifactOp + ' / 复刻 ' + A.scoreDrift.replicaOp) : '无哨兵');
})();

/* R-6 四视口货舱完整可见：需真实浏览器布局，node 桩无法判定 → BLOCKED（不伪装 PASS） */
rep('R-6', null, '四视口货舱完整可见 1440×900/844×390/390×844/360×640',
    '需 chromium 实测画布与货舱包围盒，node 桩不可判');

console.log('\n结果：PASS ' + pass + ' / FAIL ' + fail + ' / BLOCKED ' + blocked);
process.exit(fail ? 1 : 0);
