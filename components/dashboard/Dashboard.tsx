import React, { useContext, useMemo, useState } from 'react';

import { AuthContext } from '../../contexts/AuthContext';

import { AppContext } from '../../contexts/AppContext';

import { useTranslation } from '../../hooks/useTranslation';

import Card from '../ui/Card';

import Input from '../ui/Input';

import { ICONS } from '../../constants';

import { Table, TableRow, TableCell } from '../ui/Table';

import { Item, Location, Stocktake, SubLocation } from '../../types';

import { getItemDisplayName } from '../../lib/utils';

type SearchScope = 'current' | 'all';

type ItemAssignment = {
  id: string;
  storeName: string;
  location: { humanId: string; name: string };
  subLocation?: { humanId: string; name: string };
  count: number;
  countedAt: string | null;
};

type ItemSearchResult = {
  id: string;
  name: string;
  sku?: string;
  assignments: ItemAssignment[];
};

type LocationSearchResult = {
  id: string;
  storeName: string;
  location: { humanId: string; name: string; description?: string };
  subLocation?: { humanId: string; name: string; description?: string };
  latest?: { itemName: string; count: number; countedAt: string; description?: string };
};

const Dashboard: React.FC = () => {
  const { user } = useContext(AuthContext);
  const { t, language } = useTranslation();
  const { items, locations, stocktakes, accessibleStores, currentStore } = useContext(AppContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope>('current');

  const stats = useMemo(() => {
    const relevantStoreIds = searchScope === 'current' && currentStore
      ? [currentStore.id]
      : accessibleStores.map((store) => store.id);

    return {
      items: items.length,
      locations: locations.filter((location) => relevantStoreIds.includes(location.storeId)).length,
      stores: accessibleStores.length,
    };
  }, [items, locations, accessibleStores, currentStore, searchScope]);

  const searchResults = useMemo(() => {
    const trimmedTerm = searchTerm.trim();
    if (!trimmedTerm) {
      return { itemResults: [] as ItemSearchResult[], locationResults: [] as LocationSearchResult[] };
    }

    const lowerSearchTerm = trimmedTerm.toLowerCase();
    const allowedStoreIds = searchScope === 'current' && currentStore
      ? new Set([currentStore.id])
      : new Set(accessibleStores.map((store) => store.id));

    const storeById = new Map(accessibleStores.map((store) => [store.id, store]));
    const locationById = new Map(locations.map((location) => [location.id, location]));
    const itemById = new Map(items.map((item) => [item.id, item]));

    const resolveStoreName = (storeId: string) => storeById.get(storeId)?.name || t('dashboard.search.unknownStore');

    const itemResults: ItemSearchResult[] = [];
    const locationResults: LocationSearchResult[] = [];

    items.forEach((item) => {
      const displayNameLower = getItemDisplayName(item, language).toLowerCase();
      const skuLower = item.sku ? item.sku.toLowerCase() : '';

      if (displayNameLower.includes(lowerSearchTerm) || (!!skuLower && skuLower.includes(lowerSearchTerm))) {
        const assignments: ItemAssignment[] = [];

        stocktakes.forEach((stocktake) => {
          if (stocktake.itemId !== item.id || !allowedStoreIds.has(stocktake.storeId)) {
            return;
          }

          const location = locationById.get(stocktake.locationId);
          if (!location) {
            return;
          }

          const subLocation = stocktake.subLocationId
            ? location.sublocations?.find((sub) => sub.id === stocktake.subLocationId)
            : undefined;

          assignments.push({
            id: stocktake.id,
            storeName: resolveStoreName(stocktake.storeId),
            location: { humanId: location.humanId, name: location.name },
            subLocation: subLocation
              ? { humanId: subLocation.humanId, name: subLocation.name }
              : undefined,
            count: stocktake.lastCount,
            countedAt: stocktake.lastCountedAt || null,
          });
        });

        if (assignments.length > 0) {
          assignments.sort((a, b) => {
            if (a.storeName !== b.storeName) {
              return a.storeName.localeCompare(b.storeName);
            }
            if (a.location.humanId !== b.location.humanId) {
              return a.location.humanId.localeCompare(b.location.humanId);
            }
            if (a.subLocation && b.subLocation) {
              return a.subLocation.humanId.localeCompare(b.subLocation.humanId);
            }
            if (a.subLocation) {
              return 1;
            }
            if (b.subLocation) {
              return -1;
            }
            return 0;
          });

          itemResults.push({
            id: item.id,
            name: getItemDisplayName(item, language),
            sku: item.sku || undefined,
            assignments,
          });
        }
      }
    });

    const buildLatestEntry = (location: Location, subLocation?: SubLocation) => {
      const relevantStocktakes = stocktakes.filter((stocktake) => {
        if (stocktake.locationId !== location.id) {
          return false;
        }

        if (subLocation) {
          return stocktake.subLocationId === subLocation.id;
        }

        return !stocktake.subLocationId;
      });

      const latestStocktake = relevantStocktakes.reduce<{ stocktake: Stocktake; countedAt: string } | null>((latest, current) => {
        if (!current.lastCountedAt) {
          return latest;
        }

        if (!latest) {
          return { stocktake: current, countedAt: current.lastCountedAt };
        }

        return new Date(current.lastCountedAt) > new Date(latest.countedAt)
          ? { stocktake: current, countedAt: current.lastCountedAt }
          : latest;
      }, null);

      if (!latestStocktake) {
        return undefined;
      }

      const item = itemById.get(latestStocktake.stocktake.itemId);
      const itemName = getItemDisplayName(item, language) || t('dashboard.search.unknownItem');

      return {
        itemName,
        count: latestStocktake.stocktake.lastCount,
        countedAt: latestStocktake.countedAt,
        description: latestStocktake.stocktake.description,
      };
    };

    const pushLocationResult = (location: Location, storeName: string, subLocation?: SubLocation) => {
      locationResults.push({
        id: subLocation ? subLocation.id : location.id,
        storeName,
        location: {
          humanId: location.humanId,
          name: location.name,
          description: location.description || undefined,
        },
        subLocation: subLocation
          ? {
              humanId: subLocation.humanId,
              name: subLocation.name,
              description: subLocation.description || undefined,
            }
          : undefined,
        latest: buildLatestEntry(location, subLocation),
      });
    };

    locations.forEach((location) => {
      if (!allowedStoreIds.has(location.storeId)) {
        return;
      }

      const storeName = resolveStoreName(location.storeId);
      const locationNameLower = location.name.toLowerCase();
      const locationHumanIdLower = location.humanId.toLowerCase();

      if (locationNameLower.includes(lowerSearchTerm) || locationHumanIdLower.includes(lowerSearchTerm)) {
        pushLocationResult(location, storeName);
      }

      location.sublocations?.forEach((subLocation) => {
        const subNameLower = subLocation.name.toLowerCase();
        const subHumanIdLower = subLocation.humanId.toLowerCase();

        if (subNameLower.includes(lowerSearchTerm) || subHumanIdLower.includes(lowerSearchTerm)) {
          pushLocationResult(location, storeName, subLocation);
        }
      });
    });

    return { itemResults, locationResults };
  }, [searchTerm, searchScope, currentStore, accessibleStores, items, locations, stocktakes, language, t]);

  const hasSearchTerm = !!searchTerm.trim();
  const hasItemResults = searchResults.itemResults.length > 0;
  const hasLocationResults = searchResults.locationResults.length > 0;
  const hasResults = hasItemResults || hasLocationResults;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('dashboard.title')}</h1>

      <p className="text-lg text-gray-600 dark:text-gray-400">{t('dashboard.welcome', { name: user?.name || '' })}</p>

      <Card>
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <Input
              icon={ICONS.search}
              placeholder={t('common.search.placeholder')}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="flex-grow"
            />
            {accessibleStores.length > 1 && (
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium">{t('common.searchScope')}:</span>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="search-scope"
                    value="current"
                    checked={searchScope === 'current'}
                    onChange={() => setSearchScope('current')}
                    disabled={!currentStore}
                  />
                  <span>{t('common.currentStore')}</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="search-scope"
                    value="all"
                    checked={searchScope === 'all'}
                    onChange={() => setSearchScope('all')}
                  />
                  <span>{t('common.allAccessibleStores')}</span>
                </label>
              </div>
            )}
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.search.helper')}</p>

          {hasSearchTerm ? (
            <>
              {hasItemResults && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">{t('dashboard.search.itemsTitle', { count: searchResults.itemResults.length })}</h3>
                  <Table headers={[t('common.name'), t('dashboard.search.locationPath'), t('dashboard.search.count'), t('dashboard.search.latestActivity')]}>
                    {searchResults.itemResults.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell>
                          <div className="font-semibold">{result.name}</div>
                          {result.sku && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">SKU: {result.sku}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {result.assignments.map((assignment) => (
                              <div key={assignment.id}>
                                <div>{t('dashboard.search.locationLine', { store: assignment.storeName, humanId: assignment.location.humanId, name: assignment.location.name })}</div>
                                {assignment.subLocation && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">{t('dashboard.search.subLocationLine', { humanId: assignment.subLocation.humanId, name: assignment.subLocation.name })}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {result.assignments.map((assignment) => (
                              <div key={`${assignment.id}-count`}>{assignment.count}</div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {result.assignments.map((assignment) => (
                              <div key={`${assignment.id}-date`}>
                                {assignment.countedAt
                                  ? new Date(assignment.countedAt).toLocaleString()
                                  : t('dashboard.search.latestActivity.none')}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </Table>
                </div>
              )}

              {hasLocationResults && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">{t('dashboard.search.locationsTitle', { count: searchResults.locationResults.length })}</h3>
                  <Table headers={[t('dashboard.search.store'), t('dashboard.search.locationPath'), t('dashboard.search.latestActivity')]}>
                    {searchResults.locationResults.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell>{result.storeName}</TableCell>
                        <TableCell>
                          <div className="font-semibold">
                            {t('dashboard.search.location')}: [{result.location.humanId}] {result.location.name}
                          </div>
                          {result.location.description && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">{result.location.description}</div>
                          )}
                          {result.subLocation && (
                            <div className="mt-2">
                              <div className="text-sm font-medium">
                                {t('dashboard.search.subLocation')}: [{result.subLocation.humanId}] {result.subLocation.name}
                              </div>
                              {result.subLocation.description && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">{result.subLocation.description}</div>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {result.latest ? (
                            <div className="space-y-1">
                              <div>{new Date(result.latest.countedAt).toLocaleString()}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {t('dashboard.search.latestActivity.item', { item: result.latest.itemName, count: result.latest.count })}
                              </div>
                              {result.latest.description && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">{result.latest.description}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-400">{t('dashboard.search.latestActivity.none')}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </Table>
                </div>
              )}

              {!hasResults && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.search.noMatches')}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.search.startTyping')}</p>
          )}
        </div>
      </Card>

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
    </div>
  );
};

export default Dashboard;
