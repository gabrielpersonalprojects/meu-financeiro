import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";

type Mode = "login" | "signup" | "forgot" | "reset";

// sua logo em /public/logo.svg
const LOGO_SRC = "/logo.svg";

// NOVA paleta da marca (FluxMoney)
const BRAND = {
  from: "#220055",
  to: "#4600ac",
  glow: "#8b5cf6", // roxo claro p/ efeitos suaves
};

const REMEMBER_EMAIL_KEY = "fluxmoney-remember-email";
const REMEMBER_EMAIL_ENABLED_KEY = "fluxmoney-remember-email-enabled";

function traduzirErroSupabase(message?: string) {
  const m = (message || "").toLowerCase();

  if (m.includes("missing email or phone")) return "Digite seu e-mail.";
  if (m.includes("missing password")) return "Digite sua senha.";
  if (m.includes("email is required")) return "Digite seu e-mail.";
  if (m.includes("password is required")) return "Digite sua senha.";

  if (m.includes("email not confirmed")) return "Você precisa confirmar seu e-mail antes de entrar.";
  if (m.includes("invalid login credentials"))
    return "E-mail ou senha inválidos. Se você ainda não tem conta, clique em “Criar conta”.";
  if (m.includes("user already registered")) return "Esse e-mail já está cadastrado. Tente entrar.";
  if (m.includes("password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (m.includes("signup is disabled")) return "Cadastro desativado no momento.";
  if (m.includes("rate limit")) return "Muitas tentativas. Aguarde um pouco e tente novamente.";

  return message || "Ocorreu um erro. Tente novamente.";
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M9.88 5.08A10.97 10.97 0 0112 5c7 0 10 7 10 7a18.2 18.2 0 01-3.26 4.39"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M6.1 6.1A18.3 18.3 0 002 12s3 7 10 7c1.1 0 2.14-.17 3.11-.49"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

type AuthPageProps = {
  initialMode?: Mode;
  onPasswordResetSuccess?: () => void;
};

export default function AuthPage({
  initialMode = "login",
  onPasswordResetSuccess,
}: AuthPageProps) {
  const [mode, setMode] = useState<Mode>(initialMode);

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");

  const [showPass1, setShowPass1] = useState(false);
  const [showPass2, setShowPass2] = useState(false);

  const [rememberMe, setRememberMe] = useState(true);

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [lastEmail, setLastEmail] = useState<string>("");

  useEffect(() => {
  setMode(initialMode);
  setErro(null);
  setMsg(null);

  if (initialMode === "reset") {
    setSenha("");
    setConfirmar("");
    setShowPass1(false);
    setShowPass2(false);
  }
}, [initialMode]);

  const limparCampos = () => {
    setEmail("");
    setSenha("");
    setConfirmar("");
    setShowPass1(false);
    setShowPass2(false);
  };

  const irParaLoginLimpo = () => {
    setMode("login");
    setErro(null);
    limparCampos();
  };

  const irParaCadastro = () => {
    setMode("signup");
    setErro(null);
    setMsg(null);
    setSenha("");
    setConfirmar("");
    setShowPass1(false);
    setShowPass2(false);
  };

  const irParaForgot = () => {
    setMode("forgot");
    setErro(null);
    setMsg(null);
    setSenha("");
    setConfirmar("");
    setShowPass1(false);
    setShowPass2(false);
  };

  const mostrarReenviar = !!lastEmail && !!erro && erro.toLowerCase().includes("confirmar seu e-mail");

  useEffect(() => {
  const savedRemember = localStorage.getItem(REMEMBER_EMAIL_ENABLED_KEY) === "true";
  const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY) || "";

  if (savedRemember && savedEmail) {
    setRememberMe(true);
    setEmail(savedEmail);
  } else {
    setRememberMe(false);
  }
}, []);

async function onEntrar(e: FormEvent) {
  e.preventDefault();

  setErro(null);
  setMsg(null);

  const emailTrim = email.trim();
  if (!emailTrim) {
    setErro("Digite seu e-mail.");
    return;
  }
  if (!senha) {
    setErro("Digite sua senha.");
    return;
  }

    if (rememberMe) {
    localStorage.setItem(REMEMBER_EMAIL_ENABLED_KEY, "true");
    localStorage.setItem(REMEMBER_EMAIL_KEY, emailTrim);
  } else {
    localStorage.removeItem(REMEMBER_EMAIL_ENABLED_KEY);
    localStorage.removeItem(REMEMBER_EMAIL_KEY);
  }
  setLoading(true);
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: emailTrim,
      password: senha,
    });
    if (error) throw error;
  } catch (err: any) {
    const friendly = traduzirErroSupabase(err?.message);
    setErro(friendly);

    if ((err?.message || "").toLowerCase().includes("email not confirmed")) {
      setLastEmail(emailTrim);
    }
  } finally {
    setLoading(false);
  }
}

  async function onCriarConta(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setMsg(null);

    if (senha.length < 6) {
      setErro("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== confirmar) {
      setErro("As senhas não conferem.");
      return;
    }

    setLoading(true);
    try {
      const emailCriado = email.trim();

      const { data, error } = await supabase.auth.signUp({
        email: emailCriado,
        password: senha,
      });
      if (error) throw error;

      setLastEmail(emailCriado);

      if (data?.session) {
        await supabase.auth.signOut();
      }

      setMsg("Conta criada! Agora confirme seu e-mail (veja também o spam) e depois faça login.");
      irParaLoginLimpo();
    } catch (err: any) {
      setErro(traduzirErroSupabase(err?.message));
    } finally {
      setLoading(false);
    }
  }

  async function onEnviarReset(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setMsg(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-senha`,
      });
      if (error) throw error;

      setMsg("Te enviamos um e-mail com o link para redefinir sua senha. Verifique também o spam.");
      setMode("login");
    } catch (err: any) {
      setErro(traduzirErroSupabase(err?.message));
    } finally {
      setLoading(false);
    }
  }

  async function onRedefinirSenha(e: FormEvent) {
  e.preventDefault();
  setErro(null);
  setMsg(null);

  if (senha.length < 6) {
    setErro("A senha precisa ter pelo menos 6 caracteres.");
    return;
  }

  if (senha !== confirmar) {
    setErro("As senhas não conferem.");
    return;
  }

  setLoading(true);
  try {
    const { error } = await supabase.auth.updateUser({
      password: senha,
    });

    if (error) throw error;

    setMsg("Senha redefinida com sucesso. Entre com sua nova senha.");

    const cleanUrl = `${window.location.origin}/`;
    window.history.replaceState({}, document.title, cleanUrl);

    await supabase.auth.signOut();

    setSenha("");
    setConfirmar("");
    setShowPass1(false);
    setShowPass2(false);
    setMode("login");

    onPasswordResetSuccess?.();
  } catch (err: any) {
    setErro(traduzirErroSupabase(err?.message));
  } finally {
    setLoading(false);
  }
}

  async function reenviarConfirmacao() {
    setErro(null);
    setMsg(null);

    const alvo = (lastEmail || "").trim();
    if (!alvo) {
      setErro("Digite seu e-mail acima (ou tente entrar novamente) para reenviar a confirmação.");
      return;
    }

    setLoading(true);
    try {
      const authAny = supabase.auth as any;

      if (typeof authAny.resend === "function") {
        const { error } = await authAny.resend({ type: "signup", email: alvo });
        if (error) throw error;

        setMsg("Pronto! Reenviamos o e-mail de confirmação. Verifique sua caixa de entrada e o spam.");
      } else {
        setErro("Não consegui reenviar por código nesta versão. Se quiser, a gente atualiza o supabase-js.");
      }
    } catch (err: any) {
      setErro(traduzirErroSupabase(err?.message));
    } finally {
      setLoading(false);
    }
  }

  return (
<div
  className="w-full min-h-screen flex flex-col items-center justify-center px-4 py-6 sm:py-8"
  style={{
    minHeight: "100dvh",
    background: `linear-gradient(180deg,
      ${BRAND.from} 0%,
      ${BRAND.to} 58%,
      #07031b 100%)`,
  }}
>
      {/* Glow roxo sutil (inferior direito) */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background: `radial-gradient(900px 650px at 85% 85%,
            rgba(70,0,172,0.22) 0%,
            rgba(70,0,172,0.10) 28%,
            rgba(70,0,172,0.00) 60%)`,
        }}
      />

      {/* Luz geral no topo */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background: "radial-gradient(circle at top, rgba(255,255,255,0.14), transparent 55%)",
        }}
      />

     <div className="w-full max-w-[380px] rounded-[24px] overflow-hidden shadow-2xl border border-white/15 bg-white/5 backdrop-blur-xl">
        {/* Header */}
        <div className="px-7 pt-6 pb-3">
          <div className="flex flex-col items-center">
<img
  src={LOGO_SRC}
  alt="Logo"
  className="mt-4 translate-x-[2px] w-[214px] h-[214px] object-contain drop-shadow md:w-[224px] md:h-[224px]"
/>
           <div className="mt-1 w-full h-px bg-white/20" />
          </div>

          <div className="mt-5 text-center">
            <h1 className="text-white text-xl font-semibold tracking-wide">
                {mode === "login"
    ? "Acesso"
    : mode === "signup"
    ? "Criar conta"
    : mode === "forgot"
    ? "Recuperar senha"
    : "Redefinir senha"}
            </h1>
            <p className="mt-1 text-white/70 text-sm">
  {mode === "login"
    ? "Entre com seu e-mail e senha."
    : mode === "signup"
    ? "Cadastre seu e-mail e defina sua senha."
    : mode === "forgot"
    ? "Informe seu e-mail para receber o link."
    : "Digite sua nova senha para concluir a recuperação."}
            </p>
          </div>

          {erro && (
            <div className="mt-5 rounded-xl border border-white/15 bg-black/25 text-white/90 p-3 text-sm">
              <span className="text-rose-200 font-medium">Ops:</span> {erro}
            </div>
          )}

          {msg && (
            <div className="mt-5 rounded-xl border border-white/15 bg-black/20 text-white/90 p-3 text-sm">
              {msg}
            </div>
          )}
        </div>

        {/* Corpo */}
        <div className="px-8 pb-8">
          {mode === "login" && (
            <form onSubmit={onEntrar} className="space-y-2">
<div className="rounded-xl overflow-hidden border border-white/20 bg-white/10">
  <input
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    className="w-full h-10 px-4 bg-transparent text-sm text-white placeholder:text-sm placeholder:text-white/50 outline-none"
    placeholder="E-mail"
    autoComplete="email"
  />
</div>

<div className="flex items-center rounded-xl border border-white/20 bg-white/10 pr-2">
  <input
    value={senha}
    onChange={(e) => setSenha(e.target.value)}
    type={showPass1 ? "text" : "password"}
    className="flex-1 h-10 min-w-0 px-4 bg-transparent text-sm text-white placeholder:text-sm placeholder:text-white/50 outline-none"
    placeholder="Senha"
    autoComplete="current-password"
  />
  <button
    type="button"
    onClick={() => setShowPass1((v) => !v)}
    className="shrink-0 w-10 h-10 grid place-items-center text-white/70 hover:text-white transition"
    aria-label={showPass1 ? "Ocultar senha" : "Mostrar senha"}
    title={showPass1 ? "Ocultar senha" : "Mostrar senha"}
  >
    <EyeIcon open={showPass1} />
  </button>
</div>

<div className="flex items-center justify-between mt-2 gap-3">
  <label className="flex items-center gap-2 text-[11px] text-white/65 select-none">
    <input
      type="checkbox"
      checked={rememberMe}
      onChange={(e) => setRememberMe(e.target.checked)}
      className="h-3.5 w-3.5 rounded border-white/30 bg-transparent accent-white/90"
    />
    Lembrar e-mail
  </label>

  <button
    type="button"
    onClick={irParaForgot}
    className="text-white/55 text-[11px] hover:text-white/80 hover:underline transition"
  >
    Esqueci minha senha
  </button>
</div>

<div className="pt-4">

  {/* BOTÃO ENTRAR (marca) */}
  <button
    disabled={loading}
className="group relative overflow-hidden mt-0 h-10 max-w-[280px] w-full mx-auto block rounded-xl
           text-sm text-white font-semibold tracking-wide
           transition hover:brightness-110
           hover:shadow-[0_12px_30px_rgba(70,0,172,0.20)]
           disabled:opacity-60"
                style={{
                  background: `linear-gradient(135deg,
                    ${BRAND.from} 0%,
                    ${BRAND.to} 82%,
                    rgba(255,255,255,0.06) 100%)`,
                  boxShadow: "0 10px 28px rgba(34,0,85,0.28)",
                }}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 group-hover:brightness-110"
                  style={{
                    background: `linear-gradient(135deg,
                      ${BRAND.from} 0%,
                      ${BRAND.to} 70%,
                      rgba(139,92,246,0.22) 100%)`,
                  }}
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style={{
                    background: `radial-gradient(120% 140% at 85% 85%,
                      rgba(139,92,246,0.22) 0%,
                      rgba(139,92,246,0.08) 45%,
                      rgba(139,92,246,0.00) 70%)`,
                  }}
                />
<span className="relative z-10">{loading ? "Entrando..." : "ENTRAR"}</span>
              </button>
</div>

              {mostrarReenviar && (
                <button
                  type="button"
                  onClick={reenviarConfirmacao}
                  disabled={loading}
                  className="w-full text-center text-white/70 text-sm hover:text-white hover:underline transition"
                >
                  Reenviar e-mail de confirmação
                </button>
              )}

              <button
                type="button"
                onClick={irParaCadastro}
                className="w-full text-center text-white/55 text-[11px] hover:text-white/80 hover:underline transition"
              >
                Criar conta
              </button>
            </form>
          )}

          {mode === "signup" && (
            <form onSubmit={onCriarConta} className="space-y-3">
<div className="rounded-xl overflow-hidden border border-white/20 bg-white/10">
  <input
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    className="w-full h-10 px-4 bg-transparent text-sm text-white placeholder:text-sm placeholder:text-white/50 outline-none"
    placeholder="Cadastre seu e-mail de acesso"
    autoComplete="email"
  />
</div>

<div className="flex items-center rounded-xl border border-white/20 bg-white/10 pr-2">
  <input
    value={senha}
    onChange={(e) => setSenha(e.target.value)}
    type={showPass1 ? "text" : "password"}
    className="flex-1 h-10 min-w-0 px-4 bg-transparent text-sm text-white placeholder:text-sm placeholder:text-white/50 outline-none"
    placeholder="Insira sua senha de acesso"
    autoComplete="new-password"
  />
  <button
    type="button"
    onClick={() => setShowPass1((v) => !v)}
    className="shrink-0 w-10 h-10 grid place-items-center text-white/70 hover:text-white transition"
    aria-label={showPass1 ? "Ocultar senha" : "Mostrar senha"}
    title={showPass1 ? "Ocultar senha" : "Mostrar senha"}
  >
    <EyeIcon open={showPass1} />
  </button>
</div>

<div className="flex items-center rounded-xl border border-white/20 bg-white/10 pr-2">
  <input
    value={confirmar}
    onChange={(e) => setConfirmar(e.target.value)}
    type={showPass2 ? "text" : "password"}
    className="flex-1 h-10 min-w-0 px-4 bg-transparent text-sm text-white placeholder:text-sm placeholder:text-white/50 outline-none"
    placeholder="Confirme sua senha de acesso"
    autoComplete="new-password"
  />
  <button
    type="button"
    onClick={() => setShowPass2((v) => !v)}
    className="shrink-0 w-10 h-10 grid place-items-center text-white/70 hover:text-white transition"
    aria-label={showPass2 ? "Ocultar senha" : "Mostrar senha"}
    title={showPass2 ? "Ocultar senha" : "Mostrar senha"}
  >
    <EyeIcon open={showPass2} />
  </button>
</div>

              {/* BOTÃO CRIAR CONTA (marca) */}
              <button
                disabled={loading}
className="group relative overflow-hidden mt-4 h-10 max-w-[280px] w-full mx-auto block rounded-xl
           text-sm text-white font-semibold tracking-wide
           transition hover:brightness-110
           hover:shadow-[0_12px_30px_rgba(70,0,172,0.20)]
           disabled:opacity-60"
                style={{
                  background: `linear-gradient(135deg,
                    ${BRAND.from} 0%,
                    ${BRAND.to} 82%,
                    rgba(255,255,255,0.06) 100%)`,
                  boxShadow: "0 10px 28px rgba(34,0,85,0.28)",
                }}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 group-hover:brightness-110"
                  style={{
                    background: `linear-gradient(135deg,
                      ${BRAND.from} 0%,
                      ${BRAND.to} 70%,
                      rgba(139,92,246,0.22) 100%)`,
                  }}
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style={{
                    background: `radial-gradient(120% 140% at 85% 85%,
                      rgba(139,92,246,0.22) 0%,
                      rgba(139,92,246,0.08) 45%,
                      rgba(139,92,246,0.00) 70%)`,
                  }}
                />
                <span className="relative z-10">{loading ? "Criando..." : "CRIAR CONTA"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMsg(null);
                  setErro(null);
                  irParaLoginLimpo();
                }}
                className="w-full text-center text-white/70 text-sm hover:text-white hover:underline transition"
              >
                Voltar para entrar
              </button>
            </form>
          )}

          {mode === "forgot" && (
            <form onSubmit={onEnviarReset} className="space-y-3">
<div className="rounded-xl overflow-hidden border border-white/20 bg-white/10">
  <input
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    className="w-full h-10 px-4 bg-transparent text-sm text-white placeholder:text-sm placeholder:text-white/50 outline-none"
    placeholder="Seu e-mail"
    autoComplete="email"
  />
</div>

              {/* BOTÃO ENVIAR LINK (marca) */}
              <button
                disabled={loading}
className="group relative overflow-hidden mt-4 h-10 max-w-[280px] w-full mx-auto block rounded-xl
           text-sm text-white font-semibold tracking-wide
           transition hover:brightness-110
           hover:shadow-[0_12px_30px_rgba(70,0,172,0.20)]
           disabled:opacity-60"
                style={{
                  background: `linear-gradient(135deg,
                    ${BRAND.from} 0%,
                    ${BRAND.to} 82%,
                    rgba(255,255,255,0.06) 100%)`,
                  boxShadow: "0 10px 28px rgba(34,0,85,0.28)",
                }}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 group-hover:brightness-110"
                  style={{
                    background: `linear-gradient(135deg,
                      ${BRAND.from} 0%,
                      ${BRAND.to} 70%,
                      rgba(139,92,246,0.22) 100%)`,
                  }}
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style={{
                    background: `radial-gradient(120% 140% at 85% 85%,
                      rgba(139,92,246,0.22) 0%,
                      rgba(139,92,246,0.08) 45%,
                      rgba(139,92,246,0.00) 70%)`,
                  }}
                />
                <span className="relative z-10">{loading ? "Enviando..." : "ENVIAR LINK"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMsg(null);
                  setErro(null);
                  irParaLoginLimpo();
                }}
                className="w-full text-center text-white/70 text-sm hover:text-white hover:underline transition"
              >
                Voltar para entrar
              </button>
            </form>
          )}

                    {mode === "reset" && (
            <form onSubmit={onRedefinirSenha} className="space-y-3">
              <div className="flex items-center rounded-xl border border-white/20 bg-white/10 pr-2">
                <input
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  type={showPass1 ? "text" : "password"}
                  className="flex-1 h-10 min-w-0 px-4 bg-transparent text-sm text-white placeholder:text-sm placeholder:text-white/50 outline-none"
                  placeholder="Nova senha"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass1((v) => !v)}
                  className="shrink-0 w-10 h-10 grid place-items-center text-white/70 hover:text-white transition"
                  aria-label={showPass1 ? "Ocultar senha" : "Mostrar senha"}
                  title={showPass1 ? "Ocultar senha" : "Mostrar senha"}
                >
                  <EyeIcon open={showPass1} />
                </button>
              </div>

              <div className="flex items-center rounded-xl border border-white/20 bg-white/10 pr-2">
                <input
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  type={showPass2 ? "text" : "password"}
                  className="flex-1 h-10 min-w-0 px-4 bg-transparent text-sm text-white placeholder:text-sm placeholder:text-white/50 outline-none"
                  placeholder="Confirmar nova senha"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass2((v) => !v)}
                  className="shrink-0 w-10 h-10 grid place-items-center text-white/70 hover:text-white transition"
                  aria-label={showPass2 ? "Ocultar senha" : "Mostrar senha"}
                  title={showPass2 ? "Ocultar senha" : "Mostrar senha"}
                >
                  <EyeIcon open={showPass2} />
                </button>
              </div>

              <button
                disabled={loading}
                className="group relative overflow-hidden mt-4 h-10 max-w-[280px] w-full mx-auto block rounded-xl
                           text-sm text-white font-semibold tracking-wide
                           transition hover:brightness-110
                           hover:shadow-[0_12px_30px_rgba(70,0,172,0.20)]
                           disabled:opacity-60"
                style={{
                  background: `linear-gradient(135deg,
                    ${BRAND.from} 0%,
                    ${BRAND.to} 82%,
                    rgba(255,255,255,0.06) 100%)`,
                  boxShadow: "0 10px 28px rgba(34,0,85,0.28)",
                }}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 group-hover:brightness-110"
                  style={{
                    background: `linear-gradient(135deg,
                      ${BRAND.from} 0%,
                      ${BRAND.to} 70%,
                      rgba(139,92,246,0.22) 100%)`,
                  }}
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style={{
                    background: `radial-gradient(120% 140% at 85% 85%,
                      rgba(139,92,246,0.22) 0%,
                      rgba(139,92,246,0.08) 45%,
                      rgba(139,92,246,0.00) 70%)`,
                  }}
                />
                <span className="relative z-10">
                  {loading ? "Salvando..." : "SALVAR NOVA SENHA"}
                </span>
              </button>
            </form>
          )}

        </div>
      </div>
<div className="mt-6 text-center text-[11px] text-white/25 tracking-wide select-none">
  Desenvolvido por Inpulso Digital LTDA
</div>
          <div className="pt-4 text-center text-[11px] text-white/25 tracking-wide">
  v0.2.0
</div>
    </div>
    
  );
}