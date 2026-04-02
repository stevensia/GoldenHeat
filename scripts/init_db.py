#!/usr/bin/env python3
"""初始化 GoldenHeat 数据库"""

import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from backend.db.connection import init_db

if __name__ == "__main__":
    init_db()
