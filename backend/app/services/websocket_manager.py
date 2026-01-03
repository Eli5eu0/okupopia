from fastapi import WebSocket
import json

class ConnectionManager:
    def __init__(self):
        # Dicionário para rastrear conexões ativas: { "username": WebSocket }
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, username: str, websocket: WebSocket):
        await websocket.accept()
        # Se o usuário já estiver conectado em outra aba, fecha a antiga ou ignora
        self.active_connections[username] = websocket
        print(f"🔌 Usuário conectado: {username}")

    def disconnect(self, username: str):
        if username in self.active_connections:
            del self.active_connections[username]
            print(f"❌ Usuário desconectado: {username}")

    async def send_personal_message(self, message: dict, username: str):
        """Envia uma mensagem JSON para um usuário específico se ele estiver online"""
        if username in self.active_connections:
            websocket = self.active_connections[username]
            await websocket.send_json(message)
            return True
        return False

    async def broadcast(self, message: dict):
        """Envia para todos os usuários conectados (útil para anúncios do sistema)"""
        for connection in self.active_connections.values():
            await connection.send_json(message)

# Instância única para ser usada em todas as rotas
manager = ConnectionManager()