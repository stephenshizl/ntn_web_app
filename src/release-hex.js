/* Copyright (c) 2026, youyoutech. SPDX-License-Identifier: Apache-2.0 */
// The production image contains three on-chip regions. Only the compact,
// signed MCUboot image can be sent to the secondary slot over RS232.
export function extractReleaseApp(text) {
  const primary = 0x20000;
  const end = 0x7e000;
  const memory = new Uint8Array(end);
  let base = 0, next = 0, eof = false;
  for (const line of text.trim().split(/\r?\n/)) {
    if (eof || line.length > 521 || !/^:(?:[0-9a-f]{2}){5,}$/i.test(line))
      throw new Error("整机 HEX 记录格式错误");
    const record = Uint8Array.from(line.slice(1).match(/../g), pair => parseInt(pair, 16));
    const [count, high, low, type] = record;
    if (record.length !== count + 5 || (record.reduce((sum, n) => sum + n, 0) & 255))
      throw new Error("整机 HEX 记录校验失败");
    const offset = high * 256 + low;
    if (type === 4 && count === 2 && offset === 0) {
      base = (record[4] * 256 + record[5]) * 65536;
    } else if (type === 1 && !count && !offset) {
      eof = true;
    } else if (type === 0 && count) {
      const address = base + offset;
      const gapAfterBl1 = next >= 0x420 && next < 0x4000 && address === 0x4000;
      if ((address !== next && !gapAfterBl1) || address + count > end)
        throw new Error("整机 HEX 地址或分区不完整");
      memory.set(record.subarray(4, 4 + count), address);
      next = address + count;
    } else {
      throw new Error("整机 HEX 记录类型不匹配");
    }
  }
  if (!eof || next !== end) throw new Error("整机 HEX 缺少完整主槽");
  const view = new DataView(memory.buffer);
  const tlv = primary + view.getUint16(primary + 8, true) +
    view.getUint32(primary + 12, true) + view.getUint16(primary + 10, true);
  if (tlv + 4 > end || view.getUint16(tlv, true) !== 0x6907)
    throw new Error("整机 HEX 缺少 App 签名区");
  const size = view.getUint16(tlv + 2, true);
  if (size <= 4 || tlv + size > end - 0x2000) throw new Error("App 签名区长度错误");
  return memory.subarray(primary, tlv + size);
}
