/* tests/test_inspect.js — 16 品类模型数据完整性
   用法：node tests/test_inspect.js [html]

   判定口径（与 v30.0 基线一致）：
   · 完整性：16 品类全部检查（顶点数 / 索引数 / 越界 / 量化范围 / 顶点色长度）
   · 尺寸误差 ≤5%：仅对补模型阶段新增的 9 品类（含 mirror）严格判定。
     老 7 品类（box/suitcase/bike/sofa/mattress/fridge/shelf）的 dims 是原始扫描比例，
     渲染端由 makeObjSized 按实际包围盒非等比拉伸适配 CATALOG 尺寸，不属于尺寸误差项；
     其数据一致性由 audit_models.js 逐字段比对 v30 基线。 */
'use strict';
var L = require('./lib.js');
var htmlPath = process.argv[2] || require('path').join(__dirname, '..', 'output', 'szxm_cdn.html');
var A = L.loadArtifact(htmlPath);

/* 老 7 品类：模型原始比例，尺寸豁免 */
var LEGACY = ['box', 'suitcase', 'bike', 'sofa', 'mattress', 'fridge', 'shelf'];

function decI16(s) {
  var b = Buffer.from(s, 'base64'), a = [];
  for (var i = 0; i < b.length; i += 2) a.push(b.readInt16LE(i));
  return a;
}
function decU16(s) {
  var b = Buffer.from(s, 'base64'), a = [];
  for (var i = 0; i < b.length; i += 2) a.push(b.readUInt16LE(i));
  return a;
}

var pass = 0, fail = 0, exempt = 0;
console.log('== test_inspect 16 品类模型 · ' + htmlPath + ' ==');
console.log('品类 | 顶点 | 三角 | 越界 | 顶点范围 | 顶点色 | dims换算三轴 vs 目录');

A.CATALOG.forEach(function (c) {
  var key = c.mesh, d = A.MESH_DATA[key], probs = [], notes = [];
  if (!d) { console.log('FAIL ' + c.name + ' 无模型数据（' + key + '）'); fail++; return; }

  var verts = decI16(d.pos), idx = decU16(d.idx);
  if (verts.length !== d.verts * 3) probs.push('顶点数不符(' + verts.length + '/' + d.verts * 3 + ')');
  if (idx.length !== d.tris * 3) probs.push('索引数不符(' + idx.length + '/' + d.tris * 3 + ')');
  if (!d.qscale) probs.push('缺 qscale（非量化格式）');
  var maxI = 0; for (var i = 0; i < idx.length; i++) if (idx[i] > maxI) maxI = idx[i];
  if (maxI >= d.verts) probs.push('索引越界(' + maxI + '>=' + d.verts + ')');

  var qs = d.qscale, lo = 1e9, hi = -1e9;
  for (var k = 0; k < verts.length; k++) { var v = verts[k] * qs; if (v < lo) lo = v; if (v > hi) hi = v; }
  if (lo < -0.5001 || hi > 0.5001) probs.push('顶点超 [-0.5,0.5](' + lo.toFixed(3) + '~' + hi.toFixed(3) + ')');

  if (d.col && Buffer.from(d.col, 'base64').length !== d.verts * 3) probs.push('顶点色长度不符');

  /* 三轴比例（模型 x=长 l，y=高 h，z=宽 w） */
  var want = [c.l, c.h, c.w], mx = Math.max(c.l, c.w, c.h), dimDesc = [];
  var isLegacy = LEGACY.indexOf(key) >= 0;
  for (var a = 0; a < 3; a++) {
    var expect = want[a] / mx, err = Math.abs(d.dims[a] - expect) / expect * 100;
    dimDesc.push((d.dims[a] * mx).toFixed(1) + '/' + want[a]);
    if (!isLegacy && err > 5) { probs.push('轴' + a + ' 尺寸误差 ' + err.toFixed(1) + '%'); dimDesc[a] += ' ✗'; }
  }
  if (isLegacy) { exempt++; notes.push('老品类：原始比例，尺寸豁免'); }

  var okAll = probs.length === 0;
  if (okAll) pass++; else fail++;
  console.log((okAll ? (isLegacy ? 'PASS* ' : 'PASS  ') : 'FAIL  ') + c.name + ' | ' + d.verts + ' | ' + d.tris +
              ' | ' + (maxI >= d.verts ? '是' : '否') + ' | ' + lo.toFixed(2) + '~' + hi.toFixed(2) +
              ' | ' + (d.col ? '有' : '无') + ' | ' + dimDesc.join(' ') + (notes.length ? '　(' + notes.join('；') + ')' : ''));
  if (!okAll) console.log('       └ ' + probs.join('；'));
});

console.log('\n结果：PASS ' + pass + ' / FAIL ' + fail + '  （其中老品类尺寸豁免 ' + exempt + ' 个）');
process.exit(fail ? 1 : 0);
