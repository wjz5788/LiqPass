#!/bin/bash

# jp-verify 启动脚本

echo "启动 jp-verify 服务..."

# 检查 Python 环境
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到 python3，请先安装 Python 3.8+"
    exit 1
fi

# 创建并激活虚拟环境
if [ ! -d ".venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv .venv
fi

source .venv/bin/activate

# 检查依赖
if [ ! -f "requirements.txt" ]; then
    echo "错误: 未找到 requirements.txt"
    exit 1
fi

# 安装依赖
echo "安装 Python 依赖..."
pip install -r requirements.txt

# 启动服务
echo "执行环境检查..."
export EVIDENCE_DIR=${EVIDENCE_DIR:-reports/evidence}
export JP_VERIFY_TEST_MODE=${JP_VERIFY_TEST_MODE:-1}
python env_check.py || exit $?

echo "启动服务在端口 8082..."
export EVIDENCE_DIR=${EVIDENCE_DIR:-reports/evidence}
export JP_VERIFY_TEST_MODE=${JP_VERIFY_TEST_MODE:-1}
python main.py
