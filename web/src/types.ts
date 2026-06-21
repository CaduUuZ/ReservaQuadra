// Tipos que espelham as respostas da API ReservaQuadra.

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Resource {
  id: string;
  name: string;
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

export interface Booking {
  id: string;
  resourceId: string;
  userId: string;
  startsAt: string;
  endsAt: string;
  resource?: Resource;
  user?: User;
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
