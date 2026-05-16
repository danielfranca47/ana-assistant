# Ana — Assistente Pessoal com IA

<!-- Substitua [SCREENSHOT] por um GIF ou imagem real após o primeiro deploy -->
[SCREENSHOT]

Ana é uma assistente pessoal que organiza a sua rotina, agenda compromissos,
gere tarefas e aprende as suas preferências. Funciona com as suas próprias
chaves de API — os seus dados ficam apenas no seu servidor pessoal.

---

## Deploy em 1 clique

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/SEU-USUARIO/ana-assistant)

### Para utilizadores sem experiência técnica

1. Clique no botão acima e crie uma conta gratuita no Vercel (se ainda não tiver).
2. Siga as instruções até o deploy ficar concluído — demora cerca de 2 minutos.
3. Abra o URL gerado, insira as suas chaves de API na página de configuração, e a Ana está pronta.

---

## As suas chaves de API

A Ana precisa de duas chaves para funcionar. São gratuitas nos planos de entrada:

- **Chave Anthropic** (para o chat e análise de rotina) — obter em [console.anthropic.com](https://console.anthropic.com)
- **Chave OpenAI** (para transcrição de voz) — obter em [platform.openai.com](https://platform.openai.com)

Insira as chaves na página `/setup` que aparece automaticamente na primeira visita à aplicação.

---

## O que a Ana faz

- Rotina diária com timeline de tarefas
- Calendário mensal e visão semanal
- Chat por voz e texto com IA
- Relatório diário com rebalanceamento de rotina por IA
- Metas e preferências personalizadas

---

## Desenvolvimento local

**Pré-requisitos:** Node.js 18+, npm

```bash
git clone https://github.com/SEU-USUARIO/ana-assistant.git
cd ana-assistant
npm install
```

Crie o ficheiro `.env.local` na raiz do projecto:

```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

Inicialize a base de dados e arranque o servidor:

```bash
npx prisma generate
npx prisma db push
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no browser.
