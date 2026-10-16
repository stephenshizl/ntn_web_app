const encoder = new TextEncoder();

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

