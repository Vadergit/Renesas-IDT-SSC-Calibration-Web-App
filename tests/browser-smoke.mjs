import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try{
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.serialRequests=0;Object.defineProperty(navigator,'serial',{configurable:true,value:{requestPort:()=>{window.serialRequests++;return Promise.reject(new DOMException('Cancelled','NotFoundError'))},getPorts:async()=>[],addEventListener:()=>{}}})});
await page.goto('http://127.0.0.1:8000/?model=zsc31014',{waitUntil:'networkidle'});
await page.locator('#gwConnectionToggle').click();
for(const [i,adapter] of ['renesas','esp32','promicro'].entries()){
 await page.locator('#adapter').selectOption(adapter);
 await page.locator('#connect').click();
 await page.waitForFunction(n=>window.serialRequests===n,i+1);
 await page.waitForFunction(()=>document.getElementById('conn').textContent.includes('abgebrochen'));
 assert.equal(await page.locator('#connect').isEnabled(),true);
}
assert.deepEqual(errors,[]);
await page.goto('http://127.0.0.1:8000/?model=zsc31010',{waitUntil:'networkidle'});
await page.locator('#landing').waitFor({state:'visible'});
assert.equal(await page.locator('[data-task]').count(),8);
await page.locator('[data-task=calibration]').click();
await page.locator('[data-preset=tk0]').click();
await page.locator('#gwNext').click();
await page.locator('#gwNext').click();
await page.locator('#gwNext').click();
await page.locator('#gwCapture').waitFor({state:'visible'});
assert.equal(await page.locator('#gwPointNav button').count(),3);
await page.locator('#example').click();
await page.locator('#calculate').click();
await page.locator('#fitStatus').waitFor({state:'visible'});
assert.match(await page.locator('#fitStatus').textContent(),/Offline-Modell berechnet/);
await page.locator('#gwNext').click();
await page.locator('#verify').waitFor({state:'visible'});
await page.locator('#home').click();
await page.locator('[data-task=inspect]').click();
await page.locator('#hexExample').click();
await page.locator('#hexView').click();
assert.match(await page.locator('#hexResult').textContent(),/Gain_B_code/);
await page.locator('#classic').click();
await page.locator('#workspace').waitFor({state:'visible'});
assert.deepEqual(errors,[]);
}finally{await browser.close()}
