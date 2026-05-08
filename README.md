<<<<<<< HEAD
# 📌 Muraly — Quadro Colaborativo em Tempo Real

> Um mural de post-its virtual onde qualquer pessoa pode colar uma mensagem colorida — sem login, sem cadastro, sem complicação.  
> **Entre na URL, escreva e veja aparecer na tela de todo mundo instantaneamente.**

---

## 🎯 Problema

Ferramentas colaborativas geralmente exigem cadastro, login e configurações pesadas. Para um uso rápido — deixar um recado para uma equipe, fazer um brainstorming ou coletar ideias — essa fricção desnecessária mata a espontaneidade.

**Muraly resolve isso:**
- Zero barreiras de entrada — nenhum cadastro, nenhum login.
- URL pública → qualquer pessoa acessa e escreve na hora.
- Atualização em tempo real para todos os participantes conectados.
- Persistência: os post-its não somem ao recarregar a página.

---

## 💡 Solução

Um quadro interativo com **post-its coloridos**, alimentado por **WebSockets** para colaboração ao vivo.

- Qualquer visitante adiciona um post-it com texto, cor e nome opcional.
- O servidor guarda tudo em um arquivo JSON (persistência sem banco de dados).
- Todos os clientes conectados veem as alterações **instantaneamente**: novos post-its, edições, remoções, reações e movimentos.
- Interface leve e responsiva com animações, confetes, emojis voadores e indicador de digitação.

---

## 🧱 Stack

| Camada | Tecnologia |
|---|---|
| Backend | Node.js + Express + Socket.IO |
| Persistência | JSON (`data/postits.json`) via módulo `fs` nativo |
| Frontend | HTML5, CSS3 (Flex, variáveis CSS, animações), JavaScript puro |
| Comunicação | WebSockets via Socket.IO |
| Extras | `html2canvas` (exportar PNG), Google Fonts (Caveat + Outfit) |

Sem framework de frontend. Sem banco de dados externo. Sem etapa de build.

---

## 📁 Estrutura do Projeto

```
muraly/
├── server.js              → Servidor HTTP + Socket.IO, validação e persistência
├── data/
│   └── postits.json       → Armazenamento dos post-its (criado automaticamente)
├── public/
│   ├── index.html         → Estrutura da página (toolbar, board, modal, toasts)
│   ├── style.css          → Estilos, animações e responsividade
│   └── client.js          → Lógica de UI, renderização, drag & drop, reações
├── package.json           → Dependências (express, socket.io)
└── README.md
```

**Regra de ouro do projeto:** o servidor nunca toca no DOM. O cliente nunca guarda estado principal — toda atualização vem do servidor via socket.

---

## 🚀 Como Rodar

### Pré-requisitos
- [Node.js](https://nodejs.org) versão 14 ou superior
- NPM (já incluso com o Node)

### Passo a passo

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/muraly.git
cd muraly

# 2. Instale as dependências
npm install

# 3. Inicie o servidor
node server.js

# 4. Abra no navegador
http://localhost:3000
```

Para testar em outros dispositivos na mesma rede, use o IP da máquina (ex: `http://192.168.1.10:3000`).

Para expor o mural para a internet rapidamente:

```bash
npx localtunnel --port 3000
# Gera uma URL pública como https://xxxx.loca.lt
```

---

## ✅ Requisitos Atendidos

### Obrigatórios (MVP)

| Requisito | Status |
|---|---|
| Interface web utilizável (desktop) | ✅ |
| Persistência mínima (JSON) | ✅ |
| README com problema, solução, stack e como rodar | ✅ |
| Demo funcionando na apresentação | ✅ |
| Separação entre lógica e interface | ✅ |
| Inputs validados no servidor | ✅ |
| Código explicável por quem fez | ✅ |

### Bônus Implementados

| Funcionalidade | Status | Descrição |
|---|---|---|
| Arrastar e reposicionar | ✅ | Drag & drop nativo sincronizado via WebSocket |
| Reações com emojis | ✅ | Chips estilo WhatsApp + picker com 4 categorias + animação voador |
| Nome/apelido opcional | ✅ | Campo no modal, salvo em LocalStorage |
| Editar post-it | ✅ | Preserva posição e reações ao editar |
| Busca no mural | ✅ | Filtra por texto ou nome do autor em tempo real |
| Exportar como PNG | ✅ | Captura todo o board com `html2canvas` |
| Modo apresentação | ✅ | Esconde toolbar e controles, foco nos post-its |
| Indicador de digitação | ✅ | Mostra quando outro usuário está escrevendo |
| Confetes ao adicionar | ✅ | Explosão de partículas coloridas para todos |
| Preview no modal | ✅ | Visualiza cor e texto antes de colar |
| Timestamp nos post-its | ✅ | "agora mesmo", "há X min", etc. |
| Contador de online | ✅ | Exibe quantos usuários estão conectados |

---

## 🕹️ Funcionalidades

### Adicionar post-it
Clique em **+ Novo post-it**, preencha o nome (opcional) e a mensagem (máx. 200 caracteres), escolha a cor e cole. Todos os participantes veem o novo post-it instantaneamente com uma chuva de confetes.

### Editar e remover
Passe o mouse sobre um post-it para revelar os ícones de editar (✏️) e remover (🗑️). A edição reutiliza o mesmo modal e preserva posição e reações.

### Arrastar e reposicionar
Segure qualquer parte do post-it e mova. A nova posição é salva no servidor e sincronizada para todos os clientes em tempo real.

### Reações com emojis
Abaixo de cada post-it há um botão 😊 que abre um seletor com 32 emojis em 4 categorias. As reações aparecem como chips com contagem acumulada (👍 3, ❤️ 1) — estilo WhatsApp. Ao reagir, um emoji sobe do post-it com animação.

### Busca
Campo de busca na toolbar. Filtra post-its por texto ou nome do autor em tempo real, destacando os relevantes e esmaecendo os demais.

### Exportar mural
Botão ⬇ na toolbar gera um PNG do board inteiro em alta resolução (escala 2×).

### Modo apresentação
Botão ⛶ esconde a toolbar e todos os controles. Para sair, clique no botão flutuante **✕ Sair** ou pressione `ESC`.

---

## 🏗️ Arquitetura e Decisões Técnicas

### Servidor (`server.js`)
- Mantém o array `postits` em memória e sincroniza com `data/postits.json` a cada alteração.
- Valida todos os dados recebidos antes de salvar: texto obrigatório (máx. 200 chars), cor hexadecimal válida (fallback `#FFEB3B`), apelido máx. 30 chars, emojis restritos a uma lista de 32 permitidos.
- Usa `io.emit` (broadcast para todos) em vez de `socket.emit` (apenas o remetente) para garantir sincronização.
- Cria a pasta `data/` automaticamente se não existir.

### Eventos Socket.IO

| Evento | Direção | Payload |
|---|---|---|
| `initial_postits` | server → client | array completo de post-its |
| `new_postit` | client → server | `{ texto, cor, nickname }` |
| `postit_added` | server → todos | post-it completo com id |
| `edit_postit` | client → server | `{ id, texto, cor, nickname, x, y }` |
| `postit_edited` | server → todos | post-it atualizado completo |
| `delete_postit` | client → server | `id` |
| `postit_removed` | server → todos | `id` |
| `move_postit` | client → server | `{ id, x, y }` |
| `postit_moved` | server → todos | `{ id, x, y }` |
| `react_postit` | client → server | `{ id, emoji }` |
| `postit_reacted` | server → todos | `{ id, reacoes }` |
| `typing` | client → server | `nickname` |
| `user_typing` | server → outros | `nickname` |
| `online_count` | server → todos | número de clientes |

### Cliente (`client.js`)
- Conecta ao socket e mantém uma cópia local do array `postits` apenas como cache de renderização.
- Renderização completamente baseada em eventos: cada evento do servidor atualiza apenas o elemento afetado (reações atualizam só os chips, movimentos atualizam só `left`/`top`).
- Drag & drop implementado com eventos nativos `mousedown`/`mousemove`/`mouseup`, sem biblioteca.
- Reações com toggle local otimista (atualiza a UI imediatamente) e confirmação via broadcast do servidor.
- LocalStorage usado exclusivamente para persistir o apelido entre sessões.

### Estilo (`style.css`)
- Glassmorphism na toolbar com `backdrop-filter: blur`.
- Post-its com rotação determinística baseada no `id`, sombra e efeito de dobra no canto.
- Animações: `popIn` (entrada), `flyUp` (emoji voador), `confettiFall` (confetes), `typingBounce` (bolinhas de digitação).
- Totalmente responsivo com media queries para telas menores que 700px.


---

## 📦 Deploy

### Render (recomendado)
1. Suba o código para um repositório no GitHub.
2. No [Render](https://render.com), crie um **Web Service** conectado ao repositório.
3. Comando de start: `node server.js`.
4. Receba uma URL pública como `https://muraly.onrender.com`.

Socket.IO funciona normalmente no Render, Railway e Glitch.

---
