import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAtBytes, bytesToEscapedText, bytesToHex, extractJsonResponse,
  lineEndingValue, parseHex, safeCommandValue
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

