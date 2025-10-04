import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import { Stocktake, Role, Location, SubLocation, NewStocktake } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { AppContext } from '../../contexts/AppContext';
import { AuthContext } from '../../contexts/AuthContext';
import Card from '../ui/Card';
import Input from '../ui/Input';
import { Table, TableRow, TableCell } from '../ui/Table';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import { ICONS } from '../../constants';
import { classNames, getItemDisplayName } from '../../lib/utils';

type ViewMode = 'location' | 'item';
type ActiveTab = 'assignment' | 'count';

const LocationNode: React.FC<{
  location: Location;
  selectedId: string | null;
  onSelect: (id: string, isSub: boolean) => void;
  onHide: (id: string) => void;
  hideLabel: string;
  hideHint: string;
}> = ({ location, selectedId, onSelect, onHide, hideLabel, hideHint }) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasSublocations = location.sublocations && location.sublocations.length > 0;

  return (
    <div>
      <div
        className={classNames(
          'flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700',
          selectedId === location.id && 'bg-primary-100 dark:bg-primary-900/50'
        )}
        onClick={() => {
          onSelect(location.id, false);
          if (hasSublocations) {
            setIsOpen(true);
          }
        }}
      >
        <div className="flex items-center">
          {hasSublocations ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(!isOpen);
              }}
              className={classNames('transition-transform duration-200 mr-2', isOpen ? 'rotate-90' : '')}
            >
              {ICONS.chevronRight}
            </button>
          ) : (
            <span className="w-5 inline-block mr-2" />
          )}
          <span className="font-mono bg-gray-200 dark:bg-gray-600 rounded px-1.5 py-0.5 text-sm mr-2">
            {location.humanId}
          </span>
          <span>{location.name}</span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          type="button"
          title={hideHint}
          aria-label={hideHint}
          onClick={(e) => {
            e.stopPropagation();
            onHide(location.id);
          }}
        >
          {hideLabel}
        </Button>
      </div>
      {isOpen && hasSublocations && (
        <div className="pl-4 border-l ml-4 dark:border-gray-600 space-y-1">
          {location.sublocations?.map((sub) => (
            <div
              key={sub.id}
              className={classNames(
                'flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700',
                selectedId === sub.id && 'bg-primary-100 dark:bg-primary-900/50'
              )}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(sub.id, true);
              }}
            >
              <span>
                <span className="font-mono bg-gray-200 dark:bg-gray-600 rounded px-1.5 py-0.5 text-sm mr-2">
                  {location.humanId}-{sub.humanId}
                </span>
                {sub.name}
              </span>
              <Button
                size="sm"
                variant="secondary"
                type="button"
                title={hideHint}
                aria-label={hideHint}
                onClick={(e) => {
                  e.stopPropagation();
                  onHide(sub.id);
                }}
              >
                {hideLabel}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const formatLocationLabel = (location: Location, subLocation?: SubLocation) => {
  if (subLocation) {
    return `[${location.humanId}-${subLocation.humanId}] ${location.name} > ${subLocation.name}`;
  }
  return `[${location.humanId}] ${location.name}`;
};

const InventoryCount: React.FC = () => {
  const { t, language } = useTranslation();
  const {
    currentStore,
    items: allItems,
    locations: allLocations,
    stocktakes: allStocktakes,
    saveStocktakes,
    removeStocktakes,
  } = useContext(AppContext);
  const { hasPermission, isOffline } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('assignment');
  const [viewMode, setViewMode] = useState<ViewMode>('location');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIsSub, setSelectedIsSub] = useState(false);
  const [editedCounts, setEditedCounts] = useState<Record<string, string>>({});
  const [selectedForAssignment, setSelectedForAssignment] = useState<Set<string>>(new Set());
  const [removingAssignments, setRemovingAssignments] = useState<Set<string>>(new Set());
  const [assignmentSearch, setAssignmentSearch] = useState('');

  const [hiddenLocationIds, setHiddenLocationIds] = useState<Set<string>>(new Set());
  const [hiddenItemIds, setHiddenItemIds] = useState<Set<string>>(new Set());
  const [showHiddenLocations, setShowHiddenLocations] = useState(false);
  const [showHiddenItems, setShowHiddenItems] = useState(false);
  const [isSelectionPanelOpen, setIsSelectionPanelOpen] = useState(false);

  const isMobileViewport = useCallback(() => typeof window !== 'undefined' && window.innerWidth < 768, []);
  const openSelectionPanelOnMobile = useCallback(() => {
    if (isMobileViewport()) {
      setIsSelectionPanelOpen(true);
    }
  }, [isMobileViewport]);
  const closeSelectionPanelOnMobile = useCallback(() => {
    if (isMobileViewport()) {
      setIsSelectionPanelOpen(false);
    }
  }, [isMobileViewport]);

  useEffect(() => {
    openSelectionPanelOnMobile();
  }, [openSelectionPanelOnMobile]);

  useEffect(() => {
    openSelectionPanelOnMobile();
  }, [viewMode, openSelectionPanelOnMobile]);

  const stockableItems = useMemo(() => allItems.filter((item) => !item.isDiscontinued), [allItems]);

  const { locationsInStore, stocktakesInStore } = useMemo(() => {
    if (!currentStore) {
      return { locationsInStore: [] as Location[], stocktakesInStore: [] as Stocktake[] };
    }

    const locations = allLocations.filter((location) => location.storeId === currentStore.id);
    const stocktakes = allStocktakes.filter((stocktake) => stocktake.storeId === currentStore.id);

    return { locationsInStore: locations, stocktakesInStore: stocktakes };
  }, [currentStore, allLocations, allStocktakes]);

  const visibleLocations = useMemo(() => {
    return locationsInStore
      .filter((location) => !hiddenLocationIds.has(location.id))
      .map((location) => ({
        ...location,
        sublocations: location.sublocations?.filter((sub) => !hiddenLocationIds.has(sub.id)),
      }));
  }, [locationsInStore, hiddenLocationIds]);

  const visibleItems = useMemo(() => stockableItems.filter((item) => !hiddenItemIds.has(item.id)), [stockableItems, hiddenItemIds]);

  const hiddenLocationsList = useMemo(() => {
    const entries: { id: string; label: string }[] = [];
    locationsInStore.forEach((location) => {
      if (hiddenLocationIds.has(location.id)) {
        entries.push({ id: location.id, label: formatLocationLabel(location) });
      }
      location.sublocations?.forEach((sub) => {
        if (hiddenLocationIds.has(sub.id)) {
          entries.push({ id: sub.id, label: formatLocationLabel(location, sub) });
        }
      });
    });
    return entries;
  }, [locationsInStore, hiddenLocationIds]);

  const hiddenItemsList = useMemo(() => {
    return stockableItems
      .filter((item) => hiddenItemIds.has(item.id))
      .map((item) => ({ id: item.id, label: getItemDisplayName(item, language) }));
  }, [stockableItems, hiddenItemIds, language]);

  const ensureSelection = useCallback(() => {
    if (!currentStore) {
      setSelectedId(null);
      setSelectedIsSub(false);
      return;
    }

    if (viewMode === 'location') {
      if (selectedId) {
        const hasParent = !selectedIsSub && visibleLocations.some((location) => location.id === selectedId);
        const hasSub = selectedIsSub && visibleLocations.some((location) => location.sublocations?.some((sub) => sub.id === selectedId));
        if (hasParent || hasSub) {
          return;
        }
      }

      if (visibleLocations.length > 0) {
        setSelectedId(visibleLocations[0].id);
        setSelectedIsSub(false);
      } else {
        setSelectedId(null);
        setSelectedIsSub(false);
      }
    } else {
      if (selectedId && visibleItems.some((item) => item.id === selectedId)) {
        return;
      }

      if (visibleItems.length > 0) {
        setSelectedId(visibleItems[0].id);
      } else {
        setSelectedId(null);
      }
      setSelectedIsSub(false);
    }
  }, [currentStore, viewMode, selectedId, selectedIsSub, visibleLocations, visibleItems]);

  const hideLocationEntry = useCallback((id: string) => {
    setHiddenLocationIds((prev) => {
      if (prev.has(id)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setShowHiddenLocations(true);
  }, []);

  const restoreLocationEntry = useCallback((id: string) => {
    setHiddenLocationIds((prev) => {
      if (!prev.has(id)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(id);
      if (next.size === 0) {
        setShowHiddenLocations(false);
      }
      return next;
    });
  }, []);

  const hideItemEntry = useCallback((id: string) => {
    setHiddenItemIds((prev) => {
      if (prev.has(id)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setShowHiddenItems(true);
  }, []);

  const restoreItemEntry = useCallback((id: string) => {
    setHiddenItemIds((prev) => {
      if (!prev.has(id)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(id);
      if (next.size === 0) {
        setShowHiddenItems(false);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    setEditedCounts({});
  }, [currentStore, viewMode]);

  useEffect(() => {
    ensureSelection();
  }, [ensureSelection]);

  useEffect(() => {
    setSelectedForAssignment(new Set());
    setAssignmentSearch('');
  }, [currentStore, viewMode, selectedId, activeTab]);
  useEffect(() => {
    setRemovingAssignments(new Set());
  }, [selectedId, viewMode]);


  const canEdit = hasPermission(Role.Editor);

  const hideLabel = t('inventory.hideEntry');
  const restoreLabel = t('common.restore');
  const hiddenLocationsTitle = t('inventory.hiddenLocations');
  const hiddenItemsTitle = t('inventory.hiddenItems');
  const noHiddenLabel = t('inventory.hidden.none');
  const hideHint = t('inventory.hideHint');
  const hiddenToggleShow = t('inventory.hidden.showList');
  const hiddenToggleHide = t('inventory.hidden.hideList');
  const selectionPanelToggleLabel = useMemo(() => {
    const target = viewMode === 'location' ? t('inventory.selectionPanel.locationList') : t('inventory.selectionPanel.itemList');
    return t(isSelectionPanelOpen ? 'inventory.selectionPanel.close' : 'inventory.selectionPanel.open', { target });
  }, [isSelectionPanelOpen, t, viewMode]);
  const selectionPanelTitle = viewMode === 'location' ? t('inventory.viewByLocation') : t('inventory.viewByItem');

  const resolveSelectedLocation = () => {
    if (!selectedId) {
      return { parent: undefined as Location | undefined, subLocation: undefined as SubLocation | undefined };
    }

    if (selectedIsSub) {
      const parent = locationsInStore.find((loc) => loc.sublocations?.some((sub) => sub.id === selectedId));
      const subLocation = parent?.sublocations?.find((sub) => sub.id === selectedId);
      return { parent, subLocation };
    }

    const parent = locationsInStore.find((loc) => loc.id === selectedId);
    return { parent, subLocation: undefined };
  };

  const handleSave = async () => {
    setLoading(true);
    const updates: Stocktake[] = Object.entries(editedCounts)
      .map(([stocktakeId, newCount]) => {
        const original = allStocktakes.find((stocktake) => stocktake.id === stocktakeId);
        if (original && parseInt(newCount, 10) !== original.lastCount) {
          return {
            ...original,
            lastCount: parseInt(newCount, 10),
            lastCountedAt: new Date().toISOString(),
          };
        }
        return null;
      })
      .filter((entry): entry is Stocktake => entry !== null);

    if (updates.length > 0) {
      if (isOffline) {
        saveStocktakes(updates);
      } else {
        await api.updateStocktakes(updates);
      }
    }

    setEditedCounts({});
    setLoading(false);
  };

  const toggleAssignmentSelection = (id: string) => {
    setSelectedForAssignment((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAssign = async () => {
    if (!currentStore || !selectedId || selectedForAssignment.size === 0) return;

    const now = new Date().toISOString();
    let newStocktakes: NewStocktake[] = [];

    if (viewMode === 'location') {
      const { parent, subLocation } = resolveSelectedLocation();
      if (!parent) return;

      newStocktakes = Array.from(selectedForAssignment).map((itemId) => ({
        storeId: currentStore.id,
        itemId,
        locationId: parent.id,
        subLocationId: subLocation?.id,
        lastCount: 0,
        lastCountedAt: now,
      }));
    } else {
      newStocktakes = Array.from(selectedForAssignment).map((selection) => {
        const [locationId, subLocationIdValue] = selection.split('__');
        return {
          storeId: currentStore.id,
          itemId: selectedId,
          locationId,
          subLocationId: subLocationIdValue || undefined,
          lastCount: 0,
          lastCountedAt: now,
        };
      });
    }

    if (newStocktakes.length === 0) return;

    const stocktakesWithTempIds: Stocktake[] = newStocktakes.map((stocktake, index) => ({
      ...stocktake,
      id: `new-${Date.now()}-${index}`,
    }));

    saveStocktakes(stocktakesWithTempIds);
    if (!isOffline) {
      await api.updateStocktakes(stocktakesWithTempIds);
    }

    setSelectedForAssignment(new Set());
    setAssignmentSearch('');
  };

  const handleRemoveAssignment = useCallback(
    async (stocktakeId: string) => {
      setRemovingAssignments((prev) => {
        const next = new Set(prev);
        next.add(stocktakeId);
        return next;
      });

      try {
        const isTemporaryId = stocktakeId.startsWith('new-');
        if (!isOffline && !isTemporaryId) {
          await api.deleteStocktakes([stocktakeId]);
        }
        removeStocktakes([stocktakeId]);
      } catch (error) {
        console.error('Failed to remove assignment', error);
      } finally {
        setRemovingAssignments((prev) => {
          const next = new Set(prev);
          next.delete(stocktakeId);
          return next;
        });
      }
    },
    [isOffline, removeStocktakes]
  );

  const renderAssignmentContent = () => {
    if (!selectedId) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          <p>{viewMode === 'location' ? t('inventory.selectLocation') : t('inventory.selectItem')}</p>
        </div>
      );
    }

    if (viewMode === 'location') {
      const { parent, subLocation } = resolveSelectedLocation();
      if (!parent) {
        return (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>{t('inventory.selectLocation')}</p>
          </div>
        );
      }

      const itemsForLocation = stocktakesInStore
        .filter((stocktake) => {
          if (subLocation) return stocktake.subLocationId === subLocation.id;
          return stocktake.locationId === parent.id && !stocktake.subLocationId;
        })
        .map((stocktake) => {
          const item = allItems.find((candidate) => candidate.id === stocktake.itemId);
          return item
            ? {
                ...stocktake,
                itemName: getItemDisplayName(item, language),
              }
            : null;
        })
        .filter((entry): entry is Stocktake & { itemName: string } => entry !== null);

      const assignedItemIds = new Set(itemsForLocation.map((stocktake) => stocktake.itemId));
      const searchText = assignmentSearch.trim().toLowerCase();
      const availableItems = stockableItems
        .filter((item) => !assignedItemIds.has(item.id))
        .filter((item) => {
          if (!searchText) return true;
          return getItemDisplayName(item, language).toLowerCase().includes(searchText);
        });

      const locationName = formatLocationLabel(parent, subLocation);

      return (
        <div className="space-y-6">
          <section>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold">
                {t('inventory.itemsInLocation', { locationName })}
              </h3>
              {canEdit && (
                <Button size="sm" onClick={handleAssign} disabled={selectedForAssignment.size === 0}>
                  {t('inventory.assignItem')}
                </Button>
              )}
            </div>
            {itemsForLocation.length === 0 ? (
              <p className="text-sm text-gray-500">{t('common.noResults')}</p>
            ) : (
              <Table headers={[t('common.name'), t('inventory.lastCount'), t('inventory.lastCountDate'), t('common.actions')]}> 
                {itemsForLocation.map((stocktake) => (
                  <TableRow key={stocktake.id}>
                    <TableCell>
                      <div>{stocktake.itemName}</div>
                      {stocktake.description && (
                        <div className="text-xs text-gray-500">{stocktake.description}</div>
                      )}
                    </TableCell>
                    <TableCell>{stocktake.lastCount}</TableCell>
                    <TableCell>{new Date(stocktake.lastCountedAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="danger"
                        type="button"
                        onClick={() => handleRemoveAssignment(stocktake.id)}
                        disabled={removingAssignments.has(stocktake.id)}
                      >
                        {t('common.delete')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </Table>
            )}
          </section>

          <section className="space-y-4">
            <h4 className="text-md font-semibold">{t('inventory.assignItems.title')}</h4>
            {stockableItems.length === assignedItemIds.size ? (
              <p className="text-sm text-gray-500">{t('inventory.noAvailableItems')}</p>
            ) : (
              <>
                <Input
                  value={assignmentSearch}
                  onChange={(event) => setAssignmentSearch(event.target.value)}
                  placeholder={t('inventory.search.placeholder')}
                />
                <div className="border border-gray-200 dark:border-gray-700 rounded-md divide-y divide-gray-200 dark:divide-gray-700 max-h-64 overflow-y-auto">
                  {availableItems.length === 0 && (
                    <div className="p-3 text-sm text-gray-500">{t('common.noResults')}</div>
                  )}
                  {availableItems.map((item) => {
                    const displayName = getItemDisplayName(item, language);
                    return (
                      <label
                        key={item.id}
                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <span>{displayName}</span>
                        <input
                          type="checkbox"
                          className="form-checkbox h-4 w-4 text-primary-600"
                          checked={selectedForAssignment.has(item.id)}
                          onChange={() => toggleAssignmentSelection(item.id)}
                        />
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </div>
      );
    }

    const item = allItems.find((candidate) => candidate.id === selectedId);
    const itemName = getItemDisplayName(item, language);

    const stocktakesForItem = stocktakesInStore
      .filter((stocktake) => stocktake.itemId === selectedId)
      .map((stocktake) => {
        const location = locationsInStore.find((candidate) => candidate.id === stocktake.locationId);
        const subLocation = location?.sublocations?.find((sub) => sub.id === stocktake.subLocationId);
        const locationName = location ? formatLocationLabel(location, subLocation) : t('common.noResults');
        return location
          ? {
              ...stocktake,
              locationName,
            }
          : null;
      })
      .filter((entry): entry is Stocktake & { locationName: string } => entry !== null);

    const assignedLocationKeys = new Set(
      stocktakesForItem.map((stocktake) =>
        stocktake.subLocationId ? `${stocktake.locationId}__${stocktake.subLocationId}` : stocktake.locationId
      )
    );

    const locationOptions: { key: string; label: string }[] = [];
    visibleLocations.forEach((location) => {
      if (!assignedLocationKeys.has(location.id)) {
        locationOptions.push({ key: location.id, label: formatLocationLabel(location) });
      }
      location.sublocations?.forEach((sub) => {
        const key = `${location.id}__${sub.id}`;
        if (!assignedLocationKeys.has(key)) {
          locationOptions.push({ key, label: formatLocationLabel(location, sub) });
        }
      });
    });

    const searchText = assignmentSearch.trim().toLowerCase();
    const availableLocations = locationOptions.filter((option) => {
      if (!searchText) return true;
      return option.label.toLowerCase().includes(searchText);
    });

    return (
      <div className="space-y-6">
        <section>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold">
              {t('inventory.locationsForItem', { itemName })}
            </h3>
            {canEdit && (
              <Button size="sm" onClick={handleAssign} disabled={selectedForAssignment.size === 0}>
                {t('inventory.assignLocation')}
              </Button>
            )}
          </div>
          {stocktakesForItem.length === 0 ? (
            <p className="text-sm text-gray-500">{t('common.noResults')}</p>
          ) : (
            <Table headers={[t('nav.locations'), t('inventory.lastCount'), t('inventory.lastCountDate'), t('common.actions')]}> 
              {stocktakesForItem.map((stocktake) => (
                <TableRow key={stocktake.id}>
                  <TableCell>
                    <div>{stocktake.locationName}</div>
                    {stocktake.description && (
                      <div className="text-xs text-gray-500">{stocktake.description}</div>
                    )}
                  </TableCell>
                  <TableCell>{stocktake.lastCount}</TableCell>
                  <TableCell>{new Date(stocktake.lastCountedAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="danger"
                        type="button"
                        onClick={() => handleRemoveAssignment(stocktake.id)}
                        disabled={removingAssignments.has(stocktake.id)}
                      >
                        {t('common.delete')}
                      </Button>
                    </TableCell>
                </TableRow>
              ))}
            </Table>
          )}
        </section>

        <section className="space-y-4">
          <h4 className="text-md font-semibold">{t('inventory.assignLocations.title')}</h4>
          {locationOptions.length === 0 ? (
            <p className="text-sm text-gray-500">{t('inventory.noAvailableLocations')}</p>
          ) : (
            <>
              <Input
                value={assignmentSearch}
                onChange={(event) => setAssignmentSearch(event.target.value)}
                placeholder={t('inventory.searchLocations.placeholder')}
              />
              <div className="border border-gray-200 dark:border-gray-700 rounded-md divide-y divide-gray-200 dark:divide-gray-700 max-h-64 overflow-y-auto">
                {availableLocations.length === 0 && (
                  <div className="p-3 text-sm text-gray-500">{t('common.noResults')}</div>
                )}
                {availableLocations.map((option) => (
                  <label
                    key={option.key}
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <span>{option.label}</span>
                    <input
                      type="checkbox"
                      className="form-checkbox h-4 w-4 text-primary-600"
                      checked={selectedForAssignment.has(option.key)}
                      onChange={() => toggleAssignmentSelection(option.key)}
                    />
                  </label>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    );
  };

  const renderCountContent = () => {
    if (!selectedId) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          <p>{viewMode === 'location' ? t('inventory.selectLocation') : t('inventory.selectItem')}</p>
        </div>
      );
    }

    if (viewMode === 'location') {
      const { parent, subLocation } = resolveSelectedLocation();
      if (!parent) {
        return (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>{t('inventory.selectLocation')}</p>
          </div>
        );
      }

      const itemsForLocation = stocktakesInStore
        .filter((stocktake) => {
          if (subLocation) return stocktake.subLocationId === subLocation.id;
          return stocktake.locationId === parent.id && !stocktake.subLocationId;
        })
        .map((stocktake) => {
          const item = allItems.find((candidate) => candidate.id === stocktake.itemId);
          return item
            ? {
                ...stocktake,
                itemName: getItemDisplayName(item, language),
              }
            : null;
        })
        .filter((entry): entry is Stocktake & { itemName: string } => entry !== null);

      const locationName = formatLocationLabel(parent, subLocation);

      return (
        <div>
          <div className="mb-2">
            <h3 className="text-lg font-semibold">
              {t('inventory.itemsInLocation', { locationName })}
            </h3>
          </div>
          <Table headers={[t('common.name'), t('inventory.quantity'), t('inventory.lastCountDate')]}> 
            {itemsForLocation.map((stocktake) => (
              <TableRow key={stocktake.id}>
                <TableCell>
                  <div>{stocktake.itemName}</div>
                  {stocktake.description && (
                    <div className="text-xs text-gray-500">{stocktake.description}</div>
                  )}
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="w-24"
                    value={editedCounts[stocktake.id] ?? stocktake.lastCount}
                    onChange={(event) =>
                      setEditedCounts({
                        ...editedCounts,
                        [stocktake.id]: event.target.value,
                      })
                    }
                    disabled={!canEdit}
                  />
                </TableCell>
                <TableCell>{new Date(stocktake.lastCountedAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </Table>
        </div>
      );
    }

    const locationsForItem = stocktakesInStore
      .filter((stocktake) => stocktake.itemId === selectedId)
      .map((stocktake) => {
        const location = locationsInStore.find((candidate) => candidate.id === stocktake.locationId);
        const subLocation = location?.sublocations?.find((sub) => sub.id === stocktake.subLocationId);
        const locationName = location ? formatLocationLabel(location, subLocation) : t('common.noResults');
        return location
          ? {
              ...stocktake,
              locationName,
            }
          : null;
      })
      .filter((entry): entry is Stocktake & { locationName: string } => entry !== null);

    const item = allItems.find((candidate) => candidate.id === selectedId);
    const itemName = getItemDisplayName(item, language);

    return (
      <div>
        <div className="mb-2">
          <h3 className="text-lg font-semibold">
            {t('inventory.locationsForItem', { itemName })}
          </h3>
        </div>
        <Table headers={[t('nav.locations'), t('inventory.quantity'), t('inventory.lastCountDate')]}> 
          {locationsForItem.map((stocktake) => (
            <TableRow key={stocktake.id}>
              <TableCell>
                <div>{stocktake.locationName}</div>
                {stocktake.description && (
                  <div className="text-xs text-gray-500">{stocktake.description}</div>
                )}
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  className="w-24"
                  value={editedCounts[stocktake.id] ?? stocktake.lastCount}
                  onChange={(event) =>
                    setEditedCounts({
                      ...editedCounts,
                      [stocktake.id]: event.target.value,
                    })
                  }
                  disabled={!canEdit}
                />
              </TableCell>
              <TableCell>{new Date(stocktake.lastCountedAt).toLocaleDateString()}</TableCell>
            </TableRow>
          ))}
        </Table>
      </div>
    );
  };

  if (!currentStore) {
    return (
      <Card title={t('inventory.title')}>
        <p>{t('header.selectStore')}</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4 pb-4 border-b dark:border-gray-700">
        <div className="flex-1">
          <h2 className="text-xl font-bold">
            {t('inventory.title')} - {currentStore.name}
          </h2>
          <div className="mt-3 inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {(['assignment', 'count'] as ActiveTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                className={classNames(
                  'px-4 py-2 text-sm font-semibold transition-colors duration-200',
                  activeTab === tab ? 'bg-primary-600 text-white' : 'bg-transparent text-gray-700 dark:text-gray-200'
                )}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'assignment' ? t('inventory.tab.assignment') : t('inventory.tab.count')}
              </button>
            ))}
          </div>
        </div>
        {activeTab === 'count' && canEdit && (
          <Button onClick={handleSave} disabled={Object.keys(editedCounts).length === 0 || loading}>
            {loading ? <Spinner /> : t('common.save')}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="bg-gray-200 dark:bg-gray-700 p-1 rounded-lg flex">
          <Button
            size="sm"
            variant={viewMode === 'location' ? 'primary' : 'secondary'}
            onClick={() => {
              setViewMode('location');
            }}
          >
            {t('inventory.viewByLocation')}
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'item' ? 'primary' : 'secondary'}
            onClick={() => {
              setViewMode('item');
            }}
          >
            {t('inventory.viewByItem')}
          </Button>
        </div>
      </div>

      <div className="md:hidden mb-4">
        <Button
          size="sm"
          variant="secondary"
          className="w-full"
          onClick={() => setIsSelectionPanelOpen((prev) => !prev)}
        >
          {selectionPanelToggleLabel}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          className={classNames(
            'md:col-span-1 md:border-r md:pr-4 md:dark:border-gray-700 md:h-[calc(100vh-220px)] md:overflow-y-auto space-y-2',
            isSelectionPanelOpen ? 'block' : 'hidden',
            'md:block'
          )}
        >
          <div className="md:hidden flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">{selectionPanelTitle}</span>
            <Button size="sm" variant="secondary" onClick={() => setIsSelectionPanelOpen(false)}>
              {t('common.hide')}
            </Button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{hideHint}</p>
          {viewMode === 'location' ? (
            visibleLocations.length === 0 ? (
              <p className="text-sm text-gray-500">{t('locations.noLocations.description')}</p>
            ) : (
              visibleLocations.map((location) => (
                <LocationNode
                  key={location.id}
                  location={location}
                  selectedId={selectedId}
                  onSelect={(id, isSub) => {
                    setSelectedId(id);
                    setSelectedIsSub(isSub);
                    closeSelectionPanelOnMobile();
                  }}
                  onHide={hideLocationEntry}
                  hideLabel={hideLabel}
                  hideHint={hideHint}
                />
              ))
            )
          ) : (
            visibleItems.length === 0 ? (
              <p className="text-sm text-gray-500">{t('common.noResults')}</p>
            ) : (
              visibleItems.map((item) => (
                <div
                  key={item.id}
                  className={classNames(
                    'flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700',
                    selectedId === item.id && 'bg-primary-100 dark:bg-primary-900/50'
                  )}
                  onClick={() => {
                    setSelectedId(item.id);
                    setSelectedIsSub(false);
                    closeSelectionPanelOnMobile();
                  }}
                >
                  <span>{getItemDisplayName(item, language)}</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    type="button"
                    title={hideHint}
                    aria-label={hideHint}
                    onClick={(e) => {
                      e.stopPropagation();
                      hideItemEntry(item.id);
                    }}
                  >
                    {hideLabel}
                  </Button>
                </div>
              ))
            )
          )}
          {viewMode === 'location' && hiddenLocationsList.length > 0 && (
            <div className="mt-4 border-t pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{hiddenLocationsTitle}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  onClick={() => setShowHiddenLocations((prev) => !prev)}
                >
                  {showHiddenLocations ? hiddenToggleHide : hiddenToggleShow}
                </Button>
              </div>
              {showHiddenLocations && (
                hiddenLocationsList.length === 0 ? (
                  <p className="text-xs text-gray-500">{noHiddenLabel}</p>
                ) : (
                  <div className="space-y-2">
                    {hiddenLocationsList.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2"
                      >
                        <span className="text-sm">{entry.label}</span>
                        <Button
                          size="sm"
                          variant="secondary"
                          type="button"
                          onClick={() => restoreLocationEntry(entry.id)}
                        >
                          {restoreLabel}
                        </Button>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}
          {viewMode === 'item' && hiddenItemsList.length > 0 && (
            <div className="mt-4 border-t pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{hiddenItemsTitle}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  onClick={() => setShowHiddenItems((prev) => !prev)}
                >
                  {showHiddenItems ? hiddenToggleHide : hiddenToggleShow}
                </Button>
              </div>
              {showHiddenItems && (
                hiddenItemsList.length === 0 ? (
                  <p className="text-xs text-gray-500">{noHiddenLabel}</p>
                ) : (
                  <div className="space-y-2">
                    {hiddenItemsList.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2"
                      >
                        <span className="text-sm">{entry.label}</span>
                        <Button
                          size="sm"
                          variant="secondary"
                          type="button"
                          onClick={() => restoreItemEntry(entry.id)}
                        >
                          {restoreLabel}
                        </Button>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </div>
        <div className="md:col-span-2 md:h-[calc(100vh-220px)] md:overflow-y-auto">
          {activeTab === 'assignment' ? renderAssignmentContent() : renderCountContent()}
        </div>
      </div>
    </Card>
  );
};

export default InventoryCount;








