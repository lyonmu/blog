---
title: "Ubuntu 24.04 从零搭建 Kubernetes：kubeadm、containerd 与 Cilium"
pubDatetime: 2026-09-07T00:00:00+08:00
description: "记录在 Ubuntu 24.04 上使用 kubeadm 手动搭建三节点 Kubernetes 集群的过程，涵盖主机环境准备、containerd 配置、离线镜像导入和 Cilium 网络插件部署。"
tags:
  - kubernetes
  - ubuntu
  - kubeadm
  - containerd
  - cilium
draft: false
---

本文记录使用 kcli 创建三台 Ubuntu 24.04 虚拟机，并通过 kubeadm 搭建一个控制平面节点、两个工作节点的 Kubernetes 集群的过程。容器运行时使用 containerd，集群网络使用 Cilium，同时整理安装包准备和离线镜像导入、导出步骤。

[使用 kubeadm 引导集群](https://kubernetes.io/zh-cn/docs/setup/production-environment/tools/kubeadm/)

## 环境准备

### 创建主机

使用 kcli 创建三台虚拟主机

```sh
kcli create vm -i ubuntu-2404 -P autostart=true -P memory=8192 -P numcpus=4 -P 'disks=[128]' -P 'nets=[{"name":"default","ip":"192.168.122.11","netmask":"24","gateway":"192.168.122.1"},]' k8s-01

kcli create vm -i ubuntu-2404 -P autostart=true -P memory=8192 -P numcpus=4 -P 'disks=[128]' -P 'nets=[{"name":"default","ip":"192.168.122.12","netmask":"24","gateway":"192.168.122.1"},]' k8s-02

kcli create vm -i ubuntu-2404 -P autostart=true -P memory=8192 -P numcpus=4 -P 'disks=[128]' -P 'nets=[{"name":"default","ip":"192.168.122.13","netmask":"24","gateway":"192.168.122.1"},]' k8s-03
```

| 序号 | 主机IP         | 配置信息   | 角色    | OS                 |
| ---- | -------------- | ---------- | ------- | ------------------ |
| 1    | 192.168.122.11 | 4C8G 128GB | master1 | Ubuntu 24.04.4 LTS |
| 2    | 192.168.122.12 | 4C8G 128GB | worker1 | Ubuntu 24.04.4 LTS |
| 3    | 192.168.122.13 | 4C8G 128GB | worker2 | Ubuntu 24.04.4 LTS |

### 开启内核支持

```sh
cat >/etc/modules-load.d/k8s.conf <<'EOF'
overlay
br_netfilter
EOF

modprobe overlay
modprobe br_netfilter
```

### 开启网络转发

```sh
cat >/etc/sysctl.d/99-kubernetes.conf <<'EOF'
net.ipv4.ip_forward = 1
net.ipv6.conf.all.forwarding = 1
net.bridge.bridge-nf-call-iptables = 1
net.bridge.bridge-nf-call-ip6tables = 1
EOF

sysctl --system

sysctl net.ipv4.ip_forward
sysctl net.ipv6.conf.all.forwarding
sysctl net.bridge.bridge-nf-call-iptables
sysctl net.bridge.bridge-nf-call-ip6tables
```

### 关闭防火墙

```sh
systemctl disable --now ufw
ufw disable
```

#### 配置root用户ssh登录

1. 配置root密码

```sh
sudo passwd root
```

2. 开启root用户ssh远程登录

```sh
sudo vi /etc/ssh/sshd_config
```

- `PermitRootLogin` 参数改为 `yes`
- `PasswordAuthentication` 参数改为 `yes`

3. 重启ssh服务

```sh
sudo service ssh restart
```

4. 关闭swap

```sh
swapoff -a && sed -i '/[[:space:]]swap[[:space:]]/s/^/#/' /etc/fstab && swapon --show
```

5. 配置主机之间ssh免登录

```sh
ssh-keygen -t ed25519 -C "lyonmu@foxmail.com"

ssh-copy-id root@192.168.122.13
ssh-copy-id root@192.168.122.12
ssh-copy-id root@192.168.122.11
```

## 安装 kubectl

> 建议三个机器都安装

1. 下载 kubectl 二进制执行文件

```sh
# x86-64
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"

# arm
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/arm64/kubectl"
```

2. 安装 kubectl

```sh
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
```

3. 检查 kubectl 版本

```sh
kubectl version --client

kubectl version --client --output=yaml
```

## 安装容器运行时 containerd

> 三个机器都需要安装

1. 下载 containerd 的离线安装包
   https://github.com/containerd/containerd/releases

2. 下载 runc 的离线安装包
   https://github.com/opencontainers/runc/releases

3. 解压安装生成默认配置

```sh
# 解压安装包并copy为全局命令
tar Cxzvf /usr containerd-2.3.4-linux-amd64.tar.gz

# 生成默认配置
mkdir -p /etc/containerd && containerd config default > /etc/containerd/config.toml && sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml
```

4. 设置开机自启动

```ini
# Copyright The containerd Authors.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

[Unit]
Description=containerd container runtime
Documentation=https://containerd.io
After=network.target dbus.service

[Service]
ExecStartPre=-/sbin/modprobe overlay
ExecStart=/usr/bin/containerd

Type=notify
Delegate=yes
KillMode=process
Restart=always
RestartSec=5

# Having non-zero Limit*s causes performance problems due to accounting overhead
# in the kernel. We recommend using cgroups to do container-local accounting.
LimitNPROC=infinity
LimitCORE=infinity

# Comment TasksMax if your systemd version does not supports it.
# Only systemd 226 and above support this version.
TasksMax=infinity
OOMScoreAdjust=-999

[Install]
WantedBy=multi-user.target
```

```sh
vim /etc/systemd/system/containerd.service

systemctl daemon-reload && systemctl enable --now containerd.service && systemctl status containerd.service
```

5. 安装 runc

```sh
install -m 755 runc.amd64 /usr/bin/runc

runc --version
```

## 安装 kubeadm、kubelet、crictl

1. 下载相应软件的离线版本

kubelet.service

```ini
[Unit]
Description=kubelet: The Kubernetes Node Agent
Documentation=https://kubernetes.io/docs/
Wants=network-online.target
After=network-online.target

[Service]
ExecStart=/usr/bin/kubelet
Restart=always
StartLimitInterval=0
RestartSec=10

[Install]
WantedBy=multi-user.target
```

10-kubeadm.conf

```ini
# Note: This dropin only works with kubeadm and kubelet v1.11+
[Service]
Environment="KUBELET_KUBECONFIG_ARGS=--bootstrap-kubeconfig=/etc/kubernetes/bootstrap-kubelet.conf --kubeconfig=/etc/kubernetes/kubelet.conf"
Environment="KUBELET_CONFIG_ARGS=--config=/var/lib/kubelet/config.yaml"
# This is a file that "kubeadm init" and "kubeadm join" generates at runtime, populating the KUBELET_KUBEADM_ARGS variable dynamically
EnvironmentFile=-/var/lib/kubelet/kubeadm-flags.env
# This is a file that the user can use for overrides of the kubelet args as a last resort. Preferably, the user should use
# the .NodeRegistration.KubeletExtraArgs object in the configuration files instead. KUBELET_EXTRA_ARGS should be sourced from this file.
EnvironmentFile=-/etc/sysconfig/kubelet
ExecStart=
ExecStart=/usr/bin/kubelet $KUBELET_KUBECONFIG_ARGS $KUBELET_CONFIG_ARGS $KUBELET_KUBEADM_ARGS $KUBELET_EXTRA_ARGS
```

```sh
mkdir -p k8s-offline-v1.37.0

cd k8s-offline-v1.37.0

K8S_VERSION=v1.37.0
CRICTL_VERSION=v1.36.0
ARCH=amd64
RELEASE_VERSION=v0.16.2

curl -LO https://dl.k8s.io/release/${K8S_VERSION}/bin/linux/${ARCH}/kubeadm
curl -LO https://dl.k8s.io/release/${K8S_VERSION}/bin/linux/${ARCH}/kubelet
curl -LO https://github.com/kubernetes-sigs/cri-tools/releases/download/${CRICTL_VERSION}/crictl-${CRICTL_VERSION}-linux-${ARCH}.tar.gz
curl -L https://raw.githubusercontent.com/kubernetes/release/${RELEASE_VERSION}/cmd/krel/templates/latest/kubelet/kubelet.service -o kubelet.service
curl -L https://raw.githubusercontent.com/kubernetes/release/${RELEASE_VERSION}/cmd/krel/templates/latest/kubeadm/10-kubeadm.conf -o 10-kubeadm.conf

cd ..
tar czvf k8s-offline-v1.37.0.tar.gz k8s-offline-v1.37.0
```

2. 执行安装

```sh
tar -zxvf k8s-offline-v1.37.0.tar.gz

cd k8s-offline-v1.37.0

install -m 0755 kubeadm /usr/bin/kubeadm

install -m 0755 kubelet /usr/bin/kubelet

install -m 0644 kubelet.service /etc/systemd/system/kubelet.service

mkdir -p /etc/systemd/system/kubelet.service.d

install -m 0644 10-kubeadm.conf /etc/systemd/system/kubelet.service.d/10-kubeadm.conf

tar Cxzvf /usr/local/bin crictl-v1.36.0-linux-amd64.tar.gz

cat >/etc/crictl.yaml <<'EOF'
runtime-endpoint: unix:///run/containerd/containerd.sock
image-endpoint: unix:///run/containerd/containerd.sock
timeout: 10
debug: false
EOF

systemctl daemon-reload
systemctl enable --now kubelet


kubeadm version
kubelet --version
crictl --version
crictl info
```

## 离线导出导入镜像

1. 给 containerd 配置代理

```sh
mkdir -p /etc/systemd/system/containerd.service.d

cat >/etc/systemd/system/containerd.service.d/proxy.conf <<'EOF'
[Service]
Environment="HTTP_PROXY=http://100.64.0.3:7890/"
Environment="HTTPS_PROXY=http://100.64.0.3:7890/"
Environment="NO_PROXY=localhost,127.0.0.1/8,172.16.10.0/24,192.168.31.0/24,192.168.100.0/24,gwa.harbor.com,jd3hkvbi59b0ap.xuanyuan.run,*.xuanyuan.run,ghcr.nju.edu.cn"
EOF

systemctl daemon-reload && systemctl restart containerd && systemctl show containerd --property=Environment
```

2. 下载所需镜像

```sh
kubeadm config images list --kubernetes-version=v1.37.0 > images.txt

while read -r image; do
  echo "===== Pulling $image ====="
  ctr -n k8s.io images pull --local --platform linux/amd64 "$image"
done < images.txt
```

3. 导出镜像

```sh
ctr -n k8s.io images export --local --platform linux/amd64 k8s-v1.37.0-images.tar $(cat images.txt)
```

4. 导入镜像

```sh
ctr -n k8s.io images import --platform linux/amd64 k8s-v1.37.0-images.tar

ctr -n k8s.io images list

crictl images ls
```

## 使用 kubeadm 创建集群

```sh
# 创建master节点
kubeadm init --kubernetes-version=v1.37.0 --apiserver-advertise-address=192.168.122.11 --pod-network-cidr=10.123.0.0/16 --cri-socket=unix:///run/containerd/containerd.sock

mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config

# 创建 worker 节点：请替换为 kubeadm init 输出的 token 和 CA 证书哈希
kubeadm join 192.168.122.11:6443 --token <token> --discovery-token-ca-cert-hash sha256:<ca-cert-hash>
```

## 安装 cilium 网络插件

```sh
# 安装 helm
curl -LO https://get.helm.sh/helm-v3.18.6-linux-amd64.tar.gz

tar xzvf helm-v3.18.6-linux-amd64.tar.gz

install -m 0755 linux-amd64/helm /usr/bin/helm

helm version

# 下载 cilium 镜像
mkdir -p cilium-offline && cd cilium-offline

CILIUM_VERSION=1.20.1 && helm repo add cilium https://helm.cilium.io/ && helm repo update && helm pull cilium/cilium --version ${CILIUM_VERSION}

helm template cilium ./cilium-1.20.1.tgz --namespace kube-system --set ipam.mode=kubernetes --set image.pullPolicy=IfNotPresent --set operator.image.pullPolicy=IfNotPresent --set envoy.image.pullPolicy=IfNotPresent > cilium.yaml

grep -oE 'image: *"[^"]+"|image: *[^ ]+' cilium.yaml | sed 's/^image: *//' | tr -d '"' | sort -u > images.txt

while read -r image; do
  echo "===== $image ====="
  ctr -n k8s.io images pull --local --platform linux/amd64 "$image" || exit 1
done < images.txt

ctr -n k8s.io images list | grep cilium

ctr -n k8s.io images export --local --platform linux/amd64 cilium-1.20.1-images.tar $(cat images.txt)

# 3个节点导入 cilium 镜像
ctr -n k8s.io images import --local --platform linux/amd64 cilium-1.20.1-images.tar

# 开始部署 cilium
helm install cilium ./cilium-1.20.1.tgz   -n kube-system   --set ipam.mode=kubernetes   --set image.pullPolicy=IfNotPresent   --set operator.image.pullPolicy=IfNotPresent   --set envoy.image.pullPolicy=IfNotPresent

# 查看信息
kubectl get pods -n kube-system -o wide
kubectl -n kube-system get ds cilium
kubectl get nodes
kubectl get pod -A
```
