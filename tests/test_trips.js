/* tests/test_trips.js — 分趟方案回归
   用法：node tests/test_trips.js [html]

   期望值来源：v30.0 基线实测（tests/expected_trips.json），不得为通过而修改。
   注意：playTrips 的实例构造不带 upright（v30 起即如此），
   所以含镜子的分趟结果在任务 A 前后应完全一致——这本身是回归证据。 */
'use strict';
var L = require('./lib.js');
var fs = require('fs');
var htmlPath = process.argv[2] || require('path').join(__dirname, '..', '..', 'output', 'index.html');
var A = L.loadArtifact(htmlPath);
var EXP_PATH = require('path').join(__dirname, 'expected_trips.json');
var EXPECTED = fs.existsSync(EXP_PATH) ? JSON.parse(fs.readFileSync(EXP_PATH, 'utf8')) : {};

function cat(name) { return A.CATALOG.filter(function (c) { return c.name === name; })[0]; }

/* 三个分趟场景：①关卡的 52 件限量版 ②含镜子的混合大件 ③含镜子的中等件 */
function scenarios() {
  var LV6 = A.LEVELS[5];
  return [
    { key: 'T1_L06进M仓', bin: 'M', items: L.cartOfLevel(A, LV6).map(function (c) { return [c.name, c.qty]; }) },
    { key: 'T2_沙发床垫镜子进L仓', bin: 'L', items: [['沙发', 4], ['床垫', 4], ['落地镜', 6]] },
    { key: 'T3_镜子衣柜进XL仓', bin: 'XL', items: [['落地镜', 8], ['衣柜', 3], ['书架', 4]] }
  ];
}

function run(html) {
  var H = L.loadArtifact(html);
  var out = {};
  scenarios().forEach(function (s) {
    var bin = L.storeBin(H, s.bin);
    H.setBin(bin);
    var inst = [];
    s.items.forEach(function (kv) {
      var c = H.CATALOG.filter(function (x) { return x.name === kv[0]; })[0];
      for (var q = 0; q < kv[1]; q++) inst.push({ name: kv[0] + '#' + q, l: c.l, w: c.w, h: c.h, soft: !!c.soft, cat: c });
    });
    var plan = H.planTrips(inst, bin);
    out[s.key] = {
      trips: plan.trips.length,
      counts: plan.trips.map(function (t) { return t.count; }),
      left: plan.left,
      total: inst.length
    };
  });
  return out;
}

if (require.main === module) {
  var got = run(htmlPath);
  var pass = 0, fail = 0;
  console.log('== test_trips 分趟 · ' + htmlPath + ' ==');
  Object.keys(got).forEach(function (k) {
    var e = EXPECTED[k], g = got[k];
    var same = e && e.trips === g.trips && JSON.stringify(e.counts) === JSON.stringify(g.counts) && e.left === g.left;
    if (same) pass++; else fail++;
    console.log((same ? 'PASS ' : 'DIFF ') + k + '：' + g.trips + ' 趟 ' + JSON.stringify(g.counts) +
                ' 剩 ' + g.left + ' / 共 ' + g.total + (e ? '　|| 期望 ' + e.trips + ' 趟 ' + JSON.stringify(e.counts) + ' 剩 ' + e.left : '　|| 无期望'));
  });
  console.log('\n结果：PASS ' + pass + ' / DIFF ' + fail);
  process.exit(fail ? 1 : 0);
}
module.exports = { run: run };
