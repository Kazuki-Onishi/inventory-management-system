
export enum Role {
  Admin = 'Admin',
  Editor = 'Editor',
  Viewer = 'Viewer',
  NoAccess = 'No Access',
}

export interface User {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

export interface Store {
  id: string;
  name: string;
}
export type NewStore = Omit<Store, 'id'>;


export interface Permission {
  // FIX: Added 'id' to reflect the data structure used in the app, where permissions have document IDs.
  id: string;
  userId: string;
  storeId: string;
  role: Role;
  canViewCost: boolean;
}


export type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface Invite {
  id: string;
  code: string;
  storeId: string;
  role: Role;
  canViewCost: boolean;
  createdBy: string;
  createdAt: string;
  status: InviteStatus;
  email?: string;
  expiresAt?: string;
  redeemedBy?: string;
  redeemedAt?: string;
  revokedBy?: string;
  revokedAt?: string;
  expiredAt?: string;
}

export interface NewInvite {
  storeId: string;
  role: Role;
  canViewCost: boolean;
  email?: string;
  expiresAt?: string;
}

export interface Category {
  id: string;
  name: string;
}
export type NewCategory = Omit<Category, 'id'>;

export interface Item {
  id:string;
  name: string; // Full name, e.g., "コーヒー（オリジナルブレンド）"
  normalizedName: string;
  shortName: string;
  description: string; // Will be used for "details"
  costA: number;
  costB: number;
  sku?: string;
  isDiscontinued: boolean;
  nameEn?: string;
  janCode?: string;
  supplier?: string;
  categoryId?: string | null;
}
export type NewItem = Omit<Item, 'id' | 'normalizedName'>;


export interface SubLocation {
  id: string;
  humanId: string;
  name: string;
  description: string;
}
export type NewSubLocation = Omit<SubLocation, 'id'>;


export interface Location {
  id: string;
  humanId: string;
  name: string;
  description: string;
  storeId: string;
  sublocations?: SubLocation[];
}
export type NewLocation = Omit<Location, 'id' | 'sublocations'>;

export interface Stocktake {
    id: string;
    storeId: string;

    itemId: string;
    locationId: string;
    subLocationId?: string;
    lastCount: number;
    lastCountedAt: string;
    description?: string;
}
export type NewStocktake = Omit<Stocktake, 'id'>;
