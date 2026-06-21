// Cliente HTTP centralizado: todas as chamadas à API ReservaQuadra ficam aqui.
import type {
  Availability,
  Booking,
  CancelResult,
  Participant,
  Resource,
  User,
  WaitlistEntry,
} from "./types";

// URL da API. Em dev, a API roda na 3000 (a SPA roda na 5173).
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const TOKEN_KEY = "rq_token";
export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// Erro que carrega o status HTTP, pra UI reagir diferente a 401, 409, etc.
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      // Anexa o token JWT quando existe (rotas protegidas).
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? `Erro ${res.status}`);
  }
  return data as T;
}

interface AuthResponse {
  token: string;
  user: User;
}

interface SlotInput {
  resourceId: string;
  startsAt: string;
  endsAt: string;
}

export const api = {
  // --- Auth ---
  register: (input: { name: string; email: string; password: string }) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(input) }),
  login: (input: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(input) }),
  me: () => request<User>("/auth/me"),

  // --- Recursos ---
  listResources: () => request<Resource[]>("/resources"),
  getAvailability: (resourceId: string, date: string) =>
    request<Availability>(`/resources/${resourceId}/availability?date=${date}`),

  // --- Reservas (o userId vem do token, não do corpo) ---
  listBookings: (params: { resourceId?: string; date?: string } = {}) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return request<Booking[]>(`/bookings${q ? `?${q}` : ""}`);
  },
  createBooking: (input: SlotInput) =>
    request<Booking>("/bookings", { method: "POST", body: JSON.stringify(input) }),
  cancelBooking: (id: string) =>
    request<CancelResult>(`/bookings/${id}`, { method: "DELETE" }),

  // --- Participantes de um jogo ---
  addParticipant: (bookingId: string, input: { userId?: string; guestName?: string }) =>
    request<Participant>(`/bookings/${bookingId}/participants`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  removeParticipant: (bookingId: string, participantId: string) =>
    request<void>(`/bookings/${bookingId}/participants/${participantId}`, {
      method: "DELETE",
    }),

  // --- Fila de espera ---
  listWaitlist: (params: { resourceId?: string } = {}) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return request<WaitlistEntry[]>(`/waitlist${q ? `?${q}` : ""}`);
  },
  joinWaitlist: (input: SlotInput) =>
    request<WaitlistEntry>("/waitlist", { method: "POST", body: JSON.stringify(input) }),
  leaveWaitlist: (id: string) =>
    request<void>(`/waitlist/${id}`, { method: "DELETE" }),
};
