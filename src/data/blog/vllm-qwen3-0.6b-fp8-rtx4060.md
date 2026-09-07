---
title: "RTX 4060 8GB 部署 Qwen3-0.6B-FP8：vLLM 启动与显存调优"
pubDatetime: 2026-09-07T00:00:00+08:00
description: "面向 RTX 4060 8GB 的 Qwen3-0.6B-FP8 本地部署指南，使用 vLLM 完成环境准备、模型下载和 API 验证，并梳理上下文长度、并发、CUDA Graphs 与显存不足的排查方法。"
tags:
  - llm
  - vllm
  - qwen3
  - fp8
  - gpu
draft: false
---

## 模型选择与显存预期

[Qwen3-0.6B-FP8 官方模型卡](https://huggingface.co/Qwen/Qwen3-0.6B-FP8)说明，该模型约有 6 亿参数，支持思考与非思考模式，采用块大小为 128 的细粒度 FP8 量化。它用于文本生成，不能替代 OCR 或视觉语言模型处理图片。

模型能否运行，还取决于精度、上下文、并发、推理框架和其他进程占用。一次视觉模型启动失败，也不能直接推导出文本模型的参数量上限。

可以先用下面的关系理解显存去向：

```text
运行显存 ≈ 模型权重 + KV Cache + 中间张量与工作区 + 框架运行开销
```

按每个参数 1 字节粗算，6 亿参数约为 0.6 GB，但这只是理想化的权重估算。部分张量可能保留更高精度，量化元数据、KV Cache 和运行时开销也要占用显存，不能将其视为实际显存需求。

FP8 权重也不意味着 KV Cache 自动使用 FP8。先使用默认缓存精度，确认能够正常推理后再做进一步优化。

## 准备运行环境

本文命令面向 Linux、单张 NVIDIA GPU，并假设已经安装 Conda 和 NVIDIA 驱动。先检查显卡型号、驱动与空闲显存：

```sh
nvidia-smi
```

如果此处报错，应先解决驱动或设备访问问题。`nvidia-smi` 显示的 CUDA Version 表示驱动支持的 CUDA 版本，不等同于当前 Python 环境中 PyTorch 使用的 CUDA 运行时版本。

### 创建独立 Python 环境

```sh
conda create -n qwen3-vllm python=3.12 -y
conda activate qwen3-vllm

python -m pip install --upgrade pip
python -m pip install vllm modelscope
python -m pip check
```

[vLLM GPU 安装文档](https://docs.vllm.ai/en/latest/getting_started/installation/gpu/)建议使用全新环境，避免已有 PyTorch、CUDA 构建与 vLLM 的二进制依赖冲突。Conda 在这里仅负责创建 Python 环境，不另外安装 Conda 版 PyTorch；驱动要求应按实际安装的 vLLM wheel 核对。

安装后记录实际版本，并检查 GPU 是否对 PyTorch 可见：

```sh
python - <<'PY'
import torch
import vllm

print("vLLM:", vllm.__version__)
print("PyTorch:", torch.__version__)
print("PyTorch CUDA:", torch.version.cuda)
print("CUDA available:", torch.cuda.is_available())
if not torch.cuda.is_available():
    raise SystemExit("CUDA is unavailable; check the driver and Python environment")
print("GPU:", torch.cuda.get_device_name(0))
print("Compute capability:", torch.cuda.get_device_capability(0))
PY

python -m pip freeze > requirements-qwen3-vllm.txt
```

RTX 4060 属于 Ada 架构，但具体 FP8 内核是否可用仍受软件版本影响。遇到量化或内核错误时，应结合计算能力与错误日志核对 [Qwen 的 vLLM 量化部署说明](https://qwen.readthedocs.io/en/latest/deployment/vllm.html#serving-quantized-models)。

## 下载模型

统一使用 `Qwen/Qwen3-0.6B-FP8`，下载目录与后续启动路径保持一致：

```sh
mkdir -p "$HOME/models"

modelscope download \
  --model Qwen/Qwen3-0.6B-FP8 \
  --local_dir "$HOME/models/Qwen3-0.6B-FP8"
```

模型来自 [ModelScope 的 Qwen3-0.6B-FP8 仓库](https://modelscope.cn/models/Qwen/Qwen3-0.6B-FP8)。请完整下载模型目录，保留权重、配置与 tokenizer 相关文件。

可以先查看配置中的模型类型和量化信息，排除下载了其他模型的情况：

```sh
python - <<'PY'
import json
from pathlib import Path

model_dir = Path.home() / "models" / "Qwen3-0.6B-FP8"
config = json.loads((model_dir / "config.json").read_text())
print("Model directory:", model_dir)
print("Model type:", config.get("model_type"))
print("Quantization:", config.get("quantization_config"))
PY
```

## 使用 vLLM 启动服务

首次运行采用 2048 token 上下文、单序列并发和 eager 模式，减少同时变化的参数：

```sh
conda activate qwen3-vllm

vllm serve "$HOME/models/Qwen3-0.6B-FP8" \
  --served-model-name qwen3-0.6b-fp8 \
  --gpu-memory-utilization 0.75 \
  --enforce-eager \
  --max-num-seqs 1 \
  --max-model-len 2048 \
  --port 8000 \
  --host 127.0.0.1
```

Shell 续行符 `\` 必须位于行尾，后面不能再添加注释或空格。参数说明单独写在下面，避免复制后出现 `command not found` 或参数丢失。

| 参数                       | 本文取值         | 用途                                                     |
| -------------------------- | ---------------- | -------------------------------------------------------- |
| `--served-model-name`      | `qwen3-0.6b-fp8` | 为 API 设置固定模型别名，客户端无需填写磁盘路径          |
| `--gpu-memory-utilization` | `0.75`           | 为当前模型执行器设置显存预算比例，不是 GPU 算力使用率    |
| `--enforce-eager`          | 开启             | 禁用 CUDA Graphs，便于建立较保守的启动基线，可能牺牲性能 |
| `--max-num-seqs`           | `1`              | 限制一次迭代处理的最大序列数，先验证单请求               |
| `--max-model-len`          | `2048`           | 限制单条序列的总长度，包含输入与输出 token               |
| `--host`                   | `127.0.0.1`      | 仅监听本机，适合本地测试                                 |

参数语义以 [vLLM Engine Arguments](https://docs.vllm.ai/en/latest/configuration/engine_args/) 为准，并可使用 `vllm serve --help` 核对当前安装版本。

`0.75` 对 8GiB 显存约对应 6GiB 的预算，但不是整个进程绝不超出的硬隔离限制，也不会主动清理其他程序占用。模型权重、缓存和运行开销仍需实际容纳在可用空间内。

如需局域网访问，再将监听地址改为 `0.0.0.0`，并配置访问控制与 API 认证。

### 为什么先移除额外调优参数

原笔记同时设置了注意力后端、FP8 环境变量和缓存块覆盖参数。本文先让 vLLM 自动选择兼容的执行方式：

- 不强制指定 `FLASH_ATTN`，避免把模型启动问题与后端兼容问题混在一起。
- 不将 `VLLM_FP8_PADDING`、`VLLM_FP8_TUNE` 作为必要条件；使用前应确认安装版本确实支持这些变量。
- 不手动覆盖 `--num-gpu-blocks-override`，优先使用自动显存分析。
- 不设置 `--block-size 8`。该选项控制 KV Cache 的 token 块，与模型 FP8 量化的 128 元素分块不是同一概念。

如果当前终端继承了旧的调优变量，先查看 `env | sort` 中相关配置，清理自己先前设置的覆盖项，或在新的干净终端中启动，避免它们继续影响结果。

## 验证 API

保持服务终端运行，在另一个终端查询模型列表：

```sh
curl --fail-with-body http://127.0.0.1:8000/v1/models
```

返回的模型列表应包含 `qwen3-0.6b-fp8`。服务尚在加载权重或初始化时，请先等待启动完成。

然后发送一个简短的聊天请求：

```sh
curl --fail-with-body http://127.0.0.1:8000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen3-0.6b-fp8",
    "messages": [
      {"role": "user", "content": "请用三句话解释 Kubernetes 中 Pod 的作用。"}
    ],
    "max_tokens": 256,
    "temperature": 0.7,
    "top_p": 0.8,
    "top_k": 20,
    "chat_template_kwargs": {"enable_thinking": false}
  }'
```

这里先关闭思考模式，以便用短输出验证链路。`chat_template_kwargs` 是 vLLM 的扩展参数，其用法见 [Qwen 思考模式切换文档](https://qwen.readthedocs.io/en/latest/deployment/vllm.html#thinking-non-thinking-modes)。

检查响应中的 `choices[0].message.content` 是否包含有效回答，并结合 `usage` 查看 token 数。若 `finish_reason` 为 `length`，通常表示生成触及长度限制，不能直接判定模型故障。

在 `--max-model-len 2048` 下，提示词、聊天模板以及最多 256 个输出 token 都要计入长度预算。输入更长时，应减少输出上限或调整上下文设置。

## 显存不足时如何排查

先保留服务端完整日志，区分失败发生在加载权重、初始化缓存还是处理请求阶段。另开终端观察显存：

```sh
watch -n 1 nvidia-smi
```

| 现象                    | 优先检查                                                         |
| ----------------------- | ---------------------------------------------------------------- |
| 启动提示空闲显存不足    | 查看其他进程和桌面环境占用；必要时降低预算比例，为其他程序留空间 |
| 权重加载阶段 OOM        | 核对实际模型路径与精度，检查是否误用了更大的模型                 |
| KV Cache 空间不足       | 先降低上下文长度；若物理空闲显存充足，再考虑提高预算比例         |
| 单请求正常，多请求失败  | 降低并发，比较每个请求的输入和输出长度                           |
| FP8 内核或算子报错      | 核对 GPU、vLLM、PyTorch 与 CUDA 组合，不能只调整显存比例         |
| HTTP 请求提示模型不存在 | 让请求中的 `model` 与 `--served-model-name` 完全一致             |

降低 `--gpu-memory-utilization` 并不总能解决 OOM：它能减小预留预算，也可能让 KV Cache 更不够用。应根据错误阶段决定调整方向。

## 从可用配置逐步调优

单请求验证通过后，每次只改一个变量，并重复同一组输入进行对比：

1. 将 `--max-num-seqs` 从 `1` 提高到 `2`、`4`，有余量再尝试原笔记中的 `8`，使用实际并发请求验证。
2. 有长文本需求时，将 `--max-model-len` 从 `2048` 提高到 `4096`，重新观察缓存容量和延迟。
3. 在显存有余量时移除 `--enforce-eager`，对比图模式是否带来收益。
4. 记录 GPU、驱动、软件版本、模型来源与 revision、启动参数、输入输出长度、并发数和峰值显存。

不要只以“启动成功”判断配置可用。还应确认代表性请求能稳定完成，输出内容符合预期，且重复请求没有持续报错。本文不提供未经测量的 tokens/s 或峰值显存数字；完成目标机器验证后，可将这些数据补入部署记录。
