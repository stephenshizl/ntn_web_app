import { SerialClient } from "./serial-client.js";
import { initI18n, t } from "./i18n.js";
import { inspectMcuPackage, OtaInput, sendMcuPackage } from "./mcu-ota.js";
import { extractReleaseApp } from "./release-hex.js";
import {
  buildAtBytes, buildTextBytes, bytesToEscapedText, bytesToHex,
  extractJsonResponse, lineEndingValue, parseHex, safeCommandValue, ReadableSerialLog,
  parseRegistration, registrationLabel, parseSimState, simStateLabel
} from "./protocol.js";

const byId = id => document.getElementById(id);
const client = new SerialClient();
const decoder = new TextDecoder();
const logs = [];
const readableLog = new ReadableSerialLog();
let textStream = "";
let pendingQuery = null;
let queryTimer = null;
let effectiveMode = null;
let networkRefreshTimer = null;
let commandInFlight = false;
let pendingMaintenance = null;
let pendingBaud = null;
let pendingBaudTimer = null;
let pendingMaintenanceTimer = null;
let maintenanceConfirmed = false;
let baudSwitching = false;
let transientMessageTimer = null;
let btNamePoll=null;
let lastRequestIsName=false;
let btNamePollUntil=0;
let otaInput = null;
let otaCanCancel = false;
let otaBinaryTransfer = false;
let otaReopening = false;

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
  const target = byId("rawLog");
  target.textContent += line;
  if (target.textContent.length > 600000) target.textContent = target.textContent.slice(-450000);
  target.scrollTop = target.scrollHeight;
  readableLog.append(direction, bytes, entry.time, note);
  const readable = byId("serialLog");
  readable.textContent = readableLog.toString();
  readable.scrollTop = readable.scrollHeight;
}

function appendSystem(message) {
  appendLog("SYSTEM", new TextEncoder().encode(t(message)));
}

function setControls(connected) {
  byId("connectButton").disabled = connected || !SerialClient.isSupported();
  byId("disconnectButton").disabled = !connected;
  byId("connectAuthorizedButton").disabled = connected || !SerialClient.isSupported();
  document.querySelectorAll("[data-at], form button, #sendTextButton, #sendHexButton, #enterMaintenanceButton, #exitMaintenanceButton, #changeBaudButton, #networkQueryButton, #simQueryButton")
    .forEach(button => { button.disabled = !connected || Boolean(otaInput); });
  byId("mcuOtaStart").disabled = !connected || Boolean(otaInput);
  byId("mcuOtaRecovery").disabled = !connected || Boolean(otaInput);
  byId("mcuOtaCancel").disabled = !otaCanCancel;
}

function clearPendingBaud() {
  if (pendingBaudTimer !== null) clearTimeout(pendingBaudTimer);
  pendingBaudTimer = null;
  pendingBaud = null;
}

function clearPendingMaintenance() {
  if (pendingMaintenanceTimer !== null) clearTimeout(pendingMaintenanceTimer);
  pendingMaintenanceTimer = null;
  pendingMaintenance = null;
  maintenanceConfirmed = false;
}

function beginMaintenance(action) {
  if (pendingMaintenance) throw new Error("已有维护操作进行中");
  pendingMaintenance = action;
  maintenanceConfirmed = false;
  pendingMaintenanceTimer = setTimeout(() => {
    clearPendingMaintenance();
    setBadge(byId("maintenanceBadge"), "维护状态未知", "warn");
    appendSystem("维护操作未收到确认，请查询维护入口状态后重试");
  }, 8000);
}

function resetQuery(message = "点击快捷查询查看设备应答") {
  if (queryTimer !== null) clearTimeout(queryTimer);
  queryTimer = null;
  pendingQuery = null;
  byId("queryMessage").textContent = t(message);
  byId("queryMessage").className = "";
  byId("queryResponse").textContent = "—";
}

function resetTelemetry() {
  effectiveMode = null;
  stopNetworkRefresh();
  for (const id of ["firmwareValue", "hardwareValue", "buildValue", "modeValue", "ntnValue",
    "socketValue", "flashValue", "gnssValue", "errorValue", "timeValue", "rxModeValue", "networkValue", "simValue"]) {
    byId(id).textContent = "—";
  }
}

async function queryAt(command) {
  if (pendingQuery) throw new Error("请等待当前查询结束");
  const prefix = command.replace(/^AT/, "").replace(/\?$/, "");
  pendingQuery = { command, prefix: prefix === "+MCUQUEUE" ? "+MCUSTAT" : prefix, matched: false, lines: [] };
  byId("queryResponse").textContent = "—";
  byId("queryMessage").textContent = `${command} · ${t("等待设备应答")}`;
  byId("queryMessage").className = "";
  queryTimer = setTimeout(() => {
    if (pendingQuery) finishModemStatus(pendingQuery, false);
    pendingQuery = null;
    queryTimer = null;
    byId("queryMessage").textContent = t("查询超时：请检查波特率、连接和模式1维护状态");
    byId("queryMessage").className = "error";
  }, 5000);
  try {
    await sendAt(command);
  } catch (error) {
    if (pendingQuery) finishModemStatus(pendingQuery, false);
    resetQuery("查询发送失败");
    throw error;
  }
}

function finishModemStatus(query, ok) {
  const network = query.command === "AT+CEREG?";
  if (!network && query.command !== "AT+CPIN?") return;
  const value = network ? parseRegistration(query.lines.join("\n")) : parseSimState(query.lines.join("\n"));
  byId(network ? "networkValue" : "simValue").textContent = ok && value !== null
    ? t(network ? registrationLabel(value) : simStateLabel(value)) : t("查询失败，状态未知");
}

async function queryModemStatus(sim = false) {
  if (effectiveMode !== 0) throw new Error("请先在模式0下查询运行状态；模式1请使用蓝牙App");
  if (pendingMaintenance || pendingBaud || baudSwitching || commandInFlight || pendingQuery) throw new Error("当前通道忙，请稍后查询");
  byId(sim ? "simValue" : "networkValue").textContent = t("等待设备应答");
  await queryAt(sim ? "AT+CPIN?" : "AT+CEREG?");
}

function stopNetworkRefresh() {
  if (networkRefreshTimer !== null) clearInterval(networkRefreshTimer);
  networkRefreshTimer = null;
  byId("networkAutoRefresh").checked = false;
}

function updateQueryResponse(line) {
  if (!pendingQuery) return;
  if (line.startsWith(`${pendingQuery.prefix}:`)) {
    pendingQuery.matched = true;
    const data = extractJsonResponse(line, pendingQuery.prefix);
    pendingQuery.lines.push(data ? `${pendingQuery.prefix}:\n${JSON.stringify(data, null, 2)}` : line);
  } else if (/^\+MCUERROR:/.test(line)) {
    pendingQuery.lines.push(line);
  } else if (!/^(ERROR|\+CME ERROR:.*|\+CMS ERROR:.*)$/.test(line) && !(line === "OK" && pendingQuery.matched)) {
    return;
  } else {
    finishModemStatus(pendingQuery, line === "OK");
    pendingQuery.lines.push(line);
    byId("queryMessage").textContent = `${pendingQuery.command} · ${t(line === "OK" ? "查询成功" : "设备返回错误")}`;
    byId("queryMessage").className = line === "OK" ? "" : "error";
    clearTimeout(queryTimer);
    queryTimer = null;
    const lines = pendingQuery.lines;
    pendingQuery = null;
    byId("queryResponse").textContent = lines.join("\n");
    return;
  }
  byId("queryResponse").textContent = pendingQuery.lines.join("\n");
}

function updateStatusFromResponse(line) {
  const version = extractJsonResponse(line, "+MCUVER");
  if (version) {
    byId("firmwareValue").textContent = version.fw ?? "—";
    byId("hardwareValue").textContent = version.hw ?? "—";
    byId("buildValue").textContent = version.build ?? "—";
  }
  const gnss = extractJsonResponse(line, "+MCUGNSS");
  if (gnss) byId("gnssValue").textContent = gnss.valid === true ? t("定位有效") : gnss.valid === false ? t("未定位") : "—";
  const rxMode = extractJsonResponse(line, "+MCURXMODE");
  if (rxMode) byId("rxModeValue").textContent = `${rxMode.name ?? rxMode.saved ?? "—"} (${t("实际生效")}: ${rxMode.effective ?? "—"})`;
  if (line.startsWith("+MCUTIME:")) {
    const [valid, utc] = line.slice("+MCUTIME:".length).split(",");
    byId("timeValue").textContent = valid === "1" && utc ? utc : t("时间无效");
  }
  const status = extractJsonResponse(line, "+MCUSTAT");
  if (!status) return;
  const mode = status.mode ?? status.work_mode;
  if (mode === 0 || mode === 1) {
    effectiveMode = mode;
    if (mode !== 0) stopNetworkRefresh();
  }
  byId("modeValue").textContent = mode === 0 ? t("模式0 · AT透传") : mode === 1 ? t("模式1 · RAW上行") : mode ?? "—";
  const registration = ["未注册", "已注册（本地）", "正在搜网", "注册被拒", "网络状态未知", "已注册（漫游）"];
  byId("ntnValue").textContent = typeof status.registered === "boolean"
    ? t(status.registered ? "已注册" : "未注册")
    : t(registration[status.registered] ?? "网络状态未知");
  byId("socketValue").textContent = status.socket_open === true ? "OPEN" : status.socket_open === false ? "CLOSED" : "—";
  byId("flashValue").textContent = status.flash_pending ?? status.flash_used ?? "—";
  byId("gnssValue").textContent = status.gnss_valid === true ? t("定位有效") : status.gnss_valid === false ? t("未定位") : "—";
  byId("errorValue").textContent = status.last_error ?? "0";
}

function stopBtNamePoll() {
  if (btNamePoll) clearInterval(btNamePoll);
  btNamePoll=null;
}
function startBtNamePoll() {
  stopBtNamePoll();btNamePollUntil=Date.now()+20000;
  btNamePoll=setInterval(() => {
    if (!client.connected || Date.now()>btNamePollUntil) {stopBtNamePoll();return;}
    void runAction(() => sendAt("AT+MCUBTNAME?"));
  },2500);
}
function processLine(rawLine) {
  const line = rawLine.trim();
  if (!line) return;
  if (/^(OK|ERROR|\+CME ERROR:.*|\+CMS ERROR:.*)$/.test(line)) commandInFlight = false;
  if (line.includes("[BOOT] NTN-Terminal started")) {
    commandInFlight = false;
    resetQuery("设备已重启，请重新查询");
    resetTelemetry();
    clearPendingBaud();
    clearPendingMaintenance();
    setBadge(byId("maintenanceBadge"), "维护状态未知");
  }
  const btName=extractJsonResponse(line,"+MCUBTNAME");
  if (btName) {
    byId("btNameState").textContent=`${btName.mode} · ${btName.source} · ${btName.state}`;
    byId("btNameActual").textContent=`Desired: ${btName.desired}\nApplied: ${btName.applied}\nMAC: ${btName.mac} · Error: ${btName.last_error}`;
    if (btName.state==="APPLIED" || btName.state==="SAVE_FAILED" || btName.state==="INVALID_NAME") stopBtNamePoll();
  }
  const identity=extractJsonResponse(line,"+MCUBTIDENT");
  if (identity) byId("btNameIdentity").textContent=`Terminal SN: ${identity.terminal_sn}\nModem SN: ${identity.modem_sn}\nIMEI: ${identity.imei}`;
  const pending = extractJsonResponse(line, "+MCUPENDING");
  const applied = extractJsonResponse(line, "+MCUAPPLY");
  if (pending?.action === "RS232_BAUD" && pending.baud === pendingBaud && !baudSwitching) {
    void performBaudSwitch(pendingBaud);
  }
  if (pendingBaud !== null && !baudSwitching && applied?.state === "APPLIED" && applied.baud === pendingBaud) {
    clearPendingBaud();
  }
  const mode = extractJsonResponse(line, "+MCUMODE");
  const reportedMode = applied?.mode ?? mode?.effective;
  if (reportedMode === 0 || reportedMode === 1) {
    effectiveMode = reportedMode;
    if (reportedMode !== 0) stopNetworkRefresh();
  }
  if (applied?.mode === 0 || mode?.effective === 0) {
    clearPendingMaintenance();
    setBadge(byId("maintenanceBadge"), "RAW/普通模式");
  }
  if (pendingMaintenance && typeof applied?.pc_config === "boolean") {
    maintenanceConfirmed = applied.pc_config === (pendingMaintenance === "enter");
  }
  const maintenance = extractJsonResponse(line, "+MCUCFG");
  if (typeof maintenance?.active === "boolean") {
    setBadge(byId("maintenanceBadge"), maintenance.active ? "维护模式" : "RAW/普通模式", maintenance.active ? "warn" : "");
  }
  if (line === "OK" && pendingMaintenance && maintenanceConfirmed) {
    const active = pendingMaintenance === "enter";
    setBadge(byId("maintenanceBadge"), active ? "维护模式" : "RAW/普通模式", active ? "warn" : "");
    clearPendingMaintenance();
  }
  if (line === "ERROR") {
    if (lastRequestIsName) {
      stopBtNamePoll();lastRequestIsName=false;
      byId("btNameState").textContent=t("名称请求失败，请检查固件支持和连接状态");
    }
    clearPendingMaintenance();
    if (!baudSwitching) clearPendingBaud();
  }
  updateStatusFromResponse(line);
  updateQueryResponse(line);
}

function consumeText(bytes) {
  const decoded = decoder.decode(bytes, { stream: true });
  textStream += decoded;
  const lines = textStream.split(/\r\n|\r|\n/);
  textStream = lines.pop() ?? "";
  lines.forEach(processLine);
}

async function sendBytes(bytes, note = "") {
  if (otaInput) throw new Error("MCU 升级正在使用串口");
  commandInFlight = true;
  try { await client.write(bytes); }
  catch (error) { commandInFlight = false; throw error; }
  appendLog("TX", bytes, note);
}

async function sendAt(command) {
  lastRequestIsName=/^AT\+MCUBT/.test(command);
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
  if (otaInput) {
    otaInput.push(event.detail);
    return;
  }
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
    commandInFlight = false;
    stopBtNamePoll();
    byId("btNameState").textContent=t("连接后查询名称");
    byId("btNameActual").textContent="";byId("btNameIdentity").textContent="";
    clearPendingBaud();
    clearPendingMaintenance();
    textStream = "";
    resetQuery("串口已断开，请重新连接并查询");
    resetTelemetry();
    decoder.decode();
    readableLog.endReceive();
    setBadge(byId("maintenanceBadge"), "维护状态未知");
    setBadge(byId("connectionBadge"), "串口未连接");
    if (!state.unexpected) {
      if (!otaReopening) otaInput?.close();
      setConnectionMessage("串口已断开，可重新连接已授权串口。", "info");
    }
    if (state.unexpected) {
      otaInput?.close();
      appendSystem("串口意外断开，请检查拔插状态");
      setConnectionMessage("串口意外断开，请检查 USB 连接和 USB 转 RS232 设备。", "error");
    }
  }
});

async function upgradeMcu(recovery) {
  const file = byId("mcuOtaFile").files[0];
  const isHex = file?.name.toLowerCase().endsWith(".hex");
  if (!file || file.size > (isHex ? 2 * 1024 * 1024 : 0x5c000))
    throw new Error("请选择整机 HEX 或 App 签名 BIN");
  const image = isHex ? extractReleaseApp(await file.text()) : new Uint8Array(await file.arrayBuffer());
  inspectMcuPackage(image);
  if (otaInput || pendingBaud || pendingMaintenance) throw new Error("串口有操作正在执行");

  const progress = byId("mcuOtaProgress");
  const status = byId("mcuOtaStatus");
  const appBaud = client.baudRate;
  const rawMode = effectiveMode === 1;
  const encode = value => new TextEncoder().encode(value);
  otaInput = new OtaInput(line => appendSystem(line));
  otaCanCancel = true;
  otaBinaryTransfer = false;
  setControls(client.connected);
  stopNetworkRefresh();
  stopBtNamePoll();
  resetQuery();
  progress.value = 0;
  async function reopenOtaBaud(baud) {
    otaReopening = true;
    try {
      await client.reopen(baud);
    } finally {
      otaReopening = false;
    }
  }
  let previousBuild = null;
  try {
    if (!recovery) {
      status.textContent = "读取设备升级能力";
      await client.write(buildAtBytes("AT+MCUCAP?"));
      const line = await otaInput.line(3000, value => value.startsWith("+MCUCAP:"));
      if (!extractJsonResponse(line, "+MCUCAP")?.upgrade) {
        throw new Error("设备未报告升级能力。模式 1 请先进入维护，或使用上电恢复。");
      }
      await client.write(buildAtBytes("AT+MCUOTASTAT?"));
      const prevLine = await otaInput.line(1500, value => value.startsWith("+MCUOTASTAT:")).catch(error => {
        if (otaInput.closed || error.message !== "等待设备响应超时") throw error;
        return null;
      });
      previousBuild = prevLine ? (extractJsonResponse(prevLine, "+MCUOTASTAT")?.build ?? null) : null;
      await client.write(buildAtBytes("AT+MCUOTA=BOOT"));
      await otaInput.line(3000, value => value.startsWith("+MCUOTA:"));
    }
    if (client.baudRate !== 19200) await reopenOtaBaud(19200);
    status.textContent = recovery ? "请重新给设备上电" : "等待引导程序";
    const deadline = Date.now() + (recovery ? 20000 : 7000);
    let ready;
    while (!ready && Date.now() < deadline) {
      await client.write(encode("NTN-MCU-OTA/1 HELLO\r\n"));
      try { ready = await otaInput.line(400, value => value.startsWith("READY ")); }
      catch (error) {
        if (otaInput.closed || error.message !== "等待设备响应超时") throw error;
      }
    }
    if (!ready) throw new Error("设备引导程序未响应");
    status.textContent = "正在准备片外下载区";
    const { build } = await sendMcuPackage(client, otaInput, image, ready, (sent, total) => {
      progress.value = sent * 100 / total;
      status.textContent = `已传输 ${sent} / ${total} B`;
      if (sent === total) {
        otaCanCancel = false;
        setControls(client.connected);
      }
    }, () => { otaBinaryTransfer = true; });
    status.textContent = "设备已验签，等待安装和试运行";
    if (client.baudRate !== appBaud) await reopenOtaBaud(appBaud);
    const confirmDeadline = Date.now() + 180000;
    let rawMaintEntered = false;
    let sawTargetTrial = false;
    let lastConfirmedBuild = null;
    let maintenanceAttempts = 0;
    while (Date.now() < confirmDeadline) {
      if (rawMode && !rawMaintEntered) {
        await otaInput.line(15000, line => {
          if (line.startsWith("[BOOT]")) return true;
          return false;
        }).catch(error => {
          if (otaInput.closed || error.message !== "等待设备响应超时") throw error;
        });
        if (++maintenanceAttempts > 3) throw new Error("RAW 维护入口未确认，请重新连接后查询升级状态。");
        if (await client.waitForSilence(1100, 5000)) {
          await client.write(encode("+++"));
          if (await client.waitForSilence(1100, 5000)) {
            await client.write(buildAtBytes("AT+MCUCFG=1"));
            const reply = await otaInput.line(2000, line =>
              line.startsWith("+MCUAPPLY:") && extractJsonResponse(line, "+MCUAPPLY")?.pc_config === true
            ).catch(error => {
              if (otaInput.closed || error.message !== "等待设备响应超时") throw error;
              return null;
            });
            rawMaintEntered = reply !== null;
          }
        }
        if (!rawMaintEntered) continue;
        maintenanceAttempts = 0;
      }
      await client.write(buildAtBytes("AT+MCUOTASTAT?"));
      let reply;
      try {
        reply = await otaInput.line(3000, value => {
          if (value.startsWith("[BOOT]")) {
            if (rawMode) rawMaintEntered = false;
            return false;
          }
          return value.startsWith("+MCUOTASTAT:");
        });
      } catch (error) {
        if (otaInput.closed || error.message !== "等待设备响应超时") throw error;
        continue;
      }
      const installed = extractJsonResponse(reply, "+MCUOTASTAT");
      if (installed?.confirmed === false && installed.build === build) sawTargetTrial = true;
      if (installed?.confirmed === true) lastConfirmedBuild = installed.build;
      if (installed?.confirmed === true && installed.build === build &&
          (previousBuild !== build || sawTargetTrial)) {
        status.textContent = `已确认固件 ${build}`;
        return;
      }
      if (previousBuild && previousBuild !== build &&
          sawTargetTrial &&
          installed?.confirmed === true && installed.build === previousBuild) {
        throw new Error(`试运行后设备已回滚至旧版本 ${previousBuild}`);
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    if (lastConfirmedBuild) {
      throw new Error(`当前已确认构建 ${lastConfirmedBuild}，本次安装结果未能确认。请查询设备启动记录。`);
    }
    throw new Error("设备已验签，尚未确认目标构建。请重新连接查询设备状态。");
  } catch (error) {
    status.textContent = error.message;
    throw error;
  } finally {
    otaReopening = false;
    otaInput.close();
    otaInput = null;
    otaCanCancel = false;
    otaBinaryTransfer = false;
    commandInFlight = false;
    textStream = "";
    setControls(client.connected);
  }
}

async function performBaudSwitch(newBaud) {
  baudSwitching = true;
  if (pendingBaudTimer !== null) clearTimeout(pendingBaudTimer);
  pendingBaudTimer = null;
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
    clearPendingBaud();
    baudSwitching = false;
  }
}

async function enterMaintenance() {
  appendSystem("等待1.1秒前静默…");
  if (!await client.waitForSilence(1100, 15000)) throw new Error("15秒内未形成静默窗口，请改用蓝牙配置");
  await sendBytes(new TextEncoder().encode("+++"), "维护保护序列");
  appendSystem("等待1.1秒后静默…");
  if (!await client.waitForSilence(1100, 6000)) throw new Error("+++后出现串口数据，维护入口可能失败");
  beginMaintenance("enter");
  try {
    await sendAt("AT+MCUCFG=1");
  } catch (error) {
    clearPendingMaintenance();
    throw error;
  }
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
  byId("mcuOtaStart").addEventListener("click", () => runAction(() => upgradeMcu(false)));
  byId("mcuOtaRecovery").addEventListener("click", () => runAction(() => upgradeMcu(true)));
  byId("mcuOtaCancel").addEventListener("click", () => runAction(async () => {
    if (!otaCanCancel || !otaInput) return;
    otaInput.close();
    if (client.connected && otaBinaryTransfer) await client.write(Uint8Array.of(24, 24));
  }));
  byId("userGuideButton").addEventListener("click", () => byId("userGuideDialog").showModal());
  byId("userGuideClose").addEventListener("click", () => byId("userGuideDialog").close());
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

  byId("networkQueryButton").addEventListener("click", () => runAction(() => queryModemStatus(false)));
  byId("simQueryButton").addEventListener("click", () => runAction(() => queryModemStatus(true)));
  byId("networkAutoRefresh").addEventListener("change", () => {
    const enabled = byId("networkAutoRefresh").checked;
    stopNetworkRefresh();
    if (!enabled) return;
    if (!client.connected || effectiveMode !== 0) {
      showTransientActionError(new Error("请先在模式0下查询运行状态；模式1请使用蓝牙App"));
      return;
    }
    byId("networkAutoRefresh").checked = true;
    networkRefreshTimer = setInterval(() => {
      if (!client.connected || document.hidden || effectiveMode !== 0 || commandInFlight || pendingQuery || pendingMaintenance || pendingBaud || baudSwitching || btNamePoll) return;
      void runAction(() => queryModemStatus(false));
    }, 5000);
    if (!pendingQuery) void runAction(() => queryModemStatus(false));
  });

  byId("connectButton").addEventListener("click", () => runAction(async () => {
    const baud = Number(byId("baudSelect").value);
    setConnectionMessage("正在请求浏览器串口权限，请在弹出的端口列表中选择 USB 转 RS232 对应的 COM 口。", "info");
    await client.chooseAndConnect(baud);
    localStorage.setItem("ntn.pc.baud", String(baud));
  }, { connection: true }));
  byId("connectAuthorizedButton").addEventListener("click", () => runAction(async () => {
    const baud = Number(byId("baudSelect").value);
    await client.connectAuthorized(baud);
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
    button.addEventListener("click", () => runAction(async () => {
      if (button.dataset.at.endsWith("?")) await queryAt(button.dataset.at);
      else await sendAt(button.dataset.at);
      if (button.dataset.at==="AT+MCUBTNAMEAUTO" || button.dataset.at==="AT+MCUBTREFRESH") startBtNamePoll();
    }));
  });

  bindForm("btNameForm", data => {
    const name=String(data.get("btName")??"");
    if (!/^[A-Za-z0-9_-]{1,31}$/.test(name)) throw new Error("蓝牙名称格式无效");
    startBtNamePoll();return [`AT+MCUBTNAME=${name}`];
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
    beginMaintenance("exit");
    try {
      await sendAt("AT+MCUCFG=0");
    } catch (error) {
      clearPendingMaintenance();
      throw error;
    }
  }));
  byId("changeBaudButton").addEventListener("click", () => runAction(async () => {
    if (pendingBaud) throw new Error("已有改速操作进行中");
    pendingBaud = Number(byId("newBaudSelect").value);
    pendingBaudTimer = setTimeout(() => {
      clearPendingBaud();
      appendSystem("改速未收到确认，请核对设备实际波特率后重试");
    }, 10000);
    try {
      await sendAt(`AT+MCURS232=${pendingBaud}`);
    } catch (error) {
      clearPendingBaud();
      throw error;
    }
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
    readableLog.clear();
    byId("serialLog").textContent = "";
    byId("rawLog").textContent = "";
  });
  byId("logView").addEventListener("change", () => {
    const raw = byId("logView").value === "raw";
    byId("serialLog").hidden = raw;
    byId("rawLog").hidden = !raw;
    const visible = byId(raw ? "rawLog" : "serialLog");
    visible.scrollTop = visible.scrollHeight;
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
