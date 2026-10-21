---
name: uu-remote
description: "让网易 UU 远程（网易代号 GameViewer / uuyc，官网 uuyc.163.com）强制直连、不走代理，适用于 Clash Verge Rev / mihomo 内核。当用户提到 UU远程、网易UU远程、GameViewer 远控卡顿/连不上、远程设备或本地设备走了代理、P2P 被送进代理、要让远程桌面/端口映射直连时使用。远程桌面画面与隧道是纯 IP 的 P2P 直连、没有域名，必须用 PROCESS-NAME 按进程直连，主控端和被控端都要覆盖。同类远控（ToDesk / 向日葵 / RustDesk）也可参照本流程。"
---

# UU 远程直连（网易 GameViewer）

## 为什么必须按进程直连

- 网易 UU 远程（网易代号 **GameViewer**，二进制前缀 `uuyc`，官网 `uuyc.163.com`）的远程桌面与端口映射是 **P2P 直连**。
- 画面/隧道/媒体走**纯 IP 的 TCP/UDP，没有域名**：`DOMAIN` 规则匹配不到，靠 `GeoIP,cn` 只在对端是国内 IP 时碰巧直连。
- 一旦 P2P 对端或中转是**海外 IP**（跨国远控），GeoIP 会判定非 CN 并送进代理，表现为卡顿、停在“优化链路”、连不上。
- 正确做法：用 **`PROCESS-NAME` 按进程强制 `DIRECT`**，与目标 IP 无关。**主控端（本地）和被控端（远程）都要配。**

## Windows 已验证进程（权威清单）

安装目录通常为 `C:\Program Files\Netease\GameViewer\bin`，也可能是自定义目录（实测见过 `D:\uudesk\GameViewer\bin`）。

| 进程 | 作用 |
|---|---|
| `GameViewer.exe` | 主控端 / 界面 |
| `GameViewerServer.exe` | 被控端（常驻，远控接入方） |
| `GameViewerService.exe` | 系统服务（GameViewerService） |
| `GameViewerHealthd.exe` | 守护 / 健康检查 |
| `GameViewerLauncher.exe` | 启动器 |
| `uuyc-mux.exe` | **P2P 隧道 / 多路复用（最关键的网络进程）** |
| `uuyc-cli.exe` | 命令行 / 端口映射 |

- 这 7 个已写入本仓库 `rules/windows-direct.yaml`（provider 名 `online-windows`，统一走 DIRECT）。
- **不要**加 `aria2c.exe`、`Upgrade.exe`、`crashpad_handler.exe`、`devcon.exe` 等通用名（别的软件也会用，会误伤）。
- 信令/登录域名 `*.163.com`、`*.netease.com`（如 `sig-*.nrd.nie.163.com`、`nrd-ugc.fp.ps.netease.com`）已被 `rules/direct.yaml` 的 `163.com` / `netease.com` 覆盖，无需额外加。

## 工作流（新设备 / 重装 / 版本升级后）

1. **探测真实进程**（以实测为准，别只背清单）：
   - 安装目录：`Get-ChildItem -Path "<安装根目录>" -Recurse -Filter *.exe`
   - 运行进程：`Get-Process | Where Name -match 'GameViewer|uuyc'`
   - 实际连接：mihomo API `GET /connections`，过滤 `metadata.process` 含 `gameviewer` / `uuyc` 的连接。
2. **确认规则**：`rules/windows-direct.yaml` 含上述 7 条 `PROCESS-NAME`（仓库已含）。若新版出现新的联网 exe，补进该文件并 `git push`，然后让客户端刷新 provider。
3. **热加载 / 同步**：Windows 客户端引用了 `online-windows`，拉取后自动生效；急需则触发 `PUT /providers/rules/online-windows`（API 细节见仓库 `AGENTS.md`）。
4. **断开旧连接**（进程规则只对新连接生效，关键步骤）：
   - `DELETE /connections/{id}` 关掉现存 GameViewer 连接，或直接重启 UU 远程；让它重新建立 P2P 连接。
5. **验证**：重连后 `GET /connections` 中 UU 的连接（含纯 IP 连接）应为 `rule=RuleSet`、`rulePayload=online-windows`、链尾 `DIRECT`，且与目标 IP 是国内还是海外无关。
6. 两端（主控、被控）都要装 Clash 并订阅本仓库；被控端是服务（GameViewerService），确认其常驻流量也命中。

## 主控端 / 被控端

- 这是 P2P 两端通信，**只配一端，另一端仍可能被代理**。两台 Windows 都用同一 GitHub 仓库规则即可（24h 自动同步）。
- 端口映射走的是 `uuyc-cli`/`uuyc-mux` 隧道，同样按进程直连，映射到 `127.0.0.1:本地端口` 的业务流量本身不经过内核代理。

## macOS（被控端是 Mac 时）

- Mac 版 UU 远程进程名与 Windows 不同，且本仓库的 `windows-direct.yaml` 在 Mac 客户端默认不引用（全局脚本删了 `online-windows` 行）。
- **不要直接套用 `.exe` 名**。在 Mac 上实测：`ps aux | grep -iE 'gameviewer|uuyc|uu'` 或在“活动监视器”看真实进程名，再单独建一个 Mac 进程集合（或把该规则放进一个跨平台文件，由 Mac 端引用）。
- macOS 同样需要 TUN 模式才能稳定接管进程流量。

## 同类远控软件（参照本流程）

ToDesk、向日葵（Sunlogin）、RustDesk 等：同样是 P2P，同样用 `PROCESS-NAME` 按进程直连，**进程名必须实测**（安装目录 + `GET /connections` 的 `process` 字段），不要凭记忆写；同样覆盖主控端、被控端、系统服务，并在断开旧连接后验证。

## 常见问题

- 加了规则仍走代理：旧连接没断（规则只对新连接生效）→ 断开 GameViewer 连接或重启软件；确认 TUN 模式已开（UDP/进程流量主要靠 TUN 接管）。
- 校验失败：`mihomo -t` 检查；本集合只放 `PROCESS-NAME`，不引用策略组（固定 DIRECT）。
- 通用 API / 热加载 / named pipe 等问题见仓库 `AGENTS.md` 的「API 与排错」。
