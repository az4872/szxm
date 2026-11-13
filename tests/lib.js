/* tests/lib.js — 测试基础库
   从产物 HTML 提取真实源码执行（不是复刻），保证测到的就是产物行为。
   用法：node tests/test_xxx.js */
'use strict';
var fs = require('fs');
var path = require('path');

/* P0-R5：压缩档（greybox）里注释与换行都被 _mini 删掉了，按注释锚点取块会失败。
   这里补一条「按特征取块」的兜底：扫描所有 <script> 块，用正则挑出目标块。
   老锚点优先，拿不到才走兜底 —— cdn/inline 档行为完全不变。 */
function pickBlock(html, sig) {
  var re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi, m;
  while ((m = re.exec(html)) !== null) {
    if (sig.test(m[1])) return { code: m[1], start: m.index, end: m.index + m[0].length };
  }
  return null;
}
function extractCoreBlock(html) {
  try {
    var core0 = extract(html, '<script>// 塞得下吗 · 装填判定内核', '</script>');
    return core0.slice(core0.indexOf('>') + 1, core0.lastIndexOf('<'));
  } catch (e) {
    var b = pickBlock(html, /module\.exports\s*=\s*\{[\s\S]*?\bpack\b/);
    if (!b) throw new Error('找不到装填判定内核块（注释锚点与特征兜底都失败）');
    return b.code;
  }
}
function extractMainBlock(html) {
  var i = html.indexOf('<script>\n/* ===== 塞得下吗 v7');
  if (i >= 0) {
    var j = html.indexOf('</script>', i);
    if (j > i) return html.slice(i, j);
  }
  var b = pickBlock(html, /var CATALOG\s*=\s*\[/);
  if (!b) throw new Error('找不到主逻辑块（注释锚点与特征兜底都失败）');
  return b.code;
}

/* fallback：仅用于「跨版本对照」场景（旧产物没有新符号时补等价桩），
   不给 fallback 就是硬依赖，找不到立即抛错。 */
function extract(html, startPat, endPat, fallback) {
  var i = html.indexOf(startPat);
  if (i < 0) { if (fallback !== undefined) return fallback; throw new Error('找不到 ' + startPat); }
  var j = html.indexOf(endPat, i);
  if (j < 0) { if (fallback !== undefined) return fallback; throw new Error('找不到 ' + endPat); }
  return html.slice(i, j + endPat.length);
}

/* 跨版本对照桩：旧产物没有 v35.0 新增符号时用它补齐 */
var FB = {
  BLOCK_ORDER: "var BLOCK_ORDER = ['door', 'doorH', 'corridor', 'corridorLen', 'corner', 'cornerH', 'gap', 'height'];",
  BLOCK_TEXT: "var BLOCK_TEXT = {};",
  CACHE_VARS: "var _cmCache = {}, _cpCache = {}, _segCache = {}, _verCache = {};",
  CACHE_MAX: "var _CACHE_MAX = 20000;",
  CACHE_STAT: "var _cacheStat = { cm: 0, cp: 0, seg: 0, ver: 0, hit: 0 };",
  numOf: "function numOf(v) { if (v === null || v === undefined) return NaN; if (typeof v === 'string' && v === '') return NaN; if (typeof v === 'number') return isFinite(v) ? v : NaN; var n = parseFloat(v); return isFinite(n) ? n : NaN; }",
  numOr: "function numOr(v, d) { var n = numOf(v); return isFinite(n) ? n : d; }",
  _k100: "function _k100(x) { return Math.round(x * 100); }",
  _ck: "function _ck(k) { return k; }",
  normCorners: "function normCorners(p) { p = p || {}; var a = numOr(p.cornerA, 120), b = numOr(p.cornerB, 100), h = numOr(p.cornerH, 200); return [{ a: a, b: b, h: h, gapBefore: 0 }]; }",
  stub: function (name) { return 'function ' + name + '() { return null; }'; },
  ptCornerRows: "function ptCornerRows() { var L = [], n = numOr(els.pCorners.value, 1); for (var i = 0; i < n; i++) L.push({ a: numOr(els.pCrnA.value, 120), b: numOr(els.pCrnB.value, 100), h: numOr(els.pCrnH.value, 200), gapBefore: 0 }); return L; }",
  ptCornerList: "function ptCornerList(v) { v = v || {}; return normCorners(v); }",
  pathLineText: "function pathLineText(p) { return pathSummary(p); }"
};

/* 从产物 HTML 提取 CATALOG / LEVELS / SCENES / pack 内核 / 路线判定 */
/* 通道面板 els 桩：9 个可填输入 + 3 个显示位（默认值 = defaultPath 同款） */
function makeElsStub(vals) {
  var v = Object.assign({ pDoorW: 90, pDoorH: 200, pCorW: 120, pCorLen: '',
                          pCrnA: 120, pCrnB: 100, pCrnH: 200, pCorners: 1, pDoors: 0 }, vals || {});
  var o = {};
  for (var k in v) o[k] = { id: k, value: String(v[k]), textContent: '', className: '', disabled: false };
  o.pPathApply = { id: 'pPathApply', textContent: '', className: '', disabled: false };
  o.pPathErr = { id: 'pPathErr', textContent: '', className: '' };
  o.pPathWarn = { id: 'pPathWarn', textContent: '', className: '' };
  o.status = { id: 'status', textContent: '' };
  return o;
}
function makeLsStub() {
  var box = {};
  return { box: box,
           getItem: function (k) { return Object.prototype.hasOwnProperty.call(box, k) ? box[k] : null; },
           setItem: function (k, v) { box[k] = String(v); },
           removeItem: function (k) { delete box[k]; } };
}

/* 产物指纹：每支测试读哪个文件、多大、md5 多少，必须打在输出里。
   这是「对照是不是真对照」的唯一硬证据——路径写死或忘记传参时，指纹会立刻暴露。 */
function artifactStamp(htmlPath) {
  var m = path.resolve(htmlPath);
  var buf = fs.readFileSync(m);
  var md5 = require('crypto').createHash('md5').update(buf).digest('hex');
  return { file: m, bytes: buf.length, md5: md5 };
}
function loadArtifact(htmlPath, opts) {
  opts = opts || {};
  var st = artifactStamp(htmlPath);
  if (!opts.quiet) {
    console.log('[art] ' + st.file + '  ' + st.bytes + ' B  md5=' + st.md5);
  }
  var html = fs.readFileSync(htmlPath, 'utf8');

  /* 装填判定内核（整段 script，含 module.exports 分支）
     P0-R5：greybox 档注释被压缩删掉，改用 extractCoreBlock 的双通道取块 */
  var coreSrc = extractCoreBlock(html);
  var mod = new module.constructor();
  mod._compile(coreSrc, 'core.js');
  var pack = mod.exports.pack;
  var orientations = mod.exports.orientations;
  var effDims = mod.exports.effDims;
  var gapOf = mod.exports.gapOf;
  var voxelize = mod.exports.voxelize;
  var voxelizeBox = mod.exports.voxelizeBox;
  var supportRatio = mod.exports.supportRatio;
  var VOX_CELL = mod.exports.VOX_CELL;
  var BIN_PAD = mod.exports.BIN_PAD;
  var SUP_MIN = mod.exports.SUP_MIN;

  /* main 段源码（取纯函数与数据定义）
     P0-R5：同上，压缩档无注释锚点时按 `var CATALOG = [` 特征取块 */
  var main = extractMainBlock(html);

  /* 取出各纯函数源码并 eval（对全局变量依赖注入 ROUTE/bin） */
  function fn(name, fallback) {
    var i = main.indexOf('function ' + name + '(');
    if (i < 0) { if (fallback !== undefined) return fallback; throw new Error('找不到函数 ' + name); }
    /* 函数体以配对大括号结尾 */
    var d = 0, j = main.indexOf('{', i);
    for (var k = j; k < main.length; k++) {
      if (main[k] === '{') d++;
      else if (main[k] === '}') { d--; if (d === 0) break; }
    }
    return main.slice(i, k + 1);
  }

  var ROUTE_SRC = extract(main, 'var ROUTE = {', '};');
  var PAD_OUTER_SRC = extract(main, 'var PAD_OUTER =', ';');
  var PAD_INNER_SRC = extract(main, 'var PAD_INNER =', ';');

  var sandbox = { module: { exports: {} }, console: console };
  var src = [
    'var pack = __pack;',
    'var orientations = __orientations;',
    'var __LS = (typeof __LSSTUB !== "undefined" && __LSSTUB) || { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };',
    'var localStorage = __LS;',
    'var els = (typeof __ELS !== "undefined" && __ELS) || {};',
    'var cart = [];',
    'var hideSheets = function () { if (__H) __H.hideSheets(); };',
    'var renderScenes = function () { if (__H) __H.renderScenes(); };',
    'var renderPreview = function () { if (__H) __H.renderPreview(); };',
    'var bin = null;',
    'var routeCornerCheck = true;',   /* 自由模式默认查拐角；关卡只有 L05 查 */
    PAD_OUTER_SRC,
    PAD_INNER_SRC,
    ROUTE_SRC,
    /* v34.0 T0/T1/T2 通道路径模型（checkRoute 依赖 pathJudgeItem + MY_PATH） */
    extract(main, 'var PATH_KEY =', ';'),
    extract(main, 'var TIGHT_GAP =', ';'),
    extract(main, 'var PATH_RANGE = {', '};'),
    /* v35.0 T3-02/T3-04/T3-05 新增依赖：归因枚举 / 数值读取 / 多拐归一 / 记忆化缓存
       跨版本对照（旧产物）时用 fallback 桩补齐，保证同一份 lib 既能测新产物也能测旧产物。 */
    extract(main, 'var BLOCK_ORDER =', ';', FB.BLOCK_ORDER),
    extract(main, 'var BLOCK_TEXT = {', '};', FB.BLOCK_TEXT),
    extract(main, 'var _cmCache =', ';', FB.CACHE_VARS),
    extract(main, 'var _CACHE_MAX =', ';', FB.CACHE_MAX),
    extract(main, 'var _cacheStat =', ';', FB.CACHE_STAT),
    fn('numOf', FB.numOf), fn('numOr', FB.numOr), fn('_k100', FB._k100), fn('_ck', FB._ck),
    fn('normCorners', FB.normCorners),
    fn('defaultPath'),
    'var MY_PATH = { segments: [], params: defaultPath() };',
    fn('pathSegments'), fn('pathRebuild'),
    fn('restDim'), fn('judgeDoorSeg'), fn('judgeCorridorSeg'), fn('judgeCornerSeg'),
    fn('segKey', FB.stub('segKey')), fn('segJudge', FB.stub('segJudge')),
    fn('segsSig', FB.stub('segsSig')), fn('itemsSig', FB.stub('itemsSig')),
    fn('pathJudgeItem'), fn('routeVerdict'), fn('pathForScene'), fn('pathPlain'), fn('verdictText'),
    'pathRebuild(defaultPath());',
    fn('repoScene'),
    'var SCENES = ' + main.slice(main.indexOf('var SCENES = ['), main.indexOf('];', main.indexOf('var SCENES = [')) + 2).replace('var SCENES', 'SCENES') + ';',
    'var CATALOG = ' + main.slice(main.indexOf('var CATALOG = ['), main.indexOf('];', main.indexOf('var CATALOG = [')) + 2).replace('var CATALOG', 'CATALOG') + ';',
    /* 第13轮第4条（v8_202611132312）：产物运行时 CATALOG 会 concat BOX_LIST（6 个标准箱）→ 共 22 项。
       测试桩若只取字面量就是 16 项，全枚举基数会少 6 个（这正是把 2024 数成 816 的原因）。
       此处按产物同序复现：BOX_LIST 先赋 box/mesh/side/vol，再 concat。 */
    'var BOX_LIST = ' + (main.indexOf('var BOX_LIST = [') >= 0
      ? main.slice(main.indexOf('var BOX_LIST = ['), main.indexOf('];', main.indexOf('var BOX_LIST = [')) + 2).replace('var BOX_LIST', 'BOX_LIST') + ';'
      : '[];'),
    'for (var _bi = 0; _bi < BOX_LIST.length; _bi++) { var _b = BOX_LIST[_bi]; _b.box = true; _b.mesh = "box"; _b.side = false; _b.vol = _b.l * _b.w * _b.h; }',
    'CATALOG = CATALOG.concat(BOX_LIST);',
    /* T-04/T-05：显式姿态表 + 姿态选择（renderPicker / doPack 都依赖，缺了就 POSE_SPEC is not defined） */
    (function () {
      var i = main.indexOf('var POSE_SPEC = {');
      if (i < 0) return 'var POSE_SPEC = {}; var POSE_SEL = {};';
      var j = main.indexOf('\n};', i);
      return main.slice(i, j + 3).replace('var POSE_SPEC', 'var POSE_SPEC') +
             '\nvar POSE_SEL = {};' +
             fn('posesOf', 'function posesOf() { return null; }') +
             fn('posesFor', 'function posesFor() { return null; }');
    })(),
    'var LEVELS = ' + main.slice(main.indexOf('var LEVELS = ['), main.indexOf('];', main.indexOf('var LEVELS = [')) + 2).replace('var LEVELS', 'LEVELS') + ';',
    fn('passDoor'), fn('fitInBox'), fn('cornerMaxLen'), fn('cornerPass'), fn('_cornerPassRaw', FB.stub('_cornerPassRaw')), fn('checkRoute'),
    fn('planTrips'),
    /* v34.0 T1 通道面板：读取 / 校验 / 预警 / 应用 */
    fn('ptRead'), fn('ptWrite'), fn('ptNum'), fn('ptCornerRows', FB.ptCornerRows), fn('ptCornerList', FB.ptCornerList), fn('pathLineText', FB.pathLineText),
    fn('ptValidate'), fn('ptWarn'), fn('ptRefresh'), fn('ptApply'),
    fn('pathLineText', FB.pathLineText), fn('pathSummary'), fn('renderCornerRows', FB.stub('renderCornerRows')),
    'var manual = { placed: [] };',
    fn('checkManualFit'),
    'this.repoScene = repoScene; this.SCENES = SCENES; this.CATALOG = CATALOG; this.LEVELS = LEVELS;'
    + '; this.POSE_SPEC = (typeof POSE_SPEC !== "undefined") ? POSE_SPEC : {}; this.POSE_SEL = (typeof POSE_SEL !== "undefined") ? POSE_SEL : {};',
    'this.passDoor = passDoor; this.fitInBox = fitInBox; this.cornerPass = cornerPass; this.checkRoute = checkRoute;',
    'this.cornerMaxLen = cornerMaxLen;',
    'this.planTrips = planTrips; this.ROUTE = ROUTE; this.setBin = function (b) { bin = b; };',
    'this.checkManualFit = checkManualFit; this.setManual = function (m) { manual = m; };',
    'this.MY_PATH = MY_PATH; this.PATH_RANGE = PATH_RANGE; this.TIGHT_GAP = TIGHT_GAP;',
    'this.defaultPath = defaultPath; this.pathRebuild = pathRebuild; this.pathSegments = pathSegments;',
    'this.pathForScene = pathForScene; this.pathJudgeItem = pathJudgeItem; this.routeVerdict = routeVerdict;',
    'this.verdictText = verdictText;',
    'this.setPath = function (p) { pathRebuild(p); };',
    'this.PAD_OUTER = PAD_OUTER; this.PAD_INNER = PAD_INNER;',
    'this.ptRead = ptRead; this.ptWrite = ptWrite; this.ptNum = ptNum; this.ptValidate = ptValidate;',
    'this.ptWarn = ptWarn; this.ptRefresh = ptRefresh; this.ptApply = ptApply; this.pathSummary = pathSummary;',
    'this.numOf = numOf; this.numOr = numOr; this.normCorners = normCorners;',
    'this.segJudge = segJudge; this.segKey = segKey; this.pathLineText = pathLineText;',
    'this.ptCornerRows = ptCornerRows; this.ptCornerList = ptCornerList;',
    'this.BLOCK_ORDER = BLOCK_ORDER; this.BLOCK_TEXT = BLOCK_TEXT;',
    'this.cacheStat = function () { return _cacheStat; };',
    'this.clearCache = function () { _cmCache = {}; _cpCache = {}; _segCache = {}; _verCache = {}; _cacheStat = { cm: 0, cp: 0, seg: 0, ver: 0, hit: 0 }; };',
    'this.setCart = function (c) { cart = c; }; this.els = els;'
  ].join('\n');
  var f = new Function('__pack', '__orientations', '__ELS', '__LSSTUB', '__H', src);
  f.call(sandbox, pack, orientations, opts.els || makeElsStub(), opts.ls || makeLsStub(), opts.h || null);

  /* MESH_DATA */
  /* 第9轮 P0-3：CDN 档把数据拆成独立文件（首屏 HTML 里只有 window.MESH_DATA = {} 占位），
     这时从 HTML 里取不到数据，改从它引用的数据文件读——测试仍能覆盖 cdn 档全量几何。 */
  var mi = html.indexOf('var MESH_DATA = ');
  var mj = mi >= 0 ? html.indexOf(';</script>', mi) : -1;
  var MESH_DATA = {};
  if (mi >= 0 && mj > mi) {
    MESH_DATA = JSON.parse(html.slice(mi + 'var MESH_DATA = '.length, mj));
  } else if (!/window\.MESH_DATA\s*=\s*\{\}/.test(html) || html.indexOf('MESH_READY__') < 0) {
    MESH_DATA = {};
  }
  if (!Object.keys(MESH_DATA).length && html.indexOf('MESH_READY__') >= 0) {
    var dm = /s\.src\s*=\s*'([^']+\.js)'/.exec(html);
    if (dm && dm[1]) {
      var dpath = path.join(path.dirname(path.resolve(htmlPath)), dm[1]);
      if (fs.existsSync(dpath)) {
        var dtxt = fs.readFileSync(dpath, 'utf8');
        var di = dtxt.indexOf('window.MESH_DATA = ');
        var dj = dtxt.lastIndexOf(';');
        if (di >= 0 && dj > di) MESH_DATA = JSON.parse(dtxt.slice(di + 'window.MESH_DATA = '.length, dj));
      }
    }
  }

  /* 体素缓存：按 meshKey + 三轴尺寸缓存 6 朝向体素（P0-C 真实几何支撑） */
  var voxCache = {};
  function decI16(str) {
    var b = Buffer.from(str, 'base64'), a = new Int16Array(b.length >> 1);
    for (var k = 0; k < a.length; k++) a[k] = b.readInt16LE(k * 2);
    return a;
  }
  function decU16(str) {
    var b = Buffer.from(str, 'base64'), a = new Uint16Array(b.length >> 1);
    for (var k = 0; k < a.length; k++) a[k] = b.readUInt16LE(k * 2);
    return a;
  }
  function voxFor(meshKey, dims) {
    if (!meshKey || typeof voxelize !== 'function') return null;
    var key = meshKey + '|' + dims.l + ',' + dims.w + ',' + dims.h;
    if (voxCache[key] !== undefined) return voxCache[key];
    var d = MESH_DATA[meshKey];
    if (!d || !d.qscale) { voxCache[key] = null; return null; }
    var pi = decI16(d.pos), verts = new Float32Array(pi.length), qs = d.qscale;
    for (var i = 0; i < pi.length; i++) verts[i] = pi[i] * qs;
    var v = voxelize(verts, decU16(d.idx), dims, VOX_CELL);
    voxCache[key] = v;
    return v;
  }

  return {
    html: html,
    /* 第13轮：评分函数的漂移哨兵。本测试套件的 levelScore 是复刻实现（产物结算内联、不可 eval），
       若产物把边界改了而复刻没跟上，测试就会「测了个假」。这里抓产物里真实的比较符比对。 */
    scoreDrift: (function () {
      var m = html.match(/if \(LV\.limit > 0 && secs\s*(&gt;=|>=|&gt;|>)\s*0\)/);
      var got = m ? m[1].replace(/&gt;/g, '>') : '?';
      return { artifactOp: got, replicaOp: '>', ok: got === '>' };
    })(),
    pack: pack, orientations: orientations, effDims: effDims, gapOf: gapOf,
    voxelize: voxelize, voxFor: voxFor, supportRatio: supportRatio,
    VOX_CELL: VOX_CELL, BIN_PAD: BIN_PAD, SUP_MIN: SUP_MIN,
    CATALOG: sandbox.CATALOG, LEVELS: sandbox.LEVELS, SCENES: sandbox.SCENES,
    POSE_SPEC: sandbox.POSE_SPEC, POSE_SEL: sandbox.POSE_SEL,
    ROUTE: sandbox.ROUTE,
    passDoor: sandbox.passDoor, fitInBox: sandbox.fitInBox,
    cornerPass: sandbox.cornerPass, checkRoute: sandbox.checkRoute,
    cornerMaxLen: sandbox.cornerMaxLen,
    planTrips: sandbox.planTrips,
    ptRead: sandbox.ptRead, ptWrite: sandbox.ptWrite, ptNum: sandbox.ptNum,
    ptValidate: sandbox.ptValidate, ptWarn: sandbox.ptWarn, ptRefresh: sandbox.ptRefresh,
    ptApply: sandbox.ptApply, pathSummary: sandbox.pathSummary,
    ptCornerRows: sandbox.ptCornerRows, ptCornerList: sandbox.ptCornerList,
    setCart: sandbox.setCart, els: sandbox.els,
    checkManualFit: sandbox.checkManualFit,
    setManual: sandbox.setManual,
    repoScene: sandbox.repoScene,
    setBin: sandbox.setBin,
    /* v34.0 通道路径 */
    MY_PATH: sandbox.MY_PATH,
    PATH_RANGE: sandbox.PATH_RANGE,
    TIGHT_GAP: sandbox.TIGHT_GAP,
    defaultPath: sandbox.defaultPath,
    pathRebuild: sandbox.pathRebuild,
    pathForScene: sandbox.pathForScene,
    pathSegments: sandbox.pathSegments,
    pathJudgeItem: sandbox.pathJudgeItem,
    routeVerdict: sandbox.routeVerdict,
    verdictText: sandbox.verdictText,
    setPath: sandbox.setPath,
    numOf: sandbox.numOf, numOr: sandbox.numOr, normCorners: sandbox.normCorners,
    segJudge: sandbox.segJudge, segKey: sandbox.segKey, pathLineText: sandbox.pathLineText,
    BLOCK_ORDER: sandbox.BLOCK_ORDER, BLOCK_TEXT: sandbox.BLOCK_TEXT,
    cacheStat: sandbox.cacheStat, clearCache: sandbox.clearCache,
    PAD_OUTER: sandbox.PAD_OUTER, PAD_INNER: sandbox.PAD_INNER,
    MESH_DATA: MESH_DATA
  };
}

/* 关卡结算评分（原样拷贝自 showResult 关卡结算段，公式不变） */
function levelScore(bin, LV, r, cornerN, secs) {
  var isPerfect = (r.failed.length === 0 && r.count === r.total);
  var basePts = r.count * 100;
  var perfectPts = isPerfect ? 500 : 0;
  var binPts = 0;
  if (isPerfect && LV.minCap > 0) {
    var capM3 = bin.l * bin.w * bin.h / 1e6;
    var slack = (capM3 - LV.minCap) / LV.minCap;
    binPts = Math.round(300 * Math.max(0, 1 - Math.min(1, slack / 0.5)));
  }
  /* 第13轮第1条（v8_202611132312 终版）：边界同步产物 secs > 0（v7 的 >= 0 已作废）。
     注意本函数是「复刻」而非从产物 eval（产物结算逻辑内联在渲染大函数里，取不出来），
     因此 loadArtifact 会做一次漂移检查，把产物里的真实比较符抓出来比对，不一致就记 scoreDrift。 */
  var speedPts = 0;
  if (LV.limit > 0 && secs > 0) {
    speedPts = Math.max(0, Math.round(200 - Math.max(0, secs - 30) * 4));
  }
  var penPts = cornerN * 50;
  var pts = Math.max(0, basePts + perfectPts + binPts + speedPts - penPts);
  var stars = 0;
  if (isPerfect && cornerN === 0 && binPts >= 240) stars = 3;
  else if (isPerfect && cornerN === 0) stars = 2;
  else if (r.count * 2 >= Math.max(1, r.total)) stars = 1;
  return { pts: pts, stars: stars, isPerfect: isPerfect, basePts: basePts, binPts: binPts, speedPts: speedPts, penPts: penPts };
}

/* doPack 的清单展开（原样拷贝：不带 upright —— 自由模式与关卡结算共用这条路径） */
function instFromCart(A, cart) {
  var inst = [];
  for (var i = 0; i < cart.length; i++) {
    var c = cart[i];
    for (var q = 0; q < c.qty; q++) {
      inst.push({ name: c.name + '@' + i + '#' + q, l: c.l, w: c.w, h: c.h, soft: !!c.soft,
                  noSide: c.side === undefined ? false : !c.side,
                  _vox: (typeof A.voxFor === 'function' ? A.voxFor(c.mesh, { l: c.l, w: c.w, h: c.h }) : null) });
    }
  }
  return inst;
}

/* finishManual 对照路径的清单展开（原样拷贝：带 upright） */
function instFromCartUpright(A, cart) {
  var inst = [];
  for (var ci = 0; ci < cart.length; ci++) {
    for (var q2 = 0; q2 < cart[ci].qty; q2++) {
      inst.push({ name: cart[ci].name + '@' + ci + '#' + q2, l: cart[ci].l, w: cart[ci].w, h: cart[ci].h,
                  soft: !!cart[ci].soft, upright: !!cart[ci].upright });
    }
  }
  return inst;
}

/* 按 LEVELS[i].items 展开 cart（loadLevel 的原样逻辑） */
function cartOfLevel(A, LV) {
  var cart = [];
  for (var k = 0; k < LV.items.length; k++) {
    var nm = LV.items[k][0], qty = LV.items[k][1];
    for (var c = 0; c < A.CATALOG.length; c++) {
      if (A.CATALOG[c].name === nm) {
        cart.push(Object.assign({}, A.CATALOG[c], { qty: qty })); break;
      }
    }
  }
  return cart;
}

/* 迷你仓场景（repoScene 同款：判定用内部尺寸 = 标称 + 2cm） */
function storeBin(A, id) {
  for (var i = 0; i < A.SCENES.length; i++) if (A.SCENES[i].id === id) return A.SCENES[i];
  return null;
}

function assertEq(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(label + ' 期望 ' + JSON.stringify(expected) + ' 实际 ' + JSON.stringify(actual));
  }
}

module.exports = {
  artifactStamp: artifactStamp, loadArtifact: loadArtifact, makeElsStub: makeElsStub, makeLsStub: makeLsStub, levelScore: levelScore, instFromCart: instFromCart,
                   instFromCartUpright: instFromCartUpright, cartOfLevel: cartOfLevel,
                   storeBin: storeBin, assertEq: assertEq,
                   /* 第13轮：把取块函数暴露出来，供 diag_* 诊断脚本拿全量核心导出（packCore/repair） */
                   extractCoreBlock: extractCoreBlock, extractMainBlock: extractMainBlock };
