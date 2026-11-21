/* Copyright (c) 2026, youyoutech. SPDX-License-Identifier: Apache-2.0 */
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SOH = 1, STX = 2, EOT = 4, ACK = 6, NAK = 21, CAN = 24, CRC = 67;
const HEADER_SIZE = 0x400;
const MAX_BODY_SIZE = 0x5b400;

export function inspectMcuPackage(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const at = 0x800;
  if (bytes.length < at + 64 || bytes.length > 0x5c000 ||
      view.getUint32(0, true) !== 0x96f3b83d || view.getUint16(8, true) !== HEADER_SIZE ||
      view.getUint32(12, true) > MAX_BODY_SIZE || view.getUint32(12, true) < 0x440 ||
      HEADER_SIZE + view.getUint32(12, true) >= bytes.length ||
      decoder.decode(bytes.subarray(at, at + 4)) !== "NTHC" ||
      view.getUint32(at + 4, true) !== 0x00400001 ||
      view.getUint32(at + 8, true) !== 0x314e544e ||
      view.getUint32(at + 12, true) !== 1) {
    throw new Error("固件包格式、目标或布局不匹配");
  }
  return {
    layout: view.getUint32(at + 12, true),
    bootAbi: view.getUint32(at + 24, true),
    build: Array.from(bytes.subarray(at + 28, at + 44), byte => byte.toString(16).padStart(2, "0")).join("")
  };
}

export function firmwareFrame(sequence, data, blockSize = 1024, padding = 0x1a) {
  if ((blockSize !== 128 && blockSize !== 1024) || data.length > blockSize) {
    throw new RangeError("无效的 YMODEM 块大小");
  }
  const frame = new Uint8Array(blockSize + 5);
  frame[0] = blockSize === 128 ? SOH : STX;
  frame[1] = sequence & 0xff;
  frame[2] = frame[1] ^ 0xff;
  frame.fill(padding, 3, 3 + blockSize);
  frame.set(data, 3);
  let crc = 0;
  for (const byte of frame.subarray(3, blockSize + 3)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = ((crc << 1) ^ (crc & 0x8000 ? 0x1021 : 0)) & 0xffff;
    }
  }
  frame[blockSize + 3] = crc >> 8;
  frame[blockSize + 4] = crc & 0xff;
  return frame;
}

export class OtaInput {
  constructor(onBootLog = () => {}) {
    this.bytes = [];
    this.waiter = null;
    this.closed = false;
    this.onBootLog = onBootLog;
  }

  push(chunk) {
    if (this.closed) return;
    for (const byte of chunk) this.bytes.push(byte);
    if (this.bytes.length > 8192) {
      this.close();
      return;
    }
    this.waiter?.();
  }

  close() {
    this.closed = true;
    this.waiter?.();
  }

  async byte(timeout) {
    if (this.closed) throw new Error("升级串口已关闭");
    if (!this.bytes.length) {
      await new Promise(resolve => {
        const timer = setTimeout(() => {
          this.waiter = null;
          resolve();
        }, timeout);
        this.waiter = () => {
          clearTimeout(timer);
          this.waiter = null;
          resolve();
        };
      });
    }
    if (this.closed) throw new Error("升级串口已关闭");
    return this.bytes.shift() ?? -1;
  }

  async line(timeout, accept) {
    const deadline = Date.now() + timeout;
    let line = "";
    while (Date.now() < deadline) {
      const byte = await this.byte(Math.max(1, deadline - Date.now()));
      if (byte < 0) break;
      if (byte === 10) {
        if (/^BOOT[12] (?:ERROR|WARN|INFO|DETAIL) /.test(line)) {
          this.onBootLog(line);
          if (line.startsWith("BOOT1 ERROR ")) throw new Error(line);
        }
        if (line.startsWith("ERROR ")) throw new Error(line);
        if (accept(line)) return line;
        line = "";
      } else if (byte !== 13 && line.length < 512) {
        if (!line.length && (byte < 0x20 || byte > 0x7e)) continue;
        if (byte !== 0) line += String.fromCharCode(byte);
      }
    }
    throw new Error("等待设备响应超时");
  }
}

async function expectByte(input, expected, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const byte = await input.byte(Math.max(1, deadline - Date.now()));
    if (byte === expected) return true;
    if (byte === CAN) {
      const next = await input.byte(Math.min(1000, Math.max(1, deadline - Date.now())));
      if (next === CAN) {
        // BL2 may append a device reason after the cancellation bytes.
        try {
          await input.line(200, () => false);
        } catch (error) {
          if (error.message !== "等待设备响应超时") throw error;
        }
        throw new Error("设备取消了 YMODEM 传输");
      }
      if (next === expected) return true;
      if (next === NAK) return false;
      continue;
    }
    if (byte === -1 || byte === NAK) return false;
  }
  return false;
}

async function sendFrame(port, input, bytes) {
  for (let retry = 0; retry < 6; retry++) {
    await port.write(bytes);
    if (await expectByte(input, ACK, 3500)) return;
  }
  throw new Error("YMODEM 块重试超限");
}

export async function sendMcuPackage(port, input, image, readyLine, progress, onTransfer = () => {}) {
  const packageInfo = inspectMcuPackage(image);
  const parts = /^READY (\d+) (\d+) (\d+)$/.exec(readyLine);
  if (!parts || Number(parts[1]) !== packageInfo.bootAbi ||
      Number(parts[2]) !== packageInfo.layout || image.length > Number(parts[3])) {
    throw new Error("Boot 版本、布局或固件长度不匹配");
  }
  await port.write(encoder.encode(`BEGIN ${image.length}\r\n`));
  await input.line(60000, line => /^RX \d+$/.test(line));
  onTransfer();
  if (!await expectByte(input, CRC, 6000)) throw new Error("设备未进入 YMODEM");
  const metadata = encoder.encode(`hc32.signed.bin\0${image.length}`);
  await sendFrame(port, input, firmwareFrame(0, metadata, 128, 0));
  if (!await expectByte(input, CRC, 3500)) throw new Error("设备未确认文件信息");
  for (let offset = 0, sequence = 1; offset < image.length; offset += 1024, sequence++) {
    const part = image.subarray(offset, offset + 1024);
    await sendFrame(port, input, firmwareFrame(sequence, part));
    progress(offset + part.length, image.length);
  }
  await port.write(Uint8Array.of(EOT));
  const acceptedFirst = await expectByte(input, ACK, 3500);
  if (!acceptedFirst) await sendFrame(port, input, Uint8Array.of(EOT));
  if (!await expectByte(input, CRC, 3500)) throw new Error("设备未请求 YMODEM 尾块");
  await sendFrame(port, input, firmwareFrame(0, new Uint8Array(0), 128, 0));
  await input.line(30000, line => /^VERIFIED \d+$/.test(line));
  return packageInfo;
}
