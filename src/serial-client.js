export class SerialClient extends EventTarget {
  constructor() {
    super();
    this.port = null;
    this.reader = null;
    this.readTask = null;
    this.baudRate = 115200;
    this.connected = false;
    this.closing = false;
    this.lastActivityAt = 0;
  }

  static isSupported() { return typeof navigator !== "undefined" && "serial" in navigator; }

  async chooseAndConnect(baudRate) {
    if (!SerialClient.isSupported()) throw new Error("当前浏览器不支持Web Serial");
    const port = await navigator.serial.requestPort();
    await this.open(port, baudRate);
  }

  async open(port, baudRate) {
    if (this.connected) await this.disconnect(false);
    this.port = port;
    this.baudRate = Number(baudRate);
    this.closing = false;
    await port.open({
      baudRate: this.baudRate,
      dataBits: 8,
      stopBits: 1,
      parity: "none",
      flowControl: "none",
      bufferSize: 4096
    });
    this.connected = true;
    this.lastActivityAt = Date.now();
    this.emit("state", { connected: true, baudRate: this.baudRate, info: port.getInfo() });
    this.readTask = this.readLoop();
  }

  async reopen(baudRate) {
    if (!this.port) throw new Error("没有可重开的串口");
    const selected = this.port;
    await this.disconnect(false);
    await this.open(selected, baudRate);
  }

  async write(bytes) {
    if (!this.connected || !this.port?.writable) throw new Error("串口未连接");
    const writer = this.port.writable.getWriter();
    try {
      await writer.write(bytes);
      this.lastActivityAt = Date.now();
      this.emit("tx", bytes);
    } finally {
      writer.releaseLock();
    }
  }

  async waitForSilence(durationMs, timeoutMs) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const remaining = durationMs - (Date.now() - this.lastActivityAt);
      if (remaining <= 0) return true;
      await new Promise(resolve => setTimeout(resolve, Math.min(remaining, 100)));
    }
    return false;
  }

  async readLoop() {
    try {
      while (!this.closing && this.port?.readable) {
        this.reader = this.port.readable.getReader();
        try {
          while (!this.closing) {
            const { value, done } = await this.reader.read();
            if (done) break;
            if (value?.length) {
              this.lastActivityAt = Date.now();
              this.emit("rx", value);
            }
          }
        } finally {
          this.reader.releaseLock();
          this.reader = null;
        }
        break;
      }
    } catch (error) {
      if (!this.closing) this.emit("error", error);
    } finally {
      if (!this.closing && this.connected) {
        this.connected = false;
        this.emit("state", { connected: false, unexpected: true });
      }
    }
  }

  async disconnect(clearPort = true) {
    this.closing = true;
    if (this.reader) {
      try { await this.reader.cancel(); } catch { /* already closed */ }
    }
    if (this.readTask) {
      try { await this.readTask; } catch { /* reported by readLoop */ }
    }
    if (this.port) {
      try { await this.port.close(); } catch { /* unplugged */ }
    }
    this.connected = false;
    this.closing = false;
    this.readTask = null;
    if (clearPort) this.port = null;
    this.emit("state", { connected: false });
  }

  emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }
}
