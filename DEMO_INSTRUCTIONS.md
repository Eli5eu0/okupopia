# Sistema de Chat Distribuído com Chord

## Visão Geral

Este é um sistema de mensagens distribuído que implementa conceitos de Chord (Distributed Hash Table) para distribuir utilizadores e mensagens entre múltiplos nós virtuais.

## Funcionalidades Implementadas

### ✅ Requisitos Básicos
- **Registo de utilizadores**: Sistema simples de signup/login
- **Envio de mensagens**: `send(from, to, text)` com armazenamento persistente
- **Consulta de inbox**: `inbox(user)` mostra todas as mensagens
- **Marcação como lida**: Mensagens são marcadas automaticamente ao visualizar
- **Mensagens offline**: Mensagens ficam guardadas e aparecem quando o destinatário acessa

### ✅ Sistemas Distribuídos (Chord)
- **5 Nós Virtuais**: Node-Alpha, Node-Beta, Node-Gamma, Node-Delta, Node-Epsilon
- **Hash Consistente**: Cada utilizador é atribuído a um nó baseado em hash
- **Replicação**: Dados replicados em 3 nós (fator de replicação = 3)
- **Lookup Chord**: Algoritmo de lookup para encontrar nó responsável
- **Tolerância a falhas**: Redistribuição automática quando um nó cai

### ✅ Persistência
- **Base de dados**: Supabase KV Store (persistência completa)
- **Mensagens**: Guardadas permanentemente com metadados
- **Utilizadores**: Informação de conta persistida
- **Estado dos nós**: Configuração de nós guardada

## Demonstração Esperada

### Passo 1: Criar Utilizadores
1. Crie 5 utilizadores diferentes (ex: joao, maria, pedro, ana, carlos)
2. Aceda ao **Painel Admin** (botão de engrenagem no topo)
3. Vá à aba **"Distribuição"** para ver qual nó é responsável por cada utilizador

### Passo 2: Enviar Mensagens
1. Com o primeiro utilizador, envie **5 mensagens** para diferentes destinatários
2. Faça logout e login com outros utilizadores para verificar mensagens pendentes
3. As mensagens aparecem mesmo que o destinatário estivesse offline

### Passo 3: Demonstrar Tolerância a Falhas
1. Abra o **Painel Admin**
2. Identifique qual nó é responsável por um utilizador específico (ex: "joao")
3. Na aba **"Nós Chord"**, clique em **"Desligar Nó"** no nó responsável
4. Vá à aba **"Logs"** para ver o evento de failover
5. Volte à aba **"Distribuição"** para confirmar que o utilizador foi redistribuído
6. **Verifique que o sistema continua funcionando** - mensagens ainda são acessíveis

### Passo 4: Estabilização
1. Reative o nó que foi desligado
2. Observe nos **Logs** o evento de reativação
3. O sistema se estabiliza automaticamente

## Arquitetura Técnica

### Backend (Supabase Edge Functions)
```
/supabase/functions/server/
├── index.tsx       # Servidor Hono com rotas REST
├── chord.tsx       # Implementação do algoritmo Chord
└── kv_store.tsx    # Interface de persistência
```

### Algoritmo Chord
- **Hash Function**: Hash simples de string para inteiro
- **Chord Ring**: Espaço de 0-255 (8 bits para demonstração)
- **Lookup**: Encontra sucessor na ring (nó com posição >= chave)
- **Replicação**: N+1 e N+2 sucessores na ring

### Endpoints Admin
- `GET /admin/nodes` - Status de todos os nós
- `POST /admin/nodes/:id/toggle` - Liga/desliga um nó
- `GET /admin/distribution` - Distribuição de utilizadores
- `GET /admin/logs` - Logs de operações do sistema
- `DELETE /admin/logs` - Limpar logs

### Frontend (React + TypeScript)
```
/src/app/components/
├── LoginScreen.tsx         # Autenticação
├── ConversationList.tsx    # Lista de conversas + botão admin
├── ChatWindow.tsx          # Interface de chat
└── AdminPanel.tsx          # Painel de administração Chord
```

## Conceitos Demonstrados

1. **Distributed Hash Table (DHT)**: Utilizadores distribuídos por hash consistente
2. **Chord Protocol**: Lookup de nós responsáveis
3. **Replicação**: Dados replicados em múltiplos nós
4. **Failover**: Redistribuição automática em falhas
5. **Estabilização**: Sistema se recupera quando nós voltam
6. **Persistência**: Mensagens sobrevivem a falhas
7. **RMI-like Service**: API REST simula Remote Method Invocation

## Notas Importantes

- Este é um **protótipo educacional** para demonstração de conceitos
- Não use para dados sensíveis (sem encriptação de passwords)
- A "distribuição" é simulada (todos os nós acedem ao mesmo storage)
- Em produção, cada nó teria storage separado
- O polling de 3 segundos simula updates em tempo real

## Como Testar

1. **Criar múltiplos utilizadores** em abas diferentes do browser
2. **Enviar mensagens** entre eles
3. **Abrir Painel Admin** para visualizar distribuição
4. **Desligar nós** e observar comportamento
5. **Verificar logs** para entender operações internas
6. **Reativar nós** e confirmar estabilização

---

**Desenvolvido para disciplina de Sistemas Distribuídos**
Demonstra conceitos de Chord, DHT, replicação e tolerância a falhas.
