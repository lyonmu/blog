---
title: "Ubuntu安装snmp服务"
pubDatetime: 2026-01-19T16:38:50+08:00
draft: false
description: "ubuntu 24.04 安装部署 snmp 供 prometheus 进行监控"
tags:
  - snmp
  - prometheus
  - ubuntu
---

## 安装软件包

```shell
# 安装软件包
sudo apt-get install -y snmpd snmp snmp-mibs-downloader && sudo download-mibs
```

## 配置服务

- 配置 **snmpd**

  ```shell
  # 编辑配置文件
  vim /etc/snmp/snmpd.conf

  # 开启任意 ip 皆可访问
  # agentaddress  127.0.0.1,[::1]

  # 配置开启的 OID
  # 	注释下面两行
  # view   systemonly  included   .1.3.6.1.2.1.1
  # view   systemonly  included   .1.3.6.1.2.1.25.1
  # 	新增下面这行 打开所有指标
  view systemonly included .1
  ```

- 配置 **snmp**

  ```shell
  # 编辑配置文件
  vim /etc/snmp/snmp.conf

  # 注释下面这行
  mibs :
  ```

## 配置开机自启与检查

```shell
# 配置服务开机自启
sudo systemctl restart snmpd && sudo systemctl enable --now snmpd && sudo systemctl status snmpd

# 通过 snmpwalk 获取所有 OID 指标
snmpwalk -v2c -c public 192.168.100.21  .1
```
