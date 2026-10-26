import test from 'node:test';
import assert from 'node:assert/strict';
import {SerialClient} from '../src/serial-client.js';

test('authorized reconnection uses the sole granted port without requesting new permission',async()=>{
  const port={};let selected=null;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serial:{getPorts:async()=>[port],requestPort(){throw new Error('unexpected chooser');}}}});
  const client=new SerialClient();client.open=async(p,b)=>{selected={p,b};};
  await client.connectAuthorized(19200);
  assert.equal(selected.p,port);assert.equal(selected.b,19200);
});

test('authorized reconnection refuses an empty or ambiguous port list',async()=>{
  for(const ports of [[],[{},{}]]){
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serial:{getPorts:async()=>ports}}});
    const client=new SerialClient();client.open=()=>{throw new Error('must not select a port');};
    await assert.rejects(client.connectAuthorized(19200),/明确选择目标端口/);
  }
});
