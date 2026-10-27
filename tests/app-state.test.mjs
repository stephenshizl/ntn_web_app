import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as protocol from '../src/protocol.js';

async function app(supported=true) {
  const elements=new Map();
  const element=id=>{
    if(!elements.has(id))elements.set(id,{id,value:id==='newBaudSelect'?'19200':'',textContent:'',className:'',disabled:false,
      showModal(){this.open=true;},close(){this.open=false;},
      options:['9600','19200','38400','57600','115200'].map(value=>({value})), handlers:{},
      addEventListener(name,fn){this.handlers[name]=fn;}});
    return elements.get(id);
  };
  let client;
  class FakeSerialClient extends EventTarget {
    constructor(){super();client=this;this.connected=true;this.baudRate=19200;this.writes=[];}
    static isSupported(){return supported;}
    async write(bytes){this.writes.push(new TextDecoder().decode(bytes));}
    async waitForSilence(){return true;}
    emit(name,detail){this.dispatchEvent(new CustomEvent(name,{detail}));}
  }
  const timers=new Map();let nextTimer=1;
  const context={...protocol, SerialClient:FakeSerialClient,initI18n(){},t:s=>s,TextDecoder,TextEncoder,CustomEvent,
    document:{getElementById:element,querySelectorAll:()=>[]},navigator:supported?{serial:{addEventListener(){}}}:{},
    localStorage:{getItem(){return null;},setItem(){}},
    FormData:class {constructor(form){this.form=form;}get(name){return this.form.fields?.[name]??null;}},
    setInterval(fn,ms){const id=nextTimer++;timers.set(id,{fn,ms,interval:true});return id;},clearInterval(id){timers.delete(id);},
    setTimeout(fn,ms){const id=nextTimer++;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},console};
  const source=(await readFile(new URL('../src/app.js',import.meta.url),'utf8')).replace(/^import[\s\S]*?from\s+"[^"]+";\s*/gm,'');
  vm.runInNewContext(source,context,{filename:'src/app.js'});
  const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
  const click=async id=>{element(id).handlers.click();await settle();};
  const rx=async text=>{client.emit('rx',new TextEncoder().encode(text));await settle();};
  return {client,element,click,rx,settle,timers,
    startNamePoll:()=>vm.runInNewContext('startBtNamePoll()',context),
    async submitName(value){element('btNameForm').fields={btName:value};element('btNameForm').handlers.submit({preventDefault(){},currentTarget:element('btNameForm')});await settle();}};
}

test('same-baud APPLIED clears pending state so a later speed change is possible',async()=>{
  const a=await app();await a.click('changeBaudButton');
  await a.rx('\r\n+MCUAPPLY:{"state":"APPLIED","baud":19200}\r\nOK\r\n');
  a.element('newBaudSelect').value='115200';await a.click('changeBaudButton');
  assert.deepEqual(a.client.writes,['AT+MCURS232=19200\r\n','AT+MCURS232=115200\r\n']);
});

test('baud ERROR releases pending operation for retry',async()=>{
  const a=await app();a.element('newBaudSelect').value='115200';await a.click('changeBaudButton');
  await a.rx('\r\n+MCUERROR:6\r\nERROR\r\n');await a.click('changeBaudButton');
  assert.equal(a.client.writes.length,2);
});

test('unsupported browser keeps connection button disabled',async()=>{
  const a=await app(false);assert.equal(a.element('connectButton').disabled,true);
});

test('disconnect resets maintenance badge so reconnect does not inherit old session',async()=>{
  const a=await app();await a.click('enterMaintenanceButton');
  await a.rx('\r\n+MCUAPPLY:{"pc_config":true}\r\nOK\r\n');
  assert.equal(a.element('maintenanceBadge').textContent,'维护模式');
  a.client.emit('state',{connected:false});await a.settle();
  assert.notEqual(a.element('maintenanceBadge').textContent,'维护模式');
});

test('unrelated OK cannot confirm maintenance entry',async()=>{
  const a=await app();await a.click('enterMaintenanceButton');
  await a.rx('\r\n+MCUVER:{"fw":"test"}\r\nOK\r\n');
  assert.notEqual(a.element('maintenanceBadge').textContent,'维护模式');
  await a.rx('\r\n+MCUAPPLY:{"pc_config":true}\r\nOK\r\n');
  assert.equal(a.element('maintenanceBadge').textContent,'维护模式');
});

test('missing baud response expires and permits a fresh operation',async()=>{
  const a=await app();await a.click('changeBaudButton');
  const timer=[...a.timers.values()].find(t=>t.ms===10000);
  assert.ok(timer);timer.fn();await a.settle();
  await a.click('changeBaudButton');assert.equal(a.client.writes.length,2);
});


test('mode0 application clears a previously confirmed maintenance session',async()=>{
  const a=await app();await a.click('enterMaintenanceButton');
  await a.rx('\r\n+MCUAPPLY:{"pc_config":true}\r\nOK\r\n');
  await a.rx('\r\n+MCUAPPLY:{"state":"APPLIED","mode":0}\r\nOK\r\n');
  assert.equal(a.element('maintenanceBadge').textContent,'RAW/普通模式');
});

test('MCU reboot invalidates maintenance without disconnecting the USB adapter',async()=>{
  const a=await app();await a.click('enterMaintenanceButton');
  await a.rx('\r\n+MCUAPPLY:{"pc_config":true}\r\nOK\r\n');
  await a.rx('\r\n[BOOT] NTN-Terminal started, RS232=19200/8N1, mode=0\r\n');
  assert.notEqual(a.element('maintenanceBadge').textContent,'维护模式');
});


test('manual disconnect replaces a stale connected message',async()=>{
  const a=await app();a.client.emit('state',{connected:true,baudRate:19200});
  assert.match(a.element('connectionMessage').textContent,/已连接/);
  a.client.emit('state',{connected:false});
  assert.match(a.element('connectionMessage').textContent,/串口已断开/);
});


test('name UI keeps desired and applied distinct while deferred',async()=>{
  const a=await app();a.startNamePoll();
  await a.rx('+MCUBTNAME:{"mode":"MANUAL","source":"MANUAL","state":"DEFERRED","desired":"New","applied":"Old","mac":"98:D9:72:FD:D7:C0","last_error":0}\r\nOK\r\n');
  assert.match(a.element('btNameState').textContent,/DEFERRED/);
  assert.match(a.element('btNameActual').textContent,/Desired: New\nApplied: Old/);
  assert.equal([...a.timers.values()].filter(t=>t.interval).length,1);
  await a.rx('+MCUBTNAME:{"mode":"MANUAL","source":"MANUAL","state":"APPLIED","desired":"New","applied":"New","mac":"98:D9:72:FD:D7:C0","last_error":0}\r\nOK\r\n');
  assert.equal([...a.timers.values()].filter(t=>t.interval).length,0);
});
test('name query polling uses the production AT command and stops on disconnect',async()=>{
  const a=await app();a.startNamePoll();[...a.timers.values()].find(t=>t.interval).fn();await a.settle();
  assert.equal(a.client.writes[0],'AT+MCUBTNAME?\r\n');
  a.client.emit('state',{connected:false});assert.equal([...a.timers.values()].filter(t=>t.interval).length,0);
  assert.equal(a.element('btNameActual').textContent,'');
});
test('manual name rejects invalid input without writing or silently trimming',async()=>{
  const a=await app();
  for(const value of ['', 'A'.repeat(32),'a,b','中文',' pad ']) await a.submitName(value);
  assert.equal(a.client.writes.length,0);
  await a.submitName('AUTO');assert.equal(a.client.writes[0],'AT+MCUBTNAME=AUTO\r\n');
});
test('legacy firmware name ERROR is visible and never reported applied',async()=>{
  const a=await app();a.startNamePoll();[...a.timers.values()].find(t=>t.interval).fn();await a.settle();
  await a.rx('ERROR\r\n');assert.match(a.element('btNameState').textContent,/名称请求失败/);
  assert.equal([...a.timers.values()].filter(t=>t.interval).length,0);
});

test('user guide opens and closes without serial writes or disconnect',async()=>{
  const a=await app(); await a.click('userGuideButton');
  assert.equal(a.element('userGuideDialog').open,true);
  await a.click('userGuideClose');
  assert.equal(a.element('userGuideDialog').open,false);
  assert.equal(a.client.connected,true); assert.deepEqual(a.client.writes,[]);
});
