import os
from typing import Any, List, Optional
from supabase._async.client import create_client as create_async_client, AsyncClient
from dotenv import load_dotenv

load_dotenv()

url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Variável global que será preenchida no startup
supabase: AsyncClient = None

async def init_supabase():
    global supabase
    if supabase is None:
        # O segredo está no 'await' aqui
        supabase = await create_async_client(url, key)

TABLE_NAME = "kv_store_aef9e41b"

class KVStore:
    @staticmethod
    async def set(key: str, value: Any):
        await init_supabase() # Garante que o cliente existe
        response = await supabase.table(TABLE_NAME).upsert({"key": key, "value": value}).execute()
        return response

    @staticmethod
    async def get(key: str) -> Optional[Any]:
        await init_supabase()
        response = await supabase.table(TABLE_NAME).select("value").eq("key", key).maybe_single().execute()
        if response and hasattr(response, 'data') and response.data:
            return response.data.get("value")
        return None

    @staticmethod
    async def delete(key: str):
        await init_supabase()
        await supabase.table(TABLE_NAME).delete().eq("key", key).execute()

    @staticmethod
    async def get_by_prefix(prefix: str) -> List[Any]:
        await init_supabase()
        response = await supabase.table(TABLE_NAME).select("value").like("key", f"{prefix}%").execute()
        return [d["value"] for d in response.data] if response.data else []

kv = KVStore()