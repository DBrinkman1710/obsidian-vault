from __future__ import annotations

import json
import uuid
from collections import defaultdict
from typing import Dict, Set

from fastapi import WebSocket


class ConnectionManager:
    """Tracks active WebSocket connections per tenant session."""

    def __init__(self):
        # tenant_id -> session_id -> set of websockets
        self._connections: Dict[str, Dict[str, Set[WebSocket]]] = defaultdict(lambda: defaultdict(set))

    async def connect(self, websocket: WebSocket, tenant_id: str, session_id: str):
        await websocket.accept()
        self._connections[tenant_id][session_id].add(websocket)

    def disconnect(self, websocket: WebSocket, tenant_id: str, session_id: str):
        self._connections[tenant_id][session_id].discard(websocket)

    async def broadcast_to_session(self, tenant_id: str, session_id: str, data: dict):
        payload = json.dumps(data)
        dead = set()
        for ws in list(self._connections[tenant_id][session_id]):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._connections[tenant_id][session_id].discard(ws)

    def session_has_agent(self, tenant_id: str, session_id: str) -> bool:
        return bool(self._connections[tenant_id][session_id])


manager = ConnectionManager()
