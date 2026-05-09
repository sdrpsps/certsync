# CertSync

[![Docker Hub](https://img.shields.io/docker/pulls/sdrpsps/certsync?logo=docker&label=Docker%20Hub)](https://hub.docker.com/r/sdrpsps/certsync)

基于 Docker 的中心化证书管理方案。通过一份 JSON 配置文件，实现 **"一处申请，多点分发（群晖 NAS + 云服务器集群）"**。

## 1. 架构概览

```
┌───────────────────────────────────────────────────────┐
│                   Docker Container                    │
│                                                       │
│   ┌───────────┐       ┌────────────┐       ┌───────┐  │
│   │  acme.sh  │ ──▶   │ init-cert  │ ──▶   │ cron  │  │
│   │  (base)   │       │    .sh     │       │ (守护)│  │
│   └───────────┘       └─────┬──────┘       └───────┘  │
│                             │                         │
│                      ┌──────▼───────┐                 │
│                      │ config.jsonc │                 │
│                      └──────┬───────┘                 │
│              ┌──────────────┴──────────────┐          │
│              ▼                             ▼          │
│      ┌──────────────┐              ┌───────────────┐  │
│      │ Synology DSM │              │  SSH Cluster  │  │
│      │   (WebAPI)   │              │ (scp+reload)  │  │
│      └──────────────┘              └───────────────┘  │
└───────────────────────────────────────────────────────┘
```

## 2. 目录结构

```text
.
├── config.json          # 核心配置文件（DNS API 凭证、域名、部署目标）
├── docker-compose.yml   # 容器定义（卷挂载、重启策略）
├── Dockerfile           # 镜像构建（基于 acme.sh，安装 jq + openssh）
├── init-cert.sh         # 核心逻辑脚本（申请 + 分发 + 守护）
├── ssh_keys/            # SSH 密钥目录（需手动创建）
│   └── id_ed25519       # Ed25519 私钥
├── acmedata/            # acme.sh 数据持久化（自动生成）
└── README.md            # 本文档
```

## 3. 准备工作（手动操作）

### A. 生成 SSH 密钥对

```bash
mkdir -p ssh_keys
ssh-keygen -t ed25519 -f ./ssh_keys/id_ed25519 -N ""
```

> ⚠️ **重要：** `ssh_keys/id_ed25519` 必须存在，否则容器将 fail-fast 退出。

### B. 在目标云服务器上创建 `cert` 用户（以 Debian/Ubuntu 为例）

以下步骤需要在 **每台目标云服务器** 上以 `root` 身份执行：

```bash
# 1. 创建 cert 用户（无密码登录，仅用于证书部署）
useradd -m -s /bin/bash cert

# 2. 创建 .ssh 目录并设置权限
mkdir -p /home/cert/.ssh
chmod 700 /home/cert/.ssh

# 3. 将本地生成的公钥写入 authorized_keys
# 把 ssh_keys/id_ed25519.pub 的内容粘贴到引号内
echo "粘贴你的公钥内容" > /home/cert/.ssh/authorized_keys
chmod 600 /home/cert/.ssh/authorized_keys

# 4. 创建证书存放目录，cert 通过组权限写入，Nginx (root) 正常读取
mkdir -p /etc/nginx/ssl
chown root:cert /etc/nginx/ssl
chmod 775 /etc/nginx/ssl

# 5. 修复 .ssh 目录所有权
chown -R cert:cert /home/cert/.ssh
```

### C. 配置 `cert` 用户免密重载 Nginx

`cert` 用户需要 `sudo` 权限来重载 Nginx，但不应拥有完整的 root 权限。通过 `visudo` 精确授权：

```bash
# 使用 visudo 编辑 sudoers（推荐用独立文件，避免污染主配置）
echo 'cert ALL=(ALL) NOPASSWD: /usr/bin/systemctl reload nginx' > /etc/sudoers.d/cert
chmod 440 /etc/sudoers.d/cert
```

验证配置是否生效：

```bash
# 切换到 cert 用户测试
su - cert -c "sudo systemctl reload nginx"
# 如果没有报错，说明配置正确
```

### D. 验证 SSH 连通性

回到你的本地开发机器，测试 SSH 连接是否正常：

```bash
# 从本地测试连接（替换为你的服务器地址）
ssh -i ./ssh_keys/id_ed25519 cert@your-server-ip "echo '连接成功'"
```

> 💡 **一键脚本：** 如果你有多台服务器，可以把上述步骤写成脚本批量执行。公钥内容可以用 `cat ./ssh_keys/id_ed25519.pub` 获取。

## 4. 配置文件说明 (`config.jsonc`)

> 💡 **提示：** 本项目支持使用 `.jsonc` 格式！你可以在配置文件中自由使用 `//` 进行单行注释，脚本会自动解析。

```jsonc
{
  "global_env": {
    "ACCOUNT_EMAIL": "yourname@example.com",
    "CF_Token": "你的 Cloudflare API Token",
    "CF_Account_ID": "你的 Cloudflare Account ID",
  },
  "certificate_groups": [
    {
      "dns_api": "dns_cf",
      "domains": ["example.com", "example.org"],
      "deployments": [
        {
          "type": "synology_dsm",
          "enabled": false, // 设为 false 可临时跳过该部署
          "env": {
            "SYNO_Username": "cert_admin",
            "SYNO_Password": "NAS_PASSWORD",
            "SYNO_Certificate": "acme_wildcard",
            "SYNO_Scheme": "http",
            "SYNO_Port": "5000",
          },
        },
        {
          "type": "ssh_cluster",
          "user": "cert",
          "cert_path": "/etc/nginx/ssl/__DOMAIN__/cert.pem",
          "key_path": "/etc/nginx/ssl/__DOMAIN__/key.pem",
          "reload_cmd": "sudo systemctl reload nginx",
          "servers": [
            "node1.example.com",
            "node2.example.com",
            "114.114.114.114",
          ],
        },
      ],
    },
  ],
}
```

### 字段说明

| 字段                   | 说明                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `ACCOUNT_EMAIL`        | 用于注册 ACME 账号（避免 ZeroSSL 报错）                                                |
| `global_env`           | 全局环境变量，启动时自动导出（如 Cloudflare Token）                                    |
| `certificate_groups`   | 证书组数组，每组共享同一个 DNS API                                                     |
| `dns_api`              | acme.sh 支持的 DNS 验证插件名称                                                        |
| `domains`              | 域名列表，每个自动申请 `domain.com` + `*.domain.com`                                   |
| `deployments`          | 部署目标数组，支持 `synology_dsm` 和 `ssh_cluster`                                     |
| `enabled`              | 可选，部署开关，设为 `false` 可临时禁用（默认 `true`）                                 |
| `servers`              | SSH 集群节点列表，支持域名或 IP                                                        |
| `cert_path`/`key_path` | SSH 远程服务器上保存证书的绝对路径。支持使用 `__DOMAIN__` 占位符实现多域名分目录存储。 |

## 5. 运行

### 方式一：从 Docker Hub 拉取预构建镜像（推荐）

在任意新机器上，你只需要 **3 个文件**：

```text
.
├── config.jsonc         # 核心配置（填入真实凭证）
├── docker-compose.yml   # 容器定义（image 指向 Docker Hub）
└── ssh_keys/
    └── id_ed25519       # SSH 私钥
```

1. 编辑 `docker-compose.yml`，确认 `image` 字段指向你的 Docker Hub 镜像：

```yaml
services:
  certsync:
    image: sdrpsps/certsync:latest
```

2. 启动容器：

```bash
docker compose up -d
```

> 💡 无需 `--build`，Docker 会自动从 Docker Hub 拉取镜像。

### 方式二：本地构建

如果你修改了 `init-cert.sh` 或 `Dockerfile`，需要本地重新构建：

1. 编辑 `docker-compose.yml`，注释 `image` 行，取消注释 `build` 行：

```yaml
services:
  certsync:
    # image: sdrpsps/certsync:latest
    build: .
```

2. 构建并启动：

```bash
docker compose up -d --build
```

### 开发与调试模式

在开发阶段，频繁申请证书会触发 Let's Encrypt 的 [速率限制](https://letsencrypt.org/docs/rate-limits/)。提供两个环境变量来避免这个问题：

| 环境变量     | 作用                                                    | 适用场景                   |
| ------------ | ------------------------------------------------------- | -------------------------- |
| `STAGING`    | 使用 Let's Encrypt 测试服务器（无速率限制，证书不受信） | 本地开发，测试完整申请流程 |
| `SKIP_ISSUE` | 跳过证书申请，直接执行部署                              | 证书已存在，只调试部署逻辑 |

#### 推荐工作流

```
┌─────────────────────────────────────────────────────────────────────────┐
│     ① 本地开发             ② 调试部署               ③ 生产上线          │
│    STAGING=true      →    SKIP_ISSUE=true    →     (无环境变量)         │
│                                                                         │
│   使用测试服务器申请      跳过申请，反复调试      正式服务器，真实证书  │
│   走通整体自动化流程      验证分发/重启逻辑       生产环境自动续期/分发 │
└─────────────────────────────────────────────────────────────────────────┘
```

**① 本地开发阶段** — 用测试服务器走通完整流程：

```yaml
# docker-compose.yml
environment:
  - STAGING=true
```

**② 调试部署逻辑** — 证书已存在，只反复测试部署：

```yaml
# docker-compose.yml
environment:
  - SKIP_ISSUE=true
```

**③ 生产上线** — 移除所有环境变量，使用正式服务器：

```yaml
# docker-compose.yml（删除 environment 块或注释掉）
```

> 💡 **提示：** 也可以通过命令行临时覆盖，无需修改 compose 文件：
>
> ```bash
> STAGING=true docker compose up -d       # 测试服务器
> SKIP_ISSUE=true docker compose up -d    # 跳过申请
> ```

> ⚠️ **注意：** `STAGING=true` 申请的证书是测试证书（不受浏览器信任）。生产环境**必须去掉 `STAGING`**，让 acme.sh 用正式服务器重新申请。`acmedata/` 目录可以从开发环境直接复制到生产环境，acme.sh 会自动识别并接管续期。

### 常用命令

```bash
# 查看日志
docker logs -f certsync

# 重启容器（配置更新后）
docker compose restart

# 拉取最新镜像并重建
docker compose pull && docker compose up -d
```

## 6. Docker Hub 构建与推送

### A. 首次推送

```bash
# 登录 Docker Hub
docker login

# 构建镜像并打标签
docker build -t sdrpsps/certsync:latest .

# 推送到 Docker Hub
docker push sdrpsps/certsync:latest
```

### B. 多架构支持（amd64 + arm64）

如果你的服务器包含 ARM 架构（如树莓派、Apple Silicon 等），建议构建多架构镜像：

```bash
# 创建并使用 buildx 构建器（首次执行）
docker buildx create --name multiarch --use
docker buildx inspect --bootstrap

# 构建并推送多架构镜像（同时支持 amd64 和 arm64）
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t sdrpsps/certsync:latest \
  --push .
```

### C. 版本管理

建议同时推送版本标签和 `latest` 标签：

```bash
# 打版本标签
docker build -t sdrpsps/certsync:1.0.0 \
             -t sdrpsps/certsync:latest .

# 推送所有标签
docker push sdrpsps/certsync:1.0.0
docker push sdrpsps/certsync:latest
```

### D. 更新镜像后部署到远程机器

在远程机器上，拉取最新镜像并重启：

```bash
docker compose pull
docker compose up -d
```

## 7. 工作流程

```
1. 启动 → Fail-Fast 检查（SSH 密钥 + 配置文件）
2. 权限补丁 → chmod 600 私钥
3. 注入全局环境变量 → export CF_Token, CF_Account_ID ...
4. 遍历 certificate_groups：
   ├─ 为每个 domain 执行 acme.sh --issue -d domain -d *.domain
   └─ 遍历 deployments：
      ├─ synology_dsm → 注入 SYNO_* 环境变量 → acme.sh --deploy
      └─ ssh_cluster → ssh-keyscan 预热 → scp 上传 → ssh 重载
5. 全部完成 → 转入守护模式，每天执行 `acme.sh --cron` 并自动重走全量分发逻辑
```

## 8. 常见问题

### 更新配置后如何生效？

修改 `config.jsonc` 后，重启容器即可：

```bash
docker compose restart
```

### 证书如何自动续期？

容器首次完成所有证书申请和部署后，自动进入 `acme.sh --cron` 守护模式，每天检查一次。若证书即将到期，会自动续期并重新触发 `deployments` 中定义的所有分发任务。

### 泛域名如何处理？

系统自动为 `domains` 数组中的每个域名同时申请 `example.com` 和 `*.example.com`，无需手动指定。

### 如何添加新域名？

在 `config.jsonc` 的 `domains` 数组中追加域名，然后重启容器。

### SSH 连接失败怎么办？

1. 检查 `ssh_keys/id_ed25519` 是否存在且正确
2. 确认公钥已添加到目标服务器
3. 确认目标服务器的 SSH 端口可达
4. 查看容器日志定位具体错误

### 如何更新镜像？

```bash
# 在构建机上推送新版本后，在部署机上执行：
docker compose pull && docker compose up -d
```

## 9. 技术栈

| 组件               | 用途                            |
| ------------------ | ------------------------------- |
| `neilpang/acme.sh` | ACME 协议客户端，证书申请与续期 |
| `jq`               | JSON 配置文件解析               |
| `openssh-client`   | SSH 远程分发（scp + ssh）       |
| Docker             | 容器化运行，环境隔离            |

## 10. 安全注意事项

- SSH 私钥以只读模式挂载到容器（`:ro`）
- 脚本自动 `chmod 600` 确保私钥权限安全
- `config.json` 包含敏感信息，请勿提交到公开仓库
- 建议在 `.gitignore` 中排除 `ssh_keys/`、`acmedata/` 和 `config.json`
- Docker Hub 镜像不包含任何敏感信息（密钥和配置通过卷挂载注入）
