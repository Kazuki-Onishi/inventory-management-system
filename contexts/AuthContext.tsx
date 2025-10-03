

import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import { User, Permission, Role, Store, Item, Location, Stocktake, Category } from '../types';
import { api } from '../services/api';
import { OFFLINE_DATA } from '../data/offline';
import { AppContext } from './AppContext';
import { auth } from '../services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isOffline: boolean;
  connectionError: string | null;
  login: (isOffline: boolean, role?: 'Admin' | 'Editor') => Promise<void>;
  logout: () => void;
  permissions: Permission[];
  hasPermission: (requiredRole: Role, storeId?: string) => boolean;
  redeemInvite: (code: string) => Promise<void>;
  canViewCost: (storeId?: string) => boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isOffline: false,
  connectionError: null,
  login: async () => {},
  logout: () => {},
  permissions: [],
  hasPermission: () => false,
  redeemInvite: async () => {},
  canViewCost: () => false,
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const { setAccessibleStores, setCurrentStore, currentStore, loadOfflineData, clearData } = useContext(AppContext);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in, load their data.
        await loadUserData({ id: firebaseUser.uid, name: firebaseUser.displayName || '', email: firebaseUser.email || '', isAdmin: false }); // Pass a temporary User object
      } else {
        // User is signed out.
        clearUserData();
      }
      setLoading(false);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStoreData = async (stores: Store[]) => {
    try {
      const [items, categories] = await Promise.all([
        api.fetchItems(),
        api.fetchCategories(),
      ]);
      const [locationsPerStore, stocktakesPerStore] = await Promise.all([
        Promise.all(stores.map((store) => api.fetchLocationsByStore(store.id))),
        Promise.all(stores.map((store) => api.fetchStocktakesByStore(store.id))),
      ]);
      const locations = locationsPerStore.flat();
      const stocktakes = stocktakesPerStore.flat();
      loadOfflineData({ items, locations, stocktakes, categories });
    } catch (error) {
      console.error('Failed to load application data', error);
    }
  };

  const loadUserData = async (loggedInUser: User) => {
    try {
      setConnectionError(null);
      const { user: fetchedUser, permissions: userPermissions, stores: userStores } = await api.fetchUserData(loggedInUser.id);
      if(fetchedUser) {
        setUser(fetchedUser);
        setPermissions(userPermissions);
        setAccessibleStores(userStores);
        await loadStoreData(userStores);
        setIsOffline(false);
        if (userStores.length > 0) {
          const savedStore = localStorage.getItem('ims-store');
          const savedStoreId = savedStore ? JSON.parse(savedStore).id : null;
          const isValidSavedStore = userStores.some(s => s.id === savedStoreId);
          if (!isValidSavedStore || !currentStore) {
            setCurrentStore(userStores[0]);
          }
        }
      }
    } catch(error) {
        console.error("Failed to load user data from server. The app will use local data if available.", error);
        setConnectionError("Offline mode: Could not connect to the server. Displaying cached data, which may be out of date.");
        // We don't sign out. Let the app run with cached data.
        // The user object from onAuthStateChanged is enough to keep the user logged in.
        // A full profile will be loaded once connection is re-established.
        const tempUser: User = { 
            id: loggedInUser.id, 
            email: auth.currentUser?.email || '', 
            name: auth.currentUser?.displayName || 'User', 
            isAdmin: false // Assume false until we can connect
        };
        setUser(tempUser);
    }
  }
  
  const clearUserData = () => {
      setUser(null);
      setPermissions([]);
      setIsOffline(false);
      setConnectionError(null);
      clearData();
  }

  const login = async (isOffline: boolean, role?: 'Admin' | 'Editor') => {
    setLoading(true);
    if (!isOffline) {
        setIsOffline(false);
        await api.loginWithGoogle();
        // onAuthStateChanged will handle the rest
        return;
    }
    
    // Handle Offline Mode
    const isAdmin = role === 'Admin';
    const userId = isAdmin ? 'offline-admin' : 'offline-editor';
    const offlineUser: User = { 
        id: userId, 
        email: `${userId}@example.com`, 
        name: `Demo ${role}`, 
        isAdmin: isAdmin 
    };
    
    const { stores: mockStores, items, locations, stocktakes, categories } = OFFLINE_DATA;

    const mockPermissions: Permission[] = mockStores.map(store => ({
        id: `${userId}_${store.id}`,
        userId: userId,
        storeId: store.id,
        role: isAdmin ? Role.Admin : Role.Editor,
        canViewCost: true
    }));

    setUser(offlineUser);
    setAccessibleStores(mockStores);
    setCurrentStore(mockStores[0]);
    setPermissions(mockPermissions);
    loadOfflineData({ items, locations, stocktakes, categories });
    setIsOffline(true);
    setLoading(false);
  };

  const logout = async () => {
    if (!isOffline) {
      await signOut(auth);
    }
    clearUserData();
  };

  const redeemInvite = async (code: string): Promise<void> => {
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      throw new Error('Invite code is required');
    }
    const { permission, store } = await api.redeemInvite(trimmedCode);

    setPermissions(prev => {
      const existingIndex = prev.findIndex(p => p.id === permission.id);
      if (existingIndex !== -1) {
        const updated = [...prev];
        updated[existingIndex] = permission;
        return updated;
      }
      return [...prev, permission];
    });

    if (store) {
      setAccessibleStores(prevStores => {
        if (prevStores.some(s => s.id === store.id)) {
          return prevStores;
        }
        const next = [...prevStores, store];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      if (!currentStore) {
        setCurrentStore(store);
      }
    }
  };

  const hasPermission = (requiredRole: Role, storeId?: string): boolean => {
    if (user?.isAdmin) return true;
    const targetStoreId = storeId || currentStore?.id;
    if (!targetStoreId || !user) return false;

    const permission = permissions.find(p => p.userId === user.id && p.storeId === targetStoreId);
    if (!permission) return false;

    const roles = [Role.Viewer, Role.Editor, Role.Admin];
    return roles.indexOf(permission.role) >= roles.indexOf(requiredRole);
  };

  const canViewCost = (storeId?: string): boolean => {
    if (user?.isAdmin) return true;
    const targetStoreId = storeId || currentStore?.id;
    if (!targetStoreId || !user) return false;
    
    const permission = permissions.find(p => p.userId === user.id && p.storeId === targetStoreId);
    return permission?.canViewCost ?? false;
  };


  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isOffline, permissions, hasPermission, redeemInvite, canViewCost, connectionError }}>
      {children}
    </AuthContext.Provider>
  );
};
