---
title: "Envoy 的线程模型"
pubDatetime: 2026-06-07T10:20:00+08:00
draft: false
description: "整理 Envoy main thread、worker thread、file flush thread 的职责，以及连接处理和 TLS 配置分发模型。"
tags:
  - envoy
  - 线程
  - 网络代理
---

## 背景

Envoy 是一个高性能 L4/L7 代理。理解它的线程模型，有助于判断连接池数量、
`--concurrency` 参数、配置更新，以及 access log 写入为什么会这样设计。

Envoy 的线程大致可以分成三类：main thread、worker thread 和 file flush
thread。

## 相关链接

[Envoy threading model](https://blog.envoyproxy.io/envoy-threading-model-a8d44b922310)

## 文章主线

这篇文章主要回答三个问题：

1. Envoy 为什么能把大多数数据面代码写得像单线程程序？
2. 连接一旦进入某个 worker 后，为什么基本不会再跨线程移动？
3. `--concurrency` 为什么会影响连接池数量、内存占用和上游连接复用？

## Main Thread

main thread 负责进程级管理工作，包括：

- 和 xDS Server 通信；
- 刷新统计信息；
- 处理 admin 接口；
- 管理监听器、集群、运行时等控制面状态。

main thread 中的工作基本都是异步、非阻塞的。它负责的功能通常也不会消耗大量
CPU，所以 Envoy 可以用单个 main thread 完成进程管理。

## Worker Thread

worker thread 的数量可以通过 `--concurrency` 选项控制。

每个 worker thread 本质上都是一个非阻塞事件循环，负责监听端口、accept 连接，
并在连接生命周期内处理所有请求。连接一旦被某个 worker 接受，后续的读取、写入、
过滤器处理、路由和转发都留在这个 worker 内部完成。

这种设计让大多数连接处理代码可以像单线程代码一样编写，避免大量锁竞争。不过它
也可能带来连接不均衡：某些 worker 可能比其他 worker 持有更多长连接。

## File Flush Thread

Envoy 写入的每个文件通常都有独立的 flush 线程，典型场景是 access log。

原因是写入操作系统文件缓存时，即使使用了 `O_NONBLOCK`，也仍然可能阻塞。为了
避免 worker thread 被文件 I/O 卡住，Envoy 会先把日志内容写入内存缓冲区，再由
flush thread 刷新到文件。

## 连接处理方式

所有 worker thread 都监听所有 listener，Envoy 并不会提前对 listener 做线程分片。
内核负责把已接受的套接字分派给不同 worker。现代内核通常能较好地处理这种模型：
它会尽量完成当前线程上的 accept 工作，再考虑其他监听同一套接字的线程。

连接被某个 worker 接受后，就不会离开该 worker。这个模型会带来几个重要影响：

- Envoy 的连接池按 worker thread 划分。比如 HTTP/2 连接池对每个上游主机通常只
  建立一个连接，但如果有 4 个 worker，那么稳定状态下每个上游主机可能有 4 条
  HTTP/2 连接。
- 大量代码可以在不加锁的前提下运行，因为连接生命周期内的数据基本只在同一个
  worker 上访问。
- `--concurrency` 不是越大越好。worker 过多会增加内存占用、空闲连接数量，并降低
  连接池命中率。

## Thread Local Storage

main thread 负责控制面状态，而 worker thread 负责数据面转发。常见需求是：main
thread 从 xDS 获取新配置后，把配置更新到每个 worker，并且 worker 在读取配置时
不需要每次都加锁。

Envoy 通过 TLS（Thread Local Storage）完成这件事。可以把它理解为一组 slot：

- main thread 可以分配进程范围内的 TLS slot，本质上类似一个支持 O(1) 访问的向量
  索引；
- main thread 可以把数据写入 slot，并把更新作为事件投递到每个 worker thread；
- worker thread 从自己的线程本地 slot 中读取数据，因此读路径不需要跨线程加锁。

这里的 TLS 不是加密里的 Transport Layer Security，而是 Thread Local Storage。
它解决的是配置分发后的并发访问问题。

## 小结

Envoy 的线程模型核心是：main thread 管控制面，worker thread 管连接生命周期，
file flush thread 隔离文件 I/O。连接一旦进入某个 worker，就尽量在这个 worker
内部完成全部处理。

这种设计牺牲了一部分全局均衡性，但换来了更少的锁、更简单的数据面代码，以及很强
的水平扩展能力。实际部署时，`--concurrency` 需要结合 CPU、连接数、上游连接池和
内存占用一起评估。

如果只记一个结论：Envoy 的性能模型不是“所有线程共享所有状态”，而是尽量把连接
生命周期固定在一个 worker 内，再通过 TLS 把控制面配置安全地分发到各个 worker。
