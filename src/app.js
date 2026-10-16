import { SerialClient } from "./serial-client.js";
import {
  buildAtBytes, buildTextBytes, bytesToEscapedText, bytesToHex,
  extractJsonResponse, lineEndingValue, parseHex, safeCommandValue
} from "./protocol.js";

const byId = id => document.getElementById(id);
const client = new SerialClient();
const decoder = new TextDecoder();
const logs = [];
let textStream = "";
let responseWindow = "";
let pendingMaintenance = null;
let pendingBaud = null;
let baudSwitching = false;

function setBadge(element, text, kind = "") {
  element.textContent = text;
  element.className = `badge ${kind ? `badge-${kind}` : ""}`.trim();
}

function appendLog(direction, bytes, note = "") {
  const entry = {
    time: new Date().toISOString(),
    direction,
    note,
    hex: bytesToHex(bytes),
    text: bytesToEscapedText(bytes)
  };
  logs.push(entry);
  if (logs.length > 3000) logs.splice(0, logs.length - 3000);
  const line = `[${entry.time.slice(11, 23)}] ${direction.padEnd(6)} ${note}${note ? " " : ""}len=${bytes.length}\n` +
    `  TXT ${entry.text || "(empty)"}\n  HEX ${entry.hex || "(empty)"}\n`;
  const target = byId("serialLog");
  target.textContent += line;
  if (target.textContent.length > 600000) target.textContent = target.textContent.slice(-450000);
  target.scrollTop = target.scrollHeight;
}

function appendSystem(message) {
  appendLog("SYSTEM", new TextEncoder().encode(message));
}

function setControls(connected) {
  byId("connectButton").disabled = connected;
  byId("disconnectButton").disabled = !connected;
  document.querySelectorAll("[data-at], form button, #sendTextButton, #sendHexButton, #enterMaintenanceButton, #exitMaintenanceButton, #changeBaudButton")
    .forEach(button => { button.disabled = !connected; });
}

function updateStatusFromResponse() {
  const status = extractJsonResponse(responseWindow, "+MCUSTAT");
  if (!status) return;
  byId("modeValue").textContent = status.mode ?? status.work_mode ?? "—";
  byId("ntnValue").textContent = status.ntn_state ?? (status.registered ? "REGISTERED" : "—");
  byId("socketValue").textContent = status.socket_open === true ? "OPEN" : status.socket_open === false ? "CLOSED" : "—";
  byId("flashValue").textContent = status.flash_pending ?? status.flash_used ?? "—";
  byId("gnssValue").textContent = status.gnss_valid === true ? "VALID" : status.gnss_valid === false ? "INVALID" : "—";
  byId("errorValue").textContent = status.last_error ?? "0";
}

function processLine(rawLine) {
  const line = rawLine.trim();
  if (!line) return;
  if (line.includes("+MCUPENDING") && pendingBaud && !baudSwitching) {
    void performBaudSwitch(pendingBaud);
  }
  if (line === "OK" && pendingMaintenance) {
    const active = pendingMaintenance === "enter";
    setBadge(byId("maintenanceBadge"), active ? "维护模式" : "RAW/普通模式", active ? "warn" : "");
    pendingMaintenance = null;
  }
  if (line === "ERROR") pendingMaintenance = null;
  updateStatusFromResponse();
}

function consumeText(bytes) {
  const decoded = decoder.decode(bytes, { stream: true });
  textStream += decoded;
  responseWindow = (responseWindow + decoded).slice(-24000);
  const lines = textStream.split(/\r\n|\r|\n/);
  textStream = lines.pop() ?? "";
  lines.forEach(processLine);
}

async function sendBytes(bytes, note = "") {
  await client.write(bytes);
  appendLog("TX", bytes, note);
}

async function sendAt(command) {
  await sendBytes(buildAtBytes(command), "AT");
}

async function runAction(action) {
  try {
    await action();
  } catch (error) {
    appendSystem(`错误：${error.message ?? error}`);
  }
}

client.addEventListener("rx", event => {
  appendLog("RX", event.detail);
  consumeText(event.detail);
});
client.addEventListener("error", event => appendSystem(`串口异常：${event.detail.message ?? event.detail}`));
client.addEventListener("state", event => {
  const state = event.detail;
  setControls(Boolean(state.connected));
  if (state.connected) {
    const usb = state.info ?? {};
    const identity = usb.usbVendorId
      ? `VID:${usb.usbVendorId.toString(16).padStart(4, "0")} PID:${(usb.usbProductId ?? 0).toString(16).padStart(4, "0")}`.toUpperCase()
      : "已授权串口";
    setBadge(byId("connectionBadge"), `${state.baudRate} · 已连接`, "ok");
    byId("portInfo").textContent = identity;
    appendSystem(`串口已连接：${state.baudRate} 8N1`);
  } else {
    setBadge(byId("connectionBadge"), "串口未连接");
    if (state.unexpected) appendSystem("串口意外断开，请检查拔插状态");
  }
});

async function performBaudSwitch(newBaud) {
  baudSwitching = true;
  appendSystem(`收到PENDING，准备以${newBaud}重新打开串口`);
  try {
    await new Promise(resolve => setTimeout(resolve, 80));
    await client.reopen(Number(newBaud));
    byId("baudSelect").value = String(newBaud);
    localStorage.setItem("ntn.pc.baud", String(newBaud));
    await new Promise(resolve => setTimeout(resolve, 750));
    await sendAt("AT+MCURS232?");
  } catch (error) {
    appendSystem(`自动改速失败：${error.message ?? error}；请手动选择新波特率后重连`);
  } finally {
    pendingBaud = null;
    baudSwitching = false;
  }
}

async function enterMaintenance() {
  appendSystem("等待1.1秒前静默…");
  if (!await client.waitForSilence(1100, 15000)) throw new Error("15秒内未形成静默窗口，请改用蓝牙配置");
  await sendBytes(new TextEncoder().encode("+++"), "维护保护序列");
  appendSystem("等待1.1秒后静默…");
  if (!await client.waitForSilence(1100, 6000)) throw new Error("+++后出现串口数据，维护入口可能失败");
  pendingMaintenance = "enter";
  await sendAt("AT+MCUCFG=1");
}

function bindForm(id, builder) {
  byId(id).addEventListener("submit", event => {
    event.preventDefault();
    void runAction(async () => {
      const commands = builder(new FormData(event.currentTarget));
      for (const command of commands) {
        await sendAt(command);
        await new Promise(resolve => setTimeout(resolve, 80));
      }
    });
  });
}

function init() {
  if (SerialClient.isSupported()) setBadge(byId("supportBadge"), "Web Serial可用", "ok");
  else setBadge(byId("supportBadge"), "浏览器不支持Web Serial", "error");
  const savedBaud = localStorage.getItem("ntn.pc.baud");
  if (savedBaud && [...byId("baudSelect").options].some(option => option.value === savedBaud)) {
    byId("baudSelect").value = savedBaud;
  }
  setControls(false);

  byId("connectButton").addEventListener("click", () => runAction(async () => {
    const baud = Number(byId("baudSelect").value);
    await client.chooseAndConnect(baud);
    localStorage.setItem("ntn.pc.baud", String(baud));
  }));
  byId("disconnectButton").addEventListener("click", () => runAction(() => client.disconnect()));
  byId("refreshPortsButton").addEventListener("click", () => runAction(async () => {
    if (!SerialClient.isSupported()) throw new Error("浏览器不支持Web Serial");
    const ports = await navigator.serial.getPorts();
    appendSystem(`浏览器已授权串口数量：${ports.length}`);
  }));
  document.querySelectorAll("[data-at]").forEach(button => {
    button.addEventListener("click", () => runAction(() => sendAt(button.dataset.at)));
  });

  bindForm("modeForm", data => [`AT+MCUMODE=${data.get("mode")}`]);
  bindForm("hostForm", data => {
    const host = safeCommandValue(data.get("host"), "主机");
    const remote = Number(data.get("remote"));
    const local = Number(data.get("local"));
    if (remote < 1 || remote > 65535 || local < 0 || local > 65535) throw new Error("端口范围无效");
    return [`AT+MCUHOST=${host}`, `AT+MCUPORT=${remote},${local}`];
  });
  bindForm("networkForm", data => {
    const commands = [];
    const apn = String(data.get("apn") ?? "").trim();
    if (apn) commands.push(`AT+MCUAPN=${safeCommandValue(apn, "APN")}`);
    commands.push(`AT+MCURXMODE=${data.get("rxMode")}`);
    return commands;
  });
  bindForm("dnsForm", data => {
    const mode = data.get("dnsMode");
    const primary = String(data.get("primary") ?? "").trim();
    const secondary = String(data.get("secondary") ?? "").trim();
    if (mode === "2" && !primary) throw new Error("强制DNS模式必须填写主DNS");
    const values = [mode];
    if (primary || secondary) {
      values.push(
        primary ? safeCommandValue(primary, "主DNS") : "",
        secondary ? safeCommandValue(secondary, "备用DNS") : ""
      );
    }
    return [`AT+MCUDNS=${values.join(",")}`];
  });
  bindForm("identityForm", data => {
    const sn = safeCommandValue(data.get("sn"), "SN");
    const period = Number(data.get("period"));
    if (!Number.isInteger(period) || period < 1) throw new Error("上报周期无效");
    return [`AT+MCUSN=${sn}`, `AT+MCUASSET=${data.get("enabled")},${period}`];
  });
  bindForm("rawForm", data => {
    const values = ["gap", "block", "wait"].map(name => Number(data.get(name)));
    if (values.some(value => !Number.isInteger(value) || value < 1)) throw new Error("RAW分块参数无效");
    return [`AT+MCURAWPACK=${values.join(",")}`];
  });

  byId("enterMaintenanceButton").addEventListener("click", () => runAction(enterMaintenance));
  byId("exitMaintenanceButton").addEventListener("click", () => runAction(async () => {
    pendingMaintenance = "exit";
    await sendAt("AT+MCUCFG=0");
  }));
  byId("changeBaudButton").addEventListener("click", () => runAction(async () => {
    if (pendingBaud) throw new Error("已有改速操作进行中");
    pendingBaud = Number(byId("newBaudSelect").value);
    await sendAt(`AT+MCURS232=${pendingBaud}`);
  }));
  byId("sendTextButton").addEventListener("click", () => runAction(async () => {
    const ending = lineEndingValue(byId("lineEnding").value);
    await sendBytes(buildTextBytes(byId("textInput").value, ending), "文本");
  }));
  byId("sendHexButton").addEventListener("click", () => runAction(async () => {
    const bytes = parseHex(byId("hexInput").value);
    if (!bytes.length) throw new Error("HEX不能为空");
    await sendBytes(bytes, "RAW HEX");
  }));
  byId("clearLogButton").addEventListener("click", () => {
    logs.length = 0;
    byId("serialLog").textContent = "";
  });
  byId("exportLogButton").addEventListener("click", () => {
    const blob = new Blob([logs.map(entry => JSON.stringify(entry)).join("\n") + "\n"], { type: "application/x-ndjson;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ntn-serial-${new Date().toISOString().replace(/[:.]/g, "-")}.ndjson`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
  navigator.serial?.addEventListener("disconnect", event => {
    if (event.port === client.port) void client.disconnect();
  });
}

init();
