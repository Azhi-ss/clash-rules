# AGENTS.md —— 给 Agent 的接入 / 维护手册

> 本文件面向 AI Agent（或人类运维者）。当用户要求“把这台机器/这个客户端接入 clash-rules 在线规则集”、
> “在新电脑上配置规则”、“增加/修改分流规则”、“排查规则不生效”时，按本文件执行。
> 面向用户的介绍见 [README.md](README.md)。

## 0. 一句话目标

把本仓库的 5 个 `rule-provider`（mihomo 内核原生 HTTP 规则集）接入用户的 Clash 类客户端，
让用户的自定义分流规则从 GitHub 自动拉取、多设备共用；规则文件与机场解耦，策略组在每台设备本地映射。

## 1. 背景知识（先理解，再动手）

- 规则按“走哪个策略”拆成 5 个文件（一个 RULE-SET 只能绑一个策略）：
  | 文件 | 内容 | 期望策略 |
  |---|---|---|
  | `rules/direct.yaml` | 国内服务域名 + 内网/保留 IP 段（跨平台） | `DIRECT` |
  | `rules/windows-direct.yaml` | Windows `PROCESS-NAME` 进程规则 | `DIRECT`（仅 Windows 引用） |
  | `rules/google.yaml` | Google 全家桶域名 | Google 组 |
  | `rules/proxy.yaml` | 默认出海服务（HF/Docker/Cursor 等） | 总代理组 |
  | `rules/steam.yaml` | Steam | Steam 组 |
- 规则文件是 `behavior: classical`，**只写匹配条件，不写策略名**；策略由客户端本地的 `RULE-SET` 行决定。
- 规则顺序：脚本把 5 条 `RULE-SET` 插到规则列表**最前面**，优先于机场订阅自带规则；命中即停，未命中继续走机场规则。
- 拉取地址默认 `raw.githubusercontent.com`（实时），provider 设 `proxy: Proxies` 经代理节点下载；jsDelivr 为备选。
- 任何机场都有两个通用出口：内核内置 `DIRECT` + 一个“总代理组”（装全部节点的那个组，名字各异，常见 `Proxies/Proxy/节点选择/🚀 节点选择`）。

## 2. 支持的客户端

| 客户端 | 平台 | 接入方式 |
|---|---|---|
| **Clash Verge Rev** | Win/Mac/Linux | 全局扩展脚本，见 `clients/clash-verge/global-script.js`（首选） |
| 原生 mihomo / Mihomo Party / ClashX Meta / FlClash | 各平台 | 把 `clients/mihomo/config-snippet.yaml` 合并进主配置 |
| 其他兼容 Clash.Meta 的客户端（含 Stash/CMFA 等） | 各平台/手机 | 若支持 rule-provider + 自定义配置，用 snippet 思路；否则告知用户该客户端不支持 |

判断内核：**必须是 mihomo（Clash.Meta）内核**。Clash Premium（闭源老内核）、sing-box 不支持本方案。

## 3. 接入 Clash Verge Rev（标准流程）

### 3.1 定位配置根目录
- Windows：`%APPDATA%\io.github.clash-verge-rev.clash-verge-rev`
- macOS：`~/Library/Application Support/io.github.clash-verge-rev.clash-verge-rev`
- Linux：`~/.config/clash-verge-rev`（或 `~/.local/share/io.github.clash-verge-rev.clash-verge-rev`，以实际为准）

### 3.2 确定策略组名（关键，决定 POLICY 怎么填）
- 让用户在「代理」页查看组名，或读运行时配置 `clash-verge.yaml` 里的 `proxy-groups`，或调 API（见 §6）`GET /proxies`。
- 找到：总代理组（含全部节点的 Selector/URLTest）、Google 组、Steam 组（后两者可能不存在）。
- 填法：
  - 有细分组：`google:"Google", proxy:"<总代理组>", steam:"Steam"`（用真实名字）。
  - 没有细分组或拿不准：用「万能模式」，`google/proxy/steam` 全部指向总代理组，`direct/windows` 固定 `DIRECT`。
- **规则引用了不存在的组名会导致内核校验失败**，务必核对真实存在。

### 3.3 安装全局扩展脚本
1. 读 `profiles.yaml`，定位全局 Script 项（`uid: Script`，`type: script`）的 `file`（默认 `profiles/Script.js`）。**先备份原文件**。
2. 取 `clients/clash-verge/global-script.js` 全文，按 3.2 修改顶部 `POLICY`（必要时改 `DOWNLOAD_PROXY`、`REPO_BASE`）。
3. 覆盖写入该 Script 文件，**UTF-8 无 BOM**。
4. macOS / Linux：删除 `sets` 数组里 `RULE-SET,online-windows,...` 那一行（进程规则 Windows 专属；留着无害但会白拉一个文件）。
5. 让 Verge 重新生成配置：在 Verge UI 里打开该全局脚本并“保存”，或切换一次订阅，或重启 Verge。
   （Verge 不会可靠地监听外部文件变化；外部改完 Script 后必须触发一次重新生成。）

### 3.4 验证（全部通过才算完成）
- `GET /providers/rules`：出现 `online-direct/windows/google/proxy/steam`（Mac/Linux 无 windows），
  `vehicleType=HTTP`，`behavior=Classical`，`ruleCount` 分别为 **58 / 4 / 4 / 8 / 1**（windows 仅 Windows）。
- `GET /rules`：前 5 条为 `RuleSet online-*`。
- 实测：访问 `google.com` 命中 `RULE-SET,online-google` 并走代理；`www.baidu.com` 直连。
- 内核配置校验：`verge-mihomo(-alpha).exe -t -d <配置根目录> -f <根目录>/clash-verge.yaml` 应输出 `test is successful`。

## 4. 接入非 Verge 客户端

把 `clients/mihomo/config-snippet.yaml` 的 `rule-providers:` 块并入主配置，把 5 条 `RULE-SET` 放到 `rules:` 最前面，
策略组名改成本地真实组名；`url` 中的 `proxy` 字段改为该客户端可用的代理组（或能直连 GitHub 时删除）。改完重载并按 §3.4 验证。

## 5. 修改 / 新增规则（维护工作流）

1. 归属判断：国内直连→`direct.yaml`；Google→`google.yaml`；出海→`proxy.yaml`；Steam→`steam.yaml`；Windows 进程→`windows-direct.yaml`。
2. classical 格式：`payload:` 下每行 `类型,匹配值[,附加]`，如 `DOMAIN-SUFFIX,example.com`、`IP-CIDR,10.0.0.0/8,no-resolve`、`PROCESS-NAME,foo.exe`。
3. **必须覆盖整个域名族**：主域 + CDN + API + 静态资源 + 海外别名，不要只加单个主机。
4. 同一集合内顺序无关；不同集合之间不要重复。
5. 提交：`git add rules/ && git commit -m "rules: ..." && git push`。
6. 各设备按 `interval`（默认 86400 秒/天）自动更新；想立即生效在客户端刷新 provider 或重启内核。
7. 仓库公开，**禁止写入任何敏感信息**；IP 段只允许内网/保留地址或公开网段。

## 6. 与 mihomo API 通信（验证 / 热加载用）

- 连接信息读运行时配置 `clash-verge.yaml`：`external-controller`（可能是 TCP 端口，也可能是 Unix socket / Windows named pipe）与 `secret`。
- Clash Verge Rev 在 Windows service 模式下常**不监听 TCP**，而是 named pipe：`\\.\pipe\verge-mihomo-production-*`；
  用 HTTP/1.1 over pipe 手工请求，带 `Authorization: Bearer <secret>`。
- 热加载：`PUT /configs?force=true`，body `{"path":"","payload":"<完整yaml>"}`，成功返回 204。
- 常用：`GET /version`、`GET /providers/rules`、`GET /rules`、`GET /proxies`、`GET /connections`。

## 7. 排错清单（已踩过的坑）

- **provider 数量为 0 / 不出现**：`PUT /configs` 用 payload（内联配置）模式时，`type: file` 的相对路径不会解析；请始终用 `type: http`。
- **校验失败、无法加载**：几乎都是 `RULE-SET` 引用了不存在的策略组名；按 §3.2 核对真实组名。
- **拉不到规则文件**：把 `REPO_BASE` 换成 `https://gcore.jsdelivr.net/gh/Azhi-ss/clash-rules@main/rules`
  或 `https://fastly.jsdelivr.net/gh/Azhi-ss/clash-rules@main/rules`；确认 provider 的 `proxy` 指向一个可用代理组。
- **规则加载但没命中**：新连接才生效；旧连接走旧规则，断开重连。RULE-SET 必须在规则列表最前。
- **macOS/Linux 上报 PROCESS-NAME 问题**：删掉 online-windows 的 RULE-SET 行。
- **运行时配置被写成 0 字节**：不要在 Verge GUI 运行期间直接覆写 `clash-verge.yaml`（会与 Verge 自身的写盘竞争）。
  优先用“UI 保存脚本”或仅对内核做 `PUT /configs`；如确需写盘，写完用 `mihomo -t` 校验，并保留备份。
- **改了 Script 没生效**：Verge 不会稳定监听外部文件变化，必须触发重新生成（§3.3 第 5 步）。
- **断网/限流是否会失效**：不会。provider 首次成功后会落盘缓存（`providers/online-*.yaml`），后续拉取失败继续用缓存。

## 8. 完成后向用户报告

- 改了哪些文件、接入到哪个客户端、最终策略组映射；
- 各 provider 的 ruleCount 与实测分流结果；
- 若在过渡期保留了旧规则兜底，明确说明；
- 给出日后“加规则 → git push → 自动同步”的工作流。
