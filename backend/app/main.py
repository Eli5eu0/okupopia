import json
import os
import time
import uuid
from typing import List
from fastapi import APIRouter, FastAPI, WebSocket, WebSocketDisconnect, Body, Query, Path, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client

# Importações internas
from .database import kv
from . import chord
from .services.websocket_manager import manager 

app = FastAPI(title="Okupopia API", version="1.0.0")

# --- MIDDLEWARE ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Criamos o roteador com o prefixo necessário
api_router = APIRouter(prefix="/make-server-aef9e41b")

# --- CLIENTE SUPABASE ---
url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

# --- ESTADO GLOBAL ---
chord_nodes: List[chord.ChordNode] = []

# --- EVENTOS DE CICLO DE VIDA ---
@app.on_event("startup")
async def startup_event():
    global chord_nodes
    try:
        stored = await kv.get("system:chord_nodes")
        if stored and len(stored) > 0:
            chord_nodes = [chord.ChordNode(**n) for n in stored]
            print(f"✅ Chord: {len(chord_nodes)} nós carregados.")
            return
    except Exception as e:
        print(f"❌ ERRO ao carregar nós: {e}")

    chord_nodes = chord.initialize_nodes()
    await save_nodes()

async def save_nodes():
    global chord_nodes
    data_to_save = [n.dict() for n in chord_nodes]
    await kv.set("system:chord_nodes", data_to_save)
    
async def log_operation(operation: str, details: dict):
    """Registra logs de operações do sistema no KV Store do Supabase."""
    timestamp = int(time.time() * 1000)
    print(f" LOG: [{operation}] - {details}")
    
    # Busca logs existentes ou cria lista vazia
    logs = await kv.get("system:operation_logs") or []
    
    # Insere o novo log no início da lista
    logs.insert(0, {
        "timestamp": timestamp,
        "operation": operation,
        "details": details
    })
    
    # Mantém apenas os últimos 100 logs para não sobrecarregar o banco
    await kv.set("system:operation_logs", logs[:100])

# --- ROTAS DE AUTH & USUÁRIOS (Usando api_router) ---

@api_router.post("/signup")
async def signup(data: dict = Body(...)):
    username, password, name = data.get("username"), data.get("password"), data.get("name")
    if not all([username, password, name]):
        raise HTTPException(status_code=400, detail="Missing fields")
    
    if await kv.get(f"user:{username}"):
        raise HTTPException(status_code=409, detail="Exists")

    user_data = {
        "username": username, "password": password, "name": name,
        "status": "online", "joinedAt": int(time.time() * 1000)
    }
    await kv.set(f"user:{username}", user_data)
    return {"success": True, "user": user_data}

@api_router.post("/signin")
async def signin(data: dict = Body(...)):
    user = await kv.get(f"user:{data.get('username')}")
    if not user or user.get("password") != data.get("password"):
        raise HTTPException(status_code=401)
    return {"success": True, "user": user}

@api_router.get("/inbox")
async def get_inbox(username: str = Query(...)):
    all_msgs = await kv.get_by_prefix("message:")
    user_msgs = [m for m in all_msgs if m["to"] == username or m["from"] == username]
    user_msgs.sort(key=lambda x: x["timestamp"], reverse=True)
    return {"messages": user_msgs}

# --- ROTAS DE MENSAGENS E BUSCA (Dentro do api_router) ---
@api_router.get("/users")
async def get_users(username: str = Query(None)):
    all_users = await kv.get_by_prefix("user:")
    user_list = [
        {"username": u["username"], "name": u["name"]} 
        for u in all_users if u["username"] != username
    ]
    return {"users": user_list}

@api_router.get("/conversations")
async def get_conversations(username: str = Query(...)):
    all_messages = await kv.get_by_prefix("message:")
    # Filtra mensagens onde o usuário participa
    user_messages = [m for m in all_messages if m["to"] == username or m["from"] == username]
    
    conversations = {}
    for msg in user_messages:
        # Identifica quem é a outra pessoa na conversa
        partner = msg["from"] if msg["to"] == username else msg["to"]
        
        if partner not in conversations:
            conversations[partner] = {
                "username": partner, 
                "lastMessage": msg, 
                "unreadCount": 0
            }
        
        # Atualiza para a mensagem mais recente
        if msg["timestamp"] > conversations[partner]["lastMessage"]["timestamp"]:
            conversations[partner]["lastMessage"] = msg
            
        # Conta não lidas (se a mensagem foi PARA o usuário logado)
        if msg["to"] == username and not msg.get("read", False):
            conversations[partner]["unreadCount"] += 1

    # Adiciona o nome real do parceiro buscando no banco de usuários
    result = []
    for partner, conv in conversations.items():
        user_info = await kv.get(f"user:{partner}")
        if user_info:
            result.append({**conv, "name": user_info["name"]})
            
    # Ordena por data da última mensagem
    result.sort(key=lambda x: x["lastMessage"]["timestamp"], reverse=True)
    return {"conversations": result}
    
@api_router.put("/mark-read")
async def mark_read(data: dict = Body(...)):
    username = data.get("username") # Quem está lendo (Ex: Kassovita)
    other_user = data.get("otherUser") # Quem enviou (Ex: Eliseu)
    
    all_messages = await kv.get_by_prefix("message:")
    
    for msg in all_messages:
        if msg["to"] == username and msg["from"] == other_user and not msg.get("read"):
            msg["read"] = True
            await kv.set(f"message:{msg['id']}", msg)
    
    await manager.send_personal_message({
        "type": "read_receipt",
        "from": username # Kassovita diz: "Eu li!"
    }, other_user) # Envia para remetente
            
    return {"success": True}

# --- ADMIN & CHORD VISUALIZATION (Usando api_router) ---
@api_router.get("/admin/nodes")
async def get_nodes():
    users = await kv.get_by_prefix("user:")
    all_messages = await kv.get_by_prefix("message:")
    
    # Resetar contadores
    for node in chord_nodes:
        node.users = []
        node.message_count = 0

    # Distribuir usuários e contar mensagens por nó responsável
    for user in users:
        resp = chord.find_responsible_node(f"user:{user['username']}", chord_nodes)
        if resp:
            for n in chord_nodes:
                if n.id == resp.id:
                    n.users.append(user['username'])

    for msg in all_messages:
        # A mensagem conta para o nó responsável pelo REMETENTE
        resp = chord.find_responsible_node(f"user:{msg.get('from')}", chord_nodes)
        if resp:
            for n in chord_nodes:
                if n.id == resp.id:
                    n.message_count += 1
    
    return {"nodes": [n.dict() for n in chord_nodes]}

@api_router.post("/admin/nodes/{node_id}/toggle")
async def toggle_node(node_id: int = Path(...)):
    global chord_nodes
    # Encontra o nó específico no anel
    node = next((n for n in chord_nodes if n.id == node_id), None)
    
    if not node:
        raise HTTPException(status_code=404, detail="Nó não encontrado")

    # Inverte o status de atividade
    node.active = not node.active
    
    # Persiste a alteração no Supabase para que outros servidores vejam
    await save_nodes() 
    
    # Log da operação para auditoria
    op_name = "NODE_ACTIVATED" if node.active else "NODE_DEACTIVATED"
    await log_operation(op_name, {
        "nodeId": node.id,
        "nodeName": node.name,
        "newStatus": node.active
    })
    
    return {"success": True, "node": node.dict()}

@api_router.get("/admin/logs")
async def get_logs():
    # Retorna os últimos logs de redistribuição e erros do sistema
    logs = await kv.get("system:operation_logs") or []
    return {"logs": logs}

@api_router.delete("/admin/logs")
async def clear_logs():
    await kv.set("system:operation_logs", [])
    return {"success": True}

# --- WEBSOCKET ENDPOINT (Usando api_router) ---
@api_router.websocket("/ws/{username}")
async def websocket_endpoint(websocket: WebSocket, username: str):
    await manager.connect(username, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            msg_payload = json.loads(data)
            
            target_user = msg_payload.get("to")
            msg_type = msg_payload.get("type", "chat")

            if not target_user: continue

            if msg_type == "typing":
                await manager.send_personal_message({"type": "typing", "from": username}, target_user)
                continue

            text = msg_payload.get("text")
            if not text: continue

            responsible_node = chord.find_responsible_node(f"user:{target_user}", chord_nodes)
            timestamp = int(time.time() * 1000)
            full_message = {
                "id": f"{timestamp}-{uuid.uuid4().hex[:8]}",
                "from": username,
                "to": target_user,
                "text": text,
                "timestamp": timestamp,
                "read": False,
                "type": "chat"
            }

            delivered = await manager.send_personal_message(full_message, target_user)
            await kv.set(f"message:{full_message['id']}", full_message)
            
            if not delivered:
                print(f"📡 Roteando Chord: {target_user} -> {responsible_node.name}")

    except WebSocketDisconnect:
        manager.disconnect(username)
    except Exception as e:
        print(f"⚠️ Erro WebSocket ({username}): {e}")
        manager.disconnect(username)

# --- REGISTRO FINAL ---
app.include_router(api_router)

@app.get("/health")
async def health():
    return {"status": "online"}