import { createServerFn, createCsrfMiddleware } from "@tanstack/react-start";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Tudo neste arquivo roda SÓ no servidor — nunca é enviado ao navegador.
// A senha do admin, a chave secreta de sessão e a chave "service_role" do
// Supabase ficam só aqui, lidas de variáveis de ambiente do servidor
// (sem prefixo VITE_, então nunca entram no código público do site).
// ---------------------------------------------------------------------------

const COOKIE = "recanto_admin_sessao";
const COOKIE_TENTATIVAS = "recanto_admin_tentativas";
const DURACAO_SEGUNDOS = 60 * 60 * 24 * 30; // fica logado por 30 dias
const MAX_TENTATIVAS = 3;
const BLOQUEIO_MINUTOS = 30;

// Confere que a requisição realmente veio do próprio site (mesma origem),
// bloqueando tentativas de outro site forçar uma ação no seu navegador
// (CSRF) usando sua sessão sem você saber.
const protegerContraCsrf = createCsrfMiddleware();

function segredoSessao() {
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

type EstadoTentativas = { contagem: number; bloqueadoAte: number };

function lerTentativas(): EstadoTentativas {
  const cookie = getCookie(COOKIE_TENTATIVAS);
  if (!cookie) return { contagem: 0, bloqueadoAte: 0 };

  const [contagemStr, bloqueadoAteStr, assinatura] = cookie.split(".");
  const esperada = createHmac("sha256", segredoSessao())
    .update(`tentativas:${contagemStr}:${bloqueadoAteStr}`)
    .digest("hex");

  const bufA = Buffer.from(assinatura || "", "hex");
  const bufB = Buffer.from(esperada, "hex");
  if (bufA.length !== bufB.length || !timingSafeEqual(bufA, bufB)) {
    return { contagem: 0, bloqueadoAte: 0 };
  }
  return { contagem: Number(contagemStr) || 0, bloqueadoAte: Number(bloqueadoAteStr) || 0 };
}

function salvarTentativas(estado: EstadoTentativas) {
  const assinatura = createHmac("sha256", segredoSessao())
    .update(`tentativas:${estado.contagem}:${estado.bloqueadoAte}`)
    .digest("hex");
  setCookie(COOKIE_TENTATIVAS, `${estado.contagem}.${estado.bloqueadoAte}.${assinatura}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: BLOQUEIO_MINUTOS * 60,
  });
}

function limparTentativas() {
  deleteCookie(COOKIE_TENTATIVAS, { path: "/" });
}

/** Cliente do Supabase com acesso total (só usado aqui, no servidor) */
function supabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL;
  const chaveSecreta = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chaveSecreta) {
    throw new Error(
      "Faltam VITE_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY nas variáveis do servidor.",
    );
  }
  return createClient(url, chaveSecreta, { auth: { persistSession: false } });
}

/**
 * Traduz o erro de "duas reservas aprovadas na mesma data" (bloqueado
 * por uma trava no próprio banco) numa mensagem que faz sentido pro
 * admin entender, em vez de um erro técnico do Postgres.
 */
function traduzirErroBanco(error: { code?: string; message: string }): never {
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
  .middleware([protegerContraCsrf])
  .validator(LoginSchema)
  .handler(async ({ data }) => {
    const senhaCorreta = process.env.ADMIN_PASSWORD;
    if (!senhaCorreta) throw new Error("ADMIN_PASSWORD não configurada no servidor.");

    const tentativas = lerTentativas();
    const agora = Date.now();

    if (tentativas.bloqueadoAte > agora) {
      const minutosRestantes = Math.ceil((tentativas.bloqueadoAte - agora) / 60_000);
      return { ok: false, bloqueado: true, minutosRestantes };
    }

    if (data.senha !== senhaCorreta) {
      const novaContagem = tentativas.contagem + 1;
      if (novaContagem >= MAX_TENTATIVAS) {
        salvarTentativas({ contagem: 0, bloqueadoAte: agora + BLOQUEIO_MINUTOS * 60_000 });
        return { ok: false, bloqueado: true, minutosRestantes: BLOQUEIO_MINUTOS };
      }
      salvarTentativas({ contagem: novaContagem, bloqueadoAte: 0 });
      return { ok: false, bloqueado: false, tentativasRestantes: MAX_TENTATIVAS - novaContagem };
    }

    limparTentativas();

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
  .middleware([protegerContraCsrf])
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
  .middleware([protegerContraCsrf])
  .validator(AtualizarReservaSchema)
  .handler(async ({ data }) => {
    exigirSessaoValida();
    const { error } = await supabaseAdmin().from("reservas").update(data.mudanca).eq("id", data.id);
    if (error) traduzirErroBanco(error);
    return { ok: true };
  });

/**
 * Atualiza várias reservas de uma vez (usado quando o cliente pediu
 * mais de uma data no mesmo pedido — aprovar/recusar afeta todas as
 * datas do grupo junto).
 */
export const atualizarVariasReservasAdmin = createServerFn({ method: "POST" })
  .middleware([protegerContraCsrf])
  .validator(AtualizarVariasSchema)
  .handler(async ({ data }) => {
    exigirSessaoValida();
    const { error } = await supabaseAdmin().from("reservas").update(data.mudanca).in("id", data.ids);
    if (error) traduzirErroBanco(error);
    return { ok: true };
  });

export const alternarBloqueioAdmin = createServerFn({ method: "POST" })
  .middleware([protegerContraCsrf])
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
