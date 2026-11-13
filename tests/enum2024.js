/* tests/enum2024.js — 第13轮第4条（v8_202611132312）全枚举口径
   口径（不再从测试硬编码数组取）：
     基数 = 产物 __API__.catalog() 的全部品类（CATALOG 字面量 16 + BOX_LIST 6 = 22）
     组合 = 可重复取 3 件，i ≤ j ≤ k，组数 C(22+2,3) = C(24,3) = 2024
     每件 = Object.assign({}, cat) 全字段浅拷贝，禁止手写字段字面量
   输出：总数 / 未全装组数 / 只装1件 / 装2件 / 耗时 / 只装1件清单 / 装2件上界自证
   用法：node tests/enum2024.js [html] [仓= L] */
'use strict';
var L = require('./lib.js');
var path = require('path');
var htmlPath = process.argv[2] || path.join(__dirname, '..', '..', 'output', 'index.html');
var binKey = process.argv[3] || 'L';

var A = L.loadArtifact(htmlPath);
var CAT = A.CATALOG;
var N = CAT.length;
var combos = (N + 2) * (N + 1) * N / 6;
console.log('== enum2024 · 全枚举（第13轮第4条 · v8_202611132312）· ' + htmlPath + ' ==');
console.log('[基数] 产物目录品类 = ' + N + '（CATALOG 16 + BOX_LIST 6，按产物运行时 concat 后取值）');
console.log('[组合] 可重复取 3，i≤j≤k → C(' + N + '+2,3) = ' + combos + (combos === 2024 ? ' ✅ 对上 2024' : ' ❌ 不是 2024'));

var bin = L.storeBin(A, binKey);
var B = { l: bin.l, w: bin.w, h: bin.h };
console.log('[仓型] ' + binKey + ' ' + B.l + '×' + B.w + '×' + B.h + '（m³ ' + (B.l * B.w * B.h / 1e6).toFixed(3) + '）\n');

var t0 = Date.now();
var total = 0, notAll = [], one = [], two = [];
for (var i = 0; i < N; i++) {
  for (var j = i; j < N; j++) {
    for (var k = j; k < N; k++) {
      var its = [Object.assign({}, CAT[i]), Object.assign({}, CAT[j]), Object.assign({}, CAT[k])];
      var r = A.pack(B, its);
      total++;
      if (r.count < 3) {
        var rec = { names: [CAT[i].name, CAT[j].name, CAT[k].name], count: r.count,
                    cats: [CAT[i], CAT[j], CAT[k]], util: r.util, vols: its.map(function (x) { return x.l * x.w * x.h; }),
                    bases: its.map(function (x) { return x.l * x.w; }) };
        notAll.push(rec);
        if (r.count === 1) one.push(rec); else if (r.count === 2) two.push(rec);
      }
    }
  }
}
var ms = Date.now() - t0;

console.log('[结果] 组合 ' + total + ' / 未全装 ' + notAll.length + ' / 只装1件 ' + one.length + ' / 装2件 ' + two.length);
console.log('[耗时] ' + (ms / 1000).toFixed(1) + ' 秒');
console.log('[判据] 只装1件的组 ≤ 4 → ' + (one.length <= 4 ? 'PASS（' + one.length + '）' : 'FAIL（' + one.length + '）'));

console.log('\n--- 只装 1 件的组（必修项清单）---');
if (!one.length) console.log('  （无）');
one.forEach(function (r) {
  console.log('  ' + r.names.join(' + ') + '　count=' + r.count + '　利用 ' + (r.util * 100).toFixed(1) + '%');
});

console.log('\n--- 装 2 件的组（需上界自证：体积/底面积/叠放高度三项算术）---');
var pad = A.BIN_PAD || 0;
var W = B.l - 2 * pad, D = B.w - 2 * pad, H = B.h - 2 * pad;
var cap = W * D * H, floorA = W * D;
two.forEach(function (r) {
  var vs = r.vols.reduce(function (a, b) { return a + b; }, 0) / 1e6;
  var bs = r.bases.reduce(function (a, b) { return a + b; }, 0) / 1e4;
  var hmin = r.cats.map(function (c) { return Math.min(c.l, c.w, c.h); });
  var hsum = hmin.reduce(function (a, b) { return a + b; }, 0);
  console.log('  ' + r.names.join(' + ') +
    '\n    体积：三件和 ' + vs.toFixed(3) + ' m³ / 仓容 ' + (cap / 1e6).toFixed(3) + ' m³ = ' + (vs / (cap / 1e6) * 100).toFixed(0) + '%' +
    '｜底面积：和 ' + bs.toFixed(2) + ' / 仓底 ' + (floorA/1e4).toFixed(2) + ' m²' + (bs > floorA / 1e4 ? '（超 ' + (bs - floorA / 1e4).toFixed(2) + '，同层平铺不可能）' : '（未超，须查叠放）') +
    '\n    叠放：三件最小高 ' + hmin.join('+') + ' = ' + hsum + ' / 仓高 ' + H + (hsum > H ? '（超 ' + (hsum - H) + '，三者不能串成一柱，至少一件必须并排）' : ''));
});
if (two.length) {
  console.log('\n  逐组实际布局与剩余空隙（pack 已跑 packCore 60/0 两档 + exactPack 全枚举，仍为 2 件）：');
  two.forEach(function (r) {
    var p = A.pack({ l: B.l, w: B.w, h: B.h }, r.cats.map(function (c) { return Object.assign({}, c); }));
    var mx = 0, my = 0, mz = 0;
    p.placed.forEach(function (q) { mx = Math.max(mx, q.x + q.l); my = Math.max(my, q.y + q.w); mz = Math.max(mz, q.z + q.h); });
    var left = p.placed.map(function (q) { return q.name; });
    var third = null;
    r.cats.forEach(function (c) { var i = left.indexOf(c.name); if (i >= 0) left.splice(i, 1); else if (!third) third = c; });
    var t3 = third ? Math.min(third.l, third.w, third.h) : 0;
    console.log('    ' + r.names.join('+') + '　布局：' + p.placed.map(function (q) { return q.name + '(' + q.l + '×' + q.w + '×' + q.h + '@' + q.x + ',' + q.y + ',' + q.z + ')'; }).join(' / ') +
      '　占用包围盒 ' + mx + '×' + my + '×' + mz + '　余量 Δx=' + (W - mx) + ' Δy=' + (D - my) + ' Δz=' + (H - mz) +
      '　第三件 ' + (third ? third.name + ' 最小边长 ' + t3 : '—') + ((H - mz) < t3 && (W - mx) < t3 && (D - my) < t3 ? '（三向余量均小于该边长→无插入位）' : ''));
  });
}

console.log('\n[明细] 未全装全量：');
notAll.forEach(function (r) {
  console.log('  ' + r.count + '件 ' + r.names.join(' + '));
});
process.exit((combos === 2024 && one.length <= 4) ? 0 : 1);
