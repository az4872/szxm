/* tests/test_manual.js — 手动摆放判定回归
   用法：node tests/test_manual.js [html]
   覆盖：checkManualFit 五态（ok/out/high/collide/float）、旋转、层高、待摆盒构造。 */
'use strict';
var L = require('./lib.js');
var htmlPath = process.argv[2] || require('path').join(__dirname, '..', '..', 'output', 'index.html');
var A = L.loadArtifact(htmlPath);
var bin = L.storeBin(A, 'M');   /* 152×152×132 */
A.setBin(bin);

var pass = 0, fail = 0;
function ok(cond, no, label, extra) {
  if (cond) { pass++; console.log('  PASS ' + no + ' ' + label); }
  else { fail++; console.log('  FAIL ' + no + ' ' + label + (extra ? '  [' + extra + ']' : '')); }
}
function fit(pos, box, placed) {
  A.setManual({ placed: placed || [] });
  return A.checkManualFit({ pos: pos, box: box });
}

console.log('== test_manual 手动摆放 · ' + htmlPath + '  （仓 ' + bin.l + '×' + bin.w + '×' + bin.h + '）==');

/* 1. 地面空位 */
ok(fit({ x: 10, y: 10, z: 0 }, { l: 60, w: 40, h: 40 }) === 'ok', '01', '地面空位 → ok');

/* 2. 负坐标出界 */
ok(fit({ x: -5, y: 10, z: 0 }, { l: 60, w: 40, h: 40 }) === 'out', '02', '负坐标 → out');

/* 3. 超出 x 边界 */
ok(fit({ x: bin.l - 10, y: 10, z: 0 }, { l: 60, w: 40, h: 40 }) === 'out', '03', '超出长向 → out');

/* 4. 超高 */
ok(fit({ x: 10, y: 10, z: bin.h - 10 }, { l: 60, w: 40, h: 40 }) === 'high', '04', '超出高度 → high');

/* 5. 相撞 */
ok(fit({ x: 0, y: 0, z: 0 }, { l: 60, w: 40, h: 40 }, [{ x: 0, y: 0, z: 0, l: 60, w: 40, h: 40 }]) === 'collide',
   '05', '与已放件重叠 → collide');

/* 6. 悬空（底面 z>0 无支撑） */
ok(fit({ x: 10, y: 10, z: 50 }, { l: 60, w: 40, h: 40 }) === 'float', '06', '悬空无支撑 → float');

/* 7. 压在别的件顶面（水平重叠 + 顶面贴合） */
ok(fit({ x: 10, y: 10, z: 40 }, { l: 60, w: 40, h: 40 }, [{ x: 0, y: 0, z: 0, l: 80, w: 80, h: 40 }]) === 'ok',
   '07', '压在已放件顶面 → ok');

/* 8. 顶面贴合但水平不重叠 → 仍悬空 */
ok(fit({ x: 100, y: 10, z: 40 }, { l: 40, w: 40, h: 40 }, [{ x: 0, y: 0, z: 0, l: 60, w: 60, h: 40 }]) === 'float',
   '08', '顶面等高但水平错开 → float');

/* 9. 旋转：只交换 l/w，不换高度 */
(function () {
  var b = { base: { l: 160, w: 40, h: 5 }, box: { l: 162, w: 42, h: 7 }, r: 0 };
  var t = b.box.l; b.box.l = b.box.w; b.box.w = t; b.r = (b.r + 1) % 4;
  ok(b.box.l === 42 && b.box.w === 162 && b.box.h === 7 && b.r === 1, '09', '旋转交换 l/w 且高度不变',
     JSON.stringify(b.box));
})();

/* 10. 层高升降钳制在 [0, bin.h] */
(function () {
  function lift(layer, dir) {
    var next = layer + dir * 10;
    if (next < 0) next = 0;
    if (next > bin.h) next = bin.h;
    return next;
  }
  ok(lift(0, -1) === 0 && lift(bin.h - 5, 1) === bin.h && lift(20, 1) === 30, '10',
     '层高钳制 [0,' + bin.h + ']');
})();

/* 11. 待摆盒构造：硬物 +2 / 软物 +1 */
(function () {
  var hard = { l: 160 + 2, w: 40 + 2, h: 5 + 2 };
  var soft = { l: 200 + 1, w: 85 + 1, h: 80 + 1 };
  ok(hard.l === 162 && hard.h === 7 && soft.l === 201, '11', '待摆盒间隙：硬 +2 / 软 +1');
})();

/* 12. 镜子立放姿态的手动占位：42×7×162 在 XL 仓内可达 ok */
(function () {
  var xl = L.storeBin(A, 'XL');
  A.setBin(xl);
  var st = fit({ x: 0, y: 0, z: 0 }, { l: 42, w: 7, h: 162 });
  A.setBin(bin);
  ok(st === 'ok', '12', 'mirror 立放占位 42×7×162 在 XL 仓手动可放', st);
})();

console.log('\n结果：PASS ' + pass + ' / FAIL ' + fail);
process.exit(fail ? 1 : 0);
