// Tipos que espelham as respostas da API ReservaQuadra.

export interface User {
  id: string;
  name: string;
  email: string;
  role: string; // "JOGADOR" ou "EMPRESA"
}

export interface Resource {
  id: string;
  name: string;
  sports: string[]; // esportes aceitos (ex: ["FUTEBOL","FUTEVOLEI"])
  surface: string; // tipo de piso (ex: "AREIA")
  pricePerHour: number | null; // em centavos
}

export interface Slot {
  startsAt: string; // ISO
  endsAt: string; // ISO
  available: boolean;
}

export interface Availability {
  resource: Resource;
  date: string;
  slots: Slot[];
}

export interface Participant {
  id: string;
  bookingId: string;
  userId: string | null;
  guestName: string | null;
  team: number | null;
  user?: User;
}

export interface Booking {
  id: string;
  resourceId: string;
  userId: string; // o DONO do jogo
  startsAt: string;
  endsAt: string;
  sport: string | null; // esporte escolhido pra este jogo
  resource?: Resource;
  user?: User;
  participants?: Participant[];
}

export interface WaitlistEntry {
  id: string;
  resourceId: string;
  userId: string;
  startsAt: string;
  endsAt: string;
  status: string;
  position: number;
  user?: User;
  resource?: Resource;
}

export interface CancelResult {
  cancelled: string;
  promoted: Booking | null;
}

export interface Message {
  id: string;
  bookingId: string;
  userId: string;
  text: string;
  createdAt: string;
  user?: { id: string; name: string };
}
