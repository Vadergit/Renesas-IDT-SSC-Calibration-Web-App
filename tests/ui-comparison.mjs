import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const dir='ui-comparison';await mkdir(dir,{recursive:true});
const master=await readFile('_ui-master/index.html','utf8');
const base=[...master.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].sort((a,b)=>b[1].length-a[1].length)[0][1];
assert.equal(await readFile('master-base.css','utf8'),base,'master base CSS differs');
for(const name of ['guided.css','interface.css','theme.css','settings-refresh.css','eeprom-config-overview.css'])assert.equal(await readFile(name,'utf8'),await readFile('_ui-master/'+name,'utf8'),name+' differs');
assert.equal(await readFile('nvm-reconstruction.css','utf8'),(await readFile('_ui-master/nvm-reconstruction.css','utf8')).replaceAll('.panel[data-panel="10"]','.panel[data-panel="9"]'));
const browser=await chromium.launch({headless:true});
const comparisons=[];
try{
 for(const theme of ['light','dark']){
  const pages=[];
  for(const [name,url] of [['elmos','http://127.0.0.1:8000/_ui-master/'],['renesas','http://127.0.0.1:8000/?model=zsc31014']]){
   const page=await browser.newPage({viewport:{width:1440,height:1000}});
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.evaluate(t=>{document.documentElement.dataset.theme=t},theme);
   await page.screenshot({path:dir+'/'+name+'-home-'+theme+'.png',fullPage:true});
   // Same synthetic layout probe on both actual documents; not a device simulation.
   await page.evaluate(()=>{
    document.querySelectorAll('body > *').forEach(x=>{if(!['SCRIPT','STYLE','LINK'].includes(x.tagName))x.hidden=true});
    const wrap=document.createElement('main');wrap.className='wrap';wrap.innerHTML='<section class="card panel"><h2>EEPROM Viewer · Layoutvergleich</h2><div class="eeprom-overview"><div class="eeprom-overview-grid"><section class="eeprom-overview-card"><h4>Analog-Frontend</h4><table class="eeprom-overview-table"><thead><tr><th>Einstellung</th><th>EEPROM</th><th>Bedeutung</th></tr></thead><tbody><tr><th class="eeprom-overview-name">Gain</th><td>24 ×</td><td>Verstärkung</td></tr></tbody></table></section></div></div><div class="eeprom-raw-details"><div class="eeprom-table-scroll"><table class="eeprom-table"><thead><tr><th>Adresse</th><th>Bitfield</th><th>Data Hex</th><th>Data</th><th>Funktion</th><th>Schutz</th></tr></thead><tbody><tr class="eeprom-data-row"><td><button class="eeprom-expand" aria-expanded="true">▾ 04</button></td><td class="eeprom-register">Gain</td><td class="eeprom-raw">0x2000</td><td>8192</td><td>Verstärkung</td><td>Nur lesen</td></tr><tr class="eeprom-detail-row"><td colspan="6"><div class="eeprom-detail"><h3>Gain – Verstärkung</h3><p class="eeprom-detail-description">Beispiel eines Registerdetails.</p><dl class="eeprom-meta"><div class="eeprom-meta-item"><dt>Rohwert</dt><dd>0x2000</dd></div></dl><p class="eeprom-formula">Zusammenhang: Gain = Code / 8192</p></div></td></tr></tbody></table></div></div><div id="nvmReconstruction"><div class="nvmrecon-metrics"><div class="nvmrecon-metric nvmrecon-metric-primary"><div class="nvmrecon-metric-heading"><small>Brückenspanne</small><button class="nvmrecon-formula-trigger">ⓘ</button></div><div class="nvmrecon-metric-reading"><strong>3.5</strong><span class="nvmrecon-metric-unit">mV/V</span></div><small>Referenztemperatur</small></div></div><div class="nvmrecon-formula-content"><div class="nvmrecon-formula-eyebrow">SO WIRD DER WERT BERECHNET</div><h2 class="nvmrecon-formula-title">Brückenspanne</h2><div class="nvmrecon-formula-final">3.5 mV/V</div><ol class="nvmrecon-formula-steps"><li><h3>Spanne bestimmen</h3><code class="nvmrecon-formula-equation">B_End − B_Null</code><div class="nvmrecon-formula-values">3.0 − (−0.5) = 3.5 mV/V</div></li></ol></div></div></section>';
    const previous=document.getElementById('nvmReconstruction');if(previous)previous.id='comparison-original-nvm';wrap.id='comparison-probe';document.body.append(wrap);
   });
   const selectors=['.eeprom-overview-card','.eeprom-overview-table','.eeprom-expand','.eeprom-detail','.eeprom-meta-item','.eeprom-formula','.nvmrecon-metric','.nvmrecon-formula-trigger','.nvmrecon-formula-final','.nvmrecon-formula-equation','.nvmrecon-formula-values'];
   const properties=['backgroundColor','color','fontSize','fontWeight','borderRadius','padding','display','lineHeight','margin'];
   const styles=await page.evaluate(({selectors,properties})=>Object.fromEntries(selectors.map(sel=>{const el=document.querySelector('#comparison-probe '+sel),cs=getComputedStyle(el);return [sel,Object.fromEntries(properties.map(p=>[p,cs[p]]))]})),{selectors,properties});
   await page.locator('#comparison-probe').screenshot({path:dir+'/'+name+'-components-'+theme+'.png'});pages.push({name,styles});await page.close();
  }
  const diffs=[];for(const sel of Object.keys(pages[0].styles))for(const prop of Object.keys(pages[0].styles[sel])){const a=pages[0].styles[sel][prop],b=pages[1].styles[sel][prop];if(a!==b)diffs.push({selector:sel,property:prop,elmos:a,renesas:b})}
  comparisons.push({theme,diffs});console.log(theme+' computed style differences:',JSON.stringify(diffs));
 }
}finally{await browser.close()}
await writeFile(dir+'/computed-style-comparison.json',JSON.stringify(comparisons,null,2));
