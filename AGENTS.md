# AGENTS.md —— 给 Agent 的接入 / 维护手册

> 当用户要求“把这台机器/这个客户端接入在线规则集”“在新电脑配置规则”“增改分流规则”“排查规则不生效”时按本文件执行。
> 概念解释（规则顺序、classical、换机场原理）面向用户写在 [README.md](README.md)；本文件只讲怎么动手、怎么验证。
>
> **Skills 按需索引（`skills/` 目录）**：这里只列“什么需求 → 打开哪个文件”，**命中需求才读对应的 SKILL.md，不必全看**；
> 具体步骤都在各 SKILL.md 内，本手册不展开。以后新增技能，只需在这张表加一行。
>
> | 命中需求 | 打开 |
> |---|---|
> | 让 **UU 远程**（网易 GameViewer/uuyc）或同类远控（ToDesk/向日葵/RustDesk）不走代理、远控卡顿/连不上、P2P 流量被送进代理 | [`skills/uu-remote/SKILL.md`](skills/uu-remote/SKILL.md) |

## 1. 这是什么

mihomo（Clash.Meta）内核的 `rule-provider` HTTP 规则集，规则托管在 GitHub，客户端每天自动拉取。
规则文件只写“匹配什么”，策略组在客户端本地映射，因此与具体机场无关、跨平台（Win/Mac/Linux）。

| 文件 | 条数 | 期望策略 | 备注 |
|---|---|---|---|
| `rules/direct.yaml` | 58 | `DIRECT` | 国内域名 + 内网 IP 段，跨平台 |
| `rules/windows-direct.yaml` | 11 | `DIRECT` | Windows 进程名（输入法/系统/UU远程），**Mac/Linux 不引用** |
| `rules/google.yaml` | 4 | Google 组 | |
| `rules/proxy.yaml` | 8 | 总代理组 | HF/Docker/Cursor/GitHub 等 |
| `rules/steam.yaml` | 17 | Steam 组 | 商店/社区/下载/游戏服务器/CDN |

5 条 `RULE-SET` 必须插到 `rules:` **最前面**（顺序：windows → direct → google → proxy → steam），优先于机场订阅规则。

仅支持 **mihomo 内核**客户端（Clash Verge Rev / Mihomo Party / ClashX Meta / FlClash 等）；老 Clash Premium、sing-box 不适用。

## 2. 接入 Clash Verge Rev

**① 配置根目录**
- Windows：`%APPDATA%\io.github.clash-verge-rev.clash-verge-rev`
- macOS：`~/Library/Application Support/io.github.clash-verge-rev.clash-verge-rev`
- Linux：`~/.config/clash-verge-rev`（或对应的 `…/io.github.clash-verge-rev.clash-verge-rev`）

**② 确定策略组名**（读运行时 `clash-verge.yaml` 的 `proxy-groups`，或 API `GET /proxies`，或让用户看「代理」页）
- 找到总代理组（含全部节点的 Selector/URLTest）；`Google`、`Steam` 细分组可能不存在。
- 拿不准就用**万能模式**：`google/proxy/steam` 全部指向总代理组，`direct/windows` 固定 `DIRECT`。
- 引用不存在的组名会导致内核校验失败。

**③ 安装脚本**
- 读 `profiles.yaml`，找全局脚本项（`uid: Script`、`type: script`）的 `file`（默认 `profiles/Script.js`），先备份。
- 用 `clients/clash-verge/global-script.js` 全文覆盖（**UTF-8 无 BOM**）；按②改顶部 `POLICY`（必要时改 `DOWNLOAD_PROXY`、`REPO_BASE`）。
- Mac/Linux：删掉 `sets` 数组里 `RULE-SET,online-windows,…` 那一行。
- 触发重新生成：在 Verge UI 打开该全局脚本并保存，或切换一次订阅，或重启 Verge。**外部改文件后不触发重新生成不会生效**。

**④ 验证（全部通过才算完成）**
- `GET /providers/rules`：有 `online-direct/windows/google/proxy/steam`（Mac/Linux 无 windows），
  `vehicleType=HTTP`、`behavior=Classical`，ruleCount 为 **58/11/4/8/17**（顺序 direct/windows/google/proxy/steam）。
- `GET /rules` 前 5 条为 `RuleSet online-*`。
- 实测：`google.com` 命中 `RULE-SET,online-google` 走代理；`www.baidu.com` 直连。
- 配置校验：`verge-mihomo(-alpha).exe -t -d <根目录> -f <根目录>/clash-verge.yaml` → `test is successful`。

## 3. 接入其他 mihomo 客户端

把 `clients/mihomo/config-snippet.yaml` 的 `rule-providers:` 并入主配置、5 条 `RULE-SET` 放到 `rules:` 最前，
策略组名改为本地真实组名，Mac/Linux 删 windows 行，重载后按 §2④ 验证。

## 4. 增改规则

- 归属：国内直连→`direct.yaml`；Google→`google.yaml`；出海→`proxy.yaml`；Steam→`steam.yaml`；Windows 进程→`windows-direct.yaml`。
- 格式：`payload:` 下每行 `类型,匹配值[,附加]`（`DOMAIN-SUFFIX,example.com` / `IP-CIDR,10.0.0.0/8,no-resolve` / `PROCESS-NAME,foo.exe`），不带策略名。
- **覆盖整个域名族**（主域 + CDN + API + 静态 + 别名），不要只加单个主机；不同集合间不要重复。
- **远程桌面 / P2P 类软件（UU 远程、ToDesk、向日葵等）的进程直连不在本手册展开**：见顶部 **Skills 按需索引**，打开对应 SKILL.md。
- `git add rules/ && git commit -m "rules: …" && git push`；客户端 24h 内自动更新，急需则刷新 provider/重启内核。
- 仓库公开，**禁止写敏感信息**，IP 段只允许内网/保留或公开网段。

## 5. API 与排错

- 连接信息读 `clash-verge.yaml` 的 `external-controller` 与 `secret`。Windows service 模式常不监听 TCP，
  而用 named pipe `\\.\pipe\verge-mihomo-production-*`，请求头带 `Authorization: Bearer <secret>`。
- 热加载：`PUT /configs?force=true`，body `{"path":"","payload":"<完整yaml>"}`，成功 204。
- 常见坑：
  - provider 不出现：`PUT` payload 模式下 `type: file` 不解析，必须用 `type: http`。
  - 校验失败：RULE-SET 引用了不存在的组名 → 按 §2② 修正。
  - 拉不到规则：`REPO_BASE` 换成 `https://gcore.jsdelivr.net/gh/Azhi-ss/clash-rules@main/rules`
    或 `https://fastly.jsdelivr.net/gh/Azhi-ss/clash-rules@main/rules`，并确认 `proxy` 指向可用代理组。
  - 加载了但不命中：只对新连接生效，断开重连；确认 RULE-SET 在最前。
  - 运行时 `clash-verge.yaml` 被写成 0 字节：不要在 Verge GUI 运行时直接覆写它（会与 Verge 写盘竞争）；
    改全局脚本走 UI 保存，或仅对内核 `PUT /configs`；写盘后用 `mihomo -t` 校验并留备份。
  - 拉取失败不会断网：首次成功后缓存于 `providers/online-*.yaml`，后续失败继续用缓存。

## 6. 完成后报告

改了哪些文件/接入哪个客户端、最终 POLICY 映射、各 provider 的 ruleCount 与实测分流结果；
若过渡期保留了旧规则兜底要说明；并提醒日常“加规则 → git push → 自动同步”。
