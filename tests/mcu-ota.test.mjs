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

test("diagnostic lines are logged without consuming the READY handshake", async () => {
  const messages = [];
  const input = new OtaInput(line => messages.push(line));
  input.push(new TextEncoder().encode("\0BOOT2 INFO BL1_OK NOR_OK APP_VERIFIED\r\nREADY 1 1 376832\r\n"));
  assert.equal(await input.line(50, line => line.startsWith("READY ")), "READY 1 1 376832");
  assert.deepEqual(messages, ["BOOT2 INFO BL1_OK NOR_OK APP_VERIFIED"]);
  input.push(new TextEncoder().encode("BOOT1 ERROR BL2_SHA256\r\n"));
  await assert.rejects(input.line(50, () => false), /BL2_SHA256/);
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

test("leading UART init glitch bytes are stripped while keeping anchored boot matching", async () => {
  const messages = [];
  const input = new OtaInput(line => messages.push(line));
  input.push(Uint8Array.of(0x00, 0xfe, 0xff, ...new TextEncoder().encode("BOOT2 INFO BL1_OK NOR_OK RECOVERY\r\n")));
  input.push(Uint8Array.of(0xff, ...new TextEncoder().encode("READY 1 1 376832\r\n")));
  assert.equal(await input.line(50, line => line.startsWith("READY ")), "READY 1 1 376832");
  assert.deepEqual(messages, ["BOOT2 INFO BL1_OK NOR_OK RECOVERY"]);
});

test("single CAN preserves next ACK, payload CAN bytes pass intact, and dual CAN cancels", async () => {
  const data = sample().subarray(0, 4096);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  view.setUint32(12, data.length - 0x500, true);
  data.fill(24, 0x900, 0x920); // Embed CAN (0x18) inside binary payload
  const encoder = new TextEncoder();

  // Case 1: stray single CAN followed immediately by ACK must NOT cancel
  let input = new OtaInput();
  let phase = 0, offset = 0, injectedSingleCan = false;
  const serialSingle = {
    async write(packet) {
      if (phase === 0) {
        input.push(encoder.encode("RX 1\r\nC"));
        phase++;
      } else if (phase === 1) {
        input.push(Uint8Array.of(6, 67));
        phase++;
      } else if (phase === 2 && offset < data.length) {
        offset = Math.min(offset + 1024, data.length);
        if (!injectedSingleCan) {
          injectedSingleCan = true;
          input.push(Uint8Array.of(24, 6)); // single CAN + ACK
        } else {
          input.push(Uint8Array.of(6));
        }
      } else if (phase === 2) {
        input.push(Uint8Array.of(21));
        phase++;
      } else if (phase === 3) {
        input.push(Uint8Array.of(6, 67));
        phase++;
      } else {
        input.push(Uint8Array.of(6));
        input.push(encoder.encode("VERIFIED 1\r\n"));
      }
    }
  };
  await sendMcuPackage(serialSingle, input, data, "READY 1 1 376832", () => {});
  assert.ok(injectedSingleCan);

  // Case 2: dual CAN CAN must abort cleanly
  input = new OtaInput();
  phase = 0;
  const serialDual = {
    async write() {
      if (phase === 0) {
        input.push(encoder.encode("RX 1\r\nC"));
        phase++;
      } else if (phase === 1) {
        input.push(Uint8Array.of(6, 67));
        phase++;
      } else {
        input.push(Uint8Array.of(24, 24));
      }
    }
  };
  await assert.rejects(
    sendMcuPackage(serialDual, input, data, "READY 1 1 376832", () => {}),
    /取消/
  );
});

test("closing OtaInput immediately wakes a waiting line reader", async () => {
  const input = new OtaInput();
  const pending = input.line(5000, () => false);
  setTimeout(() => input.close(), 15);
  await assert.rejects(pending, /已关闭/);
});
