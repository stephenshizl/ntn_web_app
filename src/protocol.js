const encoder = new TextEncoder();

export function parseRegistration(text) {
  const match = String(text).match(/^\+CEREG:[ \t]*(\d+)(?:[ \t]*,[ \t]*(\d+)(?:[ \t]*,.*)?)?[ \t]*\r?$/m);
  return match ? Number(match[2] ?? match[1]) : null;
}

export function registrationLabel(stat) {
  return ["未入网", "已入网（本地）", "正在搜网", "入网被拒", "入网状态未知", "已入网（漫游）"][stat] ?? "入网状态未知";
}

export function parseSimState(text) {
  const match = String(text).match(/^\+CPIN:[ \t]*([^\r\n]+)\r?$/m);
  return match ? match[1].trim().toUpperCase() : null;
}

export function simStateLabel(state) {
  return ({ READY: "已插卡，SIM就绪", "SIM PIN": "已插卡，需要PIN", "SIM PUK": "已插卡，需要PUK",
    "SIM PIN2": "已插卡，需要PIN2", "SIM PUK2": "已插卡，需要PUK2",
    "NOT READY": "SIM未就绪（未插卡或不可用）", "NOT INSERTED": "未插卡" })[state] ?? "SIM状态未知";
}

export class ReadableSerialLog {
  constructor() { this.clear(); }

  clear() {
    this.lines = [];
    this.pending = null;
    this.decoder = new TextDecoder();
  }

  endReceive() {
    const tail = this.decoder.decode();
    if (tail && this.pending) this.pending.text += tail;
    this.pending = null;
  }

  append(direction, bytes, time, note = "") {
    if (direction !== "RX") this.pending = null;
    const text = note === "RAW HEX" ? bytesToHex(bytes)
      : direction === "RX" ? this.decoder.decode(bytes, { stream: true }) : new TextDecoder().decode(bytes);
    for (const character of text) {
      if (character === "\r" || character === "\n") {
        this.pending = null;
        continue;
      }
      if (!this.pending) {
        this.pending = { time, direction, text: note === "RAW HEX" ? "HEX " : "" };
        this.lines.push(this.pending);
      }
      this.pending.text += /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(character)
        ? bytesToEscapedText(new Uint8Array([character.charCodeAt(0)])) : character;
    }
    if (direction !== "RX") this.pending = null;
    if (this.lines.length > 3000) this.lines.splice(0, this.lines.length - 3000);
    if (this.pending?.text.length > 450000) this.pending.text = this.pending.text.slice(-450000);
  }

  toString() {
    return this.lines.map(line => `[${line.time.slice(11, 23)}] ${line.direction.padEnd(6)} ${line.text}`).join("\n").slice(-600000);
  }
}

export function bytesToHex(bytes) {
  return Array.from(bytes, value => value.toString(16).padStart(2, "0").toUpperCase()).join(" ");
}

export function parseHex(input) {
  const compact = String(input ?? "").replace(/0x/gi, "").replace(/[\s,:-]/g, "");
  if (!compact) return new Uint8Array();
  if (compact.length % 2 !== 0) throw new Error("HEX字符数必须为偶数");
  if (!/^[0-9a-f]+$/i.test(compact)) throw new Error("HEX中包含非法字符");
  const bytes = new Uint8Array(compact.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(compact.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export function bytesToEscapedText(bytes) {
  let result = "";
  for (const value of bytes) {
    if (value === 0x0d) result += "\\r";
    else if (value === 0x0a) result += "\\n";
    else if (value === 0x09) result += "\\t";
    else if (value >= 0x20 && value <= 0x7e) result += String.fromCharCode(value);
    else result += `\\x${value.toString(16).padStart(2, "0").toUpperCase()}`;
  }
  return result;
}

export function lineEndingValue(name) {
  return ({ crlf: "\r\n", cr: "\r", lf: "\n", none: "" })[name] ?? "\r\n";
}

export function buildTextBytes(text, ending = "\r\n") {
  const clean = String(text ?? "").replace(/[\r\n]+$/g, "");
  if (!clean) throw new Error("发送内容不能为空");
  return encoder.encode(clean + ending);
}

export function buildAtBytes(command) {
  const clean = String(command ?? "").trim();
  if (!/^AT(?:\+|$)/i.test(clean)) throw new Error("AT命令必须以AT开头");
  const normalized = clean.toUpperCase().startsWith("AT+") ? `AT+${clean.slice(3)}` : "AT";
  return buildTextBytes(normalized, "\r\n");
}

export function extractJsonResponse(text, prefix) {
  const marker = `${prefix}:`;
  const lines = String(text ?? "").split(/\r?\n/).reverse();
  for (const line of lines) {
    const position = line.indexOf(marker);
    if (position < 0) continue;
    const candidate = line.slice(position + marker.length).trim();
    if (!candidate.startsWith("{")) continue;
    try { return JSON.parse(candidate); } catch { return null; }
  }
  return null;
}

export function safeCommandValue(value, label, pattern = /^[\x21-\x7e]+$/) {
  const clean = String(value ?? "").trim();
  if (!clean || !pattern.test(clean) || /[\r\n,]/.test(clean)) {
    throw new Error(`${label}格式无效`);
  }
  return clean;
}

