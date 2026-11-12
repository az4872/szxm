/* tests/test_levels.js — 六关评分回归
   用法：node tests/test_levels.js [html]

   期望值来源：v30.0 基线产物（897,153 B，2026-11-08 14:10 构建）实测，
   记录于 tests/expected_levels.json。**本文件不得为让测试通过而修改期望值**；
   若产物行为变化，测试应报 DIFF，由验收方判断。 */
'use strict';
var L = require('./lib.js');
var fs = require('fs');
var htmlPath = process.argv[2] || require('path').join(__dirname, '..', 'output', 'szxm_cdn.html');
var A = L.loadArtifact(htmlPath);
var EXP_PATH = require('path').join(__dirname, 'expected_levels.json');
var EXPECTED = JSON.parse(fs.readFileSync(EXP_PATH, 'utf8'));

var pass = 0, fail = 0;
console.log('== test_levels 六关评分 · ' + htmlPath + ' ==');
console.log('关卡 | 仓 | 装下/总数 | 利用% | 拐角卡 | 分 | 星  （期望 || 实际）');

var rows = [];
for (var i = 0; i < A.LEVELS.length; i++) {
  var LV = A.LEVELS[i];
  var bin = L.storeBin(A, LV.bin);
  A.setBin(bin);
  var cart = L.cartOfLevel(A, LV);
  var inst = L.instFromCart(A, cart);
  var r = A.pack({ l: bin.l, w: bin.w, h: bin.h }, inst);

  var cornerN = 0;
  if (LV.corner) {
    for (var c = 0; c < cart.length; c++) {
      var cp = A.cornerPass({ l: cart[c].l, w: cart[c].w, h: cart[c].h }, A.ROUTE.cornerA, A.ROUTE.cornerB, A.ROUTE.cornerH);
      if (!cp.ok) cornerN++;
    }
  }
  var secs = LV.limit > 0 ? 30 : 0;
  var sc = L.levelScore(bin, LV, r, cornerN, secs);
  var got = { id: LV.id, bin: LV.bin, count: r.count, total: r.total,
              util: Math.round(r.util * 1000) / 10, cornerN: cornerN,
              pts: sc.pts, stars: sc.stars };
  var exp = EXPECTED[LV.id];
  var same = exp && ['count', 'total', 'util', 'cornerN', 'pts', 'stars'].every(function (k) { return exp[k] === got[k]; });
  if (same) pass++; else fail++;
  rows.push(got);

  var line = [LV.id, LV.bin, got.count + '/' + got.total, got.util + '%', got.cornerN, got.pts, got.stars].join(' | ');
  var ref = exp ? [exp.count + '/' + exp.total, exp.util + '%', exp.cornerN, exp.pts, exp.stars].join(' | ') : '（无期望值）';
  console.log((same ? 'PASS ' : 'DIFF ') + line + '　　|| 期望 ' + ref);
}

console.log('\n结果：PASS ' + pass + ' / DIFF ' + fail);
module.exports = { rows: rows };
process.exit(fail ? 1 : 0);
