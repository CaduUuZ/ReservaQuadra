import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";
import type { Availability, Booking, Resource, Slot, WaitlistEntry } from "./types";
import { useAuth } from "./auth/AuthContext";
import { AuthPage } from "./components/AuthPage";
import "./App.css";

// Mostra a hora (UTC) de um ISO. O backend trabalha em UTC, então exibimos UTC
// pra não confundir com o fuso do navegador.
const fmtTime = (iso: string) => iso.slice(11, 16);
const today = () => new Date().toISOString().slice(0, 10);

type Toast = { kind: "success" | "error" | "info"; text: string } | null;

export default function App() {
  const { user, loading, logout } = useAuth();

  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceId, setResourceId] = useState("");
  const [date, setDate] = useState(today());

  const [availability, setAvailability] = useState<Availability | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [toast, setToast] = useState<Toast>(null);

  const flash = (kind: NonNullable<Toast>["kind"], text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3500);
  };

  // Carrega as quadras quando há usuário logado.
  useEffect(() => {
    if (!user) return;
    api
      .listResources()
      .then((rs) => {
        setResources(rs);
        if (rs[0]) setResourceId(rs[0].id);
      })
      .catch(() => flash("error", "Não consegui carregar as quadras."));
  }, [user]);

  // Recarrega disponibilidade + reservas + fila quando muda quadra ou data.
  const refresh = useCallback(async () => {
    if (!resourceId) return;
    const [av, bk, wl] = await Promise.all([
      api.getAvailability(resourceId, date),
      api.listBookings({ resourceId, date }),
      api.listWaitlist({ resourceId }),
    ]);
    setAvailability(av);
    setBookings(bk);
    setWaitlist(wl);
  }, [resourceId, date]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  // Clicar num horário: livre -> reserva; ocupado -> entra na fila.
  const onSlotClick = async (slot: Slot) => {
    const payload = { resourceId, startsAt: slot.startsAt, endsAt: slot.endsAt };
    try {
      if (slot.available) {
        await api.createBooking(payload);
        flash("success", `Reserva criada às ${fmtTime(slot.startsAt)} ✓`);
      } else {
        await api.joinWaitlist(payload);
        flash("info", `Você entrou na fila das ${fmtTime(slot.startsAt)} 🎟️`);
      }
      await refresh();
    } catch (e) {
      flash("error", e instanceof ApiError ? e.message : "Erro inesperado");
    }
  };

  const onCancel = async (booking: Booking) => {
    try {
      const result = await api.cancelBooking(booking.id);
      if (result.promoted) {
        flash("success", "Reserva cancelada — o próximo da fila foi promovido! 🎉");
      } else {
        flash("info", "Reserva cancelada.");
      }
      await refresh();
    } catch (e) {
      flash("error", e instanceof ApiError ? e.message : "Erro ao cancelar");
    }
  };

  const onLeaveQueue = async (entry: WaitlistEntry) => {
    try {
      await api.leaveWaitlist(entry.id);
      flash("info", "Você saiu da fila.");
      await refresh();
    } catch (e) {
      flash("error", e instanceof ApiError ? e.message : "Erro");
    }
  };

  // --- Telas de boot / não autenticado ---
  if (loading) return <div className="boot">carregando…</div>;
  if (!user) return <AuthPage />;

  return (
    <div className="app">
      <header>
        <h1>🏐 ReservaQuadra</h1>
        <span className="subtitle">painel de reservas · concorrência garantida pelo banco</span>
        <div className="user-box">
          <span>👤 {user.name}</span>
          <button className="ghost" onClick={logout}>sair</button>
        </div>
      </header>

      <div className="controls">
        <label>
          Quadra
          <select value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
        <label>
          Data
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>

      <main className="grid">
        <section className="card">
          <h2>Disponibilidade <small>(UTC)</small></h2>
          <p className="hint">Clique num horário livre pra reservar, ou num ocupado pra entrar na fila.</p>
          <div className="slots">
            {availability?.slots.map((slot) => (
              <button
                key={slot.startsAt}
                className={`slot ${slot.available ? "free" : "busy"}`}
                onClick={() => onSlotClick(slot)}
                title={slot.available ? "Livre — clique pra reservar" : "Ocupado — clique pra entrar na fila"}
              >
                {fmtTime(slot.startsAt)}
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Jogos do dia</h2>
          <p className="hint">Clique num jogo pra ver/gerenciar os participantes.</p>
          {bookings.length === 0 && <p className="empty">Nenhum jogo nesse dia.</p>}
          <div className="games">
            {bookings.map((b) => (
              <BookingItem
                key={b.id}
                booking={b}
                currentUserId={user.id}
                onCancel={() => onCancel(b)}
                onChanged={refresh}
                flash={flash}
              />
            ))}
          </div>

          <h2 className="mt">Fila de espera</h2>
          {waitlist.length === 0 && <p className="empty">Fila vazia.</p>}
          <ul className="list">
            {waitlist.map((w) => (
              <li key={w.id}>
                <span><span className="pos">#{w.position}</span> {fmtTime(w.startsAt)}–{fmtTime(w.endsAt)} · <b>{w.user?.name ?? "—"}</b></span>
                {w.userId === user.id && (
                  <button className="ghost" onClick={() => onLeaveQueue(w)}>sair</button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <ConcurrencyDemo
          slots={availability?.slots ?? []}
          resourceId={resourceId}
          onDone={refresh}
          flash={flash}
        />
      </main>

      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
    </div>
  );
}

// --- Card de um jogo: expande pra ver/gerenciar participantes ---
function BookingItem({
  booking,
  currentUserId,
  onCancel,
  onChanged,
  flash,
}: {
  booking: Booking;
  currentUserId: string;
  onCancel: () => void;
  onChanged: () => Promise<void>;
  flash: (kind: "success" | "error" | "info", text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [guest, setGuest] = useState("");
  const isOwner = booking.userId === currentUserId;
  const parts = booking.participants ?? [];

  const addGuest = async () => {
    const name = guest.trim();
    if (!name) return;
    try {
      await api.addParticipant(booking.id, { guestName: name });
      setGuest("");
      await onChanged();
    } catch (e) {
      flash("error", e instanceof ApiError ? e.message : "Erro ao adicionar");
    }
  };

  const removeParticipant = async (participantId: string) => {
    try {
      await api.removeParticipant(booking.id, participantId);
      await onChanged();
    } catch (e) {
      flash("error", e instanceof ApiError ? e.message : "Erro ao remover");
    }
  };

  return (
    <div className="game">
      <div className="game-head">
        <button className="game-toggle" onClick={() => setOpen((v) => !v)}>
          <span className="chev">{open ? "▾" : "▸"}</span>
          {fmtTime(booking.startsAt)}–{fmtTime(booking.endsAt)} · <b>{booking.user?.name ?? "—"}</b>
          <span className="count">{parts.length} 👥</span>
        </button>
        {isOwner && <button className="ghost" onClick={onCancel}>cancelar</button>}
      </div>

      {open && (
        <div className="game-body">
          <ul className="part-list">
            {parts.map((p) => (
              <li key={p.id}>
                <span>
                  {p.user ? p.user.name : <em>{p.guestName} (convidado)</em>}
                  {p.userId === booking.userId && " 👑"}
                </span>
                {isOwner && p.userId !== booking.userId && (
                  <button className="x" title="remover" onClick={() => removeParticipant(p.id)}>
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
          {isOwner && (
            <div className="add-guest">
              <input
                placeholder="nome do convidado"
                value={guest}
                onChange={(e) => setGuest(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addGuest()}
              />
              <button onClick={addGuest}>+ convidado</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Demo de concorrência: dispara N reservas simultâneas no mesmo horário ---
function ConcurrencyDemo({
  slots,
  resourceId,
  onDone,
  flash,
}: {
  slots: Slot[];
  resourceId: string;
  onDone: () => Promise<void>;
  flash: (kind: "success" | "error" | "info", text: string) => void;
}) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok: number; conflict: number; other: number } | null>(null);

  const firstFree = slots.find((s) => s.available);

  const run = async (n: number) => {
    if (!firstFree) return flash("error", "Sem horário livre pra demonstrar.");
    setRunning(true);
    setResult(null);
    const payload = { resourceId, startsAt: firstFree.startsAt, endsAt: firstFree.endsAt };
    // Promise.all = todas as requisições disparadas "ao mesmo tempo".
    const settled = await Promise.allSettled(
      Array.from({ length: n }, () => api.createBooking(payload)),
    );
    let ok = 0, conflict = 0, other = 0;
    for (const s of settled) {
      if (s.status === "fulfilled") ok++;
      else if (s.reason instanceof ApiError && s.reason.status === 409) conflict++;
      else other++;
    }
    setResult({ ok, conflict, other });
    setRunning(false);
    await onDone();
  };

  return (
    <section className="card demo">
      <h2>⚡ Teste de concorrência</h2>
      <p className="hint">
        Dispara N reservas <b>simultâneas</b> no primeiro horário livre
        {firstFree ? ` (${fmtTime(firstFree.startsAt)})` : ""}. O esperado: <b>1 criada</b>, o resto bloqueado pelo banco.
      </p>
      <div className="demo-buttons">
        {[10, 30, 50].map((n) => (
          <button key={n} disabled={running || !firstFree} onClick={() => run(n)}>
            {running ? "..." : `disparar ${n}`}
          </button>
        ))}
      </div>
      {result && (
        <div className="demo-result">
          <span className="ok">✓ {result.ok} criada</span>
          <span className="conflict">⛔ {result.conflict} conflito</span>
          {result.other > 0 && <span className="other">⚠ {result.other} outro</span>}
        </div>
      )}
    </section>
  );
}
