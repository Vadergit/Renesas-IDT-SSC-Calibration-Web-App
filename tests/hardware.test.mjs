import test from 'node:test';import assert from 'node:assert/strict';import {parseAck,parseHex,dumpBytes,ZACwireCB,decode31014DF,decode31014EEPROM} from '../renesas-hardware.mjs';
test('ACK and NACK',()=>{assert.equal(parseAck('<ACK> A5'),'A5');assert.equal(parseAck('\x06A5'),'A5');assert.throws(()=>parseAck('<NACK> 041'));assert.throws(()=>parseAck('A5'));});
test('read exact length and A5',()=>{assert.equal(dumpBytes('zsc31010','00'.repeat(13)+'A5').length,14);assert.throws(()=>dumpBytes('zsc31010','00'.repeat(14)));assert.throws(()=>dumpBytes('zsc31015','00'.repeat(13)+'A5'));assert.throws(()=>parseHex('XX',1));});
test('ZACwire enter and duplicate read',async()=>{const sent=[],d=new ZACwireCB(async c=>{sent.push(c);return c==='v'?'V2.20':c==='rwt000025090'?'A5':c==='rw_000020000'?'00'.repeat(13)+'A5':''},'zsc31010');assert.equal(await d.version(),'V2.20');await d.enter();assert.equal((await d.readVerified()).length,14);assert.deepEqual(sent,['v','t01000','t_030','rwt000025090','rw_000020000','rw_000020000']);});
test('I2C data fields',()=>{assert.deepEqual(decode31014DF([0x81,0x23,0x45,0xe0]),{status:2,bridge:291,temperatureCode:559});assert.equal(decode31014EEPROM(Array(40).fill(255))[19],65535);});

import {gainOffsetPlan,writeGainOffset} from '../renesas-hardware.mjs';
const base=[0xff,0,0x20,0,0,0,0,0,0x14,0x60,0xf3,0xff,0xf7,0xa5];
test('gain offset commands and preservation',()=>{const p=gainOffsetPlan(base,2048,-16);assert.deepEqual(p.commands,[[0x80,8],[0x90,0],[0xa0,63],[0xb0,240]]);assert.equal(p.expected[0],240);assert.equal(p.expected[1],63);assert.equal(p.expected[10]&31,base[10]&31);assert.equal(p.expected[12],1);assert.deepEqual(p.expected.slice(2,10),base.slice(2,10));});
test('write aborts before commands if backup differs',async()=>{let sent=0;const d={model:'zsc31010',mode:'cm',readVerified:async()=>{const a=base.slice();a[2]=1;return a},command:async()=>{sent++;return 'A5'}};await assert.rejects(writeGainOffset(d,base,2048,0));assert.equal(sent,0)});
test('write checks all bytes',async()=>{const p=gainOffsetPlan(base,2048,-16);let reads=0;const d={model:'zsc31010',mode:'cm',readVerified:async()=>reads++?p.expected:base,command:async()=> 'A5'};assert.equal((await writeGainOffset(d,base,2048,-16)).changed,4);});

import {i2cProfiles,decodeRawPair,averageRaw,readDouble} from '../renesas-hardware.mjs';
test('model-specific memory sizes and primary address',()=>{assert.equal(i2cProfiles.zsc31050.words,32);assert.equal(i2cProfiles.zsc31150.ram,15);assert.equal(i2cProfiles.zsc31050.address,'78');});
test('raw words expose both signed and unsigned representation',()=>{assert.deepEqual(decodeRawPair([0xff,0xfe,0x80,0]),{pressureWord:65534,temperatureWord:32768,pressureSigned:-2,temperatureSigned:-32768});});
test('averaging and count validation',async()=>{const a=await averageRaw(async()=>decodeRawPair([0,10,0,20]),3);assert.equal(a.pressureSigned,10);assert.equal(a.samples.length,3);await assert.rejects(averageRaw(()=>{},0));});
test('double read rejects changed memory',async()=>{let i=0;await assert.rejects(readDouble(async()=>i++?'0001':'0000','RAM',1));assert.equal((await readDouble(async()=> 'ABCD','RAM',1)).words[0].value,'ABCD');});

import {decode31010Raw,twoPoint31010} from '../renesas-hardware.mjs';
test('ZACwire raw frame',()=>{assert.deepEqual(decode31010Raw([0x12,0x34,0x56]),{raw:4660,tempCode:86,format:'ZACwire14/8',bytes:[18,52,86]});assert.throws(()=>decode31010Raw([0xff,0,0]));});
test('linear ideal native gain candidate',()=>{const r=twoPoint31010(1000,9000,1250,11250);assert.equal(r.gainCode,2048);assert.equal(r.offsetCode,0);assert.equal(r.error,0);assert.throws(()=>twoPoint31010(9000,1000,0,1000));});

import {adapterSupported,verifyBridgeVersion,I2cCB} from '../renesas-hardware.mjs';
test('adapter capabilities and identity',()=>{for(const a of ['renesas','esp32','promicro'])for(const m of ['zsc31014','zsc31050','zsc31150'])assert.ok(adapterSupported(a,m));assert.equal(adapterSupported('promicro','zssc3281'),false);assert.throws(()=>verifyBridgeVersion('RENESAS-SSC-3 ESP32_C3','promicro'));assert.equal(verifyBridgeVersion('RENESAS-SSC-3 PRO_MICRO','promicro'),'RENESAS-SSC-3 PRO_MICRO')});
test('original 31014 I2C terminal sequence',async()=>{const sent=[],d=new I2cCB(async c=>{sent.push(c);return c==='ir_28001'?'5A':c==='ir_28003'?'5A1234':''},'zsc31014','28');await d.enter();assert.deepEqual(await d.word(0),[0x12,0x34]);assert.deepEqual(sent,['t11001','t_020','is_10','ps_d41','t00000','iwt28003A00000','ir_28001','iw_28003000000','ir_28003'])});

import {ZACwireDIY} from '../renesas-hardware.mjs';
test('DIY ZACwire explicit candidate support',async()=>{for(const a of ['esp32','promicro'])assert.ok(adapterSupported(a,'zsc31010'));const sent=[],d=new ZACwireDIY(async c=>{sent.push(c);return c==='ZCM10'?'A5':'00'.repeat(13)+'A5'},'zsc31010');await d.enter();await d.readVerified();assert.deepEqual(sent,['ZCM10','ZDUMP','ZDUMP']);await assert.rejects(d.startRaw(Array(14).fill(0)));});
