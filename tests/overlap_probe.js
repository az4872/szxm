const fs=require('fs'),cp=require('child_process');
let html=fs.readFileSync(process.env.F||'/sandbox/workspace/output/index.html','utf8');
const inj=fs.readFileSync(__dirname+'/inject_overlap.js','utf8');
html=html.replace('</body>','<script>'+inj+'\nwindow.__INJ_OVERLAP__({render:10});</script></body>');
fs.writeFileSync('/tmp/ov.html',html);
const r=cp.spawnSync('chromium',['--headless=new','--no-sandbox','--disable-gpu','--enable-unsafe-swiftshader',
 '--window-size=1200,900','--virtual-time-budget=180000','--dump-dom','file:///tmp/ov.html'],{maxBuffer:2e8,encoding:'utf8'});
const m=/<pre id="ov-out">([\s\S]*?)<\/pre>/.exec(r.stdout||'');
if(!m){console.log('NO-OUT len',(r.stdout||'').length);process.exit(1);}
const j=JSON.parse(m[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'));
console.log('枚举组数',j.scanned,'AABB 重叠组数',j.hitCount);
j.rows.forEach(x=>console.log(' ',x.verdict,'|',x.combo,'| 内核重叠对',x.kernelPairs,'首次',JSON.stringify(x.kernel),'| 渲染件数',x.rendered,'渲染重叠对',x.renderPairs,JSON.stringify(x.renderDetail)));
fs.writeFileSync('/sandbox/workspace/output/overlap_recheck.json',JSON.stringify(j,null,1));
