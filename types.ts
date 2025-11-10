
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
  humanId?: string;
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
  imageUrl?: string | null;
  categoryId?: string | null;
  vendorId?: string | null;
}
export type NewItem = Omit<Item, 'id' | 'normalizedName'> & { humanId?: string };

export interface CatalogItem {
  id: string;
  nameJa: string;
  mainImageUrl: string;
  skuOrTag?: string;
  nameEn?: string;
  nameZhHans?: string;
  nameZhHant?: string;
  nameKo?: string;
  descriptionJa?: string;
  descriptionEn?: string;
  normalizedName: string;
  createdAt: string;
  updatedAt: string;
  thumbnailUrl?: string | null;
}

export type NewCatalogItem = Omit<CatalogItem, 'id' | 'normalizedName' | 'createdAt' | 'updatedAt'>;


export interface SubLocation {
  id: string;
  humanId: string;
  name: string;
  description: string;
  imageUrl?: string | null;
}
export type NewSubLocation = Omit<SubLocation, 'id' | 'humanId'> & { humanId?: string };


export interface Location {
  id: string;
  humanId: string;
  name: string;
  description: string;
  storeId: string;
  imageUrl?: string | null;
  sublocations?: SubLocation[];
}
export type NewLocation = Omit<Location, 'id' | 'sublocations' | 'humanId'> & { humanId?: string };

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

export interface Vendor {
  id: string;
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  internalContactName?: string | null;
  notes?: string | null;
}

export type NewVendor = Omit<Vendor, 'id'>;
