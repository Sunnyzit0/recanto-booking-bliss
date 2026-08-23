import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// Tudo neste arquivo roda SÓ no servidor — nunca é enviado ao navegador.
// A senha do admin, a chave secreta de sessão e a chave "service_role" do
// Supabase ficam só aqui, lidas de variáveis de ambiente do servidor
// (sem prefixo VITE_, então nunca entram no código público do site).
// ---------------------------------------------------------------------------

const COOKIE = "recanto_admin_sessao";
const DURACAO_SEGUNDOS = 60 * 60 * 24 * 30; // fica logado por 30 dias

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

// --- Login / sessão ---

export const loginAdmin = createServerFn({ method: "POST" })
  .validator((d: { senha: string }) => d)
  .handler(async ({ data }) => {
    const senhaCorreta = process.env.ADMIN_PASSWORD;
    if (!senhaCorreta) throw new Error("ADMIN_PASSWORD não configurada no servidor.");

    if (data.senha !== senhaCorreta) {
      return { ok: false };
    }

    const expiraEm = Date.now() + DURACAO_SEGUNDOS * 1000;
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

export const sairAdmin = createServerFn({ method: "POST" }).handler(async () => {
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
  .validator((d: { id: string; mudanca: Record<string, unknown> }) => d)
  .handler(async ({ data }) => {
    exigirSessaoValida();
    const { error } = await supabaseAdmin().from("reservas").update(data.mudanca).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const alternarBloqueioAdmin = createServerFn({ method: "POST" })
  .validator((d: { data: string; jaBloqueada: boolean }) => d)
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
