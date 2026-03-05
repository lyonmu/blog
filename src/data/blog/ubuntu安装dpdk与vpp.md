---
title: "Ubuntu安装dpdk与vpp"
pubDatetime: 2026-02-02T13:06:46+08:00
draft: false
description: "ubuntu 24.04 安装部署 dpdk 与 vpp"
layout: post
tags:
  - dpdk
  - vpp
  - ubuntu
---

# DPDK

DPDK 是一套用于快速数据包处理的库和驱动程序。

# 编译 DPDK

1. 克隆代码
   [DPDK](https://github.com/DPDK/dpdk)

2. 安装meson
   [meson](https://mesonbuild.cn/Getting-meson.html)

3. 执行命令编译
   [编译](https://doc.dpdk.org/guides-24.11/sample_app_ug/index.html)

```shell
meson -Dexamples=all build

ninja -C build
```

# VPP

VPP平台是一个可扩展的框架，提供开箱即用的生产级交换机/路由器功能。它是思科矢量数据包处理（VPP）技术的开源版本：一个可在通用CPU上运行的高性能数据包处理协议栈。
VPP 实现的优势在于其高性能、成熟的技术、模块化和灵活性以及丰富的功能集。
DPDK 是 VPP 性能的基石，VPP 是基于 DPDK 构建的高级网络应用框架。

## ubuntu 24.04 编译 VPP

```shell
git clone -b v2.0  https://github.com/intel/intel-ipsec-mb.git

cd intel-ipsec-mb && make -j $(nproc) && make install

echo "/usr/local/lib" | sudo tee /etc/ld.so.conf.d/ipsec-mb.conf && ldconfig

git clone https://github.com/FDio/vpp.git

cd vpp && git checkout v25.10 && git submodule update --init --recursive

make wipe && make install-deps && make build

# 制作安装包
make pkg-deb

# 安装
sudo dpkg -i build-root/*.deb
```

## VPP 接管网卡（DPDK 驱动绑定）

### 查看网卡信息

```shell
# 查看网卡
ip a show enp45s0

# 3: enp45s0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP group default qlen 1000
#     link/ether 84:47:09:32:5f:3f brd ff:ff:ff:ff:ff:ff
#     inet 192.168.8.100/24 brd 192.168.8.255 scope global enp45s0
#        valid_lft forever preferred_lft forever

# 查看网卡PCI信息
ethtool -i enp45s0
# driver: igc
# version: 6.8.0-87-generic
# firmware-version: 1057:8754
# expansion-rom-version:
# bus-info: 0000:2d:00.0
# supports-statistics: yes
# supports-test: yes
# supports-eeprom-access: yes
# supports-register-dump: yes
# supports-priv-flags: yes

# 查看网卡队列信息
ethtool -l enp45s0
# Channel parameters for enp45s0:
# Pre-set maximums:
# RX:             n/a
# TX:             n/a
# Other:          1
# Combined:       4
# Current hardware settings:
# RX:             n/a
# TX:             n/a
# Other:          1
# Combined:       4
```

## 修改VPP配置文件，配置网卡

- 修改前

```conf

unix {
  nodaemon
  log /var/log/vpp/vpp.log
  full-coredump
  cli-listen /run/vpp/cli.sock
  gid vpp

  ## run vpp in the interactive mode
  # interactive

  ## do not use colors in terminal output
  # nocolor

  ## do not display banner
  # nobanner
}

api-trace {
## This stanza controls binary API tracing. Unless there is a very strong reason,
## please leave this feature enabled.
  on
## Additional parameters:
##
## To set the number of binary API trace records in the circular buffer, configure nitems
##
## nitems <nnn>
##
## To save the api message table decode tables, configure a filename. Results in /tmp/<filename>
## Very handy for understanding api message changes between versions, identifying missing
## plugins, and so forth.
##
## save-api-table <filename>
}

api-segment {
  gid vpp
}

socksvr {
  default
}

# memory {
        ## Set the main heap size, default is 1G
        # main-heap-size 2G

        ## Set the main heap page size. Default page size is OS default page
        ## which is in most cases 4K. if different page size is specified VPP
        ## will try to allocate main heap by using specified page size.
        ## special keyword 'default-hugepage' will use system default hugepage
        ## size
        # main-heap-page-size 1G
        ## Set the default huge page size.
        # default-hugepage-size 1G
#}

cpu {
        ## In the VPP there is one main thread and optionally the user can create worker(s)
        ## The main thread and worker thread(s) can be pinned to CPU core(s) manually or automatically

        ## Manual pinning of thread(s) to CPU core(s)

        ## Set logical CPU core where main thread runs, if main core is not set
        ## VPP will use core 1 if available
        # main-core 1

        ## Set logical CPU core(s) where worker threads are running
        # corelist-workers 2-3,18-19

        ## Automatic pinning of thread(s) to CPU core(s)

        ## Sets number of CPU core(s) to be skipped (1 ... N-1)
        ## Skipped CPU core(s) are not used for pinning main thread and working thread(s).
        ## The main thread is automatically pinned to the first available CPU core and worker(s)
        ## are pinned to next free CPU core(s) after core assigned to main thread
        # skip-cores 4

        ## Specify a number of workers to be created
        ## Workers are pinned to N consecutive CPU cores while skipping "skip-cores" CPU core(s)
        ## and main thread's CPU core
        # workers 2

        ## Apply thread pinning configuration with respect to the logical cores available
        ## to VPP at launch, rather than all logical cores present on the host machine
        # relative

        ## Set scheduling policy and priority of main and worker threads

        ## Scheduling policy options are: other (SCHED_OTHER), batch (SCHED_BATCH)
        ## idle (SCHED_IDLE), fifo (SCHED_FIFO), rr (SCHED_RR)
        # scheduler-policy fifo

        ## Scheduling priority is used only for "real-time policies (fifo and rr),
        ## and has to be in the range of priorities supported for a particular policy
        # scheduler-priority 50
}

# buffers {
        ## Increase number of buffers allocated, needed only in scenarios with
        ## large number of interfaces and worker threads. Value is per numa node.
        ## Default is 16384 (8192 if running unpriviledged)
        # buffers-per-numa 128000

        ## Size of buffer data area
        ## Default is 2048
        # default data-size 2048

        ## Size of the memory pages allocated for buffer data
        ## Default will try 'default-hugepage' then 'default'
        ## you can also pass a size in K/M/G e.g. '8M'
        # page-size default-hugepage
# }

# dsa {
        ## DSA work queue address
        # dev wq0.0
        # dev wq0.1
# }

# dpdk {
        ## Change default settings for all interfaces
        # dev default {
                ## Number of receive queues, enables RSS
                ## Default is 1
                # num-rx-queues 3

                ## Number of transmit queues, Default is equal
                ## to number of worker threads or 1 if no workers treads
                # num-tx-queues 3

                ## Number of descriptors in transmit and receive rings
                ## increasing or reducing number can impact performance
                ## Default is 1024 for both rx and tx
                # num-rx-desc 512
                # num-tx-desc 512

                ## TCP Segment Offload
                ## Default is off
                ## To enable TSO, 'enable-tcp-udp-checksum' must be set
                # tso on

                ## Devargs
                ## device specific init args
                ## Default is NULL
                # devargs safe-mode-support=1,pipeline-mode-support=1

                ## rss-queues
                ## set valid rss steering queues
                # rss-queues 0,2,5-7
        # }

        ## Whitelist specific interface by specifying PCI address
        # dev 0000:02:00.0

        ## Blacklist specific device type by specifying PCI vendor:device
        ## Whitelist entries take precedence
        # blacklist 8086:10fb

        ## Set interface name
        # dev 0000:02:00.1 {
        #        name eth0
        # }

        ## Whitelist specific interface by specifying PCI address and in
        ## addition specify custom parameters for this interface
        # dev 0000:02:00.1 {
        #        num-rx-queues 2
        # }

        ## Set interface only in poll mode
        # dev 0000:02:00.1 {
        #       no-rx-interrupts
        # }

        ## Change UIO driver used by VPP, Options are: igb_uio, vfio-pci,
        ## uio_pci_generic or auto (default)
        # uio-driver vfio-pci

        ## Disable multi-segment buffers, improves performance but
        ## disables Jumbo MTU support
        # no-multi-seg

        ## Change hugepages allocation per-socket, needed only if there is need for
        ## larger number of mbufs. Default is 256M on each detected CPU socket
        # socket-mem 2048,2048

        ## Disables UDP / TCP TX checksum offload. Typically needed for use
        ## faster vector PMDs (together with no-multi-seg)
        # no-tx-checksum-offload

        ## Enable UDP / TCP TX checksum offload
        ## This is the reversed option of 'no-tx-checksum-offload'
        # enable-tcp-udp-checksum

        ## Enable/Disable AVX-512 vPMDs
        # max-simd-bitwidth <256|512>
# }

## node variant defaults
#node {

## specify the preferred default variant
#        default        { variant avx512 }

## specify the preferred variant, for a given node
#        ip4-rewrite { variant avx2 }

#}


# plugins {
        ## Adjusting the plugin path depending on where the VPP plugins are
        #        path /ws/vpp/build-root/install-vpp-native/vpp/lib/vpp_plugins
        ## Add additional directory to the plugin path
        #        add-path /tmp/vpp_plugins

        ## Disable all plugins by default and then selectively enable specific plugins
        # plugin default { disable }
        # plugin dpdk_plugin.so { enable }
        # plugin acl_plugin.so { enable }

        ## Enable all plugins by default and then selectively disable specific plugins
        # plugin dpdk_plugin.so { disable }
        # plugin acl_plugin.so { disable }
# }

## Statistics Segment
# statseg {
    # socket-name <filename>, name of the stats segment socket
    #     defaults to /run/vpp/stats.sock
    # size <nnn>[KMG], size of the stats segment, defaults to 32mb
    # page-size <nnn>, page size, ie. 2m, defaults to 4k
    # per-node-counters on | off, defaults to none
    # update-interval <f64-seconds>, sets the segment scrape / update interval
# }

## L3 FIB
# l3fib {
    ## load balance pool size preallocation (expected number of objects)
    # load-balance-pool-size 1M

    ## fib entry pool size preallocation (expected number of objects)
    # fib-entry-pool-size 1M

    ## ip4 mtrie pool size preallocation (expected number of mtries)
    # ip4-mtrie-pool-size 1K
# }

## L2 FIB
# l2fib {
    ## l2fib hash table size.
    #  table-size 512M

    ## l2fib hash table number of buckets. Must be power of 2.
    #  num-buckets 524288
# }

## ipsec
# {
   # ip4 {
   ## ipsec for ipv4 tunnel lookup hash number of buckets.
   #  num-buckets 524288
   # }
   # ip6 {
   ## ipsec for ipv6 tunnel lookup hash number of buckets.
   #  num-buckets 524288
   # }
# }

# logging {
   ## set default logging level for logging buffer
   ## logging levels: emerg, alert,crit, error, warn, notice, info, debug, disabled
   # default-log-level debug
   ## set default logging level for syslog or stderr output
   # default-syslog-log-level info
   ## Set per-class configuration
   # class dpdk/cryptodev { rate-limit 100 level debug syslog-level error }
# }

```

- 修改后

```conf
unix {
    # 以交互模式运行，不作为守护进程
    nodaemon
    interactive

    # VPP CLI 使用的套接字
    cli-listen /run/vpp/cli.sock

    # 组ID（示例）
    gid vpp
}

cpu {
    # 避免使用核心0，并将VPP主进程放在核心1上
    skip-cores 0
    main-core 1

    # 设置工作线程运行的逻辑CPU核心。为性能测试，确保核心与NIC位于同一NUMA节点。
    # 使用lscpu确定CPU的NUMA，使用"sh hardware"在VPP CLI中确定NIC的NUMA。
    # 配置多个工作线程时，可以使用列表形式，例如：corelist-workers 2-4,6
    corelist-workers 2
}

buffers {
    # 默认值为16384（非特权运行时为8192）
    buffers-per-numa 16384
}

dpdk {
    # 说明：
    # - 假设只使用一个NIC
    # - PCI地址是示例，实际应使用dpdk_devbind.py查找（https://github.com/DPDK/dpdk/blob/main/usertools/dpdk-devbind.py）
    # - RX队列数量（num-rx-queues）应等于工作线程数量
    dev 0000:2d:00.0 {
        name enp45s0
        num-tx-desc 256     # TX队列描述符数量
        num-rx-desc 256     # RX队列描述符数量
        num-rx-queues 1     # RX队列数量
    }
}

session {
        # 使用VPP会话层套接字API进行VCL附加
        use-app-socket-api
        # 启用VPP会话层
        enable
        # VPP工作线程的消息队列长度
        event-queue-length 100000
}

# plugins {
#     plugin default { disable }    # 默认禁用所有插件
#         plugin dpdk_plugin.so { enable } # 启用 DPDK 插件
# }
```

## 关闭网卡，VPP 接管网卡

```shell
# 关闭网卡
sudo ip link set enp45s0 down
# 卸载原有内核驱动
echo 0000:2d:00.0 | sudo tee /sys/bus/pci/drivers/igc/unbind

# 重启 VPP
sudo systemctl restart vpp && sudo systemctl status vpp

# 启动网卡
sudo vppctl set int state enp45s0 up

# 查看网卡信息
sudo vppctl show interface
# Name               Idx    State  MTU (L3/IP4/IP6/MPLS)     Counter          Count
# enp45s0                           1      up          9000/0/0/0     rx packets                 33010
#                                                                     rx bytes                 4541322
#                                                                     drops                      32529
#                                                                     punt                         481
#                                                                     ip4                         5400
#                                                                     ip6                         5631
# local0                            0     down          0/0/0/0
```

## 网卡设置 IP 地址信息

```shell
# 设置 IP 地址信息
vppctl set interface ip address enp45s0 192.168.8.100/24

# 查看 IP 地址信息
vppctl show interface addr

# 简单 ping 测试
vppctl ping 192.168.8.24
# 116 bytes from 192.168.8.24: icmp_seq=2 ttl=64 time=4.2544 ms
# 116 bytes from 192.168.8.24: icmp_seq=3 ttl=64 time=7.5716 ms
# 116 bytes from 192.168.8.24: icmp_seq=4 ttl=64 time=1.3911 ms
# 116 bytes from 192.168.8.24: icmp_seq=5 ttl=64 time=4.4874 ms
#
# Statistics: 5 sent, 4 received, 20% packet loss
```
