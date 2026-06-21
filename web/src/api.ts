// Cliente HTTP centralizado: todas as chamadas à API ReservaQuadra ficam aqui.
import type {
  Availability,
  Booking,
  CancelResult,
  Resource,
  User,
  WaitlistEntry,
} from "./types";

// URL da API. Em dev, a API roda na 3000 (a SPA roda na 5173).
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

// Erro que carrega o status HTTP, pra UI reagir diferente a 409, 404, etc.
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? `Erro ${res.status}`);
  }
  return data as T;
}

interface CreateBookingInput {
  resourceId: string;
  userId: string;
  startsAt: string;
  endsAt: string;
}

export const api = {
  listUsers: () => request<User[]>("/users"),
  listResources: () => request<Resource[]>("/resources"),

  getAvailability: (resourceId: string, date: string) =>
    request<Availability>(`/resources/${resourceId}/availability?date=${date}`),

  listBookings: (params: { resourceId?: string; date?: string } = {}) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return request<Booking[]>(`/bookings${q ? `?${q}` : ""}`);
  },
  createBooking: (input: CreateBookingInput) =>
    request<Booking>("/bookings", { method: "POST", body: JSON.stringify(input) }),
  cancelBooking: (id: string) =>
    request<CancelResult>(`/bookings/${id}`, { method: "DELETE" }),

  listWaitlist: (params: { resourceId?: string } = {}) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return request<WaitlistEntry[]>(`/waitlist${q ? `?${q}` : ""}`);
  },
  joinWaitlist: (input: CreateBookingInput) =>
    request<WaitlistEntry>("/waitlist", { method: "POST", body: JSON.stringify(input) }),
  leaveWaitlist: (id: string) =>
    request<void>(`/waitlist/${id}`, { method: "DELETE" }),
};
