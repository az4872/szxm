/* tests/inject_enum_custom.js — P0-2 隐含参数枚举（五条路径）
   阶段化输出：每完成一个阶段就刷新 pre#custom-out，卡在哪段一眼可见。
   opts: { bin:{l,w,h}, seed, limit, skipCB, sideN } */
(function () {
  var out = { ok: false, err: null, stage: 'init', pool: [], rows: [], checks: [], bin: null, n: 0 };
  var pre = null;
  function flush() {
    try {
      if (!pre) {
        pre = document.createElement('pre');
        pre.id = 'custom-out';
        pre.style.display = 'none';
        (document.body || document.documentElement).appendChild(pre);
      }
      pre.textContent = JSON.stringify(out);
    } catch (e) { /* 截图阶段忽略 */ }
  }
  function stage(s) { out.stage = s; flush(); }
  try {
    stage('read-opts');
    var O = window.__CUSTOM_OPTS__ || {};
    var A = window.__API__;
    if (!A || !A.packOnly) throw new Error('__API__.packOnly 不存在');
    var BIN = O.bin || { l: 202, w: 172, h: 177 };
    out.bin = BIN;
    var seed = O.seed || 20261113;
    function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
    function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }

    /* ---------- 探针 ---------- */
    var tSum = 0, tMax = 0, cnt = 0;
    function probe(tag, names, bin, solid) {
      var list = names.map(function (p) {
        return { name: p.name, id: p.id, l: p.l, w: p.w, h: p.h, soft: !!p.soft, upright: !!p.upright,
          mesh: p.mesh, solid: !!solid };
      });
      var t0 = now(), r;
      try { r = A.packOnly(bin, list); }
      catch (e) { r = { count: 0, total: list.length, util: 0, failed: ['EX:' + e.message], boxes: [] }; }
      var dt = now() - t0; tSum += dt; if (dt > tMax) tMax = dt; cnt++;
      var volSum = 0;
      list.forEach(function (x) { volSum += x.l * x.w * x.h / 1e6; });
      var uu = r.util || 0; if (uu <= 1.0001) uu *= 100;
      var mx = 0, my = 0, mz = 0;
      (r.boxes || []).forEach(function (b) {
        if (b.x + b.l > mx) mx = b.x + b.l;
        if (b.y + b.w > my) my = b.y + b.w;
        if (b.z + b.h > mz) mz = b.z + b.h;
      });
      var gap = [bin.l - mx, bin.w - my, bin.h - mz];
      return { tag: tag, names: list.map(function (x) { return x.name; }).join('+'),
        dims: list.map(function (x) { return x.l + 'x' + x.w + 'x' + x.h; }).join(' / '),
        bin: bin.l + 'x' + bin.w + 'x' + bin.h, count: r.count, total: list.length,
        util: +uu.toFixed(2), vol: +volSum.toFixed(3), failed: (r.failed || []).join('/'),
        ms: +dt.toFixed(2), tight: (Math.min.apply(null, gap) < 2) ? 1 : 0,
        gap: gap.map(function (g) { return +g.toFixed(1); }).join('|') };
    }

    /* ---------- 池 ---------- */
    stage('build-pools');
    var cats = A.catalog().filter(function (c) { return !c.box; });
    var boxesPlain = A.boxes();
    var boxesTap = [];
    for (var i = 0; i < boxesPlain.length; i++) {
      var b = boxesPlain[i];
      A.setTapered(b.id, true);
      var bb = A.boxes()[i];
      boxesTap.push({ name: b.name + '·插口', id: b.id + '#tap', l: bb.eff.l, w: bb.eff.w, h: bb.eff.h,
        soft: false, upright: false, mesh: 'box', tag: 'tapered' });
      A.setTapered(b.id, false);
    }
    var boxesNorm = boxesPlain.map(function (b) {
      return { name: b.name, id: b.id, l: b.eff.l, w: b.eff.w, h: b.eff.h, soft: false, upright: false, mesh: 'box', tag: 'box' };
    });
    /* 任务书 P0-2-a① 指定的 5 组自建三边；产品无自定义物品 UI，经 packOnly 直接注入代表该路径 */
    var DIY = [[120, 60, 60], [150, 100, 100], [200, 80, 120], [100, 100, 100], [180, 90, 60]];
    var diyItems = DIY.map(function (d, k) {
      return { name: '自建' + (k + 1), id: 'diy' + k, l: d[0], w: d[1], h: d[2], soft: false, upright: false, mesh: 'box', tag: 'diy' };
    });
    /* 路径4：手动侧放变体。规则与产品一致——upright 件（衣柜/跑步机/电视/镜/书架/冰箱/洗衣机）
       不允许侧放；其余件取"把最长边放倒、高度最低"的那一组交换，外加 POSE_SPEC 里的显式姿态。 */
    var sideItems = [];
    function pushSide(name, id, d, mesh, soft) {
      sideItems.push({ name: name, id: id, l: d[0], w: d[1], h: d[2], soft: !!soft, upright: false, mesh: mesh, tag: 'side' });
    }
    for (var j = 0; j < cats.length; j++) {
      var c = cats[j];
      if (c.upright) continue;
      var ps = [];
      try { ps = A.poseSpecOf(c.id) || []; } catch (e) { ps = []; }
      var cands = [];
      for (var q = 1; q < ps.length; q++) if (ps[q].dims) cands.push({ nm: ps[q].name, d: ps[q].dims });
      var trio = [c.l, c.w, c.h].sort(function (x, y) { return y - x; });
      cands.push({ nm: '侧放', d: [trio[0], trio[2], trio[1]] });   /* 最长边躺平，高度取次小边 */
      var bestD = null, bestNm = '';
      for (var q2 = 0; q2 < cands.length; q2++) {
        if (bestD === null || cands[q2].d[2] < bestD[2]) { bestD = cands[q2].d; bestNm = cands[q2].nm; }
      }
      pushSide(c.name + '·' + bestNm, c.id + '#side', bestD, c.mesh, c.soft);
    }
    for (var bj = 0; bj < boxesNorm.length; bj++) {
      var bx = boxesNorm[bj], t2 = [bx.l, bx.w, bx.h].sort(function (x, y) { return y - x; });
      pushSide(bx.name + '·侧放', bx.id + '#side', [t2[0], t2[2], t2[1]], 'box', false);
    }
    var poolCat = cats.map(function (c) {
      return { name: c.name, id: c.id, l: c.l, w: c.w, h: c.h, soft: !!c.soft, upright: !!c.upright, mesh: c.mesh || null, tag: 'cat' };
    });
    var poolA = poolCat.concat(boxesNorm, boxesTap);
    var poolB = poolCat.concat(boxesNorm, diyItems);
    var poolSide = poolCat.concat(boxesNorm, sideItems);
    out.pool = poolA.map(function (p) { return { name: p.name, dims: p.l + 'x' + p.w + 'x' + p.h, tag: p.tag }; });
    out.poolSizes = { A: poolB.length === 0 ? 0 : poolA.length, B: poolB.length, side: poolSide.length,
      combosA: poolA.length * (poolA.length + 1) * (poolA.length + 2) / 6,
      combosB: poolB.length * (poolB.length + 1) * (poolB.length + 2) / 6, sideItems: sideItems.length };
    stage('pools-built');
    if (O.stopAt === 'pools') return stage('stop@' + O.stopAt);

    var LIM = O.limit || 0;
    function allCombos(tag, pool) {
      var k = 0, step = LIM ? Math.max(1, Math.ceil(4495 / LIM)) : 1;
      for (var a = 0; a < pool.length; a++)
        for (var b2 = a; b2 < pool.length; b2++)
          for (var c2 = b2; c2 < pool.length; c2++) {
            if (LIM && (k++ % step) !== 0) continue;
            out.rows.push(probe(tag, [pool[a], pool[b2], pool[c2]], BIN, false));
          }
    }
    if (O.stopAt === 'preA') return stage('stop@' + O.stopAt);
    allCombos('A', poolA); stage('comboA-done ' + out.rows.length);
    if (O.stopAt === 'A') return stage('stop@' + O.stopAt);
    allCombos('B', poolB); stage('comboB-done ' + out.rows.length);
    if (O.stopAt === 'B') return stage('stop@' + O.stopAt);
    var SN = O.sideN || 600;
    for (var s = 0; s < SN; s++) {
      var i1 = Math.floor(rnd() * poolSide.length), i2 = Math.floor(rnd() * poolSide.length), i3 = Math.floor(rnd() * poolSide.length);
      out.rows.push(probe('S', [poolSide[i1], poolSide[i2], poolSide[i3]], BIN, false));
    }
    stage('side-done ' + out.rows.length);
    if (O.stopAt === 'S') return stage('stop@' + O.stopAt);

    if (O.stopAt === 'premat') return stage('stop@' + O.stopAt);
    /* 路径3：材质切换 */
    var b0 = A.boxes()[0], matBefore = b0.mat, dimBefore = b0.eff.l + 'x' + b0.eff.w + 'x' + b0.eff.h;
    ['card', 'plastic'].forEach(function (mt) {
      A.setBoxMat(b0.id, mt);
      var b1 = A.boxes()[0], dimNow = b1.eff.l + 'x' + b1.eff.w + 'x' + b1.eff.h;
      out.checks.push({ k: 'mat:' + mt, ok: dimNow === dimBefore, detail: 'mat=' + b1.mat + ' 尺寸 ' + dimNow + '（改前 ' + dimBefore + '）' });
    });
    A.setBoxMat(b0.id, matBefore);
    stage('mat-done');
    if (O.stopAt === 'mat') return stage('stop@' + O.stopAt);

    /* 路径5：自定义仓室 5 种（真实表单） */
    var CB = [[200, 150, 120, 90, 118], [240, 200, 200, 100, 195], [300, 180, 160, 110, 158],
      [180, 180, 180, 80, 170], [220, 160, 250, 95, 190]];
    var repSet = [[poolCat[3], boxesNorm[1], boxesNorm[2]], [poolCat[11], poolCat[12], boxesNorm[0]],
      [poolCat[0], poolCat[1], poolCat[2]], [poolCat[9], poolCat[10], poolCat[8]]];
    var CBN = O.skipCB ? 0 : CB.length;
    for (var ci = 0; ci < CBN; ci++) {
      var cb = CB[ci], ap = { valid: false, applied: false, err: '' };
      try { ap = A.setCustom(cb[0], cb[1], cb[2], cb[3], cb[4], 'P0-2 探针 ' + (ci + 1)); }
      catch (e) { ap = { valid: false, applied: false, err: e.message }; }
      stage('custom-' + (ci + 1) + '-applied=' + !!(ap && ap.applied));
      var cbBin = { l: cb[0], w: cb[1], h: cb[2] };
      for (var ri = 0; ri < repSet.length; ri++) {
        var row = probe('CB' + (ci + 1), repSet[ri], cbBin, false);
        row.customOk = !!(ap && ap.applied);
        row.customErr = (ap && ap.err) || '';
        out.rows.push(row);
      }
      out.checks.push({ k: 'custom:' + cb.slice(0, 3).join('x'), ok: !!(ap && ap.applied),
        detail: 'valid=' + !!ap.valid + ' applied=' + !!ap.applied + ' err=' + (ap.err || '-') });
      stage('custom-' + (ci + 1) + '-done');
    }

    /* 路径4：手动摆放——只做 API 可用性与状态读取，不真的启动手动模式
       （启动会开渲染循环，headless 下 --dump-dom 会拿不到 DOM；真实交互验收留给截图轮） */
    try {
      var ms0 = (typeof A.manualState === 'function') ? A.manualState() : null;
      out.checks.push({ k: 'manual-api',
        ok: (typeof A.manualStart === 'function' && typeof A.manualState === 'function'),
        detail: 'manualStart=' + typeof A.manualStart + ' manualState=' + typeof A.manualState +
          ' state=' + JSON.stringify(ms0) });
    } catch (e3) { out.checks.push({ k: 'manual-api', ok: false, detail: 'EX ' + e3.message }); }

    out.n = out.rows.length;
    out.avgMs = +(tSum / Math.max(1, cnt)).toFixed(3);
    out.maxMs = +tMax.toFixed(2);
    out.ok = true;
    stage('done');
  } catch (e) {
    out.err = (e && e.message) || String(e);
    out.stack = (e && e.stack) || '';
    flush();
  }
})();
