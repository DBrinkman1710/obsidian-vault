from __future__ import annotations

import json
from collections import defaultdict
from typing import Dict, Set

from fastapi import WebSocket


class ConnectionManager:
    """Tracks active WebSocket connections per tenant.

    Visitor sockets: keyed by tenant_key → session_id → set of sockets.
    Agent sockets:   keyed by tenant_key → set of sockets (receive all tenant events).
    """

    def __init__(self):
        self._connections: Dict[str, Dict[str, Set[WebSocket]]] = defaultdict(lambda: defaultdict(set))
        self._agent_connections: Dict[str, Set[WebSocket]] = defaultdict(set)

    # ------------------------------------------------------------------
    # Visitor (widget) connections
    # ------------------------------------------------------------------

    async def connect(self, websocket: WebSocket, tenant_key: str, session_id: str):
        await websocket.accept()
        self._connections[tenant_key][session_id].add(websocket)

    def disconnect(self, websocket: WebSocket, tenant_key: str, session_id: str):
        self._connections[tenant_key][session_id].discard(websocket)

    async def broadcast_to_session(self, tenant_key: str, session_id: str, data: dict):
        payload = json.dumps(data)
        dead = set()
        for ws in list(self._connections[tenant_key][session_id]):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._connections[tenant_key][session_id].discard(ws)

    def session_has_agent(self, tenant_key: str, session_id: str) -> bool:
        return bool(self._connections[tenant_key][session_id])

    # ------------------------------------------------------------------
    # Agent connections — receive all events for the tenant in real time
    # ------------------------------------------------------------------

    async def connect_agent(self, websocket: WebSocket, tenant_key: str):
        await websocket.accept()
        self._agent_connections[tenant_key].add(websocket)

    def disconnect_agent(self, websocket: WebSocket, tenant_key: str):
        self._agent_connections[tenant_key].discard(websocket)

    async def broadcast_to_agents(self, tenant_key: str, data: dict):
        payload = json.dumps(data)
        dead = set()
        for ws in list(self._agent_connections[tenant_key]):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._agent_connections[tenant_key].discard(ws)


manager = ConnectionManager()
