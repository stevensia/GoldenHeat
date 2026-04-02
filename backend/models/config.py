"""应用配置数据模型"""

import json
from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class AppConfig:
    """运行时配置 — 对应 app_config 表"""
    key: str
    value: str              # 存储为字符串
    type: str = "string"    # string / int / float / bool / json
    description: Optional[str] = None
    updated_at: Optional[str] = None

    def get_typed_value(self) -> Any:
        """根据 type 字段返回正确类型的值"""
        if self.type == "int":
            return int(self.value)
        elif self.type == "float":
            return float(self.value)
        elif self.type == "bool":
            return self.value.lower() in ("true", "1", "yes")
        elif self.type == "json":
            return json.loads(self.value)
        return self.value

    def to_dict(self) -> dict:
        return {
            "key": self.key,
            "value": self.get_typed_value(),
            "raw_value": self.value,
            "type": self.type,
            "description": self.description,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_row(cls, row) -> "AppConfig":
        keys = row.keys()
        return cls(
            key=row["key"],
            value=row["value"],
            type=row["type"] if "type" in keys else "string",
            description=row["description"] if "description" in keys else None,
            updated_at=row["updated_at"] if "updated_at" in keys else None,
        )
