# =============================================================================
# acme-master Dockerfile
# 基于 neilpang/acme.sh 官方镜像，安装 jq 和 openssh-client 依赖，
# 挂载初始化脚本作为容器入口点。
# =============================================================================
FROM neilpang/acme.sh:latest

# 安装运行时依赖：jq 用于解析 JSON 配置，openssh-client 用于 SSH 远程分发
RUN apk add --no-cache jq openssh-client

# 将初始化脚本复制到容器内并赋予执行权限
COPY init-cert.sh /init-cert.sh
RUN chmod +x /init-cert.sh

# 以初始化脚本作为容器入口点
ENTRYPOINT ["/init-cert.sh"]
