# CorteX MAP

CorteX MAP é uma ferramenta de footprint digital baseada em OSINT passivo, desenvolvida pela comunidade CorteX Club, com foco em desempenho extremo, interface gráfica impactante e arquitetura modular.

## 🔷 Descrição Geral

Uma ferramenta para realizar a coleta automatizada e visualização inteligente de pegadas digitais associadas a um alvo (domínio ou IP), sem gerar ruído de rede. Ideal para uso em ambientes controlados, CTFs, testes iniciais de reconhecimento e análises de infraestrutura.

## ⚙️ Tecnologias Utilizadas

### 🦀 Backend (Rust)
- reqwest e serde para requisições e parsing
- tokio para multitarefa com alto desempenho
- axum como webserver
- Módulos para fontes OSINT: crt.sh, Shodan, Wayback, dorker, etc.

### ⚛️ Frontend (React + TypeScript)
- Next.js
- Tauri para distribuição como aplicativo nativo
- Estilo clean brutalista, tema dark neon roxo
- UI com Framer Motion, TailwindCSS
- Visualização com Recharts
- Layout profissional com foco em UX

## 📊 Funcionalidades (MVP)

- Entrada do alvo (domínio/IP)
- Consultas OSINT passivas
- Visualização dinâmica de relações
- Exportação em múltiplos formatos

## 🚀 Instalação

```bash
# Clone o repositório
git clone https://github.com/cortexclub/cortex-map.git

# Instale as dependências do frontend
cd cortex-map/frontend
npm install

# Compile o backend
cd ../backend
cargo build --release
```

## 📦 Distribuição (em breve)

Disponível como:
- .exe (Windows)
- .AppImage (Linux)
- .dmg (Mac)

## 🌍 Objetivo do Projeto

Tornar-se a principal ferramenta brasileira de footprint passivo visual, utilizada por red teams, bug bounty hunters e profissionais de segurança.

---

Desenvolvido com 💜 pela comunidade CorteX Club 