import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAtBytes, bytesToEscapedText, bytesToHex, extractJsonResponse,
  lineEndingValue, parseHex, safeCommandValue, ReadableSerialLog
} from "../src/protocol.js";

test("HEX输入支持常见分隔并保持二进制", () => {
  const bytes = parseHex("0x00, 0xFF:0D-0A");
  assert.deepEqual([...bytes], [0x00, 0xff, 0x0d, 0x0a]);
  assert.equal(bytesToHex(bytes), "00 FF 0D 0A");
  assert.equal(bytesToEscapedText(bytes), "\\x00\\xFF\\r\\n");
});

test("非法HEX被拒绝", () => {
  assert.throws(() => parseHex("123"), /偶数/);
  assert.throws(() => parseHex("GG"), /非法/);
});

test("AT命令统一追加CRLF", () => {
  const text = new TextDecoder().decode(buildAtBytes("at+MCUVER?\r\n"));
  assert.equal(text, "AT+MCUVER?\r\n");
  assert.throws(() => buildAtBytes("MCUVER?"), /AT开头/);
  assert.equal(lineEndingValue("cr"), "\r");
});

test("提取最新MCUSTAT JSON", () => {
  const value = extractJsonResponse("x\r\n+MCUSTAT:{\"mode\":1,\"socket_open\":true}\r\nOK\r\n", "+MCUSTAT");
  assert.equal(value.mode, 1);
  assert.equal(value.socket_open, true);
});

test("命令参数拒绝逗号与换行", () => {
  assert.equal(safeCommandValue("demo.example.com", "主机"), "demo.example.com");
  assert.throws(() => safeCommandValue("a,b", "主机"), /无效/);
});

test('readable log joins serial fragments into complete AT echo and reply lines', () => {
  const log = new ReadableSerialLog();
  const enc = new TextEncoder();
  const time = '2026-11-04T10:08:53.937Z';
  log.append('TX', enc.encode('at\r\n'), time);
  for (const chunk of ['a', 't\r', 'O', 'K\r\n']) log.append('RX', enc.encode(chunk), time);
  assert.equal(log.toString(), '[10:08:53.937] TX     at\n[10:08:53.937] RX     at\n[10:08:53.937] RX     OK');
});

test('CR-only echo and fragmented CRLF both delimit lines without empty RX entries', () => {
  const log = new ReadableSerialLog();
  for (const ch of 'at+cpin?\r+CPIN:READY\r\n\r\nOK\r\n') {
    log.append('RX', new TextEncoder().encode(ch), '2026-11-04T10:00:00.000Z');
  }
  assert.deepEqual(log.toString().split('\n').map(line => line.slice(22)), ['at+cpin?', '+CPIN:READY', 'OK']);
});

test('partial lines update in place and split UTF-8 characters remain readable', () => {
  const log = new ReadableSerialLog();
  const time = '2026-11-04T10:00:00.000Z';
  log.append('RX', new TextEncoder().encode('O'), time);
  assert.equal(log.lines.length, 1);
  assert.equal(log.lines[0].text, 'O');
  log.append('RX', new TextEncoder().encode('K\n'), time);
  for (const byte of new TextEncoder().encode('串口正常\r\n')) log.append('RX', new Uint8Array([byte]), time);
  assert.deepEqual(log.lines.map(line => line.text), ['OK', '串口正常']);
});

test('text log clear and disconnect cannot merge data across sessions', () => {
  const log = new ReadableSerialLog();
  const time = '2026-11-04T10:00:00.000Z';
  const bytes = text => new TextEncoder().encode(text);
  log.append('RX', bytes('old'), time);
  log.endReceive();log.append('RX', bytes('new\r\n'), time);
  assert.deepEqual(log.lines.map(line => line.text), ['old', 'new']);
  log.clear();log.append('RX', bytes('OK\r\n'), time);
  assert.deepEqual(log.lines.map(line => line.text), ['OK']);
  log.append('TX', new Uint8Array([0, 255]), time, 'RAW HEX');
  assert.equal(log.lines.at(-1).text, 'HEX 00 FF');
});

