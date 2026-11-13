/* tests/run_regress.js — 第13轮（任务书 v8_202611132312）R-1~R-6 回归用例
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

console.log('== R-1~R-6 回归（第13轮 · 任务书 v8_202611132312）· ' + htmlPath + ' ==');

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

/* R-5 L06 速度分边界（第13轮第1条 · v8_202611132312 终版）：
   未计时 secs=0 → 5700 且 speedPts=0（守卫只认「真计过时」）；注入 12 秒 → 5900；
   30 秒内不衰减；超时按 4 分/秒衰减。 */
(function () {
  var LV = A.LEVELS.filter(function (x) { return x.id === 'L06'; })[0];
  var bin = L.storeBin(A, LV.bin); A.setBin(bin);
  var cart = L.cartOfLevel(A, LV);
  var inst = L.instFromCart(A, cart);
  var r = A.pack({ l: bin.l, w: bin.w, h: bin.h }, inst);
  var s0 = L.levelScore(bin, LV, r, 0, 0);
  var s12 = L.levelScore(bin, LV, r, 0, 12);
  var p45 = L.levelScore(bin, LV, r, 0, 45).pts;
  var p60 = L.levelScore(bin, LV, r, 0, 60).pts;
  var ok = (s0.pts === 5700 && s0.speedPts === 0 && s12.pts === 5900 &&
            s12.speedPts === 200 && p45 === 5840 && p60 === 5780);
  rep('R-5', ok, 'L06 未计时 5700(速分0) / 注入12秒 5900(速分200) / 45秒 5840 / 60秒 5780',
      [s0.pts + '·速' + s0.speedPts, s12.pts + '·速' + s12.speedPts, p45, p60].join('/'));
  rep('R-5d', A.scoreDrift && A.scoreDrift.ok, '评分复刻与产物边界未漂移',
      A.scoreDrift ? ('产物 ' + A.scoreDrift.artifactOp + ' / 复刻 ' + A.scoreDrift.replicaOp) : '无哨兵');
  /* R-5e 取时路径自证：真路径 secs 只由 levelRunning ? 差值/1000 : 0 产生，无第二个来源，
     因此「向 levelScore 注入 secs=12 / 0」与浏览器级推时钟 12 秒 / 不推，喂给结算的是同一个量。 */
  var mm = A.html.match(/var secs = levelRunning \? \(nowMs\(\) - levelStartMs\) \/ 1000 : 0;/);
  var all = (A.html.match(/var secs =/g) || []).length;
  rep('R-5e', !!mm && all === 1, '取时路径唯一（secs = levelRunning ? 差值/1000 : 0），注入同源',
      mm ? ('命中 / 全篇 var secs = 共 ' + all + ' 处') : '未命中');
})();

/* R-6 四视口货舱完整可见：需真实浏览器布局，node 桩无法判定 → BLOCKED（不伪装 PASS） */
rep('R-6', null, '四视口货舱完整可见 1440×900/844×390/390×844/360×640',
    '需 chromium 实测画布与货舱包围盒，node 桩不可判');

console.log('\n结果：PASS ' + pass + ' / FAIL ' + fail + ' / BLOCKED ' + blocked);
process.exit(fail ? 1 : 0);
