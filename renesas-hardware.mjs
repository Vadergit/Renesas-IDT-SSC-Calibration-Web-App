// Renesas SSC Communication Board V3.3/V4.1; evaluation kit manual section 7.
// One outstanding transaction, CR command terminator, CRLF response.
export const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0').toUpperCase()).join(' ');
export function parseAck(line){const m=/^(?:<ACK>|\x06)\s*(.*)$/i.exec(line);if(m)return m[1].trim();const e=/^(?:<NACK>|\x15)\s*(.*)$/i.exec(line);if(e)throw Error('Adapter NACK: '+e[1]);throw Error('Unbekannte Adapterantwort: '+line);}
export function parseHex(payload,count){const s=payload.replace(/\s+/g,'');if(!/^[0-9a-f]+$/i.test(s)||s.length!==count*2)throw Error('Antwortlänge oder Hex-Format falsch (erwartet '+count+' Bytes).');return Array.from(s.match(/../g),x=>parseInt(x,16));}
export function dumpBytes(model,payload){const count={zsc31010:14,zsc31015:20}[model];if(!count)throw Error('Nicht unterstütztes ZACwire-Modell.');const b=parseHex(payload,count);if(b.at(-1)!==0xa5)throw Error('SSC-Abschluss A5 fehlt.');return b;}
export class SerialCommands{
 constructor(port,log=()=>{}){this.port=port;this.log=log;this.reader=port.readable.getReader();this.writer=port.writable.getWriter();this.buffer='';this.pending=null;this.fault=false;this.closed=false;this.task=this.read();}
 async read(){const d=new TextDecoder();try{while(!this.closed){const {value,done}=await this.reader.read();if(done)break;this.buffer+=d.decode(value,{stream:true});if(this.buffer.length>32768)throw Error('Empfangspuffer übergelaufen.');let end;while((end=this.buffer.indexOf('\n'))>=0){const line=this.buffer.slice(0,end).replace(/\r$/,'');this.buffer=this.buffer.slice(end+1);this.log('RX '+line);if(!line)continue;if(!this.pending){this.fault=true;continue}const p=this.pending;this.pending=null;clearTimeout(p.timer);try{p.resolve(parseAck(line))}catch(e){p.reject(e)}}}}catch(e){this.fail(e)}finally{this.fail(Error('USB-Empfang beendet.'));this.reader.releaseLock()}}
 fail(e){this.fault=true;if(this.pending){const p=this.pending;this.pending=null;clearTimeout(p.timer);p.reject(e)}}
 async command(command,timeout=1800){if(this.closed||this.fault||this.pending)throw Error('USB-Kanal nicht bereit. Neu verbinden.');if(!/^[a-zA-Z0-9_]+$/.test(command))throw Error('Ungültiges Kommando.');this.log('TX '+command);let promise=new Promise((resolve,reject)=>{const timer=setTimeout(()=>this.fail(Error('Timeout: '+command+' · Verbindung neu aufbauen.')),timeout);this.pending={resolve,reject,timer}});try{await this.writer.write(new TextEncoder().encode(command+'\r'))}catch(e){this.fail(e)}return promise;}
 async close(){this.closed=true;this.fail(Error('USB getrennt.'));try{await this.reader.cancel();await this.task}finally{this.writer.releaseLock();await this.port.close()}}
}
export class ZACwireCB{
 constructor(command,model){if(!['zsc31010','zsc31015'].includes(model))throw Error('Kein ZACwire-Treiber.');this.command=command;this.model=model;this.mode='unknown';}
 async version(){const v=await this.command('v');if(!/V\d+\.\d+/i.test(v))throw Error('SSC-CB Firmwareantwort nicht erkannt.');return v;}
 async enter(){this.mode='unknown';await this.command('t01000');await this.command('t_030');const ack=await this.command('rwt000025090');if(ack.toUpperCase()!=='A5')throw Error('SSC hat Command Mode nicht bestätigt.');this.mode='cm';}
 async dump(){if(this.mode!=='cm')throw Error('Zuerst Command Mode starten.');return dumpBytes(this.model,await this.command('rw_000020000'))}
 async readVerified(){const a=await this.dump(),b=await this.dump();if(hex(a)!==hex(b))throw Error('EEPROM-Doppellesung unterscheidet sich.');return a;}
 async normal(){if(this.mode!=='cm')throw Error('Command Mode fehlt.');this.mode='unknown';// NOM may not return A5 because SIG changes to analog.
 const v=await this.command('rw_000024000');this.mode='nom-requested';return v;}
}
export function decode31014DF(b){if(!Array.isArray(b)||b.length!==4||b.some(x=>!Number.isInteger(x)||x<0||x>255))throw Error('Vier I2C-Bytes nötig.');return {status:b[0]>>6,bridge:((b[0]&63)<<8)|b[1],temperatureCode:(b[2]<<3)|(b[3]>>5)};}
export function decode31014EEPROM(b){if(!Array.isArray(b)||b.length!==40||b.some(x=>!Number.isInteger(x)||x<0||x>255))throw Error('20 EEPROM-Wörter nötig.');return Array.from({length:20},(_,i)=>(b[i*2]<<8)|b[i*2+1]);}

export function gainOffsetPlan(before,gain,offset){
 if(!Array.isArray(before)||before.length!==14||before[13]!==0xa5||(before[12]>>4)!==(before[0]&15)||before.some(b=>!Number.isInteger(b)||b<0||b>255))throw Error('Gültiger ZSC31010 EEPROM-Dump nötig.');
 if(!Number.isInteger(gain)||gain<0||gain>32767||!Number.isInteger(offset)||offset< -8192||offset>8191)throw Error('Gain/Offset-Code ausserhalb des Wertebereichs.');
 const oldGain=(before[10]>>5)|(before[11]<<3)|((before[12]&15)<<11),oldOffset=before[0]|((before[1]&63)<<8),o=offset&16383;
 const commands=[];for(const [cmd,oldVal,newVal] of [[0x80,oldGain>>8,gain>>8],[0x90,oldGain&255,gain&255],[0xa0,oldOffset>>8,o>>8],[0xb0,oldOffset&255,o&255]])if(oldVal!==newVal)commands.push([cmd,newVal]);
 const expected=before.slice();expected[0]=o&255;expected[1]=(expected[1]&192)|(o>>8);expected[10]=(expected[10]&31)|((gain&7)<<5);expected[11]=(gain>>3)&255;expected[12]=((o&15)<<4)|(gain>>11);
 return {commands,expected};
}
export async function writeGainOffset(driver,before,gain,offset){
 if(driver.model!=='zsc31010'||driver.mode!=='cm')throw Error('ZSC31010 im Command Mode erforderlich.');
 const plan=gainOffsetPlan(before,gain,offset),current=await driver.readVerified();
 if(hex(current)!==hex(before))throw Error('EEPROM seit Backup verändert; Vorgang abgebrochen.');
 for(const bytes of plan.commands){const ack=await driver.command('rw_00002'+hex(bytes).replaceAll(' ',''));if(ack.toUpperCase()!=='A5')throw Error('Schreibbefehl nicht bestätigt. EEPROM kann teilweise geändert sein; erneut auslesen, nicht automatisch wiederholen.');}
 const after=await driver.readVerified();if(hex(after)!==hex(plan.expected))throw Error('EEPROM-Rücklesekontrolle stimmt nicht mit dem Soll-Dump überein. Keine automatische Wiederholung.');
 return {after,changed:plan.commands.length};
}
