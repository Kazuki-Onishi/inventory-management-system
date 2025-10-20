
import { User, Store, Permission, Role, Item, Location, Stocktake, NewStore, NewItem, NewLocation, NewSubLocation, SubLocation, Category, NewCategory, Vendor, NewVendor, Invite, InviteStatus, NewInvite } from '../types';
import { ensureLocationHumanId, generateNextLocationHumanId, generateNextSubLocationHumanId } from '../lib/locations';
import { deriveHumanIdFromId, ensureItemHumanId } from '../lib/items';
import { db, auth, googleProvider } from './firebase';
import {
  deleteImageByUrl,
  uploadItemImageToStorage,
  uploadLocationImageToStorage,
  uploadSubLocationImageToStorage,
} from './storage';
import { signInWithPopup, User as FirebaseUser } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  where,
  writeBatch,
  addDoc,
  updateDoc,
  arrayUnion,
  deleteDoc,
  runTransaction,
  deleteField,
} from 'firebase/firestore';

// Helper to fetch a collection and map to our types
async function getCollectionData<T>(collectionName: string): Promise<T[]> {
    const querySnapshot = await getDocs(collection(db, collectionName));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
}

function generateInviteCode(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function normalizeEmail(email?: string | null): string | undefined {
  return email ? email.trim().toLowerCase() : undefined;
}

function nowIsoString(): string {
  return new Date().toISOString();
}
function toInvite(id: string, data: any): Invite {
  return {
    id,
    code: data.code ?? id,
    storeId: data.storeId,
    role: data.role as Role,
    canViewCost: !!data.canViewCost,
    createdBy: data.createdBy ?? '',
    createdAt: data.createdAt ?? nowIsoString(),
    status: (data.status ?? 'pending') as InviteStatus,
    email: data.email ?? undefined,
    expiresAt: data.expiresAt ?? undefined,
    redeemedBy: data.redeemedBy ?? undefined,
    redeemedAt: data.redeemedAt ?? undefined,
    revokedBy: data.revokedBy ?? undefined,
    revokedAt: data.revokedAt ?? undefined,
    expiredAt: data.expiredAt ?? undefined,
  };
}



async function createInviteInternal(input: NewInvite): Promise<Invite> {
  let code = generateInviteCode();
  let inviteRef = doc(db, 'invites', code);
  let existing = await getDoc(inviteRef);
  while (existing.exists()) {
    code = generateInviteCode();
    inviteRef = doc(db, 'invites', code);
    existing = await getDoc(inviteRef);
  }
  const normalizedEmail = normalizeEmail(input.email) ?? null;
  const payload = {
    code,
    storeId: input.storeId,
    role: input.role,
    canViewCost: input.canViewCost,
    createdBy: auth.currentUser?.uid || 'system',
    createdAt: nowIsoString(),
    status: 'pending',
    email: normalizedEmail,
    expiresAt: input.expiresAt ?? null,
  };
  await setDoc(inviteRef, payload);
  return toInvite(inviteRef.id, payload);
}

export const api = {
  loginWithGoogle: async (): Promise<User> => {
    const result = await signInWithPopup(auth, googleProvider);
    const firebaseUser = result.user;

    const userRef = doc(db, 'users', firebaseUser.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      return { id: userSnap.id, ...userSnap.data() } as User;
    } else {
      // Create a new user profile in Firestore
      const newUser: Omit<User, 'id'> = {
        email: firebaseUser.email || '',
        name: firebaseUser.displayName || 'New User',
        isAdmin: false, // Default new users to not be admins
      };
      await setDoc(userRef, newUser);
      return { id: firebaseUser.uid, ...newUser };
    }
  },
  
  fetchUserData: async (userId: string): Promise<{ user: User | undefined, permissions: Permission[], stores: Store[] }> => {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    let user: User;
    if (userSnap.exists()) {
      user = { id: userSnap.id, ...userSnap.data() } as User;
    } else {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser || firebaseUser.uid !== userId) {
        throw new Error("User not found in Firestore");
      }
      const fallbackName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'New User';
      const newUser: Omit<User, 'id'> = {
        email: firebaseUser.email || '',
        name: fallbackName,
        isAdmin: false,
      };
      await setDoc(userRef, newUser);
      user = { id: userId, ...newUser };
    }

    const userEmail = normalizeEmail(user.email);
    if (userEmail) {
      const emailInvitesQuery = query(collection(db, 'invites'), where('email', '==', userEmail));
      const emailInvitesSnapshot = await getDocs(emailInvitesQuery);
      for (const inviteDoc of emailInvitesSnapshot.docs) {
        const inviteData = inviteDoc.data() as any;
        const status = inviteData.status ?? 'pending';
        if (status !== 'pending') continue;

        const expiresAt = inviteData.expiresAt ? new Date(inviteData.expiresAt) : null;
        if (expiresAt && expiresAt.getTime() < Date.now()) {
          await updateDoc(inviteDoc.ref, {
            status: 'expired',
            expiredAt: nowIsoString(),
          });
          continue;
        }

    const permissionId = `${user.id}_${inviteData.storeId}`;
        const permissionRef = doc(db, 'permissions', permissionId);
        await setDoc(permissionRef, {
          userId: user.id,
          storeId: inviteData.storeId,
          role: inviteData.role,
          canViewCost: !!inviteData.canViewCost,
        }, { merge: true });

        await updateDoc(inviteDoc.ref, {
          status: 'accepted',
          redeemedBy: user.id,
          redeemedAt: nowIsoString(),
        });
      }
    }

    if (user.isAdmin) {
      // Admins get all stores and all permissions
      const stores = await getCollectionData<Store>('stores');
      const permissions = await getCollectionData<Permission>('permissions');
      return { user, permissions, stores };
    }
    
    // Non-admins get permissions based on their userId
    const permissionsQuery = query(collection(db, 'permissions'), where('userId', '==', userId), where('role', '!=', Role.NoAccess));
    const permissionsSnap = await getDocs(permissionsQuery);
    const userPermissions = permissionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Permission));
    
    if (userPermissions.length === 0) {
        return { user, permissions: [], stores: [] };
    }

    const accessibleStoreIds = userPermissions.map(p => p.storeId);
    const storesQuery = query(collection(db, 'stores'), where('__name__', 'in', accessibleStoreIds));
    const storesSnap = await getDocs(storesQuery);
    const accessibleStores = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Store));
    
    return { user, permissions: userPermissions, stores: accessibleStores };
  },

  fetchAllUsers: async (): Promise<User[]> => {
    const usersQuery = query(collection(db, 'users'), where('isAdmin', '==', false));
    const querySnapshot = await getDocs(usersQuery);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
  },
  
  fetchAllStores: (): Promise<Store[]> => getCollectionData<Store>('stores'),
  
  fetchAllPermissions: (): Promise<Permission[]> => getCollectionData<Permission>('permissions'),

  updatePermission: async (newPermission: Permission): Promise<Permission> => {
      // Use a composite key for the document ID to ensure uniqueness
      const permissionId = `${newPermission.userId}_${newPermission.storeId}`;
      const permissionRef = doc(db, 'permissions', permissionId);
      // FIX: The original error on the return statement is resolved by updating the Permission type.
      // Additionally, destructure the 'id' out of the permission object before saving to Firestore to avoid data redundancy.
      const { id, ...permissionToStore } = newPermission;
      await setDoc(permissionRef, permissionToStore, { merge: true });
      return { ...newPermission, id: permissionId };
  },

  fetchInvites: async (storeIds?: string[]): Promise<Invite[]> => {
    const invitesCollection = collection(db, 'invites');
    if (!storeIds) {
      const snapshot = await getDocs(invitesCollection);
      return snapshot.docs.map((docSnap) => toInvite(docSnap.id, docSnap.data()));
    }
    if (storeIds.length === 0) {
      return [];
    }
    const chunkSize = 10;
    const invitesMap = new Map<string, Invite>();
    for (let i = 0; i < storeIds.length; i += chunkSize) {
      const chunk = storeIds.slice(i, i + chunkSize);
      const q = query(invitesCollection, where('storeId', 'in', chunk));
      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => {
        invitesMap.set(docSnap.id, toInvite(docSnap.id, docSnap.data()));
      });
    }
    return Array.from(invitesMap.values()).sort((a, b) => {
      const aDate = a.createdAt ?? '';
      const bDate = b.createdAt ?? '';
      return bDate.localeCompare(aDate);
    });
  },

  createInvite: async (input: NewInvite): Promise<Invite> => {
    return createInviteInternal(input);
  },

  createInvites: async (input: NewInvite, count: number): Promise<Invite[]> => {
    const MAX_COUNT = 20;
    if (!Number.isInteger(count) || count < 1) {
      throw new Error('Invite count must be a positive integer');
    }
    if (count > MAX_COUNT) {
      throw new Error(`Invite count may not exceed ${MAX_COUNT}`);
    }
    const invites: Invite[] = [];
    for (let index = 0; index < count; index += 1) {
      const invite = await createInviteInternal(input);
      invites.push(invite);
    }
    return invites;
  },

  revokeInvite: async (code: string): Promise<void> => {
    const inviteRef = doc(db, 'invites', code);
    const inviteSnap = await getDoc(inviteRef);
    if (!inviteSnap.exists()) {
      throw new Error('Invite not found');
    }
    const invite = toInvite(inviteSnap.id, inviteSnap.data());
    if (invite.status === 'accepted') {
      throw new Error('Invite was already accepted');
    }
    const revokedAt = nowIsoString();
    await updateDoc(inviteRef, {
      status: 'revoked',
      revokedBy: auth.currentUser?.uid || 'system',
      revokedAt,
    });
  },

  redeemInvite: async (code: string): Promise<{ invite: Invite; permission: Permission; store?: Store }> => {
    const inviteRef = doc(db, 'invites', code);
    const inviteSnap = await getDoc(inviteRef);
    if (!inviteSnap.exists()) {
      throw new Error('Invite not found');
    }
    const invite = toInvite(inviteSnap.id, inviteSnap.data());
    if (invite.status !== 'pending') {
      throw new Error('Invite is no longer active');
    }
    if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
      const expiredAt = nowIsoString();
      await updateDoc(inviteRef, {
        status: 'expired',
        expiredAt,
      });
      throw new Error('Invite has expired');
    }
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      throw new Error('Authentication required to redeem invite');
    }
    if (invite.email) {
      const normalizedUserEmail = normalizeEmail(firebaseUser.email);
      if (!normalizedUserEmail || normalizedUserEmail !== invite.email) {
        throw new Error('This invite is issued to a different email address');
      }
    }
    const permissionId = `${firebaseUser.uid}_${invite.storeId}`;
    const permissionRef = doc(db, 'permissions', permissionId);
    await setDoc(permissionRef, {
      userId: firebaseUser.uid,
      storeId: invite.storeId,
      role: invite.role,
      canViewCost: invite.canViewCost,
    }, { merge: true });
    const redeemedAt = nowIsoString();
    await updateDoc(inviteRef, {
      status: 'accepted',
      redeemedBy: firebaseUser.uid,
      redeemedAt,
    });
    const permission: Permission = {
      id: permissionId,
      userId: firebaseUser.uid,
      storeId: invite.storeId,
      role: invite.role,
      canViewCost: invite.canViewCost,
    };
    const storeSnap = await getDoc(doc(db, 'stores', invite.storeId));
    const store = storeSnap.exists() ? ({ id: storeSnap.id, ...storeSnap.data() } as Store) : undefined;
    return {
      invite: { ...invite, status: 'accepted', redeemedBy: firebaseUser.uid, redeemedAt },
      permission,
      store,
    };
  },

  
  fetchItems: async (): Promise<Item[]> => {
    const snapshot = await getDocs(collection(db, 'items'));
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Omit<Item, 'id'> & { categoryId?: string | null; imageUrl?: string | null; humanId?: string | null; vendorId?: string | null };
      const item: Item = {
        ...data,
        id: docSnap.id,
        categoryId: data.categoryId ?? null,
        vendorId: data.vendorId ?? null,
        imageUrl: data.imageUrl ?? null,
      } as Item;
      return ensureItemHumanId(item);
    });
  },

  fetchCategories: (): Promise<Category[]> => getCollectionData<Category>('categories'),
  
  fetchVendors: (): Promise<Vendor[]> => getCollectionData<Vendor>('vendors'),
  
  fetchLocationsByStore: async (storeId: string): Promise<Location[]> => {
    const locationsQuery = query(collection(db, 'locations'), where('storeId', '==', storeId));
    const querySnapshot = await getDocs(locationsQuery);
    return querySnapshot.docs.map(doc => ensureLocationHumanId({ id: doc.id, ...doc.data() } as Location));
  },
  
  fetchStocktakesByStore: async (storeId: string): Promise<Stocktake[]> => {
      const stocktakesQuery = query(collection(db, 'stocktakes'), where('storeId', '==', storeId));
      // FIX: Corrected variable name from querySnapshot to stocktakesQuery.
      const querySnapshot = await getDocs(stocktakesQuery);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Stocktake));
  },
  
  updateStocktakes: async (stocktakesToUpdate: Stocktake[]): Promise<void> => {
    const batch = writeBatch(db);
    stocktakesToUpdate.forEach(stocktake => {
      const { id, ...data } = stocktake;
      const docRef = id.startsWith('new-') ? doc(collection(db, 'stocktakes')) : doc(db, 'stocktakes', id);
      batch.set(docRef, data, { merge: true });
    });
    await batch.commit();
  },

  deleteStocktakes: async (stocktakeIds: string[]): Promise<void> => {
    const persistentIds = stocktakeIds.filter(id => !id.startsWith('new-'));
    if (persistentIds.length === 0) {
      return;
    }

    const batch = writeBatch(db);
    persistentIds.forEach(id => {
      batch.delete(doc(db, 'stocktakes', id));
    });
    await batch.commit();
  },

  // --- Add new data ---
  addStore: async (newStore: NewStore): Promise<Store> => {
    const docRef = await addDoc(collection(db, 'stores'), newStore);
    return { ...newStore, id: docRef.id };
  },

  addItem: async (newItem: NewItem): Promise<Item> => {
    const docRef = doc(collection(db, 'items'));
    const normalizedName = newItem.name.toLowerCase().replace(/\s+/g, '_');
    const providedHumanId = newItem.humanId && newItem.humanId.trim().length > 0 ? newItem.humanId : null;
    const humanId = providedHumanId ?? deriveHumanIdFromId(docRef.id);
    const itemToAdd = {
      ...newItem,
      humanId,
      normalizedName,
      categoryId: newItem.categoryId ?? null,
      vendorId: newItem.vendorId ?? null,
      imageUrl: newItem.imageUrl ?? null,
    };
    await setDoc(docRef, itemToAdd);
    return { ...itemToAdd, id: docRef.id };
  },

  addCategory: async (newCategory: NewCategory): Promise<Category> => {
    const docRef = await addDoc(collection(db, 'categories'), newCategory);
    return { ...newCategory, id: docRef.id };
  },

  addVendor: async (newVendor: NewVendor): Promise<Vendor> => {
    const docRef = await addDoc(collection(db, 'vendors'), newVendor);
    return { ...newVendor, id: docRef.id };
  },

  addLocation: async (newLocation: NewLocation): Promise<Location> => {
    const storeId = newLocation.storeId;
    const providedHumanId = newLocation.humanId?.trim().toUpperCase();

    const locationsQuery = query(collection(db, 'locations'), where('storeId', '==', storeId));
    const existingSnapshot = await getDocs(locationsQuery);
    const existingLocations = existingSnapshot.docs.map(doc => ensureLocationHumanId({ id: doc.id, ...doc.data() } as Location));

    let humanId = providedHumanId;
    if (humanId) {
      const duplicate = existingLocations.some(location => location.humanId === humanId);
      if (duplicate) {
        throw new Error('LOCATION_HUMAN_ID_ALREADY_EXISTS');
      }
    } else {
      humanId = generateNextLocationHumanId(existingLocations);
    }

    const locationToAdd = {
      name: newLocation.name.trim(),
      humanId,
      description: newLocation.description || '',
      storeId,
      imageUrl: newLocation.imageUrl ?? null,
      sublocations: [],
    };

    const docRef = await addDoc(collection(db, 'locations'), locationToAdd);
    return { ...locationToAdd, id: docRef.id };
  },

  addSubLocation: async (locationId: string, newSubLocation: NewSubLocation): Promise<Location> => {
    const locationRef = doc(db, 'locations', locationId);

    return await runTransaction(db, async (transaction) => {
        const locationDoc = await transaction.get(locationRef);
        if (!locationDoc.exists()) {
            throw new Error("Parent location not found");
        }

        const parentLocation = ensureLocationHumanId({ id: locationDoc.id, ...locationDoc.data() } as Location);
        const sublocations = parentLocation.sublocations || [];

        const newHumanId = generateNextSubLocationHumanId(parentLocation);
        const newId = doc(collection(db, '_')).id;
        const subLocationWithIds = {
          id: newId,
          humanId: newHumanId,
          name: newSubLocation.name?.trim() || '',
          description: newSubLocation.description || '',
          imageUrl: newSubLocation.imageUrl ?? null,
        } as SubLocation;

        const updatedSublocations = [...sublocations, subLocationWithIds];
        transaction.update(locationRef, { sublocations: updatedSublocations });

        return { ...parentLocation, sublocations: updatedSublocations };
    });
  },

  // --- Update existing data ---
  updateItem: async (item: Item): Promise<void> => {
    const itemRef = doc(db, 'items', item.id);
    const { id, ...rest } = item;
    const normalizedName = item.name.toLowerCase().replace(/\s+/g, '_');
    const itemToUpdate = {
      ...rest,
      normalizedName,
      categoryId: rest.categoryId ?? null,
      vendorId: rest.vendorId ?? null,
      imageUrl: rest.imageUrl ?? null,
    };
    await updateDoc(itemRef, itemToUpdate as { [x: string]: any });
  },

  updateCategory: async (category: Category): Promise<void> => {
    const categoryRef = doc(db, 'categories', category.id);
    await updateDoc(categoryRef, { name: category.name });
  },

  updateVendor: async (vendor: Vendor): Promise<void> => {
    const vendorRef = doc(db, 'vendors', vendor.id);
    const { id, ...rest } = vendor;
    await updateDoc(vendorRef, rest);
  },

  updateLocation: async (locationId: string, data: Partial<NewLocation>): Promise<void> => {
    const locationRef = doc(db, 'locations', locationId);
    const payload: Record<string, unknown> = { ...data };
    if (Object.prototype.hasOwnProperty.call(data, 'imageUrl')) {
      payload.imageUrl = data.imageUrl ?? null;
    }
    await updateDoc(locationRef, payload);
  },

  updateSubLocation: async (parentId: string, subLocation: SubLocation): Promise<Location> => {
    const locationRef = doc(db, 'locations', parentId);
    const parentDoc = await getDoc(locationRef);
    if (!parentDoc.exists()) throw new Error("Parent location not found");

    const parentLocation = { id: parentDoc.id, ...parentDoc.data() } as Location;
    const sublocations = parentLocation.sublocations?.map(sub =>
      sub.id === subLocation.id ? { ...sub, ...subLocation, imageUrl: subLocation.imageUrl ?? null } : sub
    ) || [];

    await updateDoc(locationRef, { sublocations });
    return { ...parentLocation, sublocations };
  },

  uploadItemImage: async (itemId: string, file: File): Promise<string> => {
    const { downloadUrl } = await uploadItemImageToStorage(itemId, file);
    return downloadUrl;
  },

  deleteItemImage: async (imageUrl: string | null | undefined): Promise<void> => {
    await deleteImageByUrl(imageUrl);
  },

  uploadLocationImage: async (locationId: string, file: File): Promise<string> => {
    const { downloadUrl } = await uploadLocationImageToStorage(locationId, file);
    return downloadUrl;
  },

  uploadSubLocationImage: async (locationId: string, subLocationId: string, file: File): Promise<string> => {
    const { downloadUrl } = await uploadSubLocationImageToStorage(locationId, subLocationId, file);
    return downloadUrl;
  },

  deleteLocationImage: async (imageUrl: string | null | undefined): Promise<void> => {
    await deleteImageByUrl(imageUrl);
  },

  deleteSubLocationImage: async (imageUrl: string | null | undefined): Promise<void> => {
    await deleteImageByUrl(imageUrl);
  },

  // --- Delete data ---
  deleteItem: async (itemId: string): Promise<void> => {
    const itemRef = doc(db, 'items', itemId);
    await deleteDoc(itemRef);
    // Note: Deleting a parent item here won't automatically delete its variants in Firestore.
    // This would require a more complex setup, e.g., using a Cloud Function.
    // The AppContext handles this logic for the frontend/offline state.
  },

  deleteCategory: async (categoryId: string): Promise<void> => {
    const batch = writeBatch(db);
    
    // 1. Delete the category document itself
    const categoryRef = doc(db, 'categories', categoryId);
    batch.delete(categoryRef);
    
    // 2. Find all items with this categoryId and unset it
    const itemsQuery = query(collection(db, 'items'), where('categoryId', '==', categoryId));
    const itemsSnapshot = await getDocs(itemsQuery);
    itemsSnapshot.forEach(itemDoc => {
      const itemRef = doc(db, 'items', itemDoc.id);
      batch.update(itemRef, { categoryId: deleteField() });
    });
    
    await batch.commit();
  },

  deleteVendor: async (vendorId: string): Promise<void> => {
    const batch = writeBatch(db);

    const vendorRef = doc(db, 'vendors', vendorId);
    batch.delete(vendorRef);

    const itemsQuery = query(collection(db, 'items'), where('vendorId', '==', vendorId));
    const itemsSnapshot = await getDocs(itemsQuery);
    itemsSnapshot.forEach(itemDoc => {
      const itemRef = doc(db, 'items', itemDoc.id);
      batch.update(itemRef, { vendorId: deleteField() });
    });

    await batch.commit();
  },

  deleteLocation: async (locationId: string): Promise<void> => {
    const locationRef = doc(db, 'locations', locationId);
    await deleteDoc(locationRef);
  },

  deleteSubLocation: async (parentId: string, subLocationId: string): Promise<void> => {
    const locationRef = doc(db, 'locations', parentId);
    const parentDoc = await getDoc(locationRef);
    if (!parentDoc.exists()) throw new Error("Parent location not found");

    const parentLocation = parentDoc.data() as Location;
    const sublocations = parentLocation.sublocations?.filter(sub => sub.id !== subLocationId) || [];

    await updateDoc(locationRef, { sublocations });
  },
};





