import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";
import type { Availability, Booking, Resource, Slot, WaitlistEntry } from "./types";
import { useAuth } from "./auth/AuthContext";
import { AuthPage } from "./components/AuthPage";
import "./App.css";

// Tudo em UTC (o backend trabalha em UTC), pra a data/hora exibida bater com os
// horários da grade e não escorregar de dia pelo fuso do navegador.
const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const SPORT_LABELS: Record<string, string> = {
  FUTEBOL: "⚽ Futebol",
  VOLEI: "🏐 Vôlei",
  TENIS: "🎾 Tênis",
  BEACH_TENNIS: "🏖️ Beach tennis",
  FUTEVOLEI: "🦶 Futevôlei",
  BASQUETE: "🏀 Basquete",
};
const SURFACE_LABELS: Record<string, string> = {
  AREIA: "Areia",
  SAIBRO: "Saibro",
  SINTETICO: "Sintético",
  CIMENTO: "Cimento",
  GRAMA: "Grama",
};
const fmtPrice = (cents: number | null) =>
  cents == null ? "" : `R$ ${(cents / 100).toFixed(2).replace(".", ",")}/h`;

const fmtTime = (iso: string) => iso.slice(11, 16);
const fmtHour = (iso: string) => `${Number(iso.slice(11, 13))}h`;
const today = () => new Date().toISOString().slice(0, 10);

// De um ISO datetime -> "Segunda, dia 22".
const fmtDayLabel = (iso: string) => {
  const d = new Date(iso);
  return `${WEEKDAYS[d.getUTCDay()]}, dia ${d.getUTCDate()}`;
};

// Da string do seletor de data "2026-06-22" -> "Segunda, 22 de junho de 2026".
const fmtSelectedDate = (dateStr: string) => {
  const [y, m, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, day));
  return `${WEEKDAYS[d.getUTCDay()]}, ${day} de ${MONTHS[m - 1]} de ${y}`;
};

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
  // Horários livres selecionados (por startsAt) para reservar de uma vez.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Esporte escolhido pro próximo jogo (dentre os que a quadra aceita).
  const [sport, setSport] = useState<string>("");
  const [sportOpen, setSportOpen] = useState(false);

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

  // Trocar de quadra/data zera a seleção (horários são de outro contexto).
  useEffect(() => {
    setSelected(new Set());
  }, [resourceId, date]);

  // Ao carregar/trocar a quadra, escolhe o 1º esporte aceito como padrão.
  useEffect(() => {
    const sports = availability?.resource.sports ?? [];
    setSport(sports[0] ?? "");
    setSportOpen(false);
  }, [availability?.resource.id]);

  // Clicar num horário: livre -> (des)seleciona; ocupado -> entra na fila.
  const onSlotClick = async (slot: Slot) => {
    if (slot.available) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(slot.startsAt)) next.delete(slot.startsAt);
        else next.add(slot.startsAt);
        return next;
      });
      return;
    }
    // Ocupado -> entra na fila (imediato).
    try {
      await api.joinWaitlist({ resourceId, startsAt: slot.startsAt, endsAt: slot.endsAt });
      flash("info", `Você entrou na fila das ${fmtTime(slot.startsAt)} 🎟️`);
      await refresh();
    } catch (e) {
      flash("error", e instanceof ApiError ? e.message : "Erro inesperado");
    }
  };

  // Confirma a seleção: junta horários contíguos numa reserva só e cria cada bloco.
  const confirmSelection = async () => {
    const slots = (availability?.slots ?? [])
      .filter((s) => selected.has(s.startsAt))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    if (slots.length === 0) return;

    // Agrupa contíguos: se um bloco termina onde o próximo começa, vira um só.
    const ranges: { startsAt: string; endsAt: string }[] = [];
    for (const s of slots) {
      const last = ranges[ranges.length - 1];
      if (last && last.endsAt === s.startsAt) last.endsAt = s.endsAt;
      else ranges.push({ startsAt: s.startsAt, endsAt: s.endsAt });
    }

    const results = await Promise.allSettled(
      ranges.map((r) => api.createBooking({ resourceId, ...r, sport: sport || undefined })),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const fail = results.length - ok;

    setSelected(new Set());
    await refresh();
    if (fail === 0) flash("success", `${ok} reserva(s) criada(s) ✓`);
    else flash("error", `${ok} criada(s), ${fail} em conflito`);
  };

  const clearSelection = () => setSelected(new Set());

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

      <p className="date-caption">🗓️ {fmtSelectedDate(date)}</p>

      <main className="grid">
        <section className="card">
          <h2>Disponibilidade <small>(UTC)</small></h2>

          {availability?.resource && (
            <div className="court-info">
              <span className="court-meta">
                🏟️ {SURFACE_LABELS[availability.resource.surface] ?? availability.resource.surface}
                {availability.resource.pricePerHour != null &&
                  ` · ${fmtPrice(availability.resource.pricePerHour)}`}
              </span>
              {availability.resource.sports.length > 0 && (
                <div className="sport-box">
                  <button className="sport-head" onClick={() => setSportOpen((v) => !v)}>
                    Esporte: <b>{SPORT_LABELS[sport] ?? "—"}</b>
                    <span className="chev">{sportOpen ? "▾" : "▸"}</span>
                  </button>
                  {sportOpen && (
                    <div className="sport-chips">
                      {availability.resource.sports.map((s) => (
                        <button
                          key={s}
                          className={`sport-chip ${s === sport ? "active" : ""}`}
                          onClick={() => {
                            setSport(s);
                            setSportOpen(false);
                          }}
                        >
                          {SPORT_LABELS[s] ?? s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <p className="hint">Selecione um ou mais horários livres e confirme. Horários ocupados: clique pra entrar na fila.</p>
          <div className="slots">
            {availability?.slots.map((slot) => (
              <button
                key={slot.startsAt}
                className={`slot ${slot.available ? "free" : "busy"} ${selected.has(slot.startsAt) ? "selected" : ""}`}
                onClick={() => onSlotClick(slot)}
                title={slot.available ? "Livre — clique pra selecionar" : "Ocupado — clique pra entrar na fila"}
              >
                {fmtTime(slot.startsAt)}
              </button>
            ))}
          </div>
          {selected.size > 0 && (
            <div className="select-bar">
              <span>{selected.size} horário(s) selecionado(s)</span>
              <button className="clear" onClick={clearSelection}>limpar</button>
              <button className="confirm" onClick={confirmSelection}>
                reservar {selected.size}
              </button>
            </div>
          )}
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

  const randomize = async (teams: number) => {
    try {
      await api.randomizeTeams(booking.id, teams);
      await onChanged();
      flash("success", `Times sorteados! ⚖️`);
    } catch (e) {
      flash("error", e instanceof ApiError ? e.message : "Erro ao sortear");
    }
  };

  const clearTeams = async () => {
    try {
      await api.clearTeams(booking.id);
      await onChanged();
    } catch (e) {
      flash("error", e instanceof ApiError ? e.message : "Erro");
    }
  };

  const hasTeams = parts.some((p) => p.team != null);

  // Linha de um participante (reusada na lista plana e na agrupada por time).
  const renderParticipant = (p: (typeof parts)[number]) => (
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
  );

  // Times presentes, ordenados (1, 2, 3...).
  const teamNumbers = [...new Set(parts.map((p) => p.team).filter((t): t is number => t != null))].sort();

  return (
    <div className="game">
      <div className="game-head">
        <button className="game-toggle" onClick={() => setOpen((v) => !v)}>
          <span className="chev">{open ? "▾" : "▸"}</span>
          <span>
            {fmtDayLabel(booking.startsAt)} · {fmtHour(booking.startsAt)}–{fmtHour(booking.endsAt)}
            {" · "}<b>{booking.user?.name ?? "—"}</b>
            {booking.sport && <span className="sport-badge">{SPORT_LABELS[booking.sport] ?? booking.sport}</span>}
          </span>
          <span className="count">{parts.length} 👥</span>
        </button>
        {isOwner && <button className="ghost" onClick={onCancel}>cancelar</button>}
      </div>

      {open && (
        <div className="game-body">
          {hasTeams ? (
            <div className="teams">
              {teamNumbers.map((t) => (
                <div key={t} className={`team team-${t}`}>
                  <h4>Time {t}</h4>
                  <ul className="part-list">
                    {parts.filter((p) => p.team === t).map(renderParticipant)}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <ul className="part-list">{parts.map(renderParticipant)}</ul>
          )}

          {isOwner && (
            <>
              <div className="add-guest">
                <input
                  placeholder="nome do convidado"
                  value={guest}
                  onChange={(e) => setGuest(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addGuest()}
                />
                <button onClick={addGuest}>+ convidado</button>
              </div>

              {parts.length >= 2 && (
                <div className="teams-bar">
                  <span>⚖️ Sortear times:</span>
                  {[2, 3, 4].map((n) => (
                    <button key={n} onClick={() => randomize(n)}>{n}</button>
                  ))}
                  {hasTeams && (
                    <button className="clear" onClick={clearTeams}>limpar</button>
                  )}
                </div>
              )}
            </>
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
