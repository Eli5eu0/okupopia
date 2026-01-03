import os
import time
import uuid
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query, Body, Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone
from supabase import create_client, Client


# Importações internas
from .database import kv
from . import chord

app = FastAPI(title="Okupopia API", version="1.0.0")

# --- CONFIGURAÇÃO DE MIDDLEWARE ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicialize o cliente Supabase
url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

class TypingData(BaseModel):
    from_user: str = Body(..., alias="from")
    to: str

# Rota para registrar que o usuário está digitando
@app.post("/make-server-aef9e41b/typing")
async def set_typing(data: TypingData):
    try:
        # Usando timezone.utc para evitar conflitos com o TIMESTAMPTZ do Supabase
        supabase.table("typing_status").upsert({
            "from_user": data.from_user,
            "to_user": data.to,
            "last_typed_at": datetime.now(timezone.utc).isoformat()
        }, on_conflict="from_user").execute()
        
        return {"success": True}
    except Exception as e:
        print(f"Erro no typing: {e}")
        return {"success": False}

# Rota para verificar se o outro usuário está digitando
@app.get("/make-server-aef9e41b/typing-status")
async def get_typing_status(from_user: str = Query(..., alias="from"), to: str = Query(...)):
    try:
        response = supabase.table("typing_status") \
            .select("last_typed_at") \
            .eq("from_user", from_user) \
            .eq("to_user", to) \
            .execute()

        if not response.data:
            return {"isTyping": False}

        last_typed_str = response.data[0]["last_typed_at"]
        # O Python 3.11+ lida bem com o formato do Supabase com fromisoformat
        last_typed = datetime.fromisoformat(last_typed_str.replace('Z', '+00:00'))
        
        # Comparações seguras com fuso horário
        now = datetime.now(timezone.utc)
        is_typing = (now - last_typed) < timedelta(seconds=4)
        
        return {"isTyping": is_typing}
    except Exception as e:
        print(f"Erro no typing-status: {e}")
        return {"isTyping": False}

# --- ESTADO GLOBAL ---
chord_nodes: List[chord.ChordNode] = []

# --- EVENTOS DE CICLO DE VIDA ---        
@app.on_event("startup")
async def startup_event():
    global chord_nodes
    try:
        stored = await kv.get("system:chord_nodes")
        if stored and len(stored) > 0:
            print(f"INFO: Carregando {len(stored)} nós do Supabase...")
            chord_nodes = [chord.ChordNode(**n) for n in stored]
            return # Sai da função com sucesso
    except Exception as e:
        print(f"ERRO ao carregar nós: {e}")

    # Só executa isso se o banco estiver REALMENTE vazio
    print("INFO: Inicializando nós padrão...")
    chord_nodes = chord.initialize_nodes()
    await save_nodes()
        

# --- HELPERS ---

async def save_nodes():
    """Persiste o estado atual dos nós no KV Store."""
    global chord_nodes
    data_to_save = [n.dict() if hasattr(n, 'dict') else n for n in chord_nodes]
    await kv.set("system:chord_nodes", data_to_save)

async def log_operation(operation: str, details: dict):
    """Registra logs de operações do sistema no KV Store."""
    timestamp = int(time.time() * 1000)
    print(f" LOG: [{operation}] - {details}")
    
    logs = await kv.get("system:operation_logs") or []
    logs.insert(0, {
        "timestamp": timestamp,
        "operation": operation,
        "details": details
    })
    await kv.set("system:operation_logs", logs[:100])

# --- EXCEPTION HANDLERS ---
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    """Garante compatibilidade de erro com o frontend antigo (formato 'error')."""
    return JSONResponse(
        status_code=400,
        content={"error": "Missing required fields or invalid data"},
    )

# --- 1. ROTAS DE SISTEMA & AUTH ---

@app.get("/make-server-aef9e41b/health")
async def health_check():
    return {"status": "ok"}

@app.post("/make-server-aef9e41b/signup")
async def signup(data: dict = Body(...)):
    username = data.get("username")
    password = data.get("password")
    name = data.get("name")
    
    if not all([username, password, name]):
        raise HTTPException(status_code=400, detail="Missing required fields")

    if await kv.get(f"user:{username}"):
        raise HTTPException(status_code=409, detail="Username already exists")

    user_data = {
        "username": username,
        "password": password,
        "name": name,
        "email": f"{username}@example.com",
        "bio": "",
        "avatar": "",
        "status": "online",
        "theme": "light",
        "notifications": True,
        "privacy": "public",
        "joinedAt": int(time.time() * 1000),
        "lastActive": int(time.time() * 1000),
        "createdAt": int(time.time() * 1000)
    }
    await kv.set(f"user:{username}", user_data)
    return {"success": True, "user": {"username": username, "name": name}}

@app.post("/make-server-aef9e41b/signin")
async def signin(data: dict = Body(...)):
    username = data.get("username")
    password = data.get("password")
    user = await kv.get(f"user:{username}")
    
    if not user or user.get("password") != password:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {"success": True, "user": {"username": username, "name": user["name"]}}

@app.get("/make-server-aef9e41b/users")
async def get_users(username: str = Query(None)):
    all_users = await kv.get_by_prefix("user:")
    user_list = [
        {"username": u["username"], "name": u["name"]} 
        for u in all_users if u["username"] != username
    ]
    return {"users": user_list}

# --- 2. ROTAS DE MENSAGENS & CONVERSAS ---

@app.post("/make-server-aef9e41b/send")
async def send_message(data: dict = Body(...)):
    sender, to, text = data.get("from"), data.get("to"), data.get("text")
    
    if not all([sender, to, text]):
        raise HTTPException(status_code=400, detail="Missing fields")

    if not await kv.get(f"user:{sender}") or not await kv.get(f"user:{to}"):
        raise HTTPException(status_code=404, detail="User not found")

    msg_id = f"{int(time.time() * 1000)}-{uuid.uuid4().hex[:9]}"
    message = {
        "id": msg_id,
        "from": sender,
        "to": to,
        "text": text,
        "timestamp": int(time.time() * 1000),
        "read": False
    }
    await kv.set(f"message:{msg_id}", message)
    return {"success": True, "message": message}

@app.get("/make-server-aef9e41b/inbox")
async def get_inbox(username: str = Query(...)):
    all_msgs = await kv.get_by_prefix("message:")
    user_msgs = [m for m in all_msgs if m["to"] == username or m["from"] == username]
    user_msgs.sort(key=lambda x: x["timestamp"], reverse=True)
    return {"messages": user_msgs}

@app.put("/make-server-aef9e41b/mark-read")
async def mark_read(data: dict = Body(...)):
    username = data.get("username")
    other_user = data.get("otherUser")
    
    if not username or not other_user:
        raise HTTPException(status_code=400, detail="Missing required fields")

    all_messages = await kv.get_by_prefix("message:")
    updated_count = 0
    
    for msg in all_messages:
        if msg["to"] == username and msg["from"] == other_user and not msg.get("read"):
            msg["read"] = True
            await kv.set(f"message:{msg['id']}", msg)
            updated_count += 1
            
    return {"success": True, "updated": updated_count}

@app.get("/make-server-aef9e41b/conversations")
async def get_conversations(username: str = Query(...)):
    all_messages = await kv.get_by_prefix("message:")
    user_messages = [m for m in all_messages if m["to"] == username or m["from"] == username]
    
    conversations = {}
    for msg in user_messages:
        partner = msg["from"] if msg["to"] == username else msg["to"]
        if partner not in conversations:
            conversations[partner] = {"username": partner, "lastMessage": msg, "unreadCount": 0}
        
        if msg["timestamp"] > conversations[partner]["lastMessage"]["timestamp"]:
            conversations[partner]["lastMessage"] = msg
            
        if msg["to"] == username and not msg.get("read", False):
            conversations[partner]["unreadCount"] += 1

    result = []
    for partner, conv in conversations.items():
        user_info = await kv.get(f"user:{partner}")
        if user_info:
            result.append({**conv, "name": user_info["name"]})
            
    result.sort(key=lambda x: x["lastMessage"]["timestamp"], reverse=True)
    return {"conversations": result}

# --- 3. ROTAS DE PERFIL ---

@app.get("/make-server-aef9e41b/profile/{username}")
async def get_profile(username: str = Path(...)):
    user = await kv.get(f"user:{username}")
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    all_messages = await kv.get_by_prefix("message:")
    sent = [m for m in all_messages if m["from"] == username]
    received = [m for m in all_messages if m["to"] == username]

    return {
        "profile": {
            **user,
            "email": user.get("email"),
            "bio": user.get("bio", ""),
            "avatar": user.get("avatar", ""),
            "status": user.get("status", "online"),
            "theme": user.get("theme", "light")
        },
        "statistics": {
            "messagesSent": len(sent),
            "messagesReceived": len(received),
            "totalMessages": len(sent) + len(received)
        }
    }

@app.put("/make-server-aef9e41b/profile/{username}")
async def update_profile(username: str = Path(...), updates: dict = Body(...)):
    user = await kv.get(f"user:{username}")
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    allowed_keys = ["name", "bio", "avatar", "status", "theme", "notifications", "privacy"]
    for key in allowed_keys:
        if key in updates:
            user[key] = updates[key]
    
    user["lastActive"] = int(time.time() * 1000)
    await kv.set(f"user:{username}", user)
    await log_operation("PROFILE_UPDATED", {"username": username})
    return {"success": True, "profile": user}

# --- 4. ROTAS ADMIN (CHORD) ---
@app.get("/make-server-aef9e41b/admin/nodes")
async def get_nodes():
    global chord_nodes
    users = await kv.get_by_prefix("user:")
    all_messages = await kv.get_by_prefix("message:") # Buscamos todas as mensagens
    
    # Resetamos os contadores de todos os nós
    for node in chord_nodes:
        node.users = []
        node.message_count = 0 

    # Distribuímos os usuários nos nós ativos
    for user in users:
        username = user['username']
        responsible = chord.find_responsible_node(f"user:{username}", chord_nodes)
        
        if responsible:
            for n in chord_nodes:
                if n.id == responsible.id:
                    if username not in n.users:
                        n.users.append(username)
                    break

    # Contabilizamos as mensagens
    # Uma mensagem conta para o nó se o REMETENTE ("from") estiver alocado nele
    for msg in all_messages:
        sender = msg.get("from")
        # Descobrimos quem é o nó responsável pelo remetente agora
        responsible = chord.find_responsible_node(f"user:{sender}", chord_nodes)
        
        if responsible:
            for n in chord_nodes:
                if n.id == responsible.id:
                    n.message_count += 1
                    break
    
    # Retornamos os dados garantindo que o nome da chave seja 'messageCount' (CamelCase) para o React
    return {
        "nodes": [
            {
                **n.dict(),
                "messageCount": n.message_count # Mapeia para o formato que o seu TS espera
            } for n in chord_nodes
        ]
    }

@app.post("/make-server-aef9e41b/admin/nodes/{node_id}/toggle")
async def toggle_node(node_id: int = Path(...)):
    global chord_nodes
    node = next((n for n in chord_nodes if n.id == node_id), None)
    
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    # Guardamos o status anterior para o log
    previous_status = node.active
    # Invertemos o status
    node.active = not previous_status
    
    # Persistimos no Supabase
    await save_nodes() 
    
    # Definimos o nome da operação conforme o novo estado
    op_name = "NODE_ACTIVATED" if node.active else "NODE_DEACTIVATED"
    
    await log_operation(op_name, {
        "nodeId": node.id,
        "nodeName": node.name,
        "newStatus": node.active,
        "previousStatus": previous_status
    })
    
    print(f"ESTADO ALTERADO: {node.name} -> {node.active}")
    
    return {"success": True, "node": node.dict()}

@app.get("/make-server-aef9e41b/admin/distribution")
async def get_distribution():
    users = await kv.get_by_prefix("user:")
    distribution = {}
    for user in users:
        key = f"user:{user['username']}"
        resp = chord.find_responsible_node(key, chord_nodes)
        reps = chord.get_replica_nodes(key, chord_nodes)
        distribution[user["username"]] = {
            "name": user["name"],
            "primaryNode": resp.name if resp else "None",
            "primaryNodeId": resp.id if resp else None,
            "replicaNodes": [r.name for r in reps],
            "chordPosition": chord.get_chord_position(key)
        }
    return {"distribution": distribution}

@app.get("/make-server-aef9e41b/admin/logs")
async def get_logs():
    return {"logs": await kv.get("system:operation_logs") or []}

@app.delete("/make-server-aef9e41b/admin/logs")
async def clear_logs():
    await kv.set("system:operation_logs", [])
    return {"success": True}