from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator


class KbSourceIn(BaseModel):
    url: str = Field(min_length=10, max_length=2000)

    @field_validator("url")
    @classmethod
    def _http_only(cls, v: str) -> str:
        v = v.strip()
        parsed = urlparse(v)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise ValueError("URL must start with http:// or https://")
        return v


class KbSourceOut(BaseModel):
    id: uuid.UUID
    url: str
    status: str
    last_fetched_at: Optional[datetime]
    error: Optional[str]
    char_count: int
    chunk_count: int
    created_at: datetime
