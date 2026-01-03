from typing import List, Optional, Dict, Any
from pydantic import BaseModel

# Schema para validação e tipagem (equivalente à interface ChordNode)
class ChordNode(BaseModel):
    id: int
    name: str
    active: bool
    users: List[str] = []
    message_count: int = 0

def hash_string(string: str) -> int:
    """
    Implementação idêntica ao hash de 32 bits do JS para manter compatibilidade.
    """
    hash_val = 0
    for char in string:
        char_code = ord(char)
        # Simula o comportamento do bitwise << em JS (32-bit signed integer)
        hash_val = ((hash_val << 5) - hash_val) + char_code
        hash_val &= 0xFFFFFFFF  # Garante que permaneça em 32 bits
        
    # Converte para signed integer de 32 bits como o JS faz implicitamente
    if hash_val > 0x7FFFFFFF:
        hash_val -= 0x100000000
        
    return abs(hash_val)

def get_chord_position(key: str) -> int:
    return hash_string(key) % 256

def find_responsible_node(key: str, nodes: List[ChordNode]) -> Optional[ChordNode]:
    """Encontra o nó sucessor responsável, ignorando nós inativos."""
    # 1. Filtra apenas os nós ativos
    active_nodes = [n for n in nodes if n.active]
    if not active_nodes:
        return None

    position = get_chord_position(key)
    
    # 2. Mapeia e ordena as posições apenas dos ativos
    node_positions = []
    for n in active_nodes:
        node_positions.append({
            "node": n,
            "pos": get_chord_position(f"node:{n.id}")
        })
    
    # Ordenação crucial para o anel
    sorted_nodes = sorted(node_positions, key=lambda x: x["pos"])

    # 3. Busca o sucessor
    for entry in sorted_nodes:
        if entry["pos"] >= position:
            return entry["node"]

    # 4. Wrap around: se a posição da chave for maior que o último nó, 
    # o responsável é o primeiro nó do anel (o menor hash)
    return sorted_nodes[0]["node"]

def get_replica_nodes(key: str, nodes: List[ChordNode], count: int = 3) -> List[ChordNode]:
    """Retorna as réplicas apenas entre os nós que estão ONLINE."""
    active_nodes = [n for n in nodes if n.active]
    if not active_nodes:
        return []

    primary = find_responsible_node(key, nodes)
    if not primary:
        return []

    # Ordena os ativos para definir a vizinhança no anel
    node_positions = sorted([
        {"node": n, "pos": get_chord_position(f"node:{n.id}")}
        for n in active_nodes
    ], key=lambda x: x["pos"])
    
    # Localiza o índice do primário no array de ativos
    try:
        primary_idx = next(i for i, x in enumerate(node_positions) if x["node"].id == primary.id)
    except StopIteration:
        return []
    
    replicas = []
    num_to_get = min(count, len(active_nodes))
    
    for i in range(num_to_get):
        next_idx = (primary_idx + i) % len(node_positions)
        replicas.append(node_positions[next_idx]["node"])
        
    return replicas

def initialize_nodes() -> List[ChordNode]:
    """Inicializa os nós padrão."""
    nodes_data = [
        {"id": 1, "name": "Node-Alpha", "active": True},
        {"id": 2, "name": "Node-Beta", "active": True},
        {"id": 3, "name": "Node-Gamma", "active": True},
        {"id": 4, "name": "Node-Delta", "active": True},
        {"id": 5, "name": "Node-Epsilon", "active": True},
    ]
    return [ChordNode(**n) for n in nodes_data]