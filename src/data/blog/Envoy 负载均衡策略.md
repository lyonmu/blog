---
title: "Envoy 负载均衡策略"
pubDatetime: 2026-06-07T10:30:00+08:00
draft: false
description: "整理 Envoy 常见负载均衡策略，包括 Round Robin、Least Request、Ring Hash、Random、Maglev 和扩展策略。"
tags:
  - envoy
  - 负载均衡
  - 网络代理
---

## 背景

Envoy 的 cluster 通过 `lb_policy` 或新的 `load_balancing_policy` 字段选择负载均衡
策略。不同策略的差异不仅是“怎么选一个 upstream”，还会影响请求长尾、缓存命中、
会话保持、扩缩容抖动和 CPU 开销。

Envoy v3 API 中常见的枚举大致如下：

```go
// Refer to :ref:`load balancer type <arch_overview_load_balancing_types>` architecture
// overview section for information on each type.
type Cluster_LbPolicy int32

const (
	// Refer to the :ref:`round robin load balancing
	// policy<arch_overview_load_balancing_types_round_robin>`
	// for an explanation.
	Cluster_ROUND_ROBIN Cluster_LbPolicy = 0
	// Refer to the :ref:`least request load balancing
	// policy<arch_overview_load_balancing_types_least_request>`
	// for an explanation.
	Cluster_LEAST_REQUEST Cluster_LbPolicy = 1
	// Refer to the :ref:`ring hash load balancing
	// policy<arch_overview_load_balancing_types_ring_hash>`
	// for an explanation.
	Cluster_RING_HASH Cluster_LbPolicy = 2
	// Refer to the :ref:`random load balancing
	// policy<arch_overview_load_balancing_types_random>`
	// for an explanation.
	Cluster_RANDOM Cluster_LbPolicy = 3
	// Refer to the :ref:`Maglev load balancing policy<arch_overview_load_balancing_types_maglev>`
	// for an explanation.
	Cluster_MAGLEV Cluster_LbPolicy = 5
	// This load balancer type must be specified if the configured cluster provides a cluster
	// specific load balancer. Consult the configured cluster's documentation for whether to set
	// this option or not.
	Cluster_CLUSTER_PROVIDED Cluster_LbPolicy = 6
	// Use the new :ref:`load_balancing_policy
	// <envoy_v3_api_field_config.cluster.v3.Cluster.load_balancing_policy>` field to determine the LB policy.
	// This has been deprecated in favor of using the :ref:`load_balancing_policy
	// <envoy_v3_api_field_config.cluster.v3.Cluster.load_balancing_policy>` field without
	// setting any value in :ref:`lb_policy<envoy_v3_api_field_config.cluster.v3.Cluster.lb_policy>`.
	Cluster_LOAD_BALANCING_POLICY_CONFIG Cluster_LbPolicy = 7
)
```

## 策略概览

| 策略                         | 复杂度     | 是否感知负载 | 是否适合稳定映射 | 典型场景                         |
| ---------------------------- | ---------- | ------------ | ---------------- | -------------------------------- |
| Round Robin                  | O(1)       | 否           | 否               | 实例规格一致、请求耗时均匀       |
| Least Request                | O(1)       | 是           | 否               | 大多数无状态微服务调用           |
| Ring Hash                    | O(log N)   | 否           | 是               | 缓存、会话保持、有状态路由       |
| Random                       | O(1)       | 否           | 否               | 超大规模且要求简单的集群         |
| Maglev                       | O(1)       | 否           | 是               | 节点稳定、追求一致性哈希查找性能 |
| Cluster Provided             | 取决于实现 | 取决于实现   | 取决于实现       | 上游 cluster 自己决定负载均衡    |
| Load Balancing Policy Config | 取决于配置 | 取决于配置   | 取决于配置       | 复杂策略组合或扩展策略           |

## Round Robin

Round Robin 是最基础的轮询策略，复杂度是 O(1)。Envoy 维护一个游标，按 endpoint
列表顺序依次分发请求。

它支持权重。如果实例 A 的权重是 100，实例 B 的权重是 50，请求分发比例会接近
2:1。

适用场景：

- 后端实例规格基本一致；
- 请求处理耗时比较均匀；
- 不需要感知实时负载。

缺点也很明显：Round Robin 不知道后端是否变慢。只要节点仍然健康，它就会继续把
请求发过去。如果某台机器处理变慢但还没有被健康检查摘除，可能造成队头阻塞，并
进一步恶化该节点。

## Least Request

Least Request 常被理解为“选择当前请求数最少的节点”，但 Envoy 并不会遍历所有节点
寻找最小值。那样是 O(N)，在大规模集群下成本太高。

Envoy 使用的是 P2C（Power of Two Choices）思想：随机选择两个健康节点，比较它们
的 active requests，然后选择较少的那个。它的复杂度是 O(1)，但效果明显优于纯随机，
并且非常接近全局最优。

适用场景：

- 大多数无状态微服务调用；
- 请求耗时差异较大；
- 有长尾请求，希望尽量降低慢节点上的堆积。

在生产环境中，Least Request 往往比 Round Robin 更适合作为默认策略，尤其是后端
请求耗时不稳定时。

## Ring Hash

Ring Hash 是一致性哈希策略，查找复杂度通常是 O(log N)。Envoy 基于 Ketama 思路，
把节点映射到哈希环上，再把请求 key 映射到环上，顺时针选择最近的节点。

它的核心优势是减少扩缩容时的 key 漂移。节点变化时，只有一部分 key 会重新映射，
大部分缓存仍然有效。

适用场景：

- Redis、Memcached 等缓存服务；
- 需要会话保持的有状态服务；
- 需要根据 header、cookie、源 IP 等 key 做稳定路由。

使用 Ring Hash 时必须配置 hash policy。否则 Envoy 不知道应该用什么字段作为 key。

## Random

Random 是纯随机选择一个健康节点，复杂度是 O(1)。

它的实现简单，适合非常大的 endpoint 集合，或者维护轮询状态、请求计数在极端场景
下可能成为瓶颈的情况。不过在多数生产场景里，它通常不如 Least Request 稳定。

适用场景：

- 超大规模集群；
- 对负载均匀性的要求不高；
- 希望策略足够简单，且不依赖请求状态。

## Maglev

Maglev 是另一种一致性哈希策略，来源于 Google 的 Maglev 论文。它不使用哈希环，而
是构建固定大小的查找表，默认表大小常见为 65537 个槽位。

相比 Ring Hash，Maglev 查找复杂度是 O(1)，查找速度更快，并且节点变化时能提供更
均匀的分布。

它的代价是建表成本更高。当 endpoint 列表频繁变化时，重建查找表会带来额外计算
开销。

适用场景：

- 追求极致查找性能；
- 后端节点列表相对稳定；
- 需要一致性哈希，但希望分布更均匀。

如果后端经常扩缩容或健康状态频繁变化，Ring Hash 往往更容易控制成本。

## Cluster Provided

`CLUSTER_PROVIDED` 是一个特殊标记，表示 Envoy 不负责具体负载均衡决策，而是依赖
上游 cluster 自身的机制。

它通常用于接入某些特定类型的 cluster，或者需要由上游系统自己完成分片、路由和
选择的场景。普通服务调用一般很少手动配置这个策略。

## Load Balancing Policy Config

`LOAD_BALANCING_POLICY_CONFIG` 是 Envoy v3 API 引入的扩展方式。它表示不再只依赖
枚举值，而是通过 `load_balancing_policy` 字段读取更详细的策略配置。

它适合更复杂的策略组合，例如：

- 先按 locality 做区域优先或区域权重；
- 再在局部范围内使用 Least Request；
- 接入自定义或扩展的负载均衡策略。

从长期看，`load_balancing_policy` 是更灵活的配置方式。

## 策略选择建议

可以按场景快速判断：

- 普通无状态服务：优先考虑 Least Request。
- 请求耗时非常均匀、实例规格一致：Round Robin 足够简单。
- 缓存、会话保持、有状态路由：使用 Ring Hash 或 Maglev。
- 节点稳定且追求查找性能：Maglev 更合适。
- 节点变化频繁且希望控制重建成本：Ring Hash 更稳。
- 极端大规模且要求简单：可以考虑 Random。

负载均衡策略没有绝对最优。真正的选择取决于请求耗时分布、服务是否有状态、endpoint
变化频率，以及是否需要稳定的 key 到节点映射。
