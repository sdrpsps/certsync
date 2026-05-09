#!/bin/sh
# =============================================================================
# CertSync 初始化与证书分发脚本
#
# 功能：
#   1. Fail-Fast 机制：启动时校验 SSH 私钥是否存在
#   2. 环境变量注入：从 config.json 的 global_env 导出环境变量
#   3. 约定优于配置：为每个域名自动申请根域名 + 泛域名证书
#   4. 多模式部署：支持群晖 DSM WebAPI 和 SSH 集群两种分发方式
#   5. 权限补丁：自动修复私钥权限并预热 known_hosts
#   6. 定时任务：流程结束后转入 acme.sh cron 守护模式
#
# 开发模式环境变量：
#   SKIP_ISSUE=true  — 跳过证书申请，仅执行部署（调试部署逻辑时使用）
#   STAGING=true     — 使用 Let's Encrypt 测试服务器（无速率限制）
# =============================================================================

set -e

CONFIG_FILE="/config.json"
SSH_KEY="/root/.ssh/id_ed25519"
LOG_PREFIX="[CertSync]"

# 开发模式开关（通过环境变量注入）
SKIP_ISSUE="${SKIP_ISSUE:-false}"
STAGING="${STAGING:-false}"

# =============================================================================
# 工具函数
# =============================================================================

log_info() {
    echo "${LOG_PREFIX} [INFO] $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_error() {
    echo "${LOG_PREFIX} [ERROR] $(date '+%Y-%m-%d %H:%M:%S') $1" >&2
}

log_warn() {
    echo "${LOG_PREFIX} [WARN] $(date '+%Y-%m-%d %H:%M:%S') $1"
}

# =============================================================================
# 第一步：Fail-Fast 检查
# =============================================================================

log_info "===== 启动 acme-master 证书管理系统 ====="

# 输出运行模式
if [ "${SKIP_ISSUE}" = "true" ]; then
    log_info "[开发模式] SKIP_ISSUE=true — 将跳过证书申请，仅执行部署。"
fi
if [ "${STAGING}" = "true" ]; then
    log_info "[开发模式] STAGING=true — 使用 Let's Encrypt 测试服务器。"
fi

# 检查 SSH 私钥是否存在
if [ ! -f "${SSH_KEY}" ]; then
    log_error "SSH 私钥不存在: ${SSH_KEY}"
    log_error "请先生成密钥对: ssh-keygen -t ed25519 -f ./ssh_keys/id_ed25519 -N \"\""
    log_error "容器无法启动，退出。"
    exit 1
fi

# 检查配置文件是否存在 (兼容 .jsonc 和 .json)
if [ ! -f "${CONFIG_FILE}" ]; then
    if [ -f "/config.jsonc" ]; then
        CONFIG_FILE="/config.jsonc"
    else
        log_error "配置文件不存在: ${CONFIG_FILE} 或 /config.jsonc"
        exit 1
    fi
fi

PARSED_JSON="/tmp/config_parsed.json"

log_info "正在解析并剔除配置文件中的注释..."
awk '{
    in_str = 0
    out = ""
    for (i=1; i<=length($0); i++) {
        c = substr($0, i, 1)
        if (c == "\"" && substr($0, i-1, 1) != "\\") {
            in_str = !in_str
        }
        if (!in_str && c == "/" && substr($0, i+1, 1) == "/") {
            break
        }
        out = out c
    }
    print out
}' "${CONFIG_FILE}" > "${PARSED_JSON}"

# 验证配置文件 JSON 格式
if ! jq empty "${PARSED_JSON}" 2>/dev/null; then
    log_error "配置文件 JSON 格式无效: ${CONFIG_FILE} (请检查是否遗漏了逗号或双引号)"
    exit 1
fi

# 将后续读取配置的指针指向解析后的纯净 JSON
CONFIG_FILE="${PARSED_JSON}"

log_info "前置检查全部通过。"

# =============================================================================
# 第二步：权限补丁
# =============================================================================

log_info "修复 SSH 私钥权限..."
mkdir -p /root/.ssh
# 由于挂载为只读，需要复制后修复权限
cp "${SSH_KEY}" /root/.ssh/_id_ed25519
chmod 600 /root/.ssh/_id_ed25519
SSH_KEY_ACTIVE="/root/.ssh/_id_ed25519"

log_info "SSH 私钥权限已设置为 600。"

# =============================================================================
# 第三步：注入全局环境变量
# =============================================================================

log_info "注入全局环境变量..."
eval "$(jq -r '.global_env // {} | to_entries[] | "export \(.key)=\(.value | @sh)"' "${CONFIG_FILE}")"
log_info "全局环境变量注入完成。"

# 自动注册 ACME 账号（如果提供了邮箱）
if [ -n "${ACCOUNT_EMAIL}" ]; then
    log_info "正在使用邮箱 ${ACCOUNT_EMAIL} 注册/更新 ACME 账号..."
    /acme.sh/acme.sh --register-account -m "${ACCOUNT_EMAIL}" --server letsencrypt
fi

# =============================================================================
# 第四步：遍历证书组，申请并部署证书
# =============================================================================

GROUP_COUNT=$(jq '.certificate_groups | length' "${CONFIG_FILE}")
log_info "发现 ${GROUP_COUNT} 个证书组，开始处理..."

# 强制禁用 acme.sh 自动更新（解决国内机器访问 GitHub 慢导致卡死的问题）
if grep -q "AUTO_UPGRADE='1'" /acme.sh/account.conf 2>/dev/null; then
    log_info "检测到 acme.sh 启用了自动更新，正在强制禁用以避免网络卡顿..."
    sed -i "s/AUTO_UPGRADE='1'/AUTO_UPGRADE='0'/g" /acme.sh/account.conf
fi

group_index=0
while [ "${group_index}" -lt "${GROUP_COUNT}" ]; do
    log_info "---------- 处理证书组 #$((group_index + 1)) ----------"

    # 获取当前证书组的 DNS API 类型
    DNS_API=$(jq -r ".certificate_groups[${group_index}].dns_api" "${CONFIG_FILE}")
    log_info "DNS API: ${DNS_API}"

    # 获取域名列表
    DOMAIN_COUNT=$(jq ".certificate_groups[${group_index}].domains | length" "${CONFIG_FILE}")

    domain_index=0
    while [ "${domain_index}" -lt "${DOMAIN_COUNT}" ]; do
        DOMAIN=$(jq -r ".certificate_groups[${group_index}].domains[${domain_index}]" "${CONFIG_FILE}")
        log_info "处理域名: ${DOMAIN} (根域名 + 泛域名)"

        # -----------------------------------------------------------------
        # 申请证书：约定优于配置，同时传入 -d domain.com -d *.domain.com
        # -----------------------------------------------------------------
        if [ "${SKIP_ISSUE}" = "true" ]; then
            log_info "[SKIP_ISSUE] 跳过 ${DOMAIN} 的证书申请。"
        else
            # 默认使用 letsencrypt，除非在 global_env 中指定了 CA_SERVER (例如 "zerossl")
            CA_SERVER="${CA_SERVER:-letsencrypt}"
            log_info "正在为 ${DOMAIN} 申请证书 (CA: ${CA_SERVER})..."

            # 构建 acme.sh --issue 命令参数
            ISSUE_ARGS="--issue --server ${CA_SERVER} --dns ${DNS_API} -d ${DOMAIN} -d *.${DOMAIN} --force"

            # 测试模式：追加 --staging 参数，使用 Let's Encrypt 测试服务器
            if [ "${STAGING}" = "true" ]; then
                ISSUE_ARGS="${ISSUE_ARGS} --staging"
                log_info "[STAGING] 使用测试服务器申请证书。"
            fi

            # shellcheck disable=SC2086
            acme.sh ${ISSUE_ARGS} \
                || log_warn "证书申请返回非零状态码（可能已存在有效证书），继续执行..."

            log_info "域名 ${DOMAIN} 证书申请流程完成。"
        fi

        domain_index=$((domain_index + 1))
    done

    # -----------------------------------------------------------------
    # 部署阶段：遍历 deployments 数组
    # -----------------------------------------------------------------
    DEPLOY_COUNT=$(jq ".certificate_groups[${group_index}].deployments | length" "${CONFIG_FILE}")
    log_info "发现 ${DEPLOY_COUNT} 个部署目标。"

    deploy_index=0
    while [ "${deploy_index}" -lt "${DEPLOY_COUNT}" ]; do
        DEPLOY_TYPE=$(jq -r ".certificate_groups[${group_index}].deployments[${deploy_index}].type" "${CONFIG_FILE}")

        # 检查 enabled 字段（默认为 true，省略时也视为启用）
        # 注意：jq 中的 `// true` 会把 false 也当成空值替换为 true，所以必须用 type 检查
        DEPLOY_ENABLED=$(jq -r ".certificate_groups[${group_index}].deployments[${deploy_index}].enabled | if type==\"boolean\" then . else true end" "${CONFIG_FILE}")
        if [ "${DEPLOY_ENABLED}" = "false" ]; then
            log_info "部署目标 ${DEPLOY_TYPE} 已禁用 (enabled: false)，跳过。"
            deploy_index=$((deploy_index + 1))
            continue
        fi

        log_info "部署目标类型: ${DEPLOY_TYPE}"

        case "${DEPLOY_TYPE}" in
            # =============================================================
            # 群晖 DSM 部署模式
            # =============================================================
            synology_dsm)
                log_info "开始群晖 DSM 部署..."

                # 注入群晖专用环境变量
                eval "$(jq -r ".certificate_groups[${group_index}].deployments[${deploy_index}].env // {} | to_entries[] | \"export \(.key)=\(.value | @sh)\"" "${CONFIG_FILE}")"

                # 对该组的每个域名执行 synology_dsm 部署钩子
                domain_index=0
                while [ "${domain_index}" -lt "${DOMAIN_COUNT}" ]; do
                    DOMAIN=$(jq -r ".certificate_groups[${group_index}].domains[${domain_index}]" "${CONFIG_FILE}")
                    log_info "向群晖 DSM 推送 ${DOMAIN} 的证书..."

                    acme.sh --deploy -d "${DOMAIN}" --deploy-hook synology_dsm \
                        || log_warn "群晖 DSM 部署 ${DOMAIN} 返回非零状态码，继续..."

                    domain_index=$((domain_index + 1))
                done

                log_info "群晖 DSM 部署完成。"
                ;;

            # =============================================================
            # SSH 集群部署模式
            # =============================================================
            ssh_cluster)
                log_info "开始 SSH 集群部署..."

                # 读取 SSH 集群配置
                SSH_USER=$(jq -r ".certificate_groups[${group_index}].deployments[${deploy_index}].user" "${CONFIG_FILE}")
                REMOTE_CERT_PATH=$(jq -r ".certificate_groups[${group_index}].deployments[${deploy_index}].cert_path" "${CONFIG_FILE}")
                REMOTE_KEY_PATH=$(jq -r ".certificate_groups[${group_index}].deployments[${deploy_index}].key_path" "${CONFIG_FILE}")
                RELOAD_CMD=$(jq -r ".certificate_groups[${group_index}].deployments[${deploy_index}].reload_cmd" "${CONFIG_FILE}")

                # 获取服务器列表
                SERVER_COUNT=$(jq ".certificate_groups[${group_index}].deployments[${deploy_index}].servers | length" "${CONFIG_FILE}")

                # 预热 known_hosts：为所有节点采集主机指纹
                log_info "预热 known_hosts..."
                server_index=0
                while [ "${server_index}" -lt "${SERVER_COUNT}" ]; do
                    SERVER=$(jq -r ".certificate_groups[${group_index}].deployments[${deploy_index}].servers[${server_index}]" "${CONFIG_FILE}")
                    log_info "采集主机指纹: ${SERVER}"
                    ssh-keyscan -H "${SERVER}" >> /root/.ssh/known_hosts 2>/dev/null || true
                    server_index=$((server_index + 1))
                done
                log_info "known_hosts 预热完成。"

                # 遍历节点，向每个节点分发所有域名的证书，最后统一执行重载
                server_index=0
                while [ "${server_index}" -lt "${SERVER_COUNT}" ]; do
                    SERVER=$(jq -r ".certificate_groups[${group_index}].deployments[${deploy_index}].servers[${server_index}]" "${CONFIG_FILE}")
                    log_info "========== 开始处理节点: ${SERVER} =========="

                    # 遍历并上传该组的所有域名证书
                    domain_index=0
                    while [ "${domain_index}" -lt "${DOMAIN_COUNT}" ]; do
                        DOMAIN=$(jq -r ".certificate_groups[${group_index}].domains[${domain_index}]" "${CONFIG_FILE}")

                        # acme.sh 证书存放路径（约定目录结构）
                        CERT_DIR="/acme.sh/${DOMAIN}_ecc"
                        FULLCHAIN="${CERT_DIR}/fullchain.cer"
                        PRIVKEY="${CERT_DIR}/${DOMAIN}.key"

                        # 检查证书文件是否存在
                        if [ ! -f "${FULLCHAIN}" ] || [ ! -f "${PRIVKEY}" ]; then
                            log_warn "  -> 域名 ${DOMAIN} 的证书不完整，跳过。"
                            domain_index=$((domain_index + 1))
                            continue
                        fi

                        # 动态替换目标路径中的 __DOMAIN__ 占位符
                        CURRENT_REMOTE_CERT_PATH="${REMOTE_CERT_PATH//__DOMAIN__/$DOMAIN}"
                        CURRENT_REMOTE_KEY_PATH="${REMOTE_KEY_PATH//__DOMAIN__/$DOMAIN}"

                        log_info "  -> 正在分发 ${DOMAIN} ..."

                        # 确保远程证书目录存在
                        CURRENT_REMOTE_CERT_DIR=$(dirname "${CURRENT_REMOTE_CERT_PATH}")
                        ssh -i "${SSH_KEY_ACTIVE}" -o StrictHostKeyChecking=no \
                            "${SSH_USER}@${SERVER}" \
                            "mkdir -p ${CURRENT_REMOTE_CERT_DIR}" \
                            || { log_warn "  -> 无法创建目录，跳过此域名..."; domain_index=$((domain_index + 1)); continue; }

                        # 上传证书（fullchain）
                        scp -i "${SSH_KEY_ACTIVE}" -o StrictHostKeyChecking=no \
                            "${FULLCHAIN}" \
                            "${SSH_USER}@${SERVER}:${CURRENT_REMOTE_CERT_PATH}" \
                            || { log_warn "  -> 上传证书失败..."; }

                        # 上传私钥
                        scp -i "${SSH_KEY_ACTIVE}" -o StrictHostKeyChecking=no \
                            "${PRIVKEY}" \
                            "${SSH_USER}@${SERVER}:${CURRENT_REMOTE_KEY_PATH}" \
                            || { log_warn "  -> 上传私钥失败..."; }

                        domain_index=$((domain_index + 1))
                    done

                    # 该节点的所有域名证书均分发完毕，执行一次统一重载
                    log_info "所有证书分发完毕，在 ${SERVER} 上执行重载: ${RELOAD_CMD}"
                    ssh -i "${SSH_KEY_ACTIVE}" -o StrictHostKeyChecking=no \
                        "${SSH_USER}@${SERVER}" \
                        "${RELOAD_CMD}" \
                        || log_warn "在 ${SERVER} 执行重载失败，继续..."

                    log_info "节点 ${SERVER} 部署流程结束。"
                    server_index=$((server_index + 1))
                done

                log_info "SSH 集群部署完成。"
                ;;

            # =============================================================
            # 未知部署类型
            # =============================================================
            *)
                log_warn "未知的部署类型: ${DEPLOY_TYPE}，跳过。"
                ;;
        esac

        deploy_index=$((deploy_index + 1))
    done

    group_index=$((group_index + 1))
done

# =============================================================================
# 第五步：转入守护进程模式（定时续期）
# =============================================================================

log_info "===== 所有证书组处理完毕 ====="
# 如果是子进程被唤醒进行每日部署，执行到这里即可退出，避免嵌套循环
if [ "$1" = "child_deploy" ]; then
    log_info "子进程每日分发任务完成，退出。"
    exit 0
fi

log_info "转入守护进程模式，每天定时检查证书续期并自动分发..."

while true; do
    # 休眠 1 天（86400 秒）
    sleep 86400
    
    log_info "===== 唤醒：执行每日证书续期检查 ====="
    
    # 创建时间戳标记文件，用于检测是否有证书被更新
    MARKER_FILE="/tmp/acme_cron_marker"
    touch "${MARKER_FILE}"
    
    acme.sh --cron || log_info "acme.sh --cron 执行完毕。"
    
    # 检查在此期间是否有任何证书文件被更新
    # 查找 /acme.sh 目录下修改时间晚于 MARKER_FILE 的 fullchain.cer 文件
    RENEWED_CERTS=$(find /acme.sh -type f -name "fullchain.cer" -newer "${MARKER_FILE}" 2>/dev/null)
    
    if [ -n "${RENEWED_CERTS}" ]; then
        log_info "检测到证书已更新，开始全量分发最新证书..."
        # 开启 SKIP_ISSUE 跳过申请环节，通过传递 child_deploy 参数避免死循环
        SKIP_ISSUE=true "$0" child_deploy || log_warn "每日全量分发出现异常，继续守护..."
    else
        log_info "没有证书需要续期，跳过分发环节，继续守护..."
    fi
done
