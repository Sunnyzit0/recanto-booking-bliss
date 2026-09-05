-- Controle de tentativas de login do /admin, feito no servidor (numa
-- tabela) em vez de um cookie — cookie é controlado pelo navegador do
-- próprio visitante, então bastava limpar os cookies pra resetar o
-- contador e continuar tentando senha à vontade.
--
-- Rode este script uma vez no SQL Editor do Supabase.

create table if not exists admin_login_tentativas (
  chave text primary key,          -- hash do IP de quem tentou logar
  contagem integer not null default 0,
  bloqueado_ate timestamptz,
  atualizado_em timestamptz not null default now()
);

-- RLS ligado e sem nenhuma policy: só a chave "service_role" (usada só
-- no servidor, em src/lib/admin-actions.ts, nunca exposta ao navegador)
-- consegue ler/gravar essa tabela.
alter table admin_login_tentativas enable row level security;
