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
test('adapter capabilities and identity',()=>{for(const a of ['renesas','esp32','promicro'])for(const m of ['zsc31014','zsc31050','zsc31150'])assert.ok(adapterSupported(a,m));assert.equal(adapterSupported('promicro','zssc3281'),false);assert.throws(()=>verifyBridgeVersion('RENESAS-SSC-3.1 ESP32_C3','promicro'));assert.equal(verifyBridgeVersion('RENESAS-SSC-3.1 PRO_MICRO','promicro'),'RENESAS-SSC-3.1 PRO_MICRO')});
test('original 31014 I2C terminal sequence',async()=>{const sent=[],d=new I2cCB(async c=>{sent.push(c);return c==='ir_28001'?'5A':c==='ir_28003'?'5A1234':''},'zsc31014','28');await d.enter();assert.deepEqual(await d.word(0),[0x12,0x34]);assert.deepEqual(sent,['t11001','t_020','is_10','ps_d41','t00000','iwt28003A00000','ir_28001','iw_28003000000','ir_28003'])});

import {ZACwireDIY} from '../renesas-hardware.mjs';
test('DIY ZACwire explicit candidate support',async()=>{for(const a of ['esp32','promicro'])assert.ok(adapterSupported(a,'zsc31010'));const sent=[],d=new ZACwireDIY(async c=>{sent.push(c);return c==='ZCM10'?'A5':'00'.repeat(13)+'A5'},'zsc31010');await d.enter();await d.readVerified();assert.deepEqual(sent,['ZCM10','ZDUMP','ZDUMP']);await assert.rejects(d.startRaw(Array(14).fill(0)));});

import {ramWord,writeRamChecked,compareBackup,rawStats} from '../renesas-hardware.mjs';
test('RAM coefficient write bounds',async()=>{assert.equal(ramWord('zsc31050',7,65535).command,'RAMW07FFFF');assert.throws(()=>ramWord('zsc31050',8,0));assert.throws(()=>ramWord('zsc31014',0,0));assert.equal(await writeRamChecked('zsc31150',async c=>{assert.equal(c,'RAMW021234');return '1234'},2,0x1234),0x1234);await assert.rejects(writeRamChecked('zsc31150',async()=> '0000',2,0x1234))});
test('backup compare model and byte changes',()=>{assert.deepEqual(compareBackup('zsc31010',[0,2],{schema:1,model:'zsc31010',bytes:[0,1]}),[{index:1,backup:'01',current:'02'}]);assert.throws(()=>compareBackup('zsc31010',[0],{schema:1,model:'zsc31015',bytes:[0]}));});
test('raw statistics',()=>{assert.deepEqual(rawStats([1,3]),{count:2,mean:2,min:1,max:3,std:1})});

import {afeGainPlan,decodeAfe,labelWords} from '../renesas-hardware.mjs';
test('AFE gain masked without touching unrelated bits',()=>{assert.equal(afeGainPlan('zsc31050',0x9800,7).value,0x9807);assert.equal(afeGainPlan('zsc31150',0x0013,7).value,0x01d3);assert.equal(decodeAfe('zsc31150',0x01d3).gain,35);assert.throws(()=>afeGainPlan('zsc31014',0,1));assert.equal(labelWords('zsc31150',[{address:'00',value:'1234'}])[0].name,'c0 Offset')});

import {SerialCommands,isCBVersion} from '../renesas-hardware.mjs';
test('real V4.12k unprefixed banner accepted ONLY for native version query',()=>{const v='V4.12k© ZMD AG 2016 - CB || SVN:5124';assert.equal(parseAck(' '+v,{native:true,command:'v'}),v);assert.equal(parseAck('<ACK>'+v,{native:true,command:'v'}),v);assert.ok(isCBVersion(v));assert.throws(()=>parseAck(v,{native:true,command:'ir_28001'}));assert.throws(()=>parseAck(v,{native:false,command:'v'}));assert.throws(()=>parseAck('<NACK>'+v,{native:true,command:'v'}));});
test('native serial response fragmented including legacy copyright byte',async()=>{let ctrl;const readable=new ReadableStream({start(c){ctrl=c}});const writable=new WritableStream({write(b){assert.equal(new TextDecoder().decode(b),'v\r');ctrl.enqueue(Uint8Array.from([86,52,46,49,50,107,169]));ctrl.enqueue(new TextEncoder().encode(' ZMD AG 2016 - CB || SVN:5124\r\n'));}});const port={readable,writable,close:async()=>{}};const channel=new SerialCommands(port,()=>{},{native:true});try{assert.equal(await channel.command('v'),'V4.12k© ZMD AG 2016 - CB || SVN:5124')}finally{await channel.close()}});

test('original 31014 normal read probe exact manual sequence',async()=>{const sent=[],d=new I2cCB(async c=>{sent.push(c);return c==='irt28001'?'80':''},'zsc31014','28');assert.deepEqual(await d.probe31014(),{firstByte:128,status:2});assert.deepEqual(sent,['t11001','t_020','is_10','ps_d41','irt28001']);assert.equal(d.mode,'nom');});

import {rawSetup31014,linear31014,plan31014,decode31014,program31014} from '../zsc31014-native.mjs';
test('31014 unity and linear calibration preserve factory temperature and protected fields',()=>{const w=Array(20).fill(0);w[15]=0x2a8;w[10]=0x1234;w[11]=0x5678;const raw=rawSetup31014(w),c=linear31014(raw,4000,10000,1638,14745);assert.equal(raw[4],8192);assert.equal(c.target[10],0x1234);assert.equal(c.target[11],0x5678);assert.ok(c.error<3);assert.ok(plan31014(w,raw).every(x=>[3,4,5,6,7,8,9,15].includes(x.address)));assert.throws(()=>plan31014(w,w.map((v,i)=>i===2?0x6000:v)));assert.equal(decode31014(raw).afeGain,24)});
test('31014 programming updates signature before verification and never writes protected words',async()=>{const w=Array(20).fill(0);w[15]=8;let state=w.slice(),events=[];const target=rawSetup31014(w),d={model:'zsc31014',mode:'cm',dump:async()=>state.flatMap(x=>[x>>8,x&255]),write31014:async(i,v)=>{events.push(i);state[i]=v},normal:async()=>{events.push('NOM');d.mode='nom';state[18]=42},enter:async()=>{events.push('CM');d.mode='cm'}};const after=await program31014(d,w,target);assert.equal(after[18],42);assert.deepEqual(events,[4,15,'NOM','CM','NOM'])});

import {original31014} from '../zsc31014-native.mjs';
test('31014 restore refuses different protected configuration and accepts own backup',()=>{const w=Array(20).fill(0);w[15]=0x28;const raw=rawSetup31014(w),file={schema:1,model:'zsc31014',bytes:w.flatMap(x=>[x>>8,x&255])};assert.deepEqual(original31014(raw,file),w);assert.throws(()=>original31014(raw.map((x,i)=>i===0?1:x),file));});

test('31014 write uses documented EEPROM command and verifies SSC ACK',async()=>{const sent=[],d=new I2cCB(async c=>{sent.push(c);return c==='ir_28001'?'5A':''},'zsc31014','28');d.mode='cm';await d.write31014(4,0x2000);assert.deepEqual(sent,['iw_28003442000','ir_28001']);await assert.rejects(d.write31014(2,0x6000));});

import {reconstruct31014} from '../bridge-reconstruction.mjs';
test('31014 bridge reconstruction reference linear exact roundtrip',()=>{const w=Array(20).fill(0);w[3]=0xf000;w[4]=0x4000;w[15]=0x08a8;const r=reconstruct31014(w,{low:25,high:75,vdd:5});assert.equal(r.a.adc,2048);assert.equal(r.b.adc,6144);assert.ok(Math.abs(r.span-4096/16384/24*1000)<1e-10);assert.equal(r.a.code,10240);assert.equal(r.b.code,14336);assert.equal(r.headroom,2047);w[9]=1;assert.throws(()=>reconstruct31014(w));});

test('31014 inversion with inverted polarity and temperature terms',()=>{const w=Array(20).fill(0);w[3]=0xf000;w[4]=0x4000;w[15]=0x0828;w[5]=12;const r=reconstruct31014(w,{low:25,high:75});assert.ok(r.span<0);assert.equal(r.tempComp,true);assert.equal(r.positive,false);w[15]=0x0c28;assert.throws(()=>reconstruct31014(w));});
