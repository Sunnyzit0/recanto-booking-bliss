import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie, deleteCookie, getRequestIP } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual, randomBytes, scryptSync } from "node:crypto";
import { z } from "zod";
import { Resend } from "resend";
import { CONFIG, formatarData } from "@/lib/reservas";

// ---------------------------------------------------------------------------
// Tudo neste arquivo roda SÓ no servidor — nunca é enviado ao navegador.
// A senha do admin, a chave secreta de sessão e a chave "service_role" do
// Supabase ficam só aqui, lidas de variáveis de ambiente do servidor
// (sem prefixo VITE_, então nunca entram no código público do site).
// ---------------------------------------------------------------------------

const COOKIE = "recanto_admin_sessao";
const DURACAO_SEGUNDOS = 60 * 60 * 24 * 30; // fica logado por 30 dias
const MAX_TENTATIVAS = 3;
const BLOQUEIO_MINUTOS = 30;

// Confere que a requisição realmente veio do próprio site (mesma origem),
// bloqueando tentativas de outro site forçar uma ação no seu navegador
// (CSRF) usando sua sessão sem você saber.

export function segredoSessao() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "Configure a variável SESSION_SECRET (mínimo 32 caracteres) no servidor.",
    );
  }
  return s;
}

function assinar(expiraEm: number) {
  return createHmac("sha256", segredoSessao()).update(`admin:${expiraEm}`).digest("hex");
}

function tokenValido(token: string | undefined): boolean {
  if (!token) return false;
  const [expiraStr, assinaturaRecebida] = token.split(".");
  const expiraEm = Number(expiraStr);
  if (!expiraEm || Date.now() > expiraEm || !assinaturaRecebida) return false;

  const esperada = assinar(expiraEm);
  const bufA = Buffer.from(assinaturaRecebida, "hex");
  const bufB = Buffer.from(esperada, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function exigirSessaoValida() {
  if (!tokenValido(getCookie(COOKIE))) {
    throw new Error("Não autorizado. Faça login novamente.");
  }
}

// --- Controle de tentativas de login (trava por 30min após 3 erros) ---
//
// Guardado numa tabela no servidor (não num cookie): um cookie é
// controlado pelo próprio navegador de quem está tentando logar, então
// bastava limpar os cookies pra resetar o contador e continuar
// tentando senha à vontade. Aqui a chave é um hash do IP de quem fez a
// requisição — o hash evita guardar o IP em texto puro no banco.

type EstadoTentativas = { contagem: number; bloqueadoAte: number };

/** Identifica quem está tentando logar pelo IP (via cabeçalho de proxy da Vercel) */
function chaveTentativas(): string {
  const ip = getRequestIP({ xForwardedFor: true }) || "desconhecido";
  return createHmac("sha256", segredoSessao()).update(`login-tentativa:${ip}`).digest("hex");
}

async function lerTentativas(chave: string): Promise<EstadoTentativas> {
  const { data } = await supabaseAdmin()
    .from("admin_login_tentativas")
    .select("contagem, bloqueado_ate")
    .eq("chave", chave)
    .maybeSingle();
  if (!data) return { contagem: 0, bloqueadoAte: 0 };
  return {
    contagem: data.contagem ?? 0,
    bloqueadoAte: data.bloqueado_ate ? new Date(data.bloqueado_ate).getTime() : 0,
  };
}

async function salvarTentativas(chave: string, estado: EstadoTentativas) {
  await supabaseAdmin()
    .from("admin_login_tentativas")
    .upsert({
      chave,
      contagem: estado.contagem,
      bloqueado_ate: estado.bloqueadoAte ? new Date(estado.bloqueadoAte).toISOString() : null,
      atualizado_em: new Date().toISOString(),
    });
}

async function limparTentativas(chave: string) {
  await supabaseAdmin().from("admin_login_tentativas").delete().eq("chave", chave);
}

/** Cliente do Supabase com acesso total (só usado aqui, no servidor) */
export function supabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL;
  const chaveSecreta = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chaveSecreta) {
    throw new Error(
      "Faltam VITE_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY nas variáveis do servidor.",
    );
  }
  return createClient(url, chaveSecreta, { auth: { persistSession: false } });
}

// --- Senha do admin: guardada no banco (com hash), permite trocar
// pelo próprio painel. Se nunca foi trocada ainda, usa a variável de
// ambiente ADMIN_PASSWORD como valor inicial (compatibilidade).

function gerarHashSenha(senha: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(senha, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function conferirHashSenha(senha: string, armazenado: string): boolean {
  const [salt, hashEsperado] = armazenado.split(":");
  if (!salt || !hashEsperado) return false;
  const hashCalculado = scryptSync(senha, salt, 64).toString("hex");
  const bufA = Buffer.from(hashCalculado, "hex");
  const bufB = Buffer.from(hashEsperado, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

async function conferirSenhaAdmin(senha: string): Promise<boolean> {
  const { data } = await supabaseAdmin()
    .from("configuracoes")
    .select("valor")
    .eq("chave", "admin_senha_hash")
    .maybeSingle();

  if (data?.valor) {
    return conferirHashSenha(senha, data.valor);
  }
  // Ainda não trocou a senha pelo painel — usa a variável de ambiente
  const senhaPadrao = process.env.ADMIN_PASSWORD;
  if (!senhaPadrao) throw new Error("ADMIN_PASSWORD não configurada no servidor.");
  return senha === senhaPadrao;
}

/**
 * Avisa o cliente por e-mail quando a reserva dele é aprovada ou
 * recusada (só manda se ele tiver preenchido e-mail no formulário).
 * Falha silenciosa: se o e-mail não sair, não trava a ação do admin.
 */
async function avisarClientePorEmail(
  linhas: { email: string | null; nome: string; data: string; valor: number; horario: string }[],
  status: "aprovada" | "recusada",
) {
  const comEmail = linhas.filter((l): l is typeof l & { email: string } => !!l.email);
  if (comEmail.length === 0) return;

  const chave = process.env.RESEND_API_KEY;
  if (!chave) return;

  const { email, nome, horario } = comEmail[0];
  const datas = comEmail.map((l) => formatarData(l.data)).join(", ");
  const valorTotal = comEmail.reduce((soma, l) => soma + l.valor, 0);

  const aprovada = status === "aprovada";
  const assunto = aprovada
    ? `Sua reserva no ${CONFIG.nome} foi aprovada!`
    : `Sobre sua solicitação no ${CONFIG.nome}`;

  const corpo = aprovada
    ? `<p>Boa notícia, ${nome}! Sua reserva para <strong>${datas}</strong> (${horario}) foi <strong>aprovada</strong>.</p>
       <p>Valor combinado: R$ ${valorTotal}. Pagamento: ${CONFIG.pagamento}.</p>
       <p>Qualquer dúvida, chama no telefone ${CONFIG.telefone}.</p>`
    : `<p>Olá, ${nome}. Infelizmente não conseguimos confirmar sua solicitação para <strong>${datas}</strong> dessa vez.</p>
       <p>Se quiser tentar outra data, é só acessar o site de novo ou chamar no telefone ${CONFIG.telefone}.</p>`;

  try {
    const resend = new Resend(chave);
    await resend.emails.send({
      from: `${CONFIG.nome} <reservas@recantodapiscina.com.br>`,
      to: email,
      subject: assunto,
      html: `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
               <h2 style="color: #0C4137;">${CONFIG.nome}</h2>
               ${corpo}
             </div>`,
    });
  } catch (erro) {
    console.error("Falha ao avisar cliente por e-mail:", erro);
  }
}

/**
 * Traduz o erro de "duas reservas aprovadas na mesma data" (bloqueado
 * por uma trava no próprio banco) numa mensagem que faz sentido pro
 * admin entender, em vez de um erro técnico do Postgres.
 */
export function traduzirErroBanco(error: { code?: string; message: string }): never {
  if (error.code === "23505") {
    throw new Error(
      "Já existe uma reserva aprovada para uma dessas datas. Recuse ou mude a data antes de aprovar.",
    );
  }
  throw new Error(error.message);
}

// --- Esquemas de validação (Zod) ---
// Restringe exatamente o que cada ação pode alterar — mesmo que alguém
// tente mandar campos extras direto pela API, o servidor rejeita.

const DataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

const MudancaReservaSchema = z
  .object({
    data: DataISO.optional(),
    valor: z.number().positive().max(100000).optional(),
    horario: z.string().min(1).max(100).optional(),
    status: z.enum(["pendente", "aprovada", "recusada"]).optional(),
    observacao: z.string().max(1000).optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, { message: "Nada para atualizar" });

const LoginSchema = z.object({ senha: z.string().min(1).max(200) });
const AtualizarReservaSchema = z.object({ id: z.string().uuid(), mudanca: MudancaReservaSchema });
const AtualizarVariasSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(3),
  mudanca: MudancaReservaSchema,
});
const AlternarBloqueioSchema = z.object({ data: DataISO, jaBloqueada: z.boolean() });

// --- Login / sessão ---

export const loginAdmin = createServerFn({ method: "POST" })
  .validator(LoginSchema)
  .handler(async ({ data }) => {
    const chave = chaveTentativas();
    const tentativas = await lerTentativas(chave);
    const agora = Date.now();

    if (tentativas.bloqueadoAte > agora) {
      const minutosRestantes = Math.ceil((tentativas.bloqueadoAte - agora) / 60_000);
      return { ok: false, bloqueado: true, minutosRestantes };
    }

    const senhaCorreta = await conferirSenhaAdmin(data.senha);

    if (!senhaCorreta) {
      const novaContagem = tentativas.contagem + 1;
      if (novaContagem >= MAX_TENTATIVAS) {
        await salvarTentativas(chave, { contagem: 0, bloqueadoAte: agora + BLOQUEIO_MINUTOS * 60_000 });
        return { ok: false, bloqueado: true, minutosRestantes: BLOQUEIO_MINUTOS };
      }
      await salvarTentativas(chave, { contagem: novaContagem, bloqueadoAte: 0 });
      return { ok: false, bloqueado: false, tentativasRestantes: MAX_TENTATIVAS - novaContagem };
    }

    await limparTentativas(chave);

    const expiraEm = agora + DURACAO_SEGUNDOS * 1000;
    const token = `${expiraEm}.${assinar(expiraEm)}`;

    setCookie(COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DURACAO_SEGUNDOS,
    });

    return { ok: true };
  });

export const verificarSessaoAdmin = createServerFn({ method: "GET" }).handler(async () => {
  return { logado: tokenValido(getCookie(COOKIE)) };
});

export const sairAdmin = createServerFn({ method: "POST" })
  .handler(async () => {
    deleteCookie(COOKIE, { path: "/" });
    return { ok: true };
  });

// --- Dados do admin (exigem sessão válida) ---

export const listarReservasAdmin = createServerFn({ method: "GET" }).handler(async () => {
  exigirSessaoValida();
  const { data, error } = await supabaseAdmin()
    .from("reservas")
    .select("*")
    .order("data", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listarBloqueiosAdmin = createServerFn({ method: "GET" }).handler(async () => {
  exigirSessaoValida();
  const { data, error } = await supabaseAdmin().from("bloqueios").select("data");
  if (error) throw new Error(error.message);
  return (data ?? []).map((b: { data: string }) => b.data);
});

export const atualizarReservaAdmin = createServerFn({ method: "POST" })
  .validator(AtualizarReservaSchema)
  .handler(async ({ data }) => {
    exigirSessaoValida();
    const client = supabaseAdmin();
    const { error } = await client.from("reservas").update(data.mudanca).eq("id", data.id);
    if (error) traduzirErroBanco(error);

    if (data.mudanca.status === "aprovada" || data.mudanca.status === "recusada") {
      const { data: linha } = await client
        .from("reservas")
        .select("email, nome, data, valor, horario")
        .eq("id", data.id)
        .maybeSingle();
      if (linha) await avisarClientePorEmail([linha], data.mudanca.status);
    }

    return { ok: true };
  });

/**
 * Atualiza várias reservas de uma vez (usado quando o cliente pediu
 * mais de uma data no mesmo pedido — aprovar/recusar afeta todas as
 * datas do grupo junto).
 */
export const atualizarVariasReservasAdmin = createServerFn({ method: "POST" })
  .validator(AtualizarVariasSchema)
  .handler(async ({ data }) => {
    exigirSessaoValida();
    const client = supabaseAdmin();
    const { error } = await client.from("reservas").update(data.mudanca).in("id", data.ids);
    if (error) traduzirErroBanco(error);

    if (data.mudanca.status === "aprovada" || data.mudanca.status === "recusada") {
      const { data: linhas } = await client
        .from("reservas")
        .select("email, nome, data, valor, horario")
        .in("id", data.ids);
      if (linhas) await avisarClientePorEmail(linhas, data.mudanca.status);
    }

    return { ok: true };
  });

export const alternarBloqueioAdmin = createServerFn({ method: "POST" })
  .validator(AlternarBloqueioSchema)
  .handler(async ({ data }) => {
    exigirSessaoValida();
    const client = supabaseAdmin();
    if (data.jaBloqueada) {
      const { error } = await client.from("bloqueios").delete().eq("data", data.data);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await client.from("bloqueios").insert({ data: data.data });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Exclui uma ou mais reservas (usado pra limpar reservas antigas/já passadas) */
export const excluirReservasAdmin = createServerFn({ method: "POST" })
  .validator(z.object({ ids: z.array(z.string().uuid()).min(1).max(50) }))
  .handler(async ({ data }) => {
    exigirSessaoValida();
    const { error } = await supabaseAdmin().from("reservas").delete().in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Ligar/desligar recebimento de novas reservas no site ---

export const obterStatusReservas = createServerFn({ method: "GET" }).handler(async () => {
  exigirSessaoValida();
  const { data, error } = await supabaseAdmin()
    .from("configuracoes")
    .select("valor")
    .eq("chave", "reservas_abertas")
    .maybeSingle();
  if (error) throw new Error(error.message);
  // Se nunca foi configurado, considera aberto por padrão
  return { abertas: data?.valor !== "false" };
});

export const definirStatusReservas = createServerFn({ method: "POST" })
  .validator(z.object({ abertas: z.boolean() }))
  .handler(async ({ data }) => {
    exigirSessaoValida();
    const { error } = await supabaseAdmin()
      .from("configuracoes")
      .upsert({ chave: "reservas_abertas", valor: data.abertas ? "true" : "false" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Configuração do e-mail que recebe avisos de reserva nova ---

export const obterEmailAdmin = createServerFn({ method: "GET" }).handler(async () => {
  exigirSessaoValida();
  const { data, error } = await supabaseAdmin()
    .from("configuracoes")
    .select("valor")
    .eq("chave", "email_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { email: data?.valor ?? "" };
});

export const salvarEmailAdmin = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().email().max(200) }))
  .handler(async ({ data }) => {
    exigirSessaoValida();
    const { error } = await supabaseAdmin()
      .from("configuracoes")
      .upsert({ chave: "email_admin", valor: data.email });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Trocar a senha do admin (pelo próprio painel) ---

export const trocarSenhaAdmin = createServerFn({ method: "POST" })
  .validator(z.object({ senhaAtual: z.string().min(1), novaSenha: z.string().min(6).max(200) }))
  .handler(async ({ data }) => {
    exigirSessaoValida();

    const senhaAtualCorreta = await conferirSenhaAdmin(data.senhaAtual);
    if (!senhaAtualCorreta) {
      return { ok: false, erro: "Senha atual incorreta." };
    }

    const novoHash = gerarHashSenha(data.novaSenha);
    const { error } = await supabaseAdmin()
      .from("configuracoes")
      .upsert({ chave: "admin_senha_hash", valor: novoHash });
    if (error) throw new Error(error.message);

    return { ok: true };
  });

// --- Recuperação de senha (esqueci a senha) ---
// Manda um link por e-mail pro endereço já cadastrado no painel — não
// precisa digitar e-mail nenhum, já que só existe um admin.

const VALIDADE_TOKEN_RECUPERACAO_MS = 1000 * 60 * 30; // 30 minutos

function assinarTokenRecuperacao(expiraEm: number): string {
  return createHmac("sha256", segredoSessao()).update(`recuperar-senha:${expiraEm}`).digest("hex");
}

function tokenRecuperacaoValido(token: string): boolean {
  const [expiraStr, assinatura] = token.split(".");
  const expiraEm = Number(expiraStr);
  if (!expiraEm || Date.now() > expiraEm || !assinatura) return false;
  const esperada = assinarTokenRecuperacao(expiraEm);
  const bufA = Buffer.from(assinatura, "hex");
  const bufB = Buffer.from(esperada, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export const solicitarRecuperacaoSenha = createServerFn({ method: "POST" }).handler(async () => {
  const { data } = await supabaseAdmin()
    .from("configuracoes")
    .select("valor")
    .eq("chave", "email_admin")
    .maybeSingle();

  const emailAdmin = data?.valor;
  if (!emailAdmin) return { ok: true };

  const chaveResend = process.env.RESEND_API_KEY;
  if (!chaveResend) return { ok: true };

  const expiraEm = Date.now() + VALIDADE_TOKEN_RECUPERACAO_MS;
  const token = `${expiraEm}.${assinarTokenRecuperacao(expiraEm)}`;
  const link = `${CONFIG.urlBase}/redefinir-senha?token=${token}`;

  try {
    await new Resend(chaveResend).emails.send({
      from: `${CONFIG.nome} <reservas@recantodapiscina.com.br>`,
      to: emailAdmin,
      subject: "Redefinir sua senha do painel",
      html: `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
               <h2 style="color: #0C4137;">${CONFIG.nome}</h2>
               <p>Recebemos um pedido pra redefinir a senha do painel administrativo.</p>
               <p><a href="${link}" style="background: #06D6A0; color: #0C4137; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: bold;">Criar nova senha</a></p>
               <p style="color: #888; font-size: 12px;">Esse link vale por 30 minutos. Se você não pediu isso, pode ignorar este e-mail.</p>
             </div>`,
    });
  } catch (erro) {
    console.error("Falha ao enviar e-mail de recuperação:", erro);
  }

  return { ok: true };
});

export const redefinirSenhaComToken = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string().min(10), novaSenha: z.string().min(6).max(200) }))
  .handler(async ({ data }) => {
    if (!tokenRecuperacaoValido(data.token)) {
      return { ok: false, erro: "Link inválido ou expirado. Peça um novo." };
    }

    const novoHash = gerarHashSenha(data.novaSenha);
    const { error } = await supabaseAdmin()
      .from("configuracoes")
      .upsert({ chave: "admin_senha_hash", valor: novoHash });
    if (error) throw new Error(error.message);

    return { ok: true };
  });

// --- Configurações editáveis do site (preço, capacidade, horário) ---

const ConfigSiteSchema = z.object({
  valorDiaria: z.number().positive().max(100000),
  capacidade: z.string().min(1).max(100),
  horario: z.string().min(1).max(100),
  // Exige a senha de novo mesmo com sessão válida — a sessão dura 30
  // dias, então isso evita que uma sessão esquecida aberta (ou um
  // cookie roubado) altere preço/config sem confirmar quem está mexendo.
  senhaAtual: z.string().min(1),
});

export const obterConfigSiteAdmin = createServerFn({ method: "GET" }).handler(async () => {
  exigirSessaoValida();
  const { data, error } = await supabaseAdmin()
    .from("configuracoes")
    .select("chave, valor")
    .in("chave", ["valor_diaria", "capacidade", "horario"]);
  if (error) throw new Error(error.message);

  const mapa = Object.fromEntries((data ?? []).map((c) => [c.chave, c.valor]));
  return {
    valorDiaria: Number(mapa.valor_diaria) || 600,
    capacidade: mapa.capacidade || "até 40 pessoas",
    horario: mapa.horario || "das 8h às 20h",
  };
});

export const salvarConfigSiteAdmin = createServerFn({ method: "POST" })
  .validator(ConfigSiteSchema)
  .handler(async ({ data }) => {
    exigirSessaoValida();

    const senhaCorreta = await conferirSenhaAdmin(data.senhaAtual);
    if (!senhaCorreta) {
      return { ok: false, erro: "Senha atual incorreta." };
    }

    const { error } = await supabaseAdmin().from("configuracoes").upsert([
      { chave: "valor_diaria", valor: String(data.valorDiaria) },
      { chave: "capacidade", valor: data.capacidade },
      { chave: "horario", valor: data.horario },
    ]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Conteúdo do site (sobre, diferenciais, regras) — editável sem senha extra ---

const DIFERENCIAIS_PADRAO = [
  { titulo: "Piscina com cascata", texto: "Piscina ampla com chafariz decorativo e iluminação à noite." },
  { titulo: "Churrasqueira e fogão a lenha", texto: "Fogão a lenha, forno e churrasqueira prontos para o dia inteiro de festa." },
  { titulo: "Área gourmet", texto: "Cooktop, pia e bancada de mármore com mesa e banco rústicos." },
  { titulo: "Espaço amplo", texto: "Bastante espaço externo para receber os convidados com conforto." },
  { titulo: "Wi-fi liberado", texto: "Internet disponível em todo o espaço." },
  { titulo: "Lugar tranquilo", texto: "Ambiente calmo, ideal para relaxar e aproveitar o dia com quem você ama." },
];

const SOBRE_TEXTO_PADRAO =
  "O aluguel inclui toda a estrutura: piscina com cascata, churrasqueira, fogão a lenha, área " +
  "gourmet completa e wi-fi. Ideal para todo tipo de evento e celebração, dos encontros em " +
  "família às festas maiores.";

const ConteudoSiteSchema = z.object({
  sobreTexto: z.string().min(1).max(2000),
  diferenciais: z.array(z.object({ titulo: z.string().min(1).max(80), texto: z.string().min(1).max(300) })).max(12),
  regras: z.array(z.string().min(1).max(300)).max(30),
});

export const obterConteudoSiteAdmin = createServerFn({ method: "GET" }).handler(async () => {
  exigirSessaoValida();
  const { data, error } = await supabaseAdmin()
    .from("configuracoes")
    .select("chave, valor")
    .in("chave", ["sobre_texto", "diferenciais", "regras"]);
  if (error) throw new Error(error.message);

  const mapa = Object.fromEntries((data ?? []).map((c) => [c.chave, c.valor]));
  return {
    sobreTexto: mapa.sobre_texto || SOBRE_TEXTO_PADRAO,
    diferenciais: mapa.diferenciais ? JSON.parse(mapa.diferenciais) : DIFERENCIAIS_PADRAO,
    regras: mapa.regras ? JSON.parse(mapa.regras) : [],
  };
});

export const salvarConteudoSiteAdmin = createServerFn({ method: "POST" })
  .validator(ConteudoSiteSchema)
  .handler(async ({ data }) => {
    exigirSessaoValida();
    const { error } = await supabaseAdmin().from("configuracoes").upsert([
      { chave: "sobre_texto", valor: data.sobreTexto },
      { chave: "diferenciais", valor: JSON.stringify(data.diferenciais) },
      { chave: "regras", valor: JSON.stringify(data.regras) },
    ]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Galeria de fotos (upload direto pelo painel, sem precisar de código) ---

const UploadFotoSchema = z.object({
  nomeArquivo: z.string().min(1).max(200),
  tipoMime: z.enum(["image/jpeg", "image/png", "image/webp"]),
  dadosBase64: z.string().min(1),
  alt: z.string().min(1).max(200),
});

export const listarFotosGaleriaAdmin = createServerFn({ method: "GET" }).handler(async () => {
  exigirSessaoValida();
  const { data } = await supabaseAdmin()
    .from("configuracoes")
    .select("valor")
    .eq("chave", "galeria_fotos")
    .maybeSingle();
  return { fotos: data?.valor ? JSON.parse(data.valor) : [] };
});

export const enviarFotoGaleriaAdmin = createServerFn({ method: "POST" })
  .validator(UploadFotoSchema)
  .handler(async ({ data }) => {
    exigirSessaoValida();
    const client = supabaseAdmin();

    const bytes = Buffer.from(data.dadosBase64, "base64");
    if (bytes.length > 5 * 1024 * 1024) {
      return { ok: false, erro: "Imagem muito grande (máximo 5MB)." };
    }

    const extensao = data.tipoMime === "image/png" ? "png" : data.tipoMime === "image/webp" ? "webp" : "jpg";
    const caminho = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extensao}`;

    const { error: erroUpload } = await client.storage
      .from("galeria")
      .upload(caminho, bytes, { contentType: data.tipoMime });
    if (erroUpload) throw new Error(erroUpload.message);

    const { data: urlPublica } = client.storage.from("galeria").getPublicUrl(caminho);

    const { data: atual } = await client
      .from("configuracoes")
      .select("valor")
      .eq("chave", "galeria_fotos")
      .maybeSingle();
    const fotos = atual?.valor ? JSON.parse(atual.valor) : [];
    fotos.push({ src: urlPublica.publicUrl, alt: data.alt, caminho });

    const { error: erroSalvar } = await client
      .from("configuracoes")
      .upsert({ chave: "galeria_fotos", valor: JSON.stringify(fotos) });
    if (erroSalvar) throw new Error(erroSalvar.message);

    return { ok: true, fotos };
  });

export const excluirFotoGaleriaAdmin = createServerFn({ method: "POST" })
  .validator(z.object({ caminho: z.string().min(1) }))
  .handler(async ({ data }) => {
    exigirSessaoValida();
    const client = supabaseAdmin();

    await client.storage.from("galeria").remove([data.caminho]);

    const { data: atual } = await client
      .from("configuracoes")
      .select("valor")
      .eq("chave", "galeria_fotos")
      .maybeSingle();
    const fotos = (atual?.valor ? JSON.parse(atual.valor) : []).filter(
      (f: { caminho: string }) => f.caminho !== data.caminho,
    );

    const { error } = await client
      .from("configuracoes")
      .upsert({ chave: "galeria_fotos", valor: JSON.stringify(fotos) });
    if (error) throw new Error(error.message);

    return { ok: true, fotos };
  });
