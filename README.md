# Recanto da Piscina — Site de Reservas

Site de reservas para o Recanto da Piscina, espaço de eventos com piscina em Padre Bernardo, GO.
Clientes escolhem datas no calendário e enviam uma solicitação; o dono aprova ou recusa pelo painel administrativo.

## Stack

- **Framework:** TanStack Start (React + Vite + Nitro)
- **Banco de dados:** Supabase (PostgreSQL + Row Level Security)
- **Hospedagem:** Vercel
- **Estilo:** Tailwind CSS

## Como funciona

- **Página pública (`/`):** calendário mostrando datas Disponíveis / Em análise / Reservadas / Indisponíveis. O cliente escolhe de 1 a 3 datas e envia nome + telefone.
- **Painel admin (`/admin`):** login por senha (verificada no servidor), lista de solicitações, aprovar/recusar (em lote quando é um pedido de várias datas), editar valor/data/horário, bloquear datas manualmente.
- Toda ação sensível (ler reservas com nome/telefone, aprovar, editar, bloquear) passa por **funções de servidor** (`src/lib/admin-actions.ts`) usando a chave `service_role` do Supabase — a chave pública do site nunca tem esse acesso.

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha com suas chaves (veja abaixo)
npm run dev
```

## Variáveis de ambiente

| Variável | Onde usar | Descrição |
|---|---|---|
| `VITE_SUPABASE_URL` | Cliente e servidor | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Cliente | Chave pública (anon) do Supabase |
| `ADMIN_PASSWORD` | Só servidor | Senha de acesso ao `/admin` (valor inicial, até ser trocada pelo painel) |
| `SESSION_SECRET` | Só servidor | String aleatória (32+ caracteres) usada pra assinar cookies de sessão, tokens de e-mail e chaves de rate limit |
| `SUPABASE_SERVICE_ROLE_KEY` | Só servidor | Chave secreta do Supabase — nunca deve ter prefixo `VITE_` nem ser exposta ao navegador |
| `RESEND_API_KEY` | Só servidor | Chave da API do Resend, usada pra enviar os e-mails de notificação de reserva |
| `VITE_TURNSTILE_SITE_KEY` | Cliente (opcional) | Site key do Cloudflare Turnstile — ativa o captcha discreto no formulário de reserva |
| `TURNSTILE_SECRET_KEY` | Só servidor (opcional) | Secret key do Cloudflare Turnstile — sem ela, o captcha fica desativado |

Veja `.env.example` na raiz do projeto pra descrições mais detalhadas. As variáveis "só servidor"
são configuradas direto no painel da Vercel (Settings → Environment Variables), nunca commitadas no Git.

## Banco de dados (Supabase)

Os scripts SQL usados para configurar tabelas, permissões (RLS) e funções ficam na raiz do
projeto (arquivos `supabase-*.sql`), executados manualmente pelo SQL Editor do Supabase — não são
rodados automaticamente no deploy. Ao clonar o projeto num novo Supabase, rode todos esses arquivos
na ordem em que foram criados.

Principais peças:
- Tabelas `reservas` e `bloqueios`
- Função `datas_ocupadas()` / `datas_pendentes()` — expõem só as datas (sem nome/telefone) pro calendário público
- Trigger que impede reservar fora da janela de 6 meses
- Trigger que impede mais de 3 datas por pedido
- Índice único que impede duas reservas APROVADAS na mesma data

## Deploy

Push na branch `main` do GitHub → a Vercel publica automaticamente. Um workflow do GitHub Actions
(`.github/workflows/manter-supabase-ativo.yml`) faz um ping no banco 2x por semana pra evitar que o
projeto gratuito do Supabase pause por inatividade.

## Domínio

Hoje publicado em `recantodapiscina.vercel.app`. Ao configurar um domínio próprio, atualizar a
constante `URL_BASE` em `src/routes/index.tsx` (usada nas tags de SEO/compartilhamento).
