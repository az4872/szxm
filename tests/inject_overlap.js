/* D5 / M-14：AABB 重叠的渲染层复核。
   ① 用 packOnly 枚举大件三件组合，取内核算出的 boxes（x/y/z + l/w/h）逐对三轴求交；
   ② 命中重叠的组，按重叠体积降序取前 N 组，走真实路径 clearCart → addToCart → doPack，
      再用 objBoxes() 读渲染层世界包围盒，同样逐对三轴求交，判断「渲染层是否也重叠」。 */
window.__INJ_OVERLAP__ = function (opt) {
  opt = opt || {};
  var A = window.__API__, out = { ok: true, scanned: 0, hits: [], rows: [], checks: [] };
  function put() {
    var pre = document.getElementById('ov-out');
    if (!pre) { pre = document.createElement('pre'); pre.id = 'ov-out'; document.body.appendChild(pre); }
    pre.textContent = JSON.stringify(out);
  }
  var B = { l: 202, w: 172, h: 177 };
  var cats = A.catalog().filter(function (c) { return !c.box; });
  var big = cats;
  var boxes = A.boxes().map(function (b) {
      return { name: b.name, id: b.id, l: b.eff.l, w: b.eff.w, h: b.eff.h, box: true, mesh: 'box' };
    });
  var pool = big.concat(boxes);
  function inter(a, b) {
    var ox = Math.min(a.x + a.l, b.x + b.l) - Math.max(a.x, b.x);
    var oy = Math.min(a.y + a.w, b.y + b.w) - Math.max(a.y, b.y);
    var oz = Math.min(a.z + a.h, b.z + b.h) - Math.max(a.z, b.z);
    return (ox > 0.01 && oy > 0.01 && oz > 0.01) ? { ox: ox, oy: oy, oz: oz, v: ox * oy * oz } : null;
  }
  function pairs(list) {
    var r = [];
    for (var i = 0; i < list.length; i++) for (var j = i + 1; j < list.length; j++) {
      var q = inter(list[i], list[j]);
      if (q) r.push({ i: i, j: j, ox: +q.ox.toFixed(2), oy: +q.oy.toFixed(2), oz: +q.oz.toFixed(2), v: Math.round(q.v) });
    }
    return r;
  }
  for (var a = 0; a < pool.length; a++) for (var b = a; b < pool.length; b++) for (var c = b; c < pool.length; c++) {
    var trio = [pool[a], pool[b], pool[c]];
    var list = trio.map(function (x) {
      return { name: x.name, id: x.id, l: x.l, w: x.w, h: x.h, soft: !!x.soft, upright: !!x.upright,
        box: !!x.box, mesh: x.mesh };
    });
    var r;
    try { r = A.packOnly(B, list); } catch (e) { continue; }
    out.scanned++;
    if (!r || !r.boxes || r.boxes.length < 2) continue;
    var pp = pairs(r.boxes);
    if (pp.length) out.hits.push({ combo: trio.map(function (x) { return x.name; }).join('+'), count: r.count,
      total: r.total, util: +((r.util || 0) * (r.util <= 1.0001 ? 100 : 1)).toFixed(2), pairs: pp });
  }
  out.hitCount = out.hits.length;
  out.hits.sort(function (x, y) { return (y.pairs[0].v) - (x.pairs[0].v); });
  put();
  /* ② 取前 N 组走真实渲染路径复核 */
  var N = opt.render || 10;
  var seen = {}, picked = [];
  for (var h = 0; h < out.hits.length && picked.length < N; h++) {
    if (!seen[out.hits[h].combo]) { seen[out.hits[h].combo] = 1; picked.push(out.hits[h]); }
  }
  for (var k = 0; k < picked.length; k++) {
    var cmb = picked[k].combo.split('+');
    A.clearCart();
    for (var m = 0; m < cmb.length; m++) {
      var cat = null;
      for (var ci = 0; ci < cats.length; ci++) if (cats[ci].name === cmb[m]) cat = cats[ci];
      if (!cat) for (var bi = 0; bi < boxes.length; bi++) if (boxes[bi].name === cmb[m]) cat = boxes[bi];
      try { A.addToCart(cat); } catch (e) { }
    }
    A.doPack();
    var ob = A.objBoxes() || [];
    var rp = pairs(ob);
    out.rows.push({ combo: picked[k].combo, kernelPairs: picked[k].pairs.length,
      kernel: picked[k].pairs[0], rendered: ob.length, renderPairs: rp.length,
      renderDetail: rp.slice(0, 3),
      verdict: rp.length ? 'RENDER-OVERLAP' : (picked[k].pairs.length ? 'AABB-ONLY' : 'NONE') });
    put();
  }
  A.clearCart();
  put();
};
