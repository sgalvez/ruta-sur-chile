export type Status = 'open' | 'closed' | 'partial' | 'unknown';
export type Service = 'toilets' | 'water' | 'showers' | 'electricity' | 'parking';
export interface Source { id: string; url: string; label: string; adapter: 'conaf' | 'pases' | 'operator' | 'directory' | 'reference'; expectedTitle?: string; titleSelector?: string; contentSelector?: string; reviewedHash?: string; checkedAt: string | null; }
export interface Place {
  id: string; name: string; kind: 'camping' | 'park' | 'reserve'; region: string; locality: string;
  coordinates: [number, number]; coordinateNote: string; coordinateSource: string;
  description: string; highlights: string[]; services: Record<Service, boolean | null>;
  serviceSource?: string; access: string; carAccess: 'yes' | 'restricted' | 'unknown';
  phone?: string; whatsapp?: string; website?: string; booking?: string;
  price?: { amount: number; unit: string; source: string; observedAt: string };
  sources: Source[]; statusSourceIds: string[];
}
export interface Observation {
  sourceId: string; checkedAt: string | null; attemptedAt: string; ok: boolean;
  hash?: string; changed: boolean; notice: string; error?: string;
  status: Status; evidenceAt: string | null; validUntil: string | null;
}
export interface State { schemaVersion: 1; attemptedAt: string | null; lastSuccessfulAt: string | null; observations: Record<string, Observation>; }
export interface Catalog { schemaVersion: 1; researchedAt: string; places: Place[]; }
