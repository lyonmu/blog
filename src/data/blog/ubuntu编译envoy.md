---
title: "Ubuntu编译envoy"
pubDatetime: 2026-01-19T16:53:13+08:00
draft: false
description: "ubuntu 24.04 编译 envoy"
tags:
  - envoy
  - ubuntu
---

## 相关链接

基于 v.136.2
[envoy](https://github.com/envoyproxy/envoy/blob/main/bazel/README.md#quick-start-bazel-build-for-developers)

[bazelisk](https://github.com/bazelbuild/bazelisk/releases/tag/v1.28.0)

## 安装依赖

```shell
sudo dpkg -i bazelisk-amd64.deb

sudo apt-get install -y autoconf curl libtool patch unzip llvm-18 clang-18 libc++-18-dev libc++abi-18-dev lld
```

## 编译

- 在 envoy 代码根目录下新建 user.bazelrc文件，增加编译配置

  ```shell
  # 使用 Clang 18 编译
  build --config=clang
  build --action_env=CC=/usr/bin/clang-18
  build --action_env=CXX=/usr/bin/clang++-18

  # 优化构建与体积
  build -c opt
  build --strip=always
  build --config=sizeopt
  build --define envoy=lite
  build --define deprecated_features=disabled
  ```

- 编译命令

  ```shell
  # 根据配置进行编译
  bazel build //source/exe:envoy-static.stripped

  # 祛除符号链接
  strip ./envoy-static
  ```
