
import React, { useContext, useEffect, useState, useMemo } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../hooks/useTranslation';
import Card from '../ui/Card';
import { api } from '../../services/api';
import { Item, Location, Stocktake, Store } from '../../types';
import Input from '../ui/Input';
import { ICONS } from '../../constants';
import Spinner from '../ui/Spinner';
import { Table, TableRow, TableCell } from '../ui/Table';
import { getItemDisplayName } from '../../lib/utils';

type SearchScope = 'current' | 'all';
type SearchResult = 
  | { type: 'item', item: Item, stock: { storeName: string, quantity: number }[] }
  | { type: 'location', location: Location, storeName: string };

const Dashboard: React.FC = () => {
  const { user } = useContext(AuthContext);
  const { t, language } = useTranslation();
  const { items, locations, stocktakes, accessibleStores, currentStore, isSidebarOpen } = useContext(AppContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope>('current');
  const [loading, setLoading] = useState(false); // Can be used for online mode fetching if needed

  const stats = useMemo(() => {
    const relevantStoreIds = searchScope === 'current' && currentStore
      ? [currentStore.id]
      : accessibleStores.map(s => s.id);

    return {
      items: items.length, // Total items are global
      locations: locations.filter(l => relevantStoreIds.includes(l.storeId)).length,
      stores: accessibleStores.length,
    };
  }, [items, locations, accessibleStores, currentStore, searchScope]);

  const searchResults = useMemo((): SearchResult[] => {
    if (!searchTerm.trim()) return [];

    const lowerSearchTerm = searchTerm.toLowerCase();
    const results: SearchResult[] = [];
    
    const relevantStoreIds = searchScope === 'current' && currentStore
      ? new Set([currentStore.id])
      : new Set(accessibleStores.map(s => s.id));

    // Search items
    items.forEach(item => {
      if (getItemDisplayName(item, language).toLowerCase().includes(lowerSearchTerm)) {
        const stockByStore: { [storeId: string]: number } = {};
        
        stocktakes
          .filter(st => st.itemId === item.id && relevantStoreIds.has(st.storeId))
          .forEach(st => {
            stockByStore[st.storeId] = (stockByStore[st.storeId] || 0) + st.lastCount;
          });

        const stock = Object.entries(stockByStore).map(([storeId, quantity]) => ({
          storeName: accessibleStores.find(s => s.id === storeId)?.name || 'Unknown Store',
          quantity,
        }));
        
        if(stock.length > 0) {
            results.push({ type: 'item', item, stock });
        }
      }
    });

    // Search locations
    locations.forEach(location => {
      if (!relevantStoreIds.has(location.storeId)) return;
      
      let match = false;
      if (location.name.toLowerCase().includes(lowerSearchTerm) || location.humanId.toLowerCase().includes(lowerSearchTerm)) {
        match = true;
      }
      location.sublocations?.forEach(sub => {
          if(sub.name.toLowerCase().includes(lowerSearchTerm) || sub.humanId.toLowerCase().includes(lowerSearchTerm)) {
              match = true;
          }
      });

      if (match) {
        results.push({ type: 'location', location, storeName: accessibleStores.find(s => s.id === location.storeId)?.name || 'Unknown Store' });
      }
    });

    return results;
  }, [searchTerm, items, locations, stocktakes, accessibleStores, currentStore, searchScope, language]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('dashboard.title')}</h1>
      
      <p className="text-lg text-gray-600 dark:text-gray-400">
        {t('dashboard.welcome', { name: user?.name || '' })}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
            <h4 className="text-gray-500">{t('dashboard.stats.items')}</h4>
            <p className="text-3xl font-bold">{stats.items}</p>
        </Card>
        <Card>
            <h4 className="text-gray-500">{t('dashboard.stats.locations')}</h4>
            <p className="text-3xl font-bold">{stats.locations}</p>
        </Card>
        <Card>
            <h4 className="text-gray-500">{t('dashboard.stats.stores')}</h4>
            <p className="text-3xl font-bold">{stats.stores}</p>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <div className="flex flex-col md:flex-row gap-4">
            <Input 
                icon={ICONS.search}
                placeholder={t('common.search.placeholder')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="flex-grow"
            />
             {accessibleStores.length > 1 && (
                <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium">{t('common.searchScope')}:</span>
                    <label className="flex items-center space-x-2">
                        <input type="radio" name="search-scope" value="current" checked={searchScope === 'current'} onChange={() => setSearchScope('current')} disabled={!currentStore}/>
                        <span>{t('common.currentStore')}</span>
                    </label>
                    <label className="flex items-center space-x-2">
                        <input type="radio" name="search-scope" value="all" checked={searchScope === 'all'} onChange={() => setSearchScope('all')} />
                        <span>{t('common.allAccessibleStores')}</span>
                    </label>
                </div>
            )}
        </div>
        
        {searchTerm && (
            <div className="mt-6">
                <h3 className="text-lg font-medium mb-2">{t('dashboard.search.resultsTitle')}</h3>
                {searchResults.length > 0 ? (
                    <Table headers={[t('common.name'), t('dashboard.search.store'), t('dashboard.search.quantity')]}>
                       {searchResults.map((result, index) => {
                           if (result.type === 'item') {
                               return (
                                   <TableRow key={`item-${result.item.id}-${index}`}>
                                       <TableCell>
                                           <div className="font-bold">{t('dashboard.search.item')}: {getItemDisplayName(result.item, language)}</div>
                                           <div className="text-xs text-gray-500">{result.item.sku}</div>
                                       </TableCell>
                                       <TableCell>
                                          <div className="space-y-1">
                                           {result.stock.map(s => <div key={s.storeName}>{s.storeName}</div>)}
                                          </div>
                                       </TableCell>
                                       <TableCell>
                                          <div className="space-y-1">
                                            {result.stock.map(s => <div key={s.storeName}>{s.quantity}</div>)}
                                           </div>
                                       </TableCell>
                                   </TableRow>
                               );
                           }
                           if (result.type === 'location') {
                               return (
                                   <TableRow key={`loc-${result.location.id}-${index}`}>
                                       <TableCell>
                                           <div className="font-bold">{t('dashboard.search.location')}: [{result.location.humanId}] {result.location.name}</div>
                                           {result.location.description && <div className="text-xs text-gray-500">{result.location.description}</div>}
                                       </TableCell>
                                       <TableCell>{result.storeName}</TableCell>
                                       <TableCell>N/A</TableCell>
                                   </TableRow>
                               );
                           }
                           return null;
                       })}
                    </Table>
                ) : (
                    <p className="text-center text-gray-500 py-4">{t('common.noResults')}</p>
                )}
            </div>
        )}

      </Card>
    </div>
  );
};

export default Dashboard;
