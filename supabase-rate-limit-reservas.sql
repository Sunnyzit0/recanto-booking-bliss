-- Rate limit do formulário público de reserva (função criarSolicitacaoServidor
-- em src/lib/email-actions.ts) — sem isso dava pra automatizar centenas de
-- solicitações e estourar a cota de e-mails do Resend.
--
-- Rode este script uma vez no SQL Editor do Supabase.

create table if not exists reserva_rate_limit (
  chave text primary key,          -- hash do IP de quem enviou o formulário
  contagem integer not null default 0,
  janela_inicio timestamptz not null default now()
);

-- RLS ligado e sem nenhuma policy: só a chave "service_role" (usada só
-- no servidor, nunca exposta ao navegador) consegue ler/gravar essa tabela.
alter table reserva_rate_limit enable row level security;
