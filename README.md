# clash-rules —— 我的 Clash 在线规则集

把自定义分流规则托管在 GitHub，用 mihomo 内核原生的 **rule-provider（HTTP 规则集）** 自动拉取。
多台电脑共用一份规则：改一次、push 到 GitHub，所有设备每天自动同步；新增设备只需粘贴一次配置。

## 工作原理

```
GitHub 仓库 (rules/*.yaml)
        │  HTTP 拉取（jsDelivr CDN，内核按 interval 定时更新）
        ▼
mihomo rule-providers（按策略拆成 5 个集合）
        │  RULE-SET 引用（策略组名在各设备本地映射）
        ▼
本机机场订阅的策略组（DIRECT / Google / Proxies / Steam …）
```

- rule-provider 只提供“匹配什么”，**走哪个策略组由本机的 `RULE-SET` 行决定**，所以不同机场、不同组名的设备都能用同一份规则文件。
- 一个集合只能对应一个策略，因此按策略拆分为 5 个文件。

## 仓库结构

```
rules/
├── direct.yaml          # 直连：国内服务域名 + 本地/内网网段（跨平台）
├── windows-direct.yaml  # Windows 进程直连（仅 Windows 引用）
├── google.yaml          # → Google 策略组
├── proxy.yaml           # → 默认代理策略组（HF/Docker/Cursor 等）
└── steam.yaml           # → Steam 策略组
clients/
├── clash-verge/global-script.js   # Clash Verge Rev 全局扩展脚本（推荐）
└── mihomo/config-snippet.yaml     # 原生 mihomo / Mihomo Party / ClashX Meta 片段
```

## 新设备接入（Clash Verge Rev，约 1 分钟）

1. 打开 `clients/clash-verge/global-script.js`，按本机订阅改顶部 3 项：
   - `REPO_BASE`：默认已填好本仓库地址（`Azhi-ss/clash-rules`），无需修改；
   - `DOWNLOAD_PROXY`：下载规则集用的代理组名（国内建议保留 `Proxies`）；
   - `POLICY`：各集合映射到自己订阅里的策略组名（在 Verge「代理」页能看到组名）。
2. Verge → 设置/订阅页 → 编辑**全局扩展脚本 (Script)** → 全文粘贴 → 保存。
3. 切一下订阅或重启内核，日志中无 provider 报错即可。
4. 验证：内核日志/API 里 5 个 `online-*` 集合均加载成功；访问 google.com 应显示命中 `RULE-SET,online-google`。
5. macOS / Linux：删掉脚本里 `RULE-SET,online-windows,...` 那一行（进程规则是 Windows 专属）。

> 非 Verge 的 mihomo 系客户端，参照 `clients/mihomo/config-snippet.yaml`。

## 更新规则（日常工作流）

```bash
# 1. 改 rules/*.yaml（按策略归到对应文件；classical 格式每行不带策略名）
# 2. 提交推送
git add rules/ && git commit -m "rules: xxx" && git push
# 3. 各设备最长 24h 自动更新；想立即生效就在 Verge 里刷新/重启内核
```

- 规则文件格式（classical）：`payload:` 下每行是 `类型,匹配值[,附加参数]`，例如
  `DOMAIN-SUFFIX,example.com`、`IP-CIDR,10.0.0.0/8,no-resolve`、`PROCESS-NAME,foo.exe`。
- 新增域名归属：国内直连 → `direct.yaml`；Google → `google.yaml`；出海服务 → `proxy.yaml`；Steam → `steam.yaml`。
- 同一集合内顺序无关；不同集合间域名不要重复。

## 国内拉取说明

- 默认 URL 用 GitHub raw（`https://raw.githubusercontent.com/...`，规则更新**实时生效**），
  并在 provider 里设置 `proxy: Proxies`，让内核经代理节点下载，国内稳定。
- 下载失败时内核会继续使用上一次的本地缓存（`providers/online-*.yaml`），不会断网；
  首次成功拉取后，即使断网/限流也不影响分流。
- 备用 URL（直连 CDN，无需代理，但有几分钟级缓存延迟，任选其一替换 `REPO_BASE`）：
  - GCore 镜像：`https://gcore.jsdelivr.net/gh/Azhi-ss/clash-rules@main/rules`
  - Fastly 镜像：`https://fastly.jsdelivr.net/gh/Azhi-ss/clash-rules@main/rules`
- 仓库必须**公开**（rule-provider 不支持交互式登录；私有仓库需自行配置带 Authorization header 的反代）。
