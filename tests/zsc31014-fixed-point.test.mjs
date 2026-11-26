import test from 'node:test';import assert from 'node:assert/strict';
import {solveBridgeRegisters31014,fitExtended31014,predict31014} from '../zsc31014-fixed-point.mjs';
import {planCalibration31014} from '../zsc31014-calibration-plan.mjs';
const expected=[1333,1940,106,0,2000,2343,1396,2042,1875,1569,1454,1895,2428,2753,2522,2577,3040,3064,2936,3045,3388,3387,3414,3563,3621,3662,3788,3792,4002,3878,4023,4092,4713,4885,4675,5071,5584,5753,5172,5516,6115,5899,5437,6225,6699,6593,5772,6581,5296,7013,6582,6306,7262,7320,7507,7093,7366,7272,7399,7468,8138,8180,8149,7958,8007,7869,8336,8032,8670,8302,8947,8633,9166,8874,9367,9173,9753,9522,10210,9494,9568,9481,9933,9717,10209,10147,9947,10085,10474,10458,10993,10633,11471,10877,11125,10928,13564,12063,10941,11148,11854,11823,12303,11448,12956,12169,12931,12446,12452,12533,13017,12469,14270,13708,14263,13609,13850,13624,15387,13786,14079,13978,14501,14066,15900,14238,15516,14612,16383,15374,16383,15308,16383,16067,16383,790,970,1388,548,1175,2145,2286,2318,1857,652,1293,1966,2176,2951,4319];
const expected8=[0,0,0,0,0,347,0,0,0,0,0,0,296,814,416,610,1048,1229,964,1129,1495,1572,1572,1826,1767,1922,1964,2111,2255,2199,2307,2479,3169,3590,3217,3815,4401,4748,3890,4403,5152,4955,4062,5388,6052,5912,4695,5889,3933,6498,5749,5468,6803,6930,7053,6601,6965,6850,6846,7132,7895,8174,7880,7847,7763,7715,8165,7954,8718,8354,9102,8847,9469,9209,9803,9655,10383,10184,10954,10150,10203,10129,10769,10486,11146,11146,10782,11054,11651,11619,12228,11908,12947,12279,12454,12386,16331,14052,12434,12740,13845,13757,14362,13170,15450,14384,15493,14751,14822,14971,15741,14849,16383,16383,16383,16383,16383,16383,16383,16383,16383,16383,16383,16383,16383,16383,16383,16383,16383,16383,16383,16383,16383,16383,16383,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1823];
test('300 original DLL SolveBridge reference results, signed terms, saturation, gain 1x and 8x',()=>{
 for(const [high,values] of [[false,expected],[true,expected8]]){let seed=12345;
 for(let i=0;i<values.length;i++){const c=[-1024+(i%101)-50,high?32768+1500+i*3:9000+i*3,0,0,0,0,0,0,8192,0,high?1:0,8000];for(let k=2;k<=6;k++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;c[k]=(seed>>>16)%(k===6?600:1000)}
 assert.equal(solveBridgeRegisters31014(c,i%64,(i*97%13000)-6500+.25,(i*331%16000)+.125,i%2,-1024),values[i],'vector '+high+'/'+i);}
 }});
test('native solver produces quantized targets for documented plans and preserves temperature output trims',()=>{
 const w=Array(20).fill(0);w[15]=8;w[4]=8192;w[11]=8192;const original=w.slice();original[10]=5;original[11]=9000;original[12]=9;original[1]=0x8000;
 for(const mode of ['tk0','tke','combined','bridge','tk0Bridge','tkeBridge','combinedBridge','quadraticOffset','quadraticGain','quadraticBoth','full']){
 const plan=planCalibration31014(mode),selected=plan.coefficients.slice(2);const sample=plan.points.map(q=>({bridge:2000+q.pressure*120+(q.temperature-25)*2+(q.temperature-25)*q.pressure*.01,temperatureCode:800+(q.temperature-25)*10,targetPercent:q.targetPercent}));
 const result=fitExtended31014(w,sample,selected,{original});assert.ok(result.error<=16,mode);assert.deepEqual(result.target.slice(10,13),original.slice(10,13));assert.equal(result.target[1]&0x8000,0x8000);assert.equal(result.pred.length,sample.length);
 }
});
