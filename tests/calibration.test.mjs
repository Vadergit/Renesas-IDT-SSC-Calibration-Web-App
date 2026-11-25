import test from 'node:test';
import assert from 'node:assert/strict';
import {fitModel,predict,verification,bridge,outputValue} from '../calibration.mjs';
import {profiles} from '../catalog.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8);
test('linear and inverse',()=>{const f=fitModel([{raw:100,reference:100},{raw:900,reference:0}]);near(predict(f,500),50);near(f.gain,-.125);});
test('quadratic',()=>near(predict(fitModel([-2,-1,0,1,2].map(raw=>({raw,reference:2+3*raw+raw*raw})),'quadratic'),3),20));
test('temperature',()=>near(predict(fitModel([0,100].flatMap(raw=>[10,40].map(temp=>({raw,temp,reference:raw+temp*.2+raw*temp*.01}))),'temperature'),50,25),67.5));
test('singular and nonfinite',()=>{assert.throws(()=>fitModel([{raw:1,reference:1},{raw:1,reference:2}]));assert.throws(()=>fitModel([{raw:NaN,reference:1},{raw:2,reference:2}]));});
test('independent verification',()=>{const f=fitModel([{raw:0,reference:0},{raw:100,reference:100}]);assert.equal(verification(f,50,25,49,100,.5).pass,false);assert.equal(verification(f,50,25,49,100,1).pass,true);});
test('bridge and clipping',()=>{near(bridge(5,-.5,3.5,24).amplifiedSpanMv,480);near(outputValue(150,0,100,.5,4.5,true),4.5);assert.throws(()=>outputValue(1,1,1,0,5,true));});
test('all profiles fail closed',()=>{assert.equal(profiles.length,8);assert.ok(profiles.every(p=>p.hardware===false));});

import {decode31010} from '../zsc31010.mjs';
test('ZSC31010 default field example',()=>{const r=decode31010('FF 00 20 00 00 00 00 00 14 60 F3 FF F7 A5');assert.equal(r.Gain_B_code,16383);assert.equal(r.Offset_B,255);assert.equal(r.Gain_T,1);assert.equal(r.preampGain,24);assert.equal(r.outputMode,'Ratiometrisch');assert.equal(r.updateMs,5);});
test('ZSC31010 malformed dump rejected',()=>{assert.throws(()=>decode31010('FF 00 20 00 00 00 00 00 14 60 F3 FF E7 A5'));assert.throws(()=>decode31010('FF 00'));});
