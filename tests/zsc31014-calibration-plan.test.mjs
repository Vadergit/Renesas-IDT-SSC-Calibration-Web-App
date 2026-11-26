import test from 'node:test';
import assert from 'node:assert/strict';
import {planCalibration31014,rawTemperatureInterval31014,decodeCorrectionWords31014,encodeCorrectionWords31014} from '../zsc31014-calibration-plan.mjs';
test('manufacturer topology: two through seven points and independent Tco/Tcg',()=>{
 for(const [mode,n] of Object.entries({linear:2,tk0:3,tke:3,combined:4,bridge:3,tk0Bridge:4,tkeBridge:4,combinedBridge:5,quadraticOffset:5,quadraticGain:5,quadraticBoth:6,full:7})){
  const p=planCalibration31014(mode);assert.equal(p.points.length,n);assert.equal(p.coefficients.length,n);assert.equal(new Set(p.points.map(v=>v.pressure+':'+v.temperature)).size,n);
 }
 assert.equal(planCalibration31014('tk0').points.at(-1).pressure,10);
 assert.equal(planCalibration31014('tke').points.at(-1).pressure,90);
 assert.equal(planCalibration31014('full',{curve:'s-shaped'}).points.length,8);
 assert.throws(()=>planCalibration31014('combined',{temperatures:[25,25]}));
});
test('raw temperature requires unity path and retains lost-bit uncertainty',()=>{
 const w=Array(20).fill(0);w[11]=0x2000;
 assert.deepEqual(rawTemperatureInterval31014(1000,w),{minimum:8000,maximum:8007,midpoint:8003.5});
 assert.throws(()=>rawTemperatureInterval31014(1000,w.map((v,i)=>i===10?1:v)));
 assert.throws(()=>rawTemperatureInterval31014(2048,w));
});
test('manufacturer sign mapping preserves unrelated bits and factory temperature coefficient',()=>{
 const w=Array(20).fill(0);w[1]=0x8049;w[12]=17;
 const updated=encodeCorrectionWords31014(w,{Tco:{magnitude:0xf0,negative:true},Tcg:{magnitude:0x161,negative:true},SOT_bridge:{magnitude:0x3b,negative:true},SOT_tco:{magnitude:0x13e,negative:false},SOT_tcg:{magnitude:0x2de,negative:false}});
 assert.equal(updated[1],0x9c49);assert.equal(updated[5],0x161);assert.equal(updated[6],0xf0);assert.equal(updated[12],17);
 assert.deepEqual(decodeCorrectionWords31014(updated).Tco,{magnitude:0xf0,negative:true});
 assert.deepEqual(decodeCorrectionWords31014(updated).SOT_T,{magnitude:17,negative:true});
 assert.throws(()=>encodeCorrectionWords31014(w,{SOT_bridge:{magnitude:1024,negative:true}}));
});
