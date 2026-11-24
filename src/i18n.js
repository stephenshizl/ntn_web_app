const zhToEn = {
  "设备自检": "Device self-test", "运行设备自检": "Run device self-test", "尚未自检": "Self-test not run",
  "模式1请先进入维护，或用 Android App 自检。": "In Mode 1, enter maintenance first or use the Android app.",
  "自检未完成，请确认连接和固件支持": "Self-test incomplete; check the connection and firmware support",
  "外置 NOR": "External NOR", "离线存储": "Offline storage", "初始化或分区异常": "Initialization or partition fault",
  "可用": "Available", "不可用": "Unavailable", "检测到存储异常": "Storage issue detected", "存储检查通过": "Storage checks passed",
  "配置": "Configuration", "已加载保存配置": "Saved settings loaded", "未加载保存配置": "Saved settings not loaded",
  "NTN 入网": "NTN registration", "NTN 最近错误码": "Last NTN error code",
  "外置 NOR 初始化失败，终端正尝试启动片内固件": "External NOR failed to initialize; booting the on-chip application",
  "外置 NOR 初始化失败，终端停在 BL2": "External NOR failed to initialize; terminal stopped in BL2",
  "查询NTN入网": "Query NTN registration", "查询SIM状态": "Query SIM status", "网络状态每5秒更新": "Refresh network every 5 seconds",
  "NTN入网查询": "NTN registration query", "SIM状态查询": "SIM status query",
  "模式未知时网页会先自动查询运行状态；模式0下继续查询，模式1请使用蓝牙App。NOT READY不能单独证明未插卡。": "When the mode is unknown, the page queries Runtime status first. It continues in Mode 0; use the Bluetooth app in Mode 1. NOT READY alone does not prove the SIM is absent.",
  "请先在模式0下查询运行状态；模式1请使用蓝牙App": "First query Runtime status in Mode 0; use the Bluetooth app in Mode 1",
  "当前为模式1，请使用蓝牙App查询NTN和SIM状态": "The device is in Mode 1; use the Bluetooth app to query NTN and SIM status",
  "当前通道忙，请稍后查询": "Channel busy; query again later", "查询失败，状态未知": "Query failed; status unknown",
  "未入网": "Not registered", "已入网（本地）": "Registered (home)", "入网被拒": "Registration denied", "入网状态未知": "Registration unknown", "已入网（漫游）": "Registered (roaming)",
  "已插卡，SIM就绪": "SIM inserted and ready", "已插卡，需要PIN": "SIM inserted; PIN required", "已插卡，需要PUK": "SIM inserted; PUK required",
  "已插卡，需要PIN2": "SIM inserted; PIN2 required", "已插卡，需要PUK2": "SIM inserted; PUK2 required",
  "SIM未就绪（未插卡或不可用）": "SIM not ready (absent or unavailable)", "未插卡": "SIM absent", "SIM状态未知": "SIM status unknown",
  "显示方式": "Log view", "按行文本": "Text lines", "原始TXT / HEX": "Raw TXT / HEX",
  "MCU固件版本": "MCU firmware", "硬件版本": "Hardware version", "编译时间": "Build time",
  "查询结果": "Query result", "点击快捷查询查看设备应答": "Select a quick query to view the device response",
  "等待设备应答": "Waiting for device response", "查询成功": "Query successful", "设备返回错误": "Device returned an error",
  "查询超时：请检查波特率、连接和模式1维护状态": "Query timed out: check baud rate, connection and Mode 1 maintenance",
  "请等待当前查询结束": "Wait for the current query to finish", "查询发送失败": "Query could not be sent",
  "串口已断开，请重新连接并查询": "Serial disconnected. Reconnect and query again",
  "设备已重启，请重新查询": "Device restarted. Query again",
  "实际生效": "Effective", "定位有效": "Valid fix", "未定位": "No fix", "时间无效": "Invalid time",
  "未注册": "Not registered", "已注册（本地）": "Registered (home)", "正在搜网": "Searching",
  "注册被拒": "Registration denied", "网络状态未知": "Network status unknown", "已注册（漫游）": "Registered (roaming)", "已注册": "Registered",
  "使用说明": "User guide",
  "关闭说明": "Close guide",
  "1. 打开网页并连接串口": "1. Open the page and connect",
  "运行本工程start.bat或start.ps1，从本地服务地址打开页面。使用桌面版Chrome或Edge，选择实际波特率，点击“选择并连接串口”，在浏览器弹窗中选择USB转RS232对应的端口。本次测试板为COM6、19200、8N1、无流控；请以设备实际设置为准。若端口被占用，先关闭其他串口工具。": "Run start.bat or start.ps1 and open the local service in desktop Chrome or Edge. Select the actual baud rate, click Select and connect, and choose the USB-to-RS232 port in the browser dialog. This test board uses COM6, 19200, 8N1, no flow control; use your device settings. Close another serial tool if it owns the port.",
  "2. 验证MCU和NTN通信": "2. Verify MCU and NTN communication",
  "先点击“固件版本”和“运行状态”，预期返回MCU信息及OK。模式0下，在串口终端发送ATI或AT，选择CRLF行尾，预期返回NTN模块信息或OK。MCU命令示例为AT+MCUVER?，NTN命令示例为ATI；网页的“固件版本”查询的是MCU版本。": "First query Firmware version and Runtime status; expect MCU information and OK. In Mode 0, send ATI or AT with CRLF in the serial terminal; expect NTN module information or OK. AT+MCUVER? is an MCU command, ATI is an NTN command. The web Firmware version button reads the MCU version.",
  "3. 读取配置，再填写实际服务器": "3. Read settings, then enter the real server",
  "可在串口终端发送AT+MCUHOST?、AT+MCUPORT?和AT+MCUMODE?读取MCU已保存的参数。服务器未配置时由用户填写实际IPv4或域名，不含http://；远端UDP端口为1–65535，本地端口0表示自动。点击对应写入按钮，并检查设备返回的确认；再次查询核对。浏览器输入框中的值不代表已保存到设备。": "Use AT+MCUHOST?, AT+MCUPORT? and AT+MCUMODE? in the serial terminal to read saved MCU settings. If unset, enter the real IPv4 address or domain without http://. Remote UDP ports are 1–65535; local port 0 means automatic. Use the matching write button, check the device confirmation, then query again. A browser form value is not a saved device value.",
  "4. 选择模式与模式1维护": "4. Select the mode and maintain Mode 1",
  "模式0为AT透传，将RS232 AT指令转发至NTN。模式1为数据终端，将RS232原始数据打包发送UDP。模式1下需要配置时，先停止连续输入，执行“+++维护宏”，等待设备确认进入维护，再查询或写入配置；完成后点击“退出维护”。不能形成串口静默时，请使用Android蓝牙配置。": "Mode 0 passes RS232 AT commands to NTN. Mode 1 packetizes raw RS232 data for UDP. To configure Mode 1, stop continuous input, run the +++ maintenance macro and wait for the device confirmation before querying or writing settings. Exit maintenance when finished. Use Android Bluetooth configuration if a silent interval is not possible.",
  "5. 蓝牙名称与定位": "5. Bluetooth names and location",
  "在蓝牙名称区域查询名称和身份，按MAC识别设备。手动名称限1–31位ASCII字母、数字、下划线或连字符；DEFERRED表示已保存、断开蓝牙后生效。定位信息来自终端GNSS；未接天线时无定位或无效时间属于预期，不能把零坐标当作有效位置。": "Query the Bluetooth name and identity and identify devices by MAC. Manual names allow 1–31 ASCII letters, digits, underscore or hyphen. DEFERRED means saved and applied after Bluetooth disconnects. Location comes from terminal GNSS. Without an antenna, no fix or invalid time is expected; zero coordinates are not a valid position.",
  "6. 蓝牙升级请使用Android App": "6. Use Android for Bluetooth updates",
  "当前网页用于串口配置，不提供蓝牙OTA入口。请在Android App中选择正确的蓝牙MAC与蓝牙.ufw固件，保持供电、蓝牙和App运行；升级完成后重新连接并读取蓝牙版本。MCU和NTN固件使用各自的升级流程。": "This web page configures the serial terminal and has no Bluetooth OTA control. In the Android app, select the correct Bluetooth MAC and Bluetooth .ufw firmware. Keep power, Bluetooth and the app running, then reconnect and read the Bluetooth version. MCU and NTN firmware use separate update workflows.",
  "7. 无SIM测试与故障记录": "7. Tests without a SIM and troubleshooting",
  "无SIM可测试串口连接、MCU本地AT、NTN基本AT、参数配置、蓝牙通信和App蓝牙OTA；网络注册和卫星UDP送达需要后续验证。ERROR时先检查指令目标、格式、设备忙或超时信息；断线先检查供电、线缆、波特率和端口占用。保留原始收发内容，点击“导出日志”用于排查。打开或关闭本说明不会发送串口数据。": "Without a SIM, test serial connection, MCU AT, basic NTN AT, settings, Bluetooth and app OTA. Network registration and satellite UDP delivery remain unverified. For ERROR, check the command target, syntax, busy or timeout response. For disconnects, check power, cables, baud rate and port ownership. Export the raw log for diagnosis. Opening or closing this guide sends no serial data.",

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
    if (node.parentElement?.closest("#serialLog, #rawLog, #queryResponse, textarea, script, style")) continue;
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
