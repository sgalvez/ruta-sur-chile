export type Status = 'open' | 'closed' | 'partial' | 'unknown';
export type Service = 'toilets' | 'water' | 'showers' | 'electricity' | 'parking';
export type Route = 'main' | 'austral';
export type Theme = 'myths' | 'heritage';
export interface Source { id: string; url: string; label: string; adapter: 'conaf' | 'pases' | 'operator' | 'directory' | 'reference'; expectedTitle?: string; titleSelector?: string; contentSelector?: string; reviewedHash?: string; checkedAt: string | null; }
export interface Place {
  id: string; name: string; kind: 'camping' | 'park' | 'reserve' | 'monument' | 'attraction' | 'cemetery' | 'town'; region: string; locality: string;
  routes: Route[]; themes: Theme[];
  story?: { text: string; label: string; sourceId: string };
  walk?: { description: string; minutes?: number; km?: number; sourceId: string };
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
export interface State { schemaVersion: 2; attemptedAt: string | null; lastSuccessfulAt: string | null; observations: Record<string, Observation>; }
export interface Ferry {
  id: string; name: string; routes: Route[]; operator: string; vehicles: boolean | null;
  terminals: { name: string; mapUrl: string }[];
  duration: string; booking: string; bookingNote: string; schedule: string;
  fare: string; observedAt: string; validUntil?: string; sources: Source[];
  legs?: string[];
}
export interface RoadNotice { id: string; region: string; road: string; name: string; restriction: string; summary: string; status: Status; reportedStatus: string; evidenceAt: string | null; updatedAt: string | null; coordinates: [number,number] | null; }
export interface Mobility { schemaVersion: 2; attemptedAt: string | null; checkedAt: string | null; ok: boolean; sourceUrl: string; error?: string; notices: RoadNotice[]; }
export interface Catalog { schemaVersion: 2; researchedAt: string; places: Place[]; ferries: Ferry[]; }
