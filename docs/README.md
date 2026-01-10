# 📱 Chat/SMS Distribuído com Chord

## 1. Identificação do Grupo

**Curso:** (Computação / Informática)  
**Instituição:** __________________________  
**Disciplina:** Sistemas Distribuídos  

### 👥 Membros do Grupo (3 estudantes)

| Nome | Função | Responsabilidades |
|-----|------|------------------|
| **Eliseu Cambinda** | **Coordenador do Grupo** | Gestão do grupo, integração dos módulos, acompanhamento geral do projeto |
| __________________ | **Responsável Técnico** | Arquitetura do sistema, implementação backend/frontend, Chord |
| __________________ | **Responsável por Testes e Documentação** | Testes funcionais, validação, escrita do relatório e README |

---

## 2. Introdução

Este projeto implementa um **sistema de mensagens distribuído (Chat/SMS)** semelhante a um mini‑WhatsApp, onde os utilizadores podem trocar mensagens em tempo real ou de forma assíncrona (offline). O sistema utiliza conceitos fundamentais de **Sistemas Distribuídos**, nomeadamente:

- Lookup distribuído com **Chord**
- Persistência de dados
- Tolerância a falhas
- Comunicação remota (RPC moderno)

---

## 3. Objetivos do Projeto

- Permitir o registo e autenticação de utilizadores
- Enviar mensagens entre utilizadores
- Garantir entrega de mensagens mesmo quando o destinatário está offline
- Armazenar mensagens de forma persistente
- Utilizar o protocolo **Chord** para distribuição de responsabilidade
- Demonstrar tolerância à falha de nós

---

## 4. Arquitetura do Sistema

### 4.1 Visão Geral

O sistema segue uma arquitetura **cliente‑servidor distribuída**, composta por:

- **Frontend (React + TypeScript)**
- **Backend (FastAPI + WebSocket)**
- **Camada de Persistência (KV Store / Base de Dados)**
- **Camada de Distribuição (Chord)**

### 4.2 Comunicação

- **HTTP (REST)** → operações como login, inbox, delete
- **WebSocket** → mensagens em tempo real, typing e read‑receipt

---

## 5. Chord no Sistema

Cada utilizador possui uma chave lógica:

```
user:username
```

O algoritmo **Chord** é responsável por:

- Determinar o nó responsável pela caixa de entrada do utilizador
- Replicar dados em nós sucessores
- Garantir continuidade em caso de falha de um nó

### Falha de Nós

O sistema permite simular falhas desligando nós. Quando um nó responsável fica offline:

- Um nó réplica assume a responsabilidade
- As mensagens continuam a ser entregues
- O sistema permanece funcional

---

## 6. Persistência

As mensagens são armazenadas de forma persistente:

- Cada mensagem contém: `id`, `from`, `to`, `text`, `timestamp`, `read`
- Mensagens não lidas ficam guardadas até o utilizador consultar a inbox
- A persistência garante entrega offline

---

## 7. Funcionalidades Implementadas

- ✅ Registo e autenticação de utilizadores
- ✅ Envio de mensagens
- ✅ Caixa de entrada (Inbox)
- ✅ Marcação de mensagens como lidas
- ✅ Indicador de digitação (typing)
- ✅ Entrega de mensagens offline
- ✅ Apagar mensagens:
  - Apagar para si
  - Apagar para todos (somente emissor)
- ✅ Simulação de falha de nós

---

## 8. Equivalência ao RMI

Embora não utilize RMI clássico, o sistema implementa **RPC moderno** através do FastAPI:

| Método | Descrição |
|------|----------|
| `send(from, to, text)` | Envio de mensagens |
| `inbox(user)` | Consulta de mensagens |
| `delete(messageId)` | Remoção de mensagens |

Esta abordagem é equivalente ao RMI tradicional, porém mais adequada a aplicações web modernas.

---

## 9. Demonstração Esperada

1. Registar dois utilizadores
2. Enviar pelo menos 5 mensagens
3. Desligar o nó responsável por um utilizador
4. Mostrar que o sistema continua funcional
5. Consultar inbox e confirmar mensagens

---

## 10. Conclusão

O sistema desenvolvido cumpre todos os requisitos do enunciado, demonstrando conceitos essenciais de **Sistemas Distribuídos**, como lookup distribuído, tolerância a falhas, persistência e comunicação remota. O projeto simula com sucesso um serviço de mensagens distribuído funcional e robusto.

---

## 11. Tecnologias Utilizadas

- Python (FastAPI)
- WebSocket
- React + TypeScript
- Chord (implementação própria)
- KV Store / Base de Dados

---

## 12. Observações Finais

Este projeto foi desenvolvido com foco académico, respeitando as boas práticas de desenvolvimento distribuído e alinhado aos objetivos da disciplina.

