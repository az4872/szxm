/* tests/diag_dup.js — 诊断「同一实例被重复放置」根因（第13轮 T-1 前置）
   用法：node tests/diag_dup.js [html]
   输出：packCore(60) / packCore(0) / pack 三层各自的 placed 重复情况 */
'use strict';
var L = require('./lib.js');
var fs = require('fs');
var path = require('path');
var htmlPath = process.argv[2] || path.join(__dirname, '..', '..', 'output', 'index.html');
var html = fs.readFileSync(htmlPath, 'utf8');

/* 复用 lib.js 的取块逻辑，但拿到全量 exports（含 packCore / repair） */
var coreSrc = L.extractCoreBlock ? L.extractCoreBlock(html) : null;
if (!coreSrc) {
  /* lib.js 未导出 extractCoreBlock 时，按 module.exports 锚点自取 */
  var m = html.match(/<script>([\s\S]*?module\.exports\s*=\s*\{[\s\S]*?\};[\s\S]*?)<\/script>/);
  if (!m) { console.error('取不到核心 script 块'); process.exit(2); }
  coreSrc = m[1];
}
var mod = new module.constructor();
mod._compile(coreSrc, 'core.js');
var K = mod.exports;
console.log('核心导出：', Object.keys(K).join(','));

/* 用 lib 拿 CATALOG 与仓 */
var A = L.loadArtifact(htmlPath, { quiet: true });
var bin = L.storeBin(A, 'L');

function mk() {
  var inst = [];
  [['沙发', 4], ['床垫', 4], ['落地镜', 6]].forEach(function (kv) {
    var c = A.CATALOG.filter(function (x) { return x.name === kv[0]; })[0];
    for (var q = 0; q < kv[1]; q++) inst.push({ name: kv[0] + '#' + q, l: c.l, w: c.w, h: c.h, soft: !!c.soft, cat: c });
  });
  return inst;
}
function dupOf(r) {
  var u = {};
  r.placed.forEach(function (p) { u[p.name] = (u[p.name] || 0) + 1; });
  return Object.keys(u).filter(function (k) { return u[k] > 1; }).map(function (k) { return k + 'x' + u[k]; });
}
var B = { l: bin.l, w: bin.w, h: bin.h };
var i1 = mk(), a = K.packCore(B, i1, 60);
console.log('\n[A] packCore(topPenalty=60)  count=' + a.count + ' placed=' + a.placed.length +
            ' 唯一=' + unique(i1, a) + ' dup=' + JSON.stringify(dupOf(a)) + ' failed=' + a.failed.length);
var i2 = mk(), b = K.packCore(B, i2, 0);
console.log('[B] packCore(topPenalty=0)   count=' + b.count + ' placed=' + b.placed.length +
            ' 唯一=' + unique(i2, b) + ' dup=' + JSON.stringify(dupOf(b)) + ' failed=' + b.failed.length);
var i3 = mk(), c = K.pack(B, i3);
console.log('[C] pack()                   count=' + c.count + ' placed=' + c.placed.length +
            ' 唯一=' + unique(i3, c) + ' dup=' + JSON.stringify(dupOf(c)) + ' _ms=' + c._ms + ' _guard=' + (c._guard || '-'));

function unique(inst, r) {
  var seen = {};
  r.placed.forEach(function (p) { seen[p.name] = 1; });
  return Object.keys(seen).length + '/' + inst.length;
}
