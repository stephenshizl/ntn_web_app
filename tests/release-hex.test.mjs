import test from "node:test";
import assert from "node:assert/strict";
import { extractReleaseApp } from "../src/release-hex.js";

function record(type, offset, data) {
  const body = [data.length, offset >> 8, offset & 255, type, ...data];
  body.push(-body.reduce((sum, value) => sum + value, 0) & 255);
  return ":" + Buffer.from(body).toString("hex");
}

test("whole-device HEX yields just the signed image including both TLV areas", () => {
  const flash = Buffer.alloc(0x7e000, 0xff);
  flash.writeUInt16LE(0x400, 0x20008);
  flash.writeUInt16LE(12, 0x2000a);
  flash.writeUInt32LE(0x440, 0x2000c);
  flash.writeUInt16LE(0x6907, 0x2084c);
  flash.writeUInt16LE(80, 0x2084e);
  const records = [];
  for (let base = 0; base < flash.length; base += 65536) {
    records.push(record(4, 0, [0, base / 65536]));
    for (let address = base; address < Math.min(base + 65536, flash.length); address += 128) {
      if (address >= 0x800 && address < 0x4000) continue;
      records.push(record(0, address & 65535, flash.subarray(address, address + 128)));
    }
  }
  records.push(record(1, 0, []));
  assert.deepEqual(Buffer.from(extractReleaseApp(records.join("\r\n"))), flash.subarray(0x20000, 0x2089c));
  assert.throws(() => extractReleaseApp(records.slice(0, -1).join("\n")), /完整主槽/);
  records.splice(2, 1);
  assert.throws(() => extractReleaseApp(records.join("\n")), /地址或分区/);
  records[0] = records[0].slice(0, -2) + "00";
  assert.throws(() => extractReleaseApp(records.join("\n")), /校验/);
});
