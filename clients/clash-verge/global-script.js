// =====================================================================
// Clash Verge Rev 全局扩展脚本 —— 在线规则集（GitHub 托管）
// 用法：设置 → 订阅 → 右上角“全局扩展脚本”(Script) → 全文粘贴本文件 → 保存
// 原理：由内核（mihomo）定时从 GitHub 拉取规则集，一次粘贴、长期自动更新。
// 改规则只需改 GitHub 仓库里的 rules/*.yaml，各设备 24h 内自动同步。
// =====================================================================

// ===== 按需修改这 3 项 =====
// 规则文件 URL 前缀（jsDelivr CDN，国内可访问性较好；备选见 README）
const REPO_BASE = "https://cdn.jsdelivr.net/gh/Azhi-ss/clash-rules@main/rules";
// 内核“下载/更新规则集”时走哪个策略组（保证国内能拉到；能直连 CDN 可改为 "DIRECT"）
const DOWNLOAD_PROXY = "Proxies";
// 每个规则集映射到本机订阅里的策略组名（不同机场的组名可能不同，以自己订阅为准）
const POLICY = {
  direct: "DIRECT",   // 直连
  windows: "DIRECT",  // Windows 进程直连（macOS/Linux 可删掉下方 RULE-SET 那一行）
  google: "Google",   // Google 组
  proxy: "Proxies",   // 默认代理组
  steam: "Steam",     // Steam 组
};

const UPDATE_INTERVAL = 86400; // 自动更新间隔（秒），86400 = 每天

function makeProvider(name, file) {
  return {
    type: "http",
    behavior: "classical",
    format: "yaml",
    url: `${REPO_BASE}/${file}`,
    interval: UPDATE_INTERVAL,
    proxy: DOWNLOAD_PROXY,
    path: `./providers/online-${name}.yaml`,
  };
}

function main(config, profileName) {
  // 1) 注册远程规则集
  const providers = config["rule-providers"] || {};
  providers["online-direct"] = makeProvider("direct", "direct.yaml");
  providers["online-windows"] = makeProvider("windows", "windows-direct.yaml");
  providers["online-google"] = makeProvider("google", "google.yaml");
  providers["online-proxy"] = makeProvider("proxy", "proxy.yaml");
  providers["online-steam"] = makeProvider("steam", "steam.yaml");
  config["rule-providers"] = providers;

  // 2) 把 RULE-SET 插到所有规则最前面（顺序：进程 → 直连 → 各组）
  const sets = [
    `RULE-SET,online-windows,${POLICY.windows}`,
    `RULE-SET,online-direct,${POLICY.direct}`,
    `RULE-SET,online-google,${POLICY.google}`,
    `RULE-SET,online-proxy,${POLICY.proxy}`,
    `RULE-SET,online-steam,${POLICY.steam}`,
  ];
  config.rules = sets.concat(config.rules || []);
  return config;
}
