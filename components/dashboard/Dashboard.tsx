import React, { useContext, useEffect, useMemo, useState } from 'react';

import { AuthContext } from '../../contexts/AuthContext';

import { AppContext } from '../../contexts/AppContext';

import { useTranslation } from '../../hooks/useTranslation';

import Card from '../ui/Card';

import Input from '../ui/Input';




import Button from '../ui/Button';



import Modal from '../ui/Modal';

import { ICONS } from '../../constants';

import { Table, TableRow, TableCell } from '../ui/Table';

import { Item, Location, Stocktake, SubLocation } from '../../types';

import { createSearchTerms, getItemDisplayName, matchesSearch } from '../../lib/utils';

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
  humanId?: string;
  description?: string;
  imageUrl?: string | null;
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
  const shouldShowStoreInPath = searchScope === 'all';
  const [selectedItemDetail, setSelectedItemDetail] = useState<ItemSearchResult | null>(null);

  useEffect(() => {
    setSelectedItemDetail(null);
  }, [searchTerm, searchScope]);

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
    const searchTerms = createSearchTerms(trimmedTerm);
    if (searchTerms.length === 0) {
      return { itemResults: [] as ItemSearchResult[], locationResults: [] as LocationSearchResult[] };
    }

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
      const itemMatches = matchesSearch(
        [
          getItemDisplayName(item, language),
          item.humanId,
          item.sku,
          item.shortName,
          item.description,
        ],
        searchTerms,
      );
      if (!itemMatches) {
        return;
      }

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
          humanId: item.humanId || undefined,
          description: item.description || undefined,
          imageUrl: item.imageUrl ?? null,
          assignments,
        });
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
      const locationMatches = matchesSearch(
        [location.name, location.humanId, location.description, storeName],
        searchTerms,
      );

      if (locationMatches) {
        pushLocationResult(location, storeName);
      }

      location.sublocations?.forEach((subLocation) => {
        const subMatches = matchesSearch(
          [
            location.name,
            location.humanId,
            subLocation.name,
            subLocation.humanId,
            subLocation.description,
            storeName,
          ],
          searchTerms,
        );

        if (subMatches) {
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
                  <Table headers={[t('common.name'), t('dashboard.search.locationPath'), t('dashboard.search.count'), t('dashboard.search.latestActivity'), t('common.actions')]}>
                    {searchResults.itemResults.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell>
                          <div className="flex items-start gap-3">
                            {result.imageUrl ? (
                              <img
                                src={result.imageUrl}
                                alt={result.name}
                                className="h-14 w-14 rounded-md object-cover border border-gray-200 dark:border-gray-700"
                              />
                            ) : null}
                            <div>
                              <div className="font-semibold text-gray-900 dark:text-white">{result.name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {result.humanId && (
                                  <span className="mr-2">
                                    {t('products.humanId')}: <span className="font-mono">{result.humanId}</span>
                                  </span>
                                )}
                                {result.sku && (
                                  <span>
                                    {t('products.sku')}: <span className="font-mono">{result.sku}</span>
                                  </span>
                                )}
                              </div>
                              {result.description && (
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{result.description}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            {result.assignments.map((assignment) => (
                              <div key={assignment.id} className="space-y-1">
                                <div className="flex flex-wrap items-center gap-1 text-sm text-gray-800 dark:text-gray-100">
                                  {shouldShowStoreInPath && (
                                    <>
                                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                        {assignment.storeName}
                                      </span>
                                      <span className="text-gray-400 dark:text-gray-500">窶｢</span>
                                    </>
                                  )}
                                  <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                                    [{assignment.location.humanId}]
                                  </span>
                                  <span className="font-medium">{assignment.location.name}</span>
                                  {assignment.subLocation && (
                                    <>
                                      <span className="text-gray-400 dark:text-gray-500">窶ｺ</span>
                                      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                                        [{assignment.subLocation.humanId}]
                                      </span>
                                      <span>{assignment.subLocation.name}</span>
                                    </>
                                  )}
                                </div>
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
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSelectedItemDetail(result)}
                          >
                            {t('dashboard.search.viewDetails')}
                          </Button>
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
                          <div className="flex flex-wrap items-center gap-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                              [{result.location.humanId}]
                            </span>
                            <span>{result.location.name}</span>
                            {result.subLocation && (
                              <>
                                <span className="text-gray-400 dark:text-gray-500">窶ｺ</span>
                                <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                                  [{result.subLocation.humanId}]
                                </span>
                                <span>{result.subLocation.name}</span>
                              </>
                            )}
                          </div>
                          {result.location.description && (
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{result.location.description}</div>
                          )}
                          {result.subLocation?.description && (
                            <div className="mt-1 ml-6 text-xs text-gray-500 dark:text-gray-400">{result.subLocation.description}</div>
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

      {selectedItemDetail && (
        <Modal
          isOpen={!!selectedItemDetail}
          onClose={() => setSelectedItemDetail(null)}
          title={t('dashboard.search.itemDetails.title', { name: selectedItemDetail.name })}
          footer={(
            <Button variant="secondary" onClick={() => setSelectedItemDetail(null)}>
              {t('common.close')}
            </Button>
          )}
        >
          <div className="space-y-6">
            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('dashboard.search.itemDetails.image')}</h4>
              {selectedItemDetail.imageUrl ? (
                <img
                  src={selectedItemDetail.imageUrl}
                  alt={selectedItemDetail.name}
                  className="max-h-64 w-full rounded-md object-cover border border-gray-200 dark:border-gray-700"
                />
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('dashboard.search.itemDetails.noImage')}</p>
              )}
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('dashboard.search.itemDetails.description')}</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {selectedItemDetail.description ? selectedItemDetail.description : t('dashboard.search.itemDetails.noDescription')}
              </p>
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('dashboard.search.itemDetails.info')}</h4>
              <dl className="grid grid-cols-2 gap-2 text-sm text-gray-700 dark:text-gray-300">
                <dt className="font-medium">{t('products.humanId')}</dt>
                <dd className="font-mono">{selectedItemDetail.humanId || '-'}</dd>
                <dt className="font-medium">{t('products.sku')}</dt>
                <dd className="font-mono">{selectedItemDetail.sku || '-'}</dd>
              </dl>
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t('dashboard.search.itemDetails.assignments', { count: selectedItemDetail.assignments.length })}
              </h4>
              {selectedItemDetail.assignments.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('dashboard.search.itemDetails.assignments.none')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {selectedItemDetail.assignments.map((assignment) => (
                    <li key={`detail-${assignment.id}`} className="rounded-md border border-gray-200 dark:border-gray-700 p-3 text-sm text-gray-700 dark:text-gray-200">
                      <div className="flex flex-wrap items-center gap-2">
                        {shouldShowStoreInPath && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                            {assignment.storeName}
                          </span>
                        )}
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                          [{assignment.location.humanId}]
                        </span>
                        <span>{assignment.location.name}</span>
                        {assignment.subLocation && (
                          <>
                            <span className="text-gray-400 dark:text-gray-500">›</span>
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                              [{assignment.subLocation.humanId}]
                            </span>
                            <span>{assignment.subLocation.name}</span>
                          </>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
                        <span>{t('dashboard.search.count')}: {assignment.count}</span>
                        <span>
                          {assignment.countedAt
                            ? new Date(assignment.countedAt).toLocaleString()
                            : t('dashboard.search.latestActivity.none')}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Dashboard;

