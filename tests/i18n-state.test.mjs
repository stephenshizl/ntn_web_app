import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

test('language switching translates in place and preserves serial log and form values',async()=>{
  let reloads=0;
  const storage=new Map([['ntn.pc.language','zh']]);
  const selector={value:'zh',addEventListener(name,fn){this[name]=fn;}};
  const nodes=[{nodeValue:'固件版本',parentElement:{closest:()=>null}},
    {nodeValue:'19200 · 已连接',parentElement:{closest:()=>null}},
    {nodeValue:'TX 原始HEX 00 FF',parentElement:{closest:()=>({id:'serialLog'})}}];
  const document={title:'NTN终端 PC配置台',documentElement:{lang:'zh-CN'},body:{},
    getElementById:()=>selector,querySelectorAll:()=>[],
    createTreeWalker(){let i=0;return {currentNode:null,nextNode(){this.currentNode=nodes[i++];return !!this.currentNode;}};}};
  const context={document,NodeFilter:{SHOW_TEXT:4},navigator:{language:'zh-CN'},
    localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
    window:{location:{reload(){reloads++;}}}};
  let source=await readFile(new URL('../src/i18n.js',import.meta.url),'utf8');
  source=source.replace(/export /g,'')+'\ninitI18n();';
  vm.runInNewContext(source,context);
  selector.value='en';selector.change();
  assert.equal(reloads,0,'language selection must not reload the serial page');
  assert.equal(nodes[0].nodeValue,'Firmware version');
  assert.equal(nodes[1].nodeValue,'19200 · Connected');
  assert.equal(nodes[2].nodeValue,'TX 原始HEX 00 FF');
  selector.value='zh';selector.change();
  assert.equal(nodes[0].nodeValue,'固件版本');
  assert.equal(nodes[1].nodeValue,'19200 · 已连接');
});
