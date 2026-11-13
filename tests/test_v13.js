/* tests/test_v13.js — 骨架回归 12 项
   用法：node tests/test_v13.js [html]
   第 7-10 项为本次任务书 A 的专项验证：mirror 三姿态在装填中真实可选。 */
'use strict';
var L = require('./lib.js');
var htmlPath = process.argv[2] || require('path').join(__dirname, '..', '..', 'output', 'index.html');
var A = L.loadArtifact(htmlPath);

var pass = 0, fail = 0;
function ok(cond, no, label, extra) {
  if (cond) { pass++; console.log('  PASS ' + no + ' ' + label); }
  else { fail++; console.log('  FAIL ' + no + ' ' + label + (extra ? '  [' + extra + ']' : '')); }
}
function cat(id) { return A.CATALOG.filter(function (c) { return c.id === id; })[0]; }

console.log('== test_v13 骨架回归 12 项 · ' + htmlPath + ' ==');

/* 1. orientations 去重与前向完整 */
(function () {
  var o6 = A.orientations({ l: 10, w: 20, h: 30 });
  var o1 = A.orientations({ l: 10, w: 10, h: 10 });
  ok(o6.length === 6 && o1.length === 1, '01', 'orientations 去重（30×20×10→6 种，正方体→1 种）',
     o6.length + '/' + o1.length);
})();

/* 2. 间隙规则：硬物 +2、软物 +1 */
(function () {
  var hard = A.effDims({ l: 100, w: 50, h: 20 });
  var soft = A.effDims({ l: 100, w: 50, h: 20, soft: true });
  /* P0-C2 规则变更：effDims 返回真实尺寸（物品间零间隙），间隙只留给门洞（gapOf 不变） */
  ok(hard.l === 100 && hard.h === 20 && soft.l === 100 && soft.h === 20 &&
     A.gapOf({}) === 2 && A.gapOf({ soft: true }) === 1,
     '02', 'effDims 真实尺寸（零间隙）/ gapOf 门洞余量不变');
})();

/* 3. 全装下：L01 四纸箱一行李箱进 1m³ */
(function () {
  var LV = A.LEVELS[0], bin = L.storeBin(A, LV.bin);
  A.setBin(bin);
  var r = A.pack({ l: bin.l, w: bin.w, h: bin.h }, L.instFromCart(A, L.cartOfLevel(A, LV)));
  ok(r.count === r.total && r.failed.length === 0, '03', 'L01 全部装下', r.count + '/' + r.total);
})();

/* 4. 装不下：L02 沙发+床垫+自行车进 3m³ 应有失败件（产品真实行为） */
(function () {
  var LV = A.LEVELS[1], bin = L.storeBin(A, LV.bin);
  A.setBin(bin);
  var r = A.pack({ l: bin.l, w: bin.w, h: bin.h }, L.instFromCart(A, L.cartOfLevel(A, LV)));
  ok(r.failed.length === r.total && r.count === 0, '04', 'L02 三件大件装不进 3m³（0/3）', r.count + '/' + r.total);
})();

/* 5. upright 已是「软优先」而非硬约束：洗衣机进矮仓，带不带 upright 都装得下
   期望值由文创侧 2026-11-12 裁定更新（第 8 轮 Q1「upright 不扩」/ Q2「不许一刀切」：
   upright 由「排除倒放」的硬约束改为「优先直立 + 高度罚差额补偿」的软优先，
   放不下自然回落到其余朝向。旧期望 rUp=0 是硬约束时代的判据，已失效。） */
(function () {
  var w = cat('washer');
  var rUp = A.pack({ l: 90, w: 90, h: 70 }, [{ name: 'x', l: w.l, w: w.w, h: w.h, upright: true }]);
  var rFree = A.pack({ l: 90, w: 90, h: 70 }, [{ name: 'x', l: w.l, w: w.w, h: w.h }]);
  ok(rUp.count === 1 && rFree.count === 1, '05', 'upright 为软优先（洗衣机→矮仓：带约束也装得下，不排除倒放）',
     rUp.count + '/' + rFree.count);
})();

/* 6. mirror 六朝向全开（任务 A 前提） */
(function () {
  var m = cat('mirror');
  var os = A.orientations(A.effDims({ l: m.l, w: m.w, h: m.h }));
  ok(os.length === 6, '06', 'mirror 有效尺寸 6 朝向全开', os.length + ' 种');
})();

/* 7-9. 三姿态各自在唯一可行仓中装下（任务 A 核心证据） */
(function () {
  var m = cat('mirror');
  var base = { name: 'mirror', l: m.l, w: m.w, h: m.h };
  var cases = [
    ['07', { l: 50, w: 12, h: 170 }, [40, 5, 160], '立放（160 竖起为高）'],
    ['08', { l: 170, w: 45, h: 12 }, [160, 40, 5], '平放（160×40 躺平，5cm 高）'],
    ['09', { l: 170, w: 12, h: 45 }, [160, 5, 40], '侧放（160×5 侧面着地，40cm 高）']
  ];
  cases.forEach(function (c) {
    var r = A.pack(c[1], [Object.assign({}, base)]);
    var p = r.placed[0];
    var got = p ? [p.l, p.w, p.h] : null;
    ok(r.count === 1 && got && got.join(',') === c[2].join(','), c[0], 'mirror ' + c[3] + ' 装下且占位正确',
       '占位 ' + (got ? got.join('×') : '未装下'));
  });
})();

/* 10. 对照：upright 为软优先时三种姿态都可装（立 / 平 / 侧 各 1 件）
   第13轮第3条（v8_202611132312）裁定：期望由「立 0 / 平 1 / 侧 1」改为「1 / 1 / 1」。
   算术：立放 = 160 竖起为高，需仓高 ≥160（本仓 170，够），底面 40×5 ≤ 50×12（够），
        故立放装得下；平放 160×40×5 需 170×45×12（够）；侧放 160×5×40 需 170×12×45（够）。
   旧期望「立 0 / 平 1 / 侧 0」因 upright 已为 false（软优先）而失效，
   其前提「upright 硬锁竖直、仓高不足即装不下」已不存在。
   这是「期望过时」，不是「产品变强了」。 */
(function () {
  var m = cat('mirror');
  var it = function () { return { name: 'mirror', l: m.l, w: m.w, h: m.h, upright: true }; };
  var a = A.pack({ l: 50, w: 12, h: 170 }, [it()]);
  var b = A.pack({ l: 170, w: 45, h: 12 }, [it()]);
  var c = A.pack({ l: 170, w: 12, h: 45 }, [it()]);
  ok(a.count === 1 && b.count === 1 && c.count === 1, '10',
     '对照：upright 软优先下立放 / 平放 / 侧放均可装（立 1/平 1/侧 1）', a.count + '/' + b.count + '/' + c.count);
})();

/* 11. 路线判定三类可用：mirror 门洞/电梯/走廊均通过 */
(function () {
  var m = cat('mirror');
  var bin = L.storeBin(A, 'XL');
  A.setBin(bin);
  var rt = A.checkRoute([{ name: 'mirror', l: m.l, w: m.w, h: m.h }]);
  ok(rt.door[0].ok && rt.elevator[0].ok && rt.corridor[0].ok && rt.blocked.length === 0, '11',
     'mirror 过仓门/电梯/走廊拐角', JSON.stringify({ door: rt.door[0].mode, elev: rt.elevator[0].car, corridor: rt.corridor[0] }));
})();

/* 12. 分趟：超量清单 ≥2 趟，件数守恒（S 仓装 12 个纸箱，单趟最多 4 件） */
(function () {
  var bin = L.storeBin(A, 'S');
  A.setBin(bin);
  var box = cat('carton');
  var inst = [];
  for (var i = 0; i < 12; i++) inst.push({ name: 'c' + i, l: box.l, w: box.w, h: box.h });
  var plan = A.planTrips(inst, bin);
  var sum = plan.trips.reduce(function (s, t) { return s + t.count; }, 0);
  ok(plan.trips.length >= 2 && sum + plan.left === 12, '12', '分趟 ≥2 趟且件数守恒',
     plan.trips.length + ' 趟，装入 ' + sum + '，剩 ' + plan.left);
})();

console.log('\n结果：PASS ' + pass + ' / FAIL ' + fail);
process.exit(fail ? 1 : 0);
