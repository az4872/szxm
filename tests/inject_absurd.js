/* P0-2-c 荒谬失败复核：对每组「util<30% 且未全装下」的三件组合，
   枚举其全部 2 件子集单独 packOnly。若存在子集 2/2 而整组只装 1 件 → 判定「部分解漏解」。
   输出 pre#absurd-out。 */
window.__INJ_ABSURD__ = function (SETS) {
  var A = window.__API__, out = { ok: true, rows: [], checks: [] };
  function put(o) {
    var pre = document.getElementById('absurd-out');
    if (!pre) { pre = document.createElement('pre'); pre.id = 'absurd-out'; document.body.appendChild(pre); }
    pre.textContent = JSON.stringify(o);
  }
  function run(set, names, dims) {
    var list = names.map(function (n, i) {
      return { name: n, id: n, l: dims[i][0], w: dims[i][1], h: dims[i][2], mesh: 'box' };
    });
    var r;
    try { r = A.packOnly({ l: set.bin[0], w: set.bin[1], h: set.bin[2] }, list); }
    catch (e) { return { err: e.message }; }
    return { c: r.count, t: r.total, f: (r.failed || []).join('/') };
  }
  for (var i = 0; i < SETS.length; i++) {
    var s = SETS[i], n = s.names.length, best = 0, bestSub = null;
    if (n === 2) {
      best = s.count; bestSub = 'full';
    } else {
      for (var a = 0; a < n; a++) for (var b = a + 1; b < n; b++) {
        var ns = [s.names[a], s.names[b]], ds = [s.dims[a], s.dims[b]];
        var rr = run(s, ns, ds);
        if (rr && rr.c > best) { best = rr.c; bestSub = ns.join('+'); }
      }
    }
    out.rows.push({ tag: s.tag, combo: s.combo, bin: s.bin.join('x'), full: s.count + '/' + s.total,
      bestSubset: best + '/2', subset: bestSub || '-',
      kind: (best >= 2 && s.count <= 1) ? 'PARTIAL-LOSS' : (s.count >= 2 ? 'TRUE-FIT-3-FAIL' : 'CHECK') });
    if (i % 8 === 0) put(out);
  }
  put(out);
};
