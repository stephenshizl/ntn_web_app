import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as protocol from '../src/protocol.js';
import * as mcuOta from '../src/mcu-ota.js';
import { extractReleaseApp } from '../src/release-hex.js';

async function app(supported=true) {
  const elements=new Map();
  const element=id=>{
    if(!elements.has(id))elements.set(id,{id,value:id==='newBaudSelect'?'19200':'',textContent:'',className:'',disabled:false,
      replaceChildren(...children){this.children=children;},
      showModal(){this.open=true;},close(){this.open=false;},
      options:['9600','19200','38400','57600','115200'].map(value=>({value})), handlers:{},
      addEventListener(name,fn){this.handlers[name]=fn;}});
    return elements.get(id);
  };
  let client;
  class FakeSerialClient extends EventTarget {
    constructor(){super();client=this;this.connected=true;this.baudRate=19200;this.writes=[];this.rawWrites=[];this.reopens=[];}
    static isSupported(){return supported;}
    async write(bytes){this.rawWrites.push(bytes);this.writes.push(new TextDecoder().decode(bytes));this.onWrite?.(bytes);}
    async reopen(baud){this.reopens.push(baud);this.connected=false;this.emit('state',{connected:false});this.baudRate=baud;this.connected=true;this.emit('state',{connected:true,baudRate:baud});}
    async disconnect(){this.connected=false;this.emit('state',{connected:false});}
    async waitForSilence(){return true;}
    emit(name,detail){this.dispatchEvent(new CustomEvent(name,{detail}));}
  }
  const timers=new Map();let nextTimer=1;
  const context={...protocol,...mcuOta,extractReleaseApp,SerialClient:FakeSerialClient,initI18n(){},t:s=>s,TextDecoder,TextEncoder,CustomEvent,Uint8Array,DataView,Date,
    document:{getElementById:element,querySelectorAll:()=>[],
      createElement:()=>({textContent:'',classList:{toggle(){}}})},navigator:supported?{serial:{addEventListener(){}}}:{},
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
    setHidden:value=>{context.document.hidden=value;},
    query:command=>vm.runInNewContext(`queryAt(${JSON.stringify(command)})`,context),
    startNamePoll:()=>vm.runInNewContext('startBtNamePoll()',context),
    async submitName(value){element('btNameForm').fields={btName:value};element('btNameForm').handlers.submit({preventDefault(){},currentTarget:element('btNameForm')});await settle();}};
}

test('self-test associates faults with the responding terminal and clears the result on disconnect',async()=>{
  const a=await app();
  await a.rx('BOOT2 ERROR NOR_INIT\r\n');
  assert.match(a.element('bootDiagnostic').textContent,/终端停在 BL2/);
  await a.query('AT+MCUSELFTEST?');
  await a.rx('OK\r\n');
  assert.equal(a.element('selfTestSummary').textContent,'等待设备应答');
  await a.rx('+MCUSELFTEST:{"sn":"TEST-01","nor_ready":false,"queue_ready":false,"config_saved":false,"gnss_valid":false,"registered":0}\r\nOK\r\n');
  assert.match(a.element('selfTestSummary').textContent,/检测到存储异常.*TEST-01/);
  assert.match(a.element('selfTestItems').children[0].textContent,/外置 NOR.*异常/);
  a.client.emit('state',{connected:false});
  assert.equal(a.element('selfTestSummary').textContent,'尚未自检');
  assert.equal(a.element('bootDiagnostic').hidden,true);
});

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

test('fragmented version response is displayed only after a complete line and matching OK',async()=>{
  const a=await app();await a.query('AT+MCUVER?');
  await a.rx('OK\r\n');
  assert.match(a.element('queryMessage').textContent,/等待设备应答/);
  const response='\r\n+MCUVER:{"fw":"V3.0.0","hw":"HC32F460-V2.0","build":"Nov 4 2026 15:12:47"}\r\nOK\r\n';
  for(const byte of response)await a.rx(byte);
  assert.equal(a.element('firmwareValue').textContent,'V3.0.0');
  assert.equal(a.element('hardwareValue').textContent,'HC32F460-V2.0');
  assert.equal(a.element('buildValue').textContent,'Nov 4 2026 15:12:47');
  assert.match(a.element('queryMessage').textContent,/查询成功/);
  assert.match(a.element('queryResponse').textContent,/"fw": "V3.0.0"/);
  assert.match(a.element('queryResponse').textContent,/OK$/);
  assert.equal([...a.timers.values()].filter(t=>t.ms===5000).length,0);
});

test('all quick response formats display data, including queue alias and CSV time',async()=>{
  const a=await app();
  for(const [command,response] of [
    ['AT+MCUCAP?','+MCUCAP:{"udp":true,"upgrade":false}'],
    ['AT+MCUCFG?','+MCUCFG:{"pc_entry_enabled":1,"active":false}'],
    ['AT+MCUQUEUE?','+MCUSTAT:{"mode":0,"ntn_state":0,"registered":4,"flash_pending":0}'],
    ['AT+MCUGNSS?','+MCUGNSS:{"valid":false,"sats":0}'],
    ['AT+MCUTIME?','+MCUTIME:0,,GNSS,4294967295'],
    ['AT+MCURXMODE?','+MCURXMODE:{"saved":0,"effective":-1,"name":"QUERY"}']
  ]) {
    await a.query(command);await a.rx(response+'\r\nOK\r\n');
    assert.match(a.element('queryMessage').textContent,/查询成功/);
    assert.notEqual(a.element('queryResponse').textContent,'—');
  }
  assert.equal(a.element('ntnValue').textContent,'网络状态未知');
  assert.equal(a.element('gnssValue').textContent,'未定位');
  assert.equal(a.element('timeValue').textContent,'时间无效');
  assert.match(a.element('rxModeValue').textContent,/QUERY.*-1/);
  await a.rx('+MCUTIME:1,2026-11-04T10:00:00Z,GNSS,0\r\n');
  assert.equal(a.element('timeValue').textContent,'2026-11-04T10:00:00Z');
});

test('new GNSS response is not overwritten by an old status response',async()=>{
  const a=await app();await a.rx('+MCUSTAT:{"gnss_valid":false}\r\nOK\r\n');
  await a.rx('+MCUGNSS:{"valid":true}\r\nOK\r\n');
  assert.equal(a.element('gnssValue').textContent,'定位有效');
});

test('query errors and timeouts are visible and disconnect clears stale device information',async()=>{
  const a=await app();await a.query('AT+MCUVER?');
  await assert.rejects(a.query('AT+MCUCAP?'),/等待/);
  await a.rx('+MCUERROR:6\r\nERROR\r\n');
  assert.match(a.element('queryMessage').textContent,/设备返回错误/);
  assert.match(a.element('queryResponse').textContent,/MCUERROR:6/);
  await a.query('AT+MCUVER?');
  [...a.timers.values()].find(t=>t.ms===5000).fn();
  assert.match(a.element('queryMessage').textContent,/查询超时/);
  await a.query('AT+MCUVER?');await a.rx('+MCUVER:{"fw":"V3.0.0"}\r\nOK\r\n');
  a.client.emit('state',{connected:false});
  assert.equal(a.element('firmwareValue').textContent,'—');
  assert.equal(a.element('queryResponse').textContent,'—');
});

test('default log combines RX fragments while raw TXT/HEX preserves original chunks',async()=>{
  const a=await app();
  for(const chunk of ['a','t\r','O','K\r\n'])await a.rx(chunk);
  assert.equal(a.element('serialLog').textContent.split('\n').length,2);
  assert.match(a.element('serialLog').textContent,/RX\s+at\n.*RX\s+OK$/);
  assert.match(a.element('rawLog').textContent,/len=1\n  TXT a\n  HEX 61/);
  assert.match(a.element('rawLog').textContent,/len=2\n  TXT t\\r\n  HEX 74 0D/);
  a.element('logView').value='raw';a.element('logView').handlers.change();
  assert.equal(a.element('serialLog').hidden,true);
  assert.equal(a.element('rawLog').hidden,false);
  a.element('logView').value='text';a.element('logView').handlers.change();
  assert.equal(a.element('serialLog').hidden,false);
  assert.equal(a.element('rawLog').hidden,true);
  await a.click('clearLogButton');
  assert.equal(a.element('serialLog').textContent,'');
  assert.equal(a.element('rawLog').textContent,'');
  await a.rx('OK\r\n');
  assert.equal(a.element('serialLog').textContent.split('\n').length,1);
});

test('modem queries discover mode automatically and reject RAW mode',async()=>{
  const a=await app();
  await a.click('simQueryButton');
  assert.deepEqual(a.client.writes,['AT+MCUSTAT?\r\n']);
  await a.rx('+MCUSTAT:{"mode":0}\r\nOK\r\n');
  assert.equal(a.client.writes.at(-1),'AT+CPIN?\r\n');
  await a.rx('+CPIN:SIM PIN\r\nOK\r\n');
  assert.equal(a.element('simValue').textContent,'已插卡，需要PIN');

  await a.click('networkQueryButton');
  assert.equal(a.client.writes.at(-1),'AT+CEREG?\r\n');
  await a.rx('AT+CEREG?\r+CEREG:1,5\r\nOK\r\n');
  assert.equal(a.element('networkValue').textContent,'已入网（漫游）');
  await a.click('simQueryButton');await a.rx('+CME ERROR: 13\r\n');
  assert.equal(a.element('simValue').textContent,'查询失败，状态未知');
  assert.match(a.element('queryMessage').textContent,/设备返回错误/);

  const b=await app();await b.rx('+MCUSTAT:{"mode":1}\r\nOK\r\n');
  await b.click('networkQueryButton');assert.deepEqual(b.client.writes,[]);
});

test('network auto refresh is opt-in, runs at 5 seconds and pauses while hidden or busy',async()=>{
  const a=await app();
  assert.equal([...a.timers.values()].filter(t=>t.interval&&t.ms===5000).length,0);
  await a.rx('+MCUSTAT:{"mode":0}\r\nOK\r\n');
  a.element('networkAutoRefresh').checked=true;a.element('networkAutoRefresh').handlers.change();await a.settle();
  const timer=[...a.timers.values()].find(t=>t.interval&&t.ms===5000);assert.ok(timer);
  assert.deepEqual(a.client.writes,['AT+CEREG?\r\n']);
  timer.fn();await a.settle();assert.equal(a.client.writes.length,1);
  await a.rx('+CEREG:1,2\r\nOK\r\n');
  a.setHidden(true);timer.fn();await a.settle();assert.equal(a.client.writes.length,1);
  a.setHidden(false);timer.fn();await a.settle();assert.equal(a.client.writes.length,2);
  await a.rx('+CEREG:1,1\r\nOK\r\n');
  assert.equal(a.element('networkValue').textContent,'已入网（本地）');
  await a.query('AT+MCUVER?');timer.fn();await a.settle();assert.equal(a.client.writes.length,3);
  await a.rx('+MCUVER:{"fw":"V3.0.0"}\r\nOK\r\n');
  await a.rx('+MCUAPPLY:{"mode":1}\r\nOK\r\n');
  assert.equal(a.element('networkAutoRefresh').checked,false);
  assert.equal([...a.timers.values()].filter(t=>t.interval&&t.ms===5000).length,0);
  a.client.emit('state',{connected:false});
  assert.equal(a.element('networkValue').textContent,'—');
  assert.equal(a.element('simValue').textContent,'—');
});

function fakeOtaImage(buildByte) {
  const data = new Uint8Array(3072);
  const view = new DataView(data.buffer);
  view.setUint32(0, 0x96f3b83d, true);
  view.setUint16(8, 0x400, true);
  view.setUint32(12, data.length - 0x480, true);
  data.set(new TextEncoder().encode('NTHC'), 0x800);
  view.setUint32(0x804, 0x00400001, true);
  view.setUint32(0x808, 0x314e544e, true);
  view.setUint32(0x80c, 1, true);
  view.setUint32(0x818, 1, true);
  data.fill(buildByte, 0x81c, 0x82c);
  return { name: 'app.signed.bin', size: data.length, async arrayBuffer() { return data.buffer; } };
}

function attachFakeOtaDevice(a, { prevBuild, postReplies, rawMode = false }) {
  const enc = new TextEncoder();
  let phase = 'app';
  let dataBlocks = 0;
  let postIdx = 0;
  let maintCount = 0;
  a.client.onWrite = bytes => {
    const text = new TextDecoder().decode(bytes);
    const push = v => queueMicrotask(() => a.client.emit('rx', typeof v === 'string' ? enc.encode(v) : v));
    if (text === 'AT+MCUCAP?\r\n') return push('+MCUCAP:{"upgrade":true}\r\nOK\r\n');
    if (text === 'AT+MCUOTASTAT?\r\n') {
      if (phase === 'app') return push(`+MCUOTASTAT:{"build":"${prevBuild}","confirmed":true}\r\nOK\r\n`);
      const reply = postReplies[Math.min(postIdx++, postReplies.length - 1)];
      return push(reply);
    }
    if (text === 'AT+MCUOTA=BOOT\r\n') { phase = 'boot'; return push('+MCUOTA:{"state":"REBOOTING"}\r\nOK\r\n'); }
    if (text === 'NTN-MCU-OTA/1 HELLO\r\n') return push('READY 1 1 376832\r\n');
    if (text.startsWith('BEGIN ')) { phase = 'ymodem_blk0'; return push('RX 1\r\nC'); }
    if (phase === 'ymodem_blk0' && bytes[0] === 1 && bytes[1] === 0) { phase = 'ymodem_data'; return push(Uint8Array.of(6, 67)); }
    if (phase === 'ymodem_data' && bytes[0] === 2) { dataBlocks++; return push(Uint8Array.of(6)); }
    if (phase === 'ymodem_data' && bytes.length === 1 && bytes[0] === 4) { phase = 'ymodem_eot2'; return push(Uint8Array.of(21)); }
    if (phase === 'ymodem_eot2' && bytes.length === 1 && bytes[0] === 4) { phase = 'ymodem_end'; return push(Uint8Array.of(6, 67)); }
    if (phase === 'ymodem_end' && bytes[0] === 1) {
      phase = 'post';
      push(Uint8Array.of(6));
      push('VERIFIED 1\r\n');
      if (rawMode) push('[BOOT] NTN-Terminal started\r\n');
      return;
    }
    if (text === '+++') { maintCount++; return; }
    if (text === 'AT+MCUCFG=1\r\n') return push('+MCUAPPLY:{"pc_config":true}\r\nOK\r\n');
  };
  return { getMaintCount: () => maintCount, getDataBlocks: () => dataBlocks };
}

const drain = async (rounds = 6) => {
  for (let r = 0; r < rounds; r++) {
    await new Promise(resolve => setImmediate(resolve));
  }
};

test('manual disconnect during OTA immediately aborts while intentional baud reopen succeeds', async () => {
  const a = await app();
  a.element('mcuOtaFile').files = [fakeOtaImage(0xb2)];
  // Part 1: manual disconnect during AT+MCUCAP? wait wakes immediately
  a.client.onWrite = () => {};
  a.element('mcuOtaStart').handlers.click();
  await drain();
  a.client.emit('state', { connected: false });
  await drain();
  assert.match(a.element('mcuOtaStatus').textContent, /串口已关闭/);

  // Part 2: intentional 115200 -> 19200 -> 115200 reopen completes end-to-end
  a.client.connected = true;
  a.client.baudRate = 115200;
  const newBuild = 'b2'.repeat(16);
  const oldBuild = 'a1'.repeat(16);
  attachFakeOtaDevice(a, {
    prevBuild: oldBuild,
    postReplies: [`+MCUOTASTAT:{"build":"${newBuild}","confirmed":true}\r\nOK\r\n`]
  });
  a.element('mcuOtaStart').handlers.click();
  await drain(12);
  assert.deepEqual(a.client.reopens, [19200, 115200]);
  assert.equal(a.element('mcuOtaStatus').textContent, `已确认固件 ${newBuild}`);
});

test('rollback to previous confirmed build is detected immediately and same-build still confirms', async () => {
  // Case 1: rollback detected immediately after seeing trial/boot
  const a = await app();
  const oldBuild = 'a1'.repeat(16);
  a.element('mcuOtaFile').files = [fakeOtaImage(0xb2)];
  attachFakeOtaDevice(a, {
    prevBuild: oldBuild,
    postReplies: [
      `+MCUOTASTAT:{"build":"${'b2'.repeat(16)}","confirmed":false}\r\nOK\r\n`,
      `+MCUOTASTAT:{"build":"${oldBuild}","confirmed":true}\r\nOK\r\n`
    ]
  });
  a.element('mcuOtaStart').handlers.click();
  await drain(12);
  // Fire the 2000ms poll delay timer once
  const pollTimer = [...a.timers.values()].find(t => t.ms === 2000);
  assert.ok(pollTimer);
  pollTimer.fn();
  await drain(12);
  assert.match(a.element('mcuOtaStatus').textContent, new RegExp(`已回滚至旧版本 ${oldBuild}`));

  // Case 2: same-build upgrade confirms without false rollback
  const b = await app();
  b.element('mcuOtaFile').files = [fakeOtaImage(0xa1)];
  attachFakeOtaDevice(b, {
    prevBuild: oldBuild,
    postReplies: [`+MCUOTASTAT:{"build":"${oldBuild}","confirmed":false}\r\nOK\r\n`,
      `+MCUOTASTAT:{"build":"${oldBuild}","confirmed":true}\r\nOK\r\n`]
  });
  b.element('mcuOtaStart').handlers.click();
  await drain(12);
  const sameBuildPoll = [...b.timers.values()].find(t => t.ms === 2000);
  assert.ok(sameBuildPoll);
  sameBuildPoll.fn(); await drain(12);
  assert.equal(b.element('mcuOtaStatus').textContent, `已确认固件 ${oldBuild}`);
});

test('RAW mode post-upgrade confirmation enters +++ maintenance only once across multiple polls', async () => {
  const a = await app();
  await a.rx('+MCUSTAT:{"mode":1}\r\nOK\r\n');
  const newBuild = 'c3'.repeat(16);
  a.element('mcuOtaFile').files = [fakeOtaImage(0xc3)];
  const dev = attachFakeOtaDevice(a, {
    prevBuild: 'a1'.repeat(16),
    rawMode: true,
    postReplies: [
      `+MCUOTASTAT:{"build":"${newBuild}","confirmed":false}\r\nOK\r\n`,
      `+MCUOTASTAT:{"build":"${newBuild}","confirmed":true}\r\nOK\r\n`
    ]
  });
  a.element('mcuOtaStart').handlers.click();
  await drain(12);
  const pollTimer = [...a.timers.values()].find(t => t.ms === 2000);
  assert.ok(pollTimer);
  pollTimer.fn();
  await drain(12);
  assert.equal(dev.getMaintCount(), 1);
  assert.equal(a.element('mcuOtaStatus').textContent, `已确认固件 ${newBuild}`);
});

test('an old confirmed reply and generic boot banner do not prove rollback', async () => {
  const a = await app();
  const old = 'a1'.repeat(16);
  const target = 'c3'.repeat(16);
  a.element('mcuOtaFile').files = [fakeOtaImage(0xc3)];
  attachFakeOtaDevice(a, { prevBuild: old, postReplies: [
    `[BOOT] startup\r\n+MCUOTASTAT:{"build":"${old}","confirmed":true}\r\n`,
    `+MCUOTASTAT:{"build":"${target}","confirmed":true}\r\n`
  ]});
  a.element('mcuOtaStart').handlers.click(); await drain();
  assert.doesNotMatch(a.element('mcuOtaStatus').textContent, /回滚/);
  const poll = [...a.timers.values()].find(timer => timer.ms === 2000);
  assert.ok(poll); poll.fn(); await drain();
  assert.match(a.element('mcuOtaStatus').textContent, new RegExp(target));
});

test('RAW status polling waits for explicit maintenance entry', async () => {
  const a = await app();
  await a.rx('+MCUSTAT:{"mode":1}\r\nOK\r\n');
  a.element('mcuOtaFile').files = [fakeOtaImage(0xc3)];
  attachFakeOtaDevice(a, {prevBuild:'a1'.repeat(16),rawMode:true,postReplies:[]});
  const original = a.client.onWrite;
  let entering = false;
  let queries = 0;
  a.client.onWrite = bytes => {
    const text = new TextDecoder().decode(bytes);
    if (text === 'AT+MCUCFG=1\r\n') {
      entering = true;
      void a.rx('OK\r\n');
      return;
    }
    if (entering && text === 'AT+MCUOTASTAT?\r\n') { queries++; return; }
    original(bytes);
  };
  a.element('mcuOtaStart').handlers.click(); await drain();
  await new Promise(resolve => setTimeout(resolve, 2150));
  assert.ok(entering);
  assert.equal(queries, 0);
  await a.client.disconnect(); await drain();
});
