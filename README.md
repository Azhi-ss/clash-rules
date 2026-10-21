# clash-rules —— 我的 Clash 在线规则集

> **🤖 AI Agent / 新设备接入请看 [`AGENTS.md`](AGENTS.md)**
> - **如果你是 AI Agent**：读仓库时请先打开 [`AGENTS.md`](AGENTS.md)，那是给你的自包含任务手册，
>   按里面的探测、配置、验证、排错步骤执行，不要凭本 README 自行猜测。
> - **如果你是用户**：要把规则接入新设备/新客户端，直接把仓库链接（或 `AGENTS.md`）丢给 Agent，
>   说“照 AGENTS.md 接入”即可，无需自己操作。

把自定义分流规则托管在 GitHub，用 mihomo 内核原生的 **rule-provider（HTTP 规则集）** 自动拉取。
多台电脑共用一份规则：改一次、push 到 GitHub，所有设备每天自动同步；新增设备只需粘贴一次配置。

## 工作原理

```
GitHub 仓库 (rules/*.yaml)
        │  HTTP 拉取（GitHub raw 实时更新，经代理节点下载；jsDelivr 作备选）
        ▼
mihomo rule-providers（按策略拆成 5 个集合）
        │  RULE-SET 引用（策略组名在各设备本地映射）
        ▼
本机机场订阅的策略组（DIRECT / Google / Proxies / Steam …）
```

- rule-provider 只提供“匹配什么”，**走哪个策略组由本机的 `RULE-SET` 行决定**，所以不同机场、不同组名的设备都能用同一份规则文件。
- 一个集合只能对应一个策略，因此按策略拆分为 5 个文件。

## 规则顺序：在线规则与机场订阅自带规则的关系

机场订阅链接本身就带了几千条规则（Netflix/YouTube 的 IP 段、GeoIP、各国分流等），本仓库的规则**不是替换它们，而是叠加在最前面**。
mihomo 的规则是**自上而下逐条匹配、命中即停**，脚本把 5 条 `RULE-SET` 插到整份规则列表的最前面，所以最终顺序是：

```
1. 在线规则集（本仓库 5 个 RULE-SET）      ← 优先级最高，你自己的规则
2. （过渡期）订阅模板里的旧 prepend 规则   ← 兜底，验证稳定后可清空
3. 机场订阅自带的几千条规则                ← 订阅原本的功能，原样保留
4. GeoIP / MATCH 兜底
```

含义：
- 在线规则**命中**的域名 → 按你在仓库里写的走（直连 / Google / 代理 / Steam）；
- 在线规则**没覆盖**的流量 → 继续往下走机场订阅规则，所以机场自带的 Netflix、YouTube 等分流完全不受影响；
- 若同一域名在两边都有且结论冲突（机场让走代理、你让直连），**在线规则优先**（因为排在最前）。
- 本仓库是“增量覆盖层”，只放你想自己掌控的规则；机场订阅更新它的规则库也不影响你这份。

## 换机场 / 换订阅（规则不绑定任何机场）

本仓库的规则文件**只描述“匹配什么域名”，不含任何策略组名**，因此和具体机场（LinkCube 或其他）完全解耦：
换机场、换订阅，**仓库里的 `rules/*.yaml` 一个字都不用改**；只需要在每台机器的 `global-script.js` 顶部改 `POLICY` 映射。

- 策略组名来自**当前订阅**，在 Verge「代理」页能看到（例如 LinkCube 有 `Google / Proxies / Steam` 等 22 个组）。
- `DIRECT` 是内核内置的、永远存在；`Google / Proxies / Steam` 等必须是订阅里**真实存在**的组名——
  引用不存在的组名会导致内核校验失败。
- 新机场没有同名细分组（比如没有 `Steam`，或叫 `游戏服务`、`🤖 AI`），把 `POLICY` 里对应的值改成实际组名，
  或直接指向总代理组（常见叫法：`Proxies` / `Proxy` / `节点选择` / `🚀 节点选择`）。
- 在多个机场订阅间切换时，确保每个订阅都含 `POLICY` 引用的组名，或干脆都指向通用总代理组。

### 本质：任何机场都只有两个通用出口

- **`DIRECT`（直连）**：内核内置，任何机场都存在，不是策略组。
- **一个“总代理组”**：真正装着所有节点的那个组。LinkCube 里叫 `Proxies`（56 个节点）；
  其他机场常见叫法：`Proxies` / `Proxy` / `节点选择` / `🚀 节点选择` / `代理`。
- 像 `Google / Steam / Netflix` 这些细分组，通常只是“预先筛选过的子组”，最终仍把流量交给总代理组。

所以有两套映射可选：

```js
// 精细模式（订阅里有 Google/Steam 等细分组时，当前 LinkCube 用这个）
const POLICY = { direct: "DIRECT", windows: "DIRECT", google: "Google",
                 proxy: "Proxies", steam: "Steam" };

// 万能模式（任何机场都能用：不管它有什么细分组，需要代理的全部走总代理组）
const POLICY = { direct: "DIRECT", windows: "DIRECT", google: "Proxies",
                 proxy: "Proxies", steam: "Proxies" };   // 把 "Proxies" 换成该机场的总代理组名
```

> 新机器/新机场若不确定组名，先用「万能模式」（直连 + 总代理组）保证全部生效，之后想要精细分流再按实际细分组调整。

## 关于 “classical”（规则集格式）

配置里的 `behavior: classical` 是 **mihomo 内核**的参数（Clash Verge 界面里看不到这个词）。
规则集有三种 behavior：
- `classical`：每行是一条完整规则（`DOMAIN-SUFFIX,xx`、`IP-CIDR,...`、`PROCESS-NAME,xx` 可混用）——本仓库用这个，因为规则里同时有域名、内网 IP 段、Windows 进程名；
- `domain`：纯域名列表；
- `ipcidr`：纯 IP 段列表。

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

## 强制直连的软件（Windows 进程规则）

`windows-direct.yaml`（仅 Windows 引用）按**进程名**把下列软件强制直连，与它们连什么 IP 无关：

- **豆包输入法 / 系统设置**：本地组件，走代理会异常。
- **网易 UU 远程**（网易代号 GameViewer，含 `GameViewer.exe`、被控端 `GameViewerServer.exe`、系统服务、
  P2P 隧道 `uuyc-mux.exe` 等进程）：远程桌面和端口映射是 **P2P 直连**，画面/隧道流量走**纯 IP、没有域名**，
  域名规则管不到；对端还可能是海外 IP，按 GeoIP 会被送进代理，导致卡顿或连不上。按进程直连后，
  **主控端和被控端都不走代理**。

为什么这类软件不能只加域名：P2P 流量是 IP 直连，没有域名可匹配。**同类远控软件（ToDesk、向日葵、RustDesk 等）
同理处理**——把联网 exe 用 `PROCESS-NAME` 加进 `windows-direct.yaml`，主控端和被控端都要覆盖；
改完重启该软件（规则只对新连接生效）。

> 🤖 给 Agent：遇到 UU 远程 / 同类远控直连需求，读按需技能 [`skills/uu-remote/SKILL.md`](skills/uu-remote/SKILL.md)（含已验证进程名、探测与验证步骤）。

## 新设备接入（Clash Verge Rev，约 1 分钟）

> 🤖 **AI Agent 注意**：本节是给人看的简要步骤；接入任务请直接以 [`AGENTS.md`](AGENTS.md) 为准（含探测、验证、排错）。

1. 打开 `clients/clash-verge/global-script.js`：只需核对顶部的 `POLICY` 组名（在 Verge「代理」页对照）；
   `REPO_BASE` 已填好无需改，`DOWNLOAD_PROXY` 国内建议保留 `Proxies`。
2. Verge → 设置/订阅页 → 编辑**全局扩展脚本 (Script)** → 全文粘贴 → 保存。
3. 切一下订阅或重启内核，日志中无 provider 报错即可。
4. 验证：内核日志/API 里 `online-*` 集合均加载成功（Windows 5 个、Mac/Linux 4 个）；访问 google.com 应命中 `RULE-SET,online-google`。
5. macOS / Linux：删掉脚本里 `RULE-SET,online-windows,...` 那一行（进程规则是 Windows 专属；不删也无害）。

> 非 Verge 的 mihomo 系客户端（Mihomo Party / ClashX Meta / FlClash 等），用 `clients/mihomo/config-snippet.yaml`。

### macOS / Linux

- Clash Verge Rev 跨平台（Intel / Apple Silicon 都有），入口和操作与 Windows 完全一样；
  除 windows-direct 外，其余 4 个规则集（域名 + IP 段）天然跨平台。
- 唯一改动：删 online-windows 那一行（见上）。`path` 是相对路径，内核会自动放到本机配置目录。
- 若用的是不同机场，核对 `POLICY` 组名（见上文「换机场」）。

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
