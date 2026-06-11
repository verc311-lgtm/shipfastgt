export interface TrackingHistory {
  date: string;
  time: string;
  status: string;
  location: string;
  details: string;
}

export interface Shipment {
  id: string;
  lockerId: string;
  sender: string;
  receiver: string;
  origin: string;
  destination: string;
  status: 'Creado' | 'En Tránsito' | 'En Sucursal' | 'En Ruta' | 'Entregado' | 'Retrasado';
  serviceType: 'Express' | 'Estándar';
  weight: number;
  dimensions: string;
  lastUpdated: string;
  history: TrackingHistory[];
  signatureUrl?: string;
  signeeName?: string;
  notes?: string;
}

export interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export interface PreAlert {
  id: string;
  lockerId: string;
  sender: string;
  description: string;
  weightEst: number;
  status: 'Pendiente' | 'Recibido';
  dateCreated: string;
  declaredValue?: number;
  insurance?: string;
  invoiceFileName?: string;
}

export interface UserProfile {
  lockerId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  role: string;
  password?: string;
}

export interface RatesSettings {
  baseEstandar: number;
  baseExpress: number;
  pesoEstandar: number;
  pesoExpress: number;
  laredoRate: number;
  mexicoRate: number;
  sheinRate: number;
}
