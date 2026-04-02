"""运行时配置 Repository"""

from typing import Any, Optional

from backend.models.config import AppConfig
from backend.repos.base import BaseRepository


class ConfigRepo(BaseRepository):
    table = "app_config"

    def get(self, key: str) -> Optional[AppConfig]:
        """获取配置项"""
        row = self.raw_query_one(
            "SELECT * FROM app_config WHERE key = ?", (key,)
        )
        return AppConfig.from_row(row) if row else None

    def get_value(self, key: str, default: Any = None) -> Any:
        """获取配置值（自动类型转换）"""
        config = self.get(key)
        if config is None:
            return default
        return config.get_typed_value()

    def set(self, key: str, value: Any, type: str = "string", description: str = "") -> int:
        """设置配置项"""
        return self.upsert(
            {
                "key": key,
                "value": str(value),
                "type": type,
                "description": description,
                "updated_at": "datetime('now')",
            },
            conflict_keys=["key"],
        )

    def get_all(self) -> list[AppConfig]:
        """获取所有配置"""
        rows = self.raw_query("SELECT * FROM app_config ORDER BY key")
        return [AppConfig.from_row(r) for r in rows]

    def delete_key(self, key: str) -> bool:
        """删除配置项"""
        count = self.raw_execute(
            "DELETE FROM app_config WHERE key = ?", (key,)
        )
        return count > 0
