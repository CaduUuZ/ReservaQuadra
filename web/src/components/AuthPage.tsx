import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api";

export function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("JOGADOR");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isLogin = mode === "login";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isLogin) await login(email, password);
      else await register(name, email, password, role);
      // Sucesso: o AuthProvider seta o user e o App troca de tela sozinho.
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Algo deu errado");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>🏐 ReservaQuadra</h1>
        <p className="auth-sub">{isLogin ? "Entre na sua conta" : "Crie sua conta"}</p>

        <form onSubmit={submit} className="auth-form">
          {!isLogin && (
            <>
              <label>
                Nome
                <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
              </label>
              <div className="role-pick">
                <button
                  type="button"
                  className={role === "JOGADOR" ? "active" : ""}
                  onClick={() => setRole("JOGADOR")}
                >
                  🏐 Sou jogador
                </button>
                <button
                  type="button"
                  className={role === "EMPRESA" ? "active" : ""}
                  onClick={() => setRole("EMPRESA")}
                >
                  🏢 Tenho quadra
                </button>
              </div>
            </>
          )}
          <label>
            E-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" disabled={busy}>
            {busy ? "..." : isLogin ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <p className="auth-toggle">
          {isLogin ? "Ainda não tem conta?" : "Já tem conta?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(isLogin ? "register" : "login");
              setError(null);
            }}
          >
            {isLogin ? "Criar conta" : "Entrar"}
          </button>
        </p>

        {isLogin && (
          <p className="auth-hint">
            Demo: <code>cadu@reservaquadra.dev</code> / <code>senha123</code>
          </p>
        )}
      </div>
    </div>
  );
}
