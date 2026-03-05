---
title: "使用KubeKey安装Kubernetes和KubeSphere"
description: "使用 KubeKey 在 ubuntu 24.04安装部署 Kubernetes 集群以及 KubeSphere 社区版"
pubDatetime: 2026-01-19T16:59:16+08:00
tags:
  - kubernetes
  - ubuntu
draft: false
---

## 相关链接

[下载操作系统](https://mirrors.tuna.tsinghua.edu.cn/#)

[官网安装文档](https://www.kubesphere.io/zh/docs/v4.1/03-installation-and-upgrade/02-install-kubesphere/02-install-kubernetes-and-kubesphere/)

## 资源配置

> - 本操作文档仅在Ubuntu 24.04.2下生效，其他操作系统不保证成功
> - 采用在线安装的方式，所以集群所有服务器都需要可以访问外网

| 序号 |     主机IP     | 配置信息     |  角色   |         OS         |
| :--: | :------------: | ------------ | :-----: | :----------------: |
|  1   | 192.168.100.20 | 4C8G 200GB   | master1 | Ubuntu 24.04.2 LTS |
|  2   | 192.168.100.21 | 4C8G 200GB   | master2 | Ubuntu 24.04.2 LTS |
|  3   | 192.168.100.22 | 4C8G 200GB   | master3 | Ubuntu 24.04.2 LTS |
|  4   | 192.168.100.23 | 16C32G 500GB | worker1 | Ubuntu 24.04.2 LTS |
|  5   | 192.168.100.24 | 16C32G 500GB | worker2 | Ubuntu 24.04.2 LTS |

## 调整服务器配置

> **所有五台机器都要配置**

### 配置root用户ssh登录

1. 配置root密码

   ```sh
   sudo passwd root
   ```

2. 开启root用户ssh远程登录

   ```sh
   sudo vi /etc/ssh/sshd_config
   ```

   - `PermitRootLogin`参数改为`yes`
   - `PasswordAuthentication`参数改为`yes`

3. 重启ssh服务

   ```sh
   sudo service ssh restart
   ```

### 设置主机名、关闭swap

```sh
swapoff -a && sed -i '/[[:space:]]swap[[:space:]]/s/^/#/' /etc/fstab && swapon --show && hostnamectl set-hostname k8smaster1 && hostname
```

### 更新包、安装包

```sh
# 更新包索引，安装需要的包
apt-get update && apt-get upgrade && apt-get install -y vim socat conntrack ebtables ipset chrony locales language-pack-zh-hans && sudo sed -i '/^# *zh_CN.UTF-8 UTF-8/s/^# *//' /etc/locale.gen && locale-gen && source /etc/default/locale && apt-get autoremove -y

# 增加命令提示，修复环境
unminimize
```

### 配置时钟服务

```sh
vim /etc/chrony/chrony.conf

# 修改配置文件 sudo vim /etc/chrony/chrony.conf  ，添加如下行
server ntp.tencent.com minpoll 4 maxpoll 10 iburst
server ntp1.tencent.com minpoll 4 maxpoll 10 iburst
server ntp2.tencent.com minpoll 4 maxpoll 10 iburst
server ntp3.tencent.com minpoll 4 maxpoll 10 iburst
server ntp4.tencent.com minpoll 4 maxpoll 10 iburst
server ntp5.tencent.com minpoll 4 maxpoll 10 iburst
server ntp.aliyun.com minpoll 4 maxpoll 10 iburst
server ntp1.aliyun.com minpoll 4 maxpoll 10 iburst
server ntp2.aliyun.com minpoll 4 maxpoll 10 iburst
server ntp3.aliyun.com minpoll 4 maxpoll 10 iburst
server ntp4.aliyun.com minpoll 4 maxpoll 10 iburst
server ntp5.aliyun.com minpoll 4 maxpoll 10 iburst
server ntp6.aliyun.com minpoll 4 maxpoll 10 iburst
server ntp7.aliyun.com minpoll 4 maxpoll 10 iburst

# 重启服务刷新时间
systemctl restart chrony && chronyc makestep && chronyc tracking && systemctl status chrony.service
```

> - server ntp.tencent.com: 这是 NTP 服务器的域名。`chrony`将连接到这个服务器以获取时间同步。
> - minpoll: 这个参数指定了最小的轮询间隔（以 2 的幂为单位）。`minpoll 4`表示最小的轮询间隔为2^4=16秒。这意味着`chrony`至少每 16 秒就会与此服务器进行一次同步请求。
> - maxpoll: 这个参数指定了最大的轮询间隔。`maxpoll 10`表示最大的轮询间隔为2^10=1024秒。因此，`chrony`可能会将轮询间隔调整到 1024 秒，但不会低于 16 秒。
> - iburst: 这个选项是一个补充参数，用于加快初次同步过程。当`chrony`启动后，它会通过发送一组快速请求（通常是 8 个请求）来快速获取服务器的时间。在这个例子中，`iburst`会在启动后立即向`ntp.cloud.aliyuncs.com`发送多个请求，确保在短时间内迅速获得准确的时间

### 配置服务器DNS

> **所有五台机器都要配置**

- 如果服务器安装阶段已做好DNS配置则该步骤可以省略

```sh
sudo mkdir -p /etc/systemd/resolved.conf.d

sudo tee /etc/systemd/resolved.conf.d/dns.conf > /dev/null <<'EOF'
[Resolve]
DNS=180.184.1.1 223.5.5.5  114.114.114.114
FallbackDNS=223.6.6.6 180.184.2.2
Domains=~.
EOF

sudo systemctl restart systemd-resolved
```

## 通过KubeKey安装kubernetes

> **在k8smaster1进行配置**

### 安装KubeKey

```sh
export KKZONE=cn

curl -sfL https://get-kk.kubesphere.io | sh -

sudo chmod +x kk
```

### 生成和调整部署文件

> **在k8smaster1进行配置**

```sh
# 查看KubeKey支持的kubernetes版本
./kk version --show-supported-k8s

# 根据版本生成部署文件,命令执行完毕后将生成安装配置文件 config-sample.yaml
./kk create config --with-kubernetes v1.33.1
```

- 根据具体服务器信息调整部署文件

  ```yaml
  apiVersion: kubekey.kubesphere.io/v1alpha2
  kind: Cluster
  metadata:
    name: sample
  spec:
    hosts:
      - {
          name: k8smaster1,
          address: 192.168.100.20,
          internalAddress: 192.168.100.20,
          user: root,
          password: "Nextenso_33@2025",
        }
      - {
          name: k8smaster2,
          address: 192.168.100.21,
          internalAddress: 192.168.100.21,
          user: root,
          password: "Nextenso_33@2025",
        }
      - {
          name: k8smaster3,
          address: 192.168.100.22,
          internalAddress: 192.168.100.22,
          user: root,
          password: "Nextenso_33@2025",
        }
      - {
          name: k8sworker1,
          address: 192.168.100.23,
          internalAddress: 192.168.100.23,
          user: root,
          password: "Nextenso_33@2025",
        }
      - {
          name: k8sworker2,
          address: 192.168.100.24,
          internalAddress: 192.168.100.24,
          user: root,
          password: "Nextenso_33@2025",
        }
    roleGroups:
      etcd:
        - k8smaster1
        - k8smaster2
        - k8smaster3
      control-plane:
        - k8smaster1
        - k8smaster2
        - k8smaster3
      worker:
        - k8sworker1
        - k8sworker2
    controlPlaneEndpoint:
      internalLoadbalancer: haproxy
      domain: lb.kubesphere.local
      address: ""
      port: 6443
    kubernetes:
      version: v1.33.1
      clusterName: cluster.local
      autoRenewCerts: true
      containerManager: containerd
    etcd:
      type: kubekey
    network:
      plugin: calico
      kubePodsCIDR: 10.233.64.0/18
      kubeServiceCIDR: 10.233.0.0/18
      multusCNI:
        enabled: false
    registry:
      privateRegistry: "registry.cn-beijing.aliyuncs.com" # 使用 KubeSphere 在阿里云的镜像仓库
      namespaceOverride: "kubesphereio"
      registryMirrors: []
      insecureRegistries: []
    addons: []
    system:
      timezone: "Asia/Shanghai"
      ntpServers:
        - ntp.tencent.com
        - ntp1.tencent.com
        - ntp2.tencent.com
        - ntp3.tencent.com
        - ntp4.tencent.com
        - ntp5.tencent.com
        - ntp.aliyun.com
        - ntp1.aliyun.com
        - ntp2.aliyun.com
        - ntp3.aliyun.com
        - ntp4.aliyun.com
        - ntp5.aliyun.com
        - ntp6.aliyun.com
        - ntp7.aliyun.com
  ```

- 部署kubernetes

  ```sh
  # 开始部署
  ./kk create cluster -f config-sample.yaml

  # 部署完成
  kubectl get pod -A
  ```

## 安装helm

> **在k8smaster1进行配置**

- 链接地址

  [安装Helm](https://helm.sh/zh/docs/intro/install/)

- apt配置helm仓库

  ```sh
  curl https://baltocdn.com/helm/signing.asc | gpg --dearmor | sudo tee /usr/share/keyrings/helm.gpg > /dev/null

  apt-get install apt-transport-https --yes

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/helm.gpg] https://baltocdn.com/helm/stable/debian/ all main" | sudo tee /etc/apt/sources.list.d/helm-stable-debian.list

  apt-get update

  apt-get install helm

  helm version
  ```

## 在kubernetes安装KubeSphere

> **在k8smaster1进行部署**

```sh
helm upgrade --install -n kubesphere-system --create-namespace ks-core https://charts.kubesphere.com.cn/main/ks-core-1.1.4.tgz --debug --wait --set ksExtensionRepository.enabled=true --set global.imageRegistry=swr.cn-southwest-2.myhuaweicloud.com/ks --set extension.imageRegistry=swr.cn-southwest-2.myhuaweicloud.com/ks

# 提示以下信息代表安装成功
# NOTES:
# Thank you for choosing KubeSphere Helm Chart.
#
# Please be patient and wait for several seconds for the KubeSphere deployment to complete.
#
# 1. Wait for Deployment Completion
#
#     Confirm that all KubeSphere components are running by executing the following command:
#
#     kubectl get pods -n kubesphere-system
# 2. Access the KubeSphere Console
#
#     Once the deployment is complete, you can access the KubeSphere console using the following URL:
#
#     http://192.168.100.20:30880
#
# 3. Login to KubeSphere Console
#
#     Use the following credentials to log in:
#
#     Account: admin
#     Password: P@88w0rd

kubectl get pod -A
```

- 打开前端页面，输入默认的用户名、密码即可登录

## 安装KubeSphere插件中心和监控服务

> **在k8smaster1进行部署**

- 安装一个默认存储类

  ```sh
  # 添加 Helm 仓库
  helm repo add openebs-localpv https://openebs.github.io/dynamic-localpv-provisioner
  helm repo update

  # 安装 openebs-localpv
  helm upgrade --install openebs-localpv openebs-localpv/localpv-provisioner --namespace openebs --create-namespace --set hostpathClass.basePath="/data/openebs/local" --set global.imageRegistry="ccr.ccs.tencentyun.com" --set  localpv.image.repository="chijinjing/provisioner-localpv" --set  helperPod.image.repository="chijinjing/linux-utils"

  kubectl  -n openebs  get pods

  kubectl get sc

   # 将 openebs-hostpath 修改为默认存储类
  kubectl patch storageclass openebs-hostpath  -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'

  kubectl get sc
  ```

- 点击KubeSphere页面`扩展市场`安装 `WhizardTelemetry 平台服务`、`WhizardTelemetry 监控`、`KubeSphere 网络`

## 配置containerd镜像仓库和代理

> **所有五台机器都要配置**

- 修改 `/etc/containerd/config.toml` 文件，修改的时候使用toml格式化工具格式化后再修改
  - 修改前

    ```toml
    version = 2
    root = "/var/lib/containerd"

    state = "/run/containerd"

    [grpc]
      address = "/run/containerd/containerd.sock"
      uid = 0
      gid = 0
      max_recv_message_size = 16777216
      max_send_message_size = 16777216

    [ttrpc]
      address = ""
      uid = 0
      gid = 0

    [debug]
      address = ""
      uid = 0
      gid = 0
      level = ""

    [metrics]
      address = ""
      grpc_histogram = false

    [cgroup]
      path = ""

    [timeouts]
      "io.containerd.timeout.shim.cleanup" = "5s"
      "io.containerd.timeout.shim.load" = "5s"
      "io.containerd.timeout.shim.shutdown" = "3s"
      "io.containerd.timeout.task.state" = "2s"

    [plugins]
      [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc]
        runtime_type = "io.containerd.runc.v2"
        [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc.options]
          SystemdCgroup = true
      [plugins."io.containerd.grpc.v1.cri"]
        sandbox_image = "registry.cn-beijing.aliyuncs.com/kubesphereio/pause:3.9"
        [plugins."io.containerd.grpc.v1.cri".cni]
          bin_dir = "/opt/cni/bin"
          conf_dir = "/etc/cni/net.d"
          max_conf_num = 1
          conf_template = ""

    # 删除下面的内容，替换为镜像配置
        [plugins."io.containerd.grpc.v1.cri".registry]
            [plugins."io.containerd.grpc.v1.cri".registry.mirrors]
            [plugins."io.containerd.grpc.v1.cri".registry.mirrors."docker.io"]
              endpoint = ["https://registry-1.docker.io"]
    ```

  - 修改后

    ```toml
    version = 2
    root = "/var/lib/containerd"
    state = "/run/containerd"

    [grpc]
    address = "/run/containerd/containerd.sock"
    uid = 0
    gid = 0
    max_recv_message_size = 16_777_216
    max_send_message_size = 16_777_216

    [ttrpc]
    address = ""
    uid = 0
    gid = 0

    [debug]
    address = ""
    uid = 0
    gid = 0
    level = ""

    [metrics]
    address = ""
    grpc_histogram = false

    [cgroup]
    path = ""

    [timeouts]
    "io.containerd.timeout.shim.cleanup" = "5s"
    "io.containerd.timeout.shim.load" = "5s"
    "io.containerd.timeout.shim.shutdown" = "3s"
    "io.containerd.timeout.task.state" = "2s"

    [plugins."io.containerd.grpc.v1.cri"]
    sandbox_image = "registry.cn-beijing.aliyuncs.com/kubesphereio/pause:3.9"

    [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc]
    runtime_type = "io.containerd.runc.v2"

      [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc.options]
      SystemdCgroup = true

      [plugins."io.containerd.grpc.v1.cri".cni]
      bin_dir = "/opt/cni/bin"
      conf_dir = "/etc/cni/net.d"
      max_conf_num = 1
      conf_template = ""

    # 修改 plugins."io.containerd.grpc.v1.cri" 的配置
    [plugins."io.containerd.grpc.v1.cri".registry.mirrors."docker.io"]
    endpoint = [
      "https://docker.m.daocloud.io",
      "https://docker.tbedu.top",
      "https://docker.1ms.run",
      "https://ccr.ccs.tencentyun.com",
      "https://docker.xuanyuan.me",
      "https://docker.hlmirror.com",
    ]

    [plugins."io.containerd.grpc.v1.cri".registry.mirrors."docker.elastic.co"]
    endpoint = [ "elastic.m.daocloud.io" ]

    [plugins."io.containerd.grpc.v1.cri".registry.mirrors."gcr.io"]
    endpoint = [ "gcr.m.daocloud.io" ]

    [plugins."io.containerd.grpc.v1.cri".registry.mirrors."ghcr.io"]
    endpoint = [ "ghcr.m.daocloud.io" ]

    [plugins."io.containerd.grpc.v1.cri".registry.mirrors."k8s.gcr.io"]
    endpoint = [ "k8s-gcr.m.daocloud.io" ]

    [plugins."io.containerd.grpc.v1.cri".registry.mirrors."registry.k8s.io"]
    endpoint = [ "k8s.m.daocloud.io" ]

    [plugins."io.containerd.grpc.v1.cri".registry.mirrors."mcr.microsoft.com"]
    endpoint = [ "mcr.m.daocloud.io" ]

    [plugins."io.containerd.grpc.v1.cri".registry.mirrors."nvcr.io"]
    endpoint = [ "nvcr.m.daocloud.io" ]

    [plugins."io.containerd.grpc.v1.cri".registry.mirrors."quay.io"]
    endpoint = [ "quay.m.daocloud.io" ]

    [plugins."io.containerd.grpc.v1.cri".registry.configs."gwa.harbor.com".tls]
    insecure_skip_verify = true

    [plugins."io.containerd.grpc.v1.cri".registry.configs."gwa.harbor.com".auth]
    username = "admin"
    password = "Harbor12345"
    ```

- 测试命令

  ```sh
  crictl pull docker.io/hashicorp/consul:latest

  crictl pull gwa.harbor.com/base/x86/consul:latest

  crictl images
  ```

## 测试部署consul

> **在k8smaster1进行部署**

- `namespace.yaml`命名空间

  ```sh
  kubectl apply -f namespace.yaml
  ```

  ```yaml
  apiVersion: v1
  kind: Namespace
  metadata:
    name: sentinel
  ```

- `consul-configmap.yaml`配置文件

  ```sh
  kubectl apply -f configmap.yaml
  ```

  ```yaml
  apiVersion: v1
  kind: ConfigMap
  metadata:
    name: consul-config
    namespace: sentinel
  data:
    acl.hcl: |
      acl {
        enabled = true
        default_policy = "deny"
        enable_token_persistence = true
        tokens {
          initial_management = "U2FsdGVkX19lXDaNU3GsjbjA6BuryxIAQ9mNt6Im+Ds="
          agent = "U2FsdGVkX19lXDaNU3GsjbjA6BuryxIAQ9mNt6Im+Ds="
        }
      }

      telemetry {
        prometheus_retention_time = "24h"
        disable_hostname = true
      }
  ```

- `consul-svc.yaml`

  ```sh
  kubectl apply -f consul-svc.yaml
  ```

  ```yaml
  apiVersion: v1
  kind: Service
  metadata:
    # 服务名称
    name: consul-svc
    # 命名空间
    namespace: sentinel
  spec:
    clusterIP: None
    selector:
      app: consul
    ports:
      - name: http
        port: 8500
        targetPort: 8500
  ```

- `consul-pod.yaml`

  ```sh
  kubectl apply -f consul-pod.yaml
  ```

  ```yaml
  apiVersion: apps/v1
  kind: StatefulSet
  metadata:
    # pod名称
    name: consul
    namespace: sentinel
  spec:
    serviceName: consul
    replicas: 1
    selector:
      matchLabels:
        app: consul
    template:
      metadata:
        labels:
          app: consul
      spec:
        containers:
          - name: consul
            # 镜像
            image: gwa.harbor.com/base/x86/consul:latest
            imagePullPolicy: Always
            env:
              - name: CONSUL_BIND_INTERFACE
                value: eth0
            ports:
              - containerPort: 8500
                name: http
            volumeMounts:
              - name: consul-data
                mountPath: /consul/data
              - name: consul-config
                mountPath: /consul/config
            command:
              - consul
              - agent
              - "-server"
              - "-bootstrap-expect=1"
              - "-ui"
              - "-client=0.0.0.0"
              - "-data-dir=/consul/data"
              - "-encrypt=VfCslpz5ih8rZtbmbuZ4NTMBoUawCkn4WE1kMsb617Y="
              # pod名称-副本id.pod名称.命名空间.svc.cluster.local 副本id从0开始
              - "-config-dir=/consul/config"
        volumes:
          - name: consul-config
            configMap:
              name: consul-config

    volumeClaimTemplates:
      - metadata:
          name: consul-data
        spec:
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 1Gi
  ```

- `consul-ui.yaml`

  ```sh
  kubectl apply -f consul-ui.yaml
  ```

  ```yaml
  apiVersion: v1
  kind: Service
  metadata:
    # 服务名称
    name: consul-ui
    namespace: sentinel
  spec:
    type: NodePort
    selector:
      app: consul
    ports:
      - name: ui
        port: 8500
        targetPort: 8500
        # 主机访问端口 外部任一节点都可访问
        nodePort: 30001
  ```
