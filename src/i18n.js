const zhToEn = {
  "名称请求失败，请检查固件支持和连接状态": "Name request failed: check firmware support and connection",
  "蓝牙名称": "Bluetooth name",
  "连接后查询名称": "Connect and query the name",
  "手动名称": "Manual name",
  "保存手动名称": "Save manual name",
  "查询名称": "Query name",
  "查询身份": "Query identity",
  "恢复自动命名": "Restore AUTO",
  "刷新身份": "Refresh identity",
  "蓝牙名称格式无效": "Invalid Bluetooth name",
  "名称限1–31位字母、数字、下划线或连字符。以APPLIED和实际名称为生效依据；DEFERRED表示已保存，断开蓝牙后生效。手动名称可能重名，请按MAC识别。": "Use 1\u201331 ASCII letters, digits, underscore or hyphen. APPLIED confirms the actual name; DEFERRED applies after Bluetooth disconnects. Manual names may duplicate: identify devices by MAC.",

  "串口已断开，可重新连接已授权串口。": "Serial disconnected. You can reconnect the authorized port.",
  "连接已授权串口": "Connect authorized port",
  "请使用选择并连接串口，明确选择目标端口": "Use Select and connect to choose the target port explicitly",
  "维护入口状态": "Maintenance entry status",
  "维护状态未知": "Maintenance state unknown",
  "已有维护操作进行中": "A maintenance operation is already in progress",
  "维护操作未收到确认，请查询维护入口状态后重试": "Maintenance was not confirmed. Query the maintenance entry status before retrying.",
  "改速未收到确认，请核对设备实际波特率后重试": "The speed change was not confirmed. Check the device baud rate before retrying.",
  "NTN终端 PC配置台": "NTN Terminal PC Console",
  "通过USB转RS232完成配置、状态检查、模式1维护和原始数据联调。": "Configure and inspect the terminal through USB-to-RS232, maintain Mode 1, and test raw data.",
  "检测浏览器…": "Checking browser…", "串口未连接": "Serial disconnected", "RAW/普通模式": "RAW / normal mode",
  "串口连接": "Serial connection", "等待用户授权串口": "Waiting for serial permission", "波特率": "Baud rate",
  "选择并连接串口": "Select and connect", "断开": "Disconnect", "查看已授权端口": "View authorized ports",
  "正在检查浏览器串口能力…": "Checking browser serial capability…",
  "请使用Chrome或Edge桌面版，并从本工程的本地服务打开页面。串口参数固定为8N1、无流控。": "Use desktop Chrome or Edge and open this page from the local service. Serial settings are fixed at 8N1 with no flow control.",
  "状态与快捷查询": "Status and quick queries", "固件版本": "Firmware version", "能力列表": "Capabilities", "运行状态": "Runtime status", "全部配置": "All configuration", "缓存队列": "Cache queue", "UTC时间": "UTC time", "接收模式": "Receive mode",
  "工作模式": "Work mode", "NTN状态": "NTN status", "Flash待发": "Flash pending", "最近错误": "Last error",
  "常用配置": "Common configuration", "以设备返回OK为成功依据": "A device OK response confirms success.",
  "模式": "Mode", "模式0 · AT透传": "Mode 0 · AT pass-through", "模式1 · RAW上行": "Mode 1 · RAW uplink", "写入 MCUMODE": "Write MCUMODE",
  "服务器": "Server", "域名或IPv4": "Domain or IPv4", "远端端口": "Remote port", "本地端口": "Local port", "写入主机和端口": "Write host and ports",
  "网络参数": "Network", "由运营网络提供": "Provided by the carrier", "0 · QUERY": "0 · QUERY", "1 · URC PUSH": "1 · URC PUSH", "写入APN和接收模式": "Write APN and receive mode",
  "DNS": "DNS", "0 · 关闭": "0 · Off", "1 · 自动/备用": "1 · Auto / fallback", "2 · 强制配置": "2 · Forced", "主DNS": "Primary DNS", "备DNS": "Secondary DNS", "写入 DNS": "Write DNS",
  "设备身份与上报": "Device identity and reporting", "设备SN": "Device SN", "设备序列号": "Device serial number", "资产上报": "Asset reporting", "关闭": "Off", "开启": "On", "周期/秒": "Period / s", "写入身份和上报": "Write identity and reporting",
  "RAW分块": "RAW packetization", "间隔/ms": "Gap / ms", "块长": "Block size", "等待/ms": "Wait / ms", "写入 RAWPACK": "Write RAWPACK",
  "模式1维护": "Mode 1 maintenance", "网页会等待至少1.1秒串口静默，一次写入": "The page waits for at least 1.1 seconds of serial silence, sends", "，再等待1.1秒并发送": ", waits another 1.1 seconds, then sends", "。连续传感器流无法形成静默时请改用Android蓝牙配置。": ". Use Android Bluetooth configuration when a continuous sensor stream cannot form a silent interval.",
  "执行 +++ 维护宏": "Run +++ maintenance macro", "退出维护": "Exit maintenance", "修改RS232波特率": "Change RS232 baud rate", "改速并自动重开": "Change speed and reopen",
  "串口终端": "Serial terminal", "AT/文本命令": "AT / text command", "行尾": "Line ending", "无": "None", "发送文本": "Send text", "原始HEX": "Raw HEX", "发送HEX": "Send HEX",
  "实时记录": "Live log", "清空": "Clear", "导出日志": "Export log", "等待串口连接…": "Waiting for serial connection…",
  "NTN终端 PC Web Serial · P0演示版 · 浏览器表单值不代表设备已保存": "NTN Terminal PC Web Serial · P0 demo · Browser form values are not device-saved values."
  ,"Web Serial可用": "Web Serial available", "浏览器不支持Web Serial": "Web Serial is not supported", "维护模式": "Maintenance mode",
  "点击“选择并连接串口”。若列表为空，请检查 USB 转 RS232 驱动、COM 口和端口占用。": "Select and connect a serial port. If the list is empty, check the USB-to-RS232 driver, COM port, and port ownership.",
  "当前浏览器不支持 Web Serial。请使用 Chrome 或 Edge 桌面版，并从本地服务地址打开页面。": "This browser does not support Web Serial. Use desktop Chrome or Edge and open the local service address.",
  "正在请求浏览器串口权限，请在弹出的端口列表中选择 USB 转 RS232 对应的 COM 口。": "Requesting browser serial permission. Select the COM port for the USB-to-RS232 adapter in the dialog.",
  "尚未授权串口。点击“选择并连接串口”后，在浏览器弹窗选择 USB 转 RS232 对应的 COM 口。": "No serial port is authorized yet. Select the USB-to-RS232 COM port in the browser dialog after clicking Select and connect.",
  "串口意外断开，请检查 USB 连接和 USB 转 RS232 设备。": "The serial port disconnected unexpectedly. Check the USB connection and USB-to-RS232 adapter.",
  "未选择串口，或浏览器没有发现可选端口。请确认 USB 转 RS232 已在设备管理器中显示为 COM 口。": "No serial port was selected, or the browser found no available port. Confirm that the USB-to-RS232 adapter appears as a COM port in Device Manager.",
  "浏览器阻止了串口权限。请用 Chrome/Edge 桌面版，并通过 http://127.0.0.1:18787 打开本页面。": "The browser blocked serial permission. Use desktop Chrome or Edge and open this page through http://127.0.0.1:18787.",
  "串口无法打开，通常是被 VS Code 串口监视器、串口助手等程序占用。请关闭占用程序后重试。": "The serial port cannot be opened. It is usually in use by VS Code Serial Monitor, a terminal program, or another tool. Close it and retry."
};

const storageKey = "ntn.pc.language";
let language = "zh";

const enToZh = Object.fromEntries(Object.entries(zhToEn).map(([zh, en]) => [en, zh]));

function toChinese(value) {
  if (enToZh[value]) return enToZh[value];
  return value
    .replace(/^(\d+) · Connected$/, "$1 · 已连接")
    .replace(/^Serial connected\. Current settings: (.+), 8N1, no flow control\.$/, "串口已连接，当前参数：$1、8N1、无流控。")
    .replace(/^Connected to (.+)\. Current serial settings: (.+), 8N1, no flow control\.$/, "已连接 $1，当前串口参数：$2、8N1、无流控。")
    .replace(/^Operation was not performed: (.*)$/, "操作未执行：$1");
}

function applyLanguage() {
  document.documentElement.lang = language === "en" ? "en" : "zh-CN";
  const title = toChinese(document.title);
  document.title = language === "en" ? t(title) : title;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (node.parentElement?.closest("#serialLog, textarea, script, style")) continue;
    const value = node.nodeValue;
    const trimmed = value.trim();
    const zh = toChinese(trimmed);
    node.nodeValue = value.replace(trimmed, language === "en" ? t(zh) : zh);
  }
  document.querySelectorAll("[placeholder]").forEach(element => {
    const zh = toChinese(element.placeholder);
    element.placeholder = language === "en" ? t(zh) : zh;
  });
}

export function initI18n() {
  const saved = localStorage.getItem(storageKey);
  language = saved === "zh" || saved === "en" ? saved : (navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en");
  const selector = document.getElementById("languageSelect");
  selector.value = language;
  selector.addEventListener("change", () => {
    language = selector.value === "en" ? "en" : "zh";
    localStorage.setItem(storageKey, language);
    applyLanguage();
  });
  applyLanguage();
}

export function t(zh) {
  if (language !== "en") return zh;
  if (zhToEn[zh]) return zhToEn[zh];
  if (/^\d+ · 已连接$/.test(zh)) return zh.replace("已连接", "Connected");
  if (/^串口已连接，当前参数：(.+)、8N1、无流控。$/.test(zh)) {
    return zh.replace(/^串口已连接，当前参数：(.+)、8N1、无流控。$/, "Serial connected. Current settings: $1, 8N1, no flow control.");
  }
  if (/^已连接 (.+)，当前串口参数：(.+)、8N1、无流控。$/.test(zh)) {
    return zh.replace(/^已连接 (.+)，当前串口参数：(.+)、8N1、无流控。$/, "Connected to $1. Current serial settings: $2, 8N1, no flow control.");
  }
  if (/^浏览器已授权串口数量：(\d+)$/.test(zh)) {
    return zh.replace(/^浏览器已授权串口数量：(\d+)$/, "Authorized browser serial ports: $1");
  }
  if (/^浏览器已授权 (\d+) 个串口；点击“选择并连接串口”可重新选择。$/.test(zh)) {
    return zh.replace(/^浏览器已授权 (\d+) 个串口；点击“选择并连接串口”可重新选择。$/, "$1 serial port(s) authorized. Select and connect to choose again.");
  }
  if (/^操作未执行：(.*)$/.test(zh)) return zh.replace(/^操作未执行：(.*)$/, "Operation was not performed: $1");
  if (/^串口操作失败：(.*)$/.test(zh)) return zh.replace(/^串口操作失败：(.*)$/, "Serial operation failed: $1");
  if (/^错误：(.*)$/.test(zh)) return zh.replace(/^错误：(.*)$/, "Error: $1");
  return zh;
}
