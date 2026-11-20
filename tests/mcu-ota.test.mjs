import test from "node:test";
import assert from "node:assert/strict";
import { firmwareFrame, inspectMcuPackage, OtaInput, sendMcuPackage } from "../src/mcu-ota.js";

function sample() {
  const data = new Uint8Array(270001);
  const view = new DataView(data.buffer);
  view.setUint32(0, 0x96f3b83d, true);
  view.setUint16(8, 0x400, true);
  view.setUint32(12, data.length - 0x500, true);
  data.set(new TextEncoder().encode("NTHC"), 0x800);
  view.setUint32(0x804, 0x00400001, true);
  view.setUint32(0x808, 0x314e544e, true);
  view.setUint32(0x80c, 1, true);
  view.setUint32(0x818, 1, true);
  data.fill(0xa8, 0x81c, 0x82c);
  return data;
}

test("layout and target are required before using an MCU image", () => {
  const data = sample();
  assert.equal(inspectMcuPackage(data).build, "a8".repeat(16));
  data[0x80c] = 2;
  assert.throws(() => inspectMcuPackage(data), /布局/);
  assert.throws(() => inspectMcuPackage(data.subarray(0, 10)));
});

test("YMODEM frames carry sequence complement, padding and CRC", () => {
  const frame = firmwareFrame(256, Uint8Array.of(0x31), 128, 0);
  assert.equal(frame.length, 133);
  assert.deepEqual([...frame.subarray(0, 5)], [1, 0, 255, 0x31, 0]);
  assert.notEqual(frame[131] | frame[132], 0);
});

test("transfers a package across block number rollover and retries a rejected block", async () => {
  const input = new OtaInput();
  const data = sample();
  const encoder = new TextEncoder();
  let phase = 0;
  let sequence = 1;
  let offset = 0;
  let retried = false;
  const serial = {
    async write(packet) {
      if (phase === 0) {
        assert.equal(new TextDecoder().decode(packet), `BEGIN ${data.length}\r\n`);
        input.push(encoder.encode("RX 1\r"));
        input.push(encoder.encode("\nC"));
        phase++;
      } else if (phase === 1) {
        assert.equal(packet[0], 1);
        assert.equal(packet[1], 0);
        input.push(Uint8Array.of(6, 67));
        phase++;
      } else if (phase === 2 && offset < data.length) {
        assert.equal(packet[0], 2);
        assert.equal(packet[1], sequence & 0xff);
        if (!retried) {
          retried = true;
          input.push(Uint8Array.of(21));
          return;
        }
        const end = Math.min(offset + 1024, data.length);
        assert.deepEqual(packet.subarray(3, 3 + end - offset), data.subarray(offset, end));
        offset = end;
        sequence++;
        input.push(Uint8Array.of(6));
      } else if (phase === 2) {
        assert.deepEqual([...packet], [4]);
        input.push(Uint8Array.of(21));
        phase++;
      } else if (phase === 3) {
        assert.deepEqual([...packet], [4]);
        input.push(Uint8Array.of(6, 67));
        phase++;
      } else {
        assert.deepEqual([...packet.subarray(0, 4)], [1, 0, 255, 0]);
        input.push(Uint8Array.of(6));
        input.push(encoder.encode("VERIFIED 1\r\n"));
      }
    }
  };
  let sent;
  const result = await sendMcuPackage(serial, input, data, "READY 1 1 376832",
                                       progress => { sent = progress; });
  assert.equal(sent, data.length);
  assert.equal(result.build, "a8".repeat(16));
  assert.ok(retried);
  assert.ok(sequence > 256);
});
