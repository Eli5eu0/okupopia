import socket
import os
import re

def get_ip():
    # Tenta conectar a um endereço externo para descobrir qual interface está a ser usada
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Não precisa de conexão real, apenas para identificar a interface de rede ativa
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def update_info_ts(new_ip):
    # Caminho para o seu arquivo info.ts (ajuste se necessário)
    path = "./src/utils/supabase/info.ts" 
    
    if not os.path.exists(path):
        print(f"Erro: Arquivo {path} não encontrado!")
        return

    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Substitui qualquer IP ou localhost entre http:// e :8000
    new_content = re.sub(r'http://.*?:8000', f'http://{new_ip}:8000', content)

    with open(path, "w", encoding="utf-8") as f:
        f.write(new_content)
    
    print(f"✅ IP atualizado para: {new_ip}")
    print(f"🔗 Backend: http://{new_ip}:8000")
    print(f"🔗 Frontend: http://{new_ip}:5173")