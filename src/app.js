import { SerialClient } from "./serial-client.js";
import { initI18n, t } from "./i18n.js";
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
let transientMessageTimer = null;

function setBadge(element, text, kind = "") {
  element.textContent = t(text);
  element.className = `badge ${kind ? `badge-${kind}` : ""}`.trim();
}

function setConnectionMessage(message, kind = "info") {
  const target = byId("connectionMessage");
  target.textContent = t(message);
  target.className = `connection-message ${kind}`;
}

function restoreConnectedMessage() {
  if (!client.connected) return;
  setConnectionMessage(t(`串口已连接，当前参数：${client.baudRate}、8N1、无流控。`), "ok");
}

function showTransientActionError(error) {
  const message = String(error?.message ?? error ?? "未知错误");
  setConnectionMessage(`操作未执行：${message}`, "error");
  if (transientMessageTimer) clearTimeout(transientMessageTimer);
  transientMessageTimer = setTimeout(() => {
    transientMessageTimer = null;
    restoreConnectedMessage();
  }, 4000);
}

function serialErrorMessage(error) {
  const name = error?.name ?? "";
  const message = String(error?.message ?? error ?? "未知错误");
  if (name === "NotFoundError") {
    return "未选择串口，或浏览器没有发现可选端口。请确认 USB 转 RS232 已在设备管理器中显示为 COM 口。";
  }
  if (name === "SecurityError") {
    return "浏览器阻止了串口权限。请用 Chrome/Edge 桌面版，并通过 http://127.0.0.1:18787 打开本页面。";
  }
  if (name === "NetworkError" || /open serial port|无法打开/i.test(message)) {
    return "串口无法打开，通常是被 VS Code 串口监视器、串口助手等程序占用。请关闭占用程序后重试。";
  }
  return `串口操作失败：${message}`;
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
  appendLog("SYSTEM", new TextEncoder().encode(t(message)));
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

async function runAction(action, options = {}) {
  try {
    await action();
  } catch (error) {
    appendSystem(`错误：${error.message ?? error}`);
    if (options.connection) setConnectionMessage(serialErrorMessage(error), "error");
    else showTransientActionError(error);
  }
}

client.addEventListener("rx", event => {
  appendLog("RX", event.detail);
  consumeText(event.detail);
});
client.addEventListener("error", event => {
  appendSystem(`串口异常：${event.detail.message ?? event.detail}`);
  setConnectionMessage(serialErrorMessage(event.detail), "error");
});
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
    setConnectionMessage(`已连接 ${identity}，当前串口参数：${state.baudRate}、8N1、无流控。`, "ok");
  } else {
    setBadge(byId("connectionBadge"), "串口未连接");
    if (state.unexpected) {
      appendSystem("串口意外断开，请检查拔插状态");
      setConnectionMessage("串口意外断开，请检查 USB 连接和 USB 转 RS232 设备。", "error");
    }
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
  initI18n();
  const supported = SerialClient.isSupported();
  if (supported) {
    setBadge(byId("supportBadge"), "Web Serial可用", "ok");
    setConnectionMessage("点击“选择并连接串口”。若列表为空，请检查 USB 转 RS232 驱动、COM 口和端口占用。", "info");
  } else {
    setBadge(byId("supportBadge"), "浏览器不支持Web Serial", "error");
    setConnectionMessage("当前浏览器不支持 Web Serial。请使用 Chrome 或 Edge 桌面版，并从本地服务地址打开页面。", "error");
    byId("connectButton").disabled = true;
  }
  const savedBaud = localStorage.getItem("ntn.pc.baud");
  if (savedBaud && [...byId("baudSelect").options].some(option => option.value === savedBaud)) {
    byId("baudSelect").value = savedBaud;
  }
  setControls(false);

  byId("connectButton").addEventListener("click", () => runAction(async () => {
    const baud = Number(byId("baudSelect").value);
    setConnectionMessage("正在请求浏览器串口权限，请在弹出的端口列表中选择 USB 转 RS232 对应的 COM 口。", "info");
    await client.chooseAndConnect(baud);
    localStorage.setItem("ntn.pc.baud", String(baud));
  }, { connection: true }));
  byId("disconnectButton").addEventListener("click", () => runAction(() => client.disconnect()));
  byId("refreshPortsButton").addEventListener("click", () => runAction(async () => {
    if (!SerialClient.isSupported()) throw new Error("浏览器不支持Web Serial");
    const ports = await navigator.serial.getPorts();
    appendSystem(`浏览器已授权串口数量：${ports.length}`);
    setConnectionMessage(ports.length
      ? `浏览器已授权 ${ports.length} 个串口；点击“选择并连接串口”可重新选择。`
      : "尚未授权串口。点击“选择并连接串口”后，在浏览器弹窗选择 USB 转 RS232 对应的 COM 口。", "info");
  }, { connection: true }));
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
