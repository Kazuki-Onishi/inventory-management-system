import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import { AppContext } from '../../contexts/AppContext';
import { AuthContext } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import { Item, Vendor, Role } from '../../types';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import { classNames, createSearchTerms, matchesSearch, getItemDisplayName } from '../../lib/utils';

const VendorAssignments: React.FC = () => {
  const { t, language } = useTranslation();
  const { hasPermission, isOffline } = useContext(AuthContext);
  const { items: contextItems, vendors: contextVendors, setVendors, updateItem, showToast } = useContext(AppContext);

  const [items, setItems] = useState<Item[]>([]);
  const [vendors, setVendorList] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  const [vendorSearch, setVendorSearch] = useState('');
  const [activeVendorId, setActiveVendorId] = useState<string | null>(null);

  const [assignSearch, setAssignSearch] = useState('');
  const [assignedSearch, setAssignedSearch] = useState('');

  const [selectedForAssign, setSelectedForAssign] = useState<Set<string>>(new Set());
  const [selectedForUnassign, setSelectedForUnassign] = useState<Set<string>>(new Set());

  const [isAssigning, setIsAssigning] = useState(false);
  const [isUnassigning, setIsUnassigning] = useState(false);

  const canEdit = hasPermission(Role.Editor);

  useEffect(() => {
    if (!isOffline) {
      return;
    }
    setVendorList(contextVendors);
    setItems(contextItems);
    setLoading(false);
  }, [isOffline, contextItems, contextVendors]);

  useEffect(() => {
    if (isOffline) {
      return;
    }
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [vendorsData, itemsData] = await Promise.all([
          api.fetchVendors(),
          api.fetchItems(),
        ]);
        if (!isMounted) return;
        setVendorList(vendorsData);
        setVendors(vendorsData);
        setItems(itemsData);
      } catch (error) {
        console.error('Failed to load vendor assignments', error);
        if (isMounted) {
          showToast(t('vendors.assignments.fetchError'), 'error');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffline]);

  useEffect(() => {
    if (vendors.length === 0) {
      setActiveVendorId(null);
      return;
    }
    if (!activeVendorId || !vendors.some(vendor => vendor.id === activeVendorId)) {
      setActiveVendorId(vendors[0].id);
    }
  }, [vendors, activeVendorId]);

  useEffect(() => {
    setSelectedForAssign(new Set());
    setSelectedForUnassign(new Set());
    setAssignSearch('');
    setAssignedSearch('');
  }, [activeVendorId]);

  const vendorStats = useMemo(() => {
    const map = new Map<string, number>();
    let unassigned = 0;
    items.forEach(item => {
      if (item.vendorId) {
        map.set(item.vendorId, (map.get(item.vendorId) ?? 0) + 1);
      } else {
        unassigned += 1;
      }
    });
    map.set('__unassigned__', unassigned);
    return map;
  }, [items]);

  const vendorNameById = useMemo(() => {
    const map = new Map<string, string>();
    vendors.forEach(vendor => map.set(vendor.id, vendor.name));
    return map;
  }, [vendors]);

  const vendorSearchTerms = useMemo(() => createSearchTerms(vendorSearch), [vendorSearch]);

  const vendorEntries = useMemo(() => {
    const enriched = vendors.map(vendor => ({
      vendor,
      count: vendorStats.get(vendor.id) ?? 0,
    }));
    return enriched.sort((a, b) => a.vendor.name.localeCompare(b.vendor.name));
  }, [vendors, vendorStats]);

  const filteredVendors = useMemo(() => {
    if (vendorSearchTerms.length === 0) {
      return vendorEntries;
    }
    return vendorEntries.filter(entry =>
      matchesSearch(
        [
          entry.vendor.name,
          entry.vendor.contactName ?? '',
          entry.vendor.internalContactName ?? '',
          entry.vendor.email ?? '',
        ],
        vendorSearchTerms,
      )
    );
  }, [vendorEntries, vendorSearchTerms]);

  const assignSearchTerms = useMemo(() => createSearchTerms(assignSearch), [assignSearch]);
  const assignedSearchTerms = useMemo(() => createSearchTerms(assignedSearch), [assignedSearch]);

  const activeVendor = useMemo(
    () => (activeVendorId ? vendors.find(vendor => vendor.id === activeVendorId) ?? null : null),
    [activeVendorId, vendors]
  );

  const assignCandidates = useMemo(() => {
    if (!activeVendorId) return [];
    let result = items.filter(item => item.vendorId !== activeVendorId);
    if (assignSearchTerms.length > 0) {
      result = result.filter(item =>
        matchesSearch(
          [
            getItemDisplayName(item, language),
            item.shortName,
            item.humanId,
            item.sku,
            item.description,
          ],
          assignSearchTerms,
        )
      );
    }
    return result.sort((a, b) =>
      getItemDisplayName(a, language).localeCompare(
        getItemDisplayName(b, language),
        language === 'ja' ? 'ja-JP' : 'en-US'
      )
    );
  }, [activeVendorId, items, assignSearchTerms, language]);

  const assignedItems = useMemo(() => {
    if (!activeVendorId) return [];
    let result = items.filter(item => item.vendorId === activeVendorId);
    if (assignedSearchTerms.length > 0) {
      result = result.filter(item =>
        matchesSearch(
          [
            getItemDisplayName(item, language),
            item.shortName,
            item.humanId,
            item.sku,
            item.description,
          ],
          assignedSearchTerms,
        )
      );
    }
    return result.sort((a, b) =>
      getItemDisplayName(a, language).localeCompare(
        getItemDisplayName(b, language),
        language === 'ja' ? 'ja-JP' : 'en-US'
      )
    );
  }, [activeVendorId, items, assignedSearchTerms, language]);

  const toggleAssignSelection = useCallback((id: string) => {
    if (!canEdit || isAssigning || isUnassigning) {
      return;
    }
    setSelectedForAssign(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setSelectedForUnassign(prev => {
      if (!prev.size) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [canEdit, isAssigning, isUnassigning]);

  const toggleUnassignSelection = useCallback((id: string) => {
    if (!canEdit || isAssigning || isUnassigning) {
      return;
    }
    setSelectedForUnassign(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setSelectedForAssign(prev => {
      if (!prev.size) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [canEdit, isAssigning, isUnassigning]);

  const handleBulkAssign = async () => {
    if (!activeVendorId || selectedForAssign.size === 0) {
      showToast(t('vendors.assignments.bulkAction.none'), 'error');
      return;
    }
    const targetIds = Array.from(selectedForAssign);
    setIsAssigning(true);
    try {
      if (isOffline) {
        for (const id of targetIds) {
          const targetItem = items.find(item => item.id === id);
          if (!targetItem) continue;
          const updatedItem = { ...targetItem, vendorId: activeVendorId };
          await updateItem(updatedItem);
        }
      } else {
        await Promise.all(
          targetIds.map(async (id) => {
            const targetItem = items.find(item => item.id === id);
            if (!targetItem) return;
            await api.updateItem({ ...targetItem, vendorId: activeVendorId });
          })
        );
      }
      setItems(prev =>
        prev.map(item =>
          targetIds.includes(item.id)
            ? { ...item, vendorId: activeVendorId }
            : item
        )
      );
      const count = targetIds.length;
      showToast(t(count === 1 ? 'vendors.assignments.bulkAssign.successSingle' : 'vendors.assignments.bulkAssign.successMulti', { count }));
      setSelectedForAssign(new Set());
    } catch (error) {
      console.error('Failed to assign vendor', error);
      showToast(t('vendors.assignments.saveError'), 'error');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleBulkUnassign = async () => {
    if (!activeVendorId || selectedForUnassign.size === 0) {
      showToast(t('vendors.assignments.bulkAction.none'), 'error');
      return;
    }
    const targetIds = Array.from(selectedForUnassign);
    setIsUnassigning(true);
    try {
      if (isOffline) {
        for (const id of targetIds) {
          const targetItem = items.find(item => item.id === id);
          if (!targetItem) continue;
          const updatedItem = { ...targetItem, vendorId: null };
          await updateItem(updatedItem);
        }
      } else {
        await Promise.all(
          targetIds.map(async (id) => {
            const targetItem = items.find(item => item.id === id);
            if (!targetItem) return;
            await api.updateItem({ ...targetItem, vendorId: null });
          })
        );
      }
      setItems(prev =>
        prev.map(item =>
          targetIds.includes(item.id)
            ? { ...item, vendorId: null }
            : item
        )
      );
      const count = targetIds.length;
      showToast(t(count === 1 ? 'vendors.assignments.bulkUnassign.successSingle' : 'vendors.assignments.bulkUnassign.successMulti', { count }));
      setSelectedForUnassign(new Set());
    } catch (error) {
      console.error('Failed to remove vendor assignment', error);
      showToast(t('vendors.assignments.saveError'), 'error');
    } finally {
      setIsUnassigning(false);
    }
  };

  const unassignedCount = vendorStats.get('__unassigned__') ?? 0;

  return (
    <Card title={t('vendors.assignments.title')}>
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        {t('vendors.assignments.description')}
      </p>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="lg:w-72 space-y-4">
          <Input
            label={t('vendors.assignments.vendorSearch.label')}
            placeholder={t('vendors.assignments.vendorSearch.placeholder')}
            value={vendorSearch}
            onChange={e => setVendorSearch(e.target.value)}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('vendors.assignments.unassignedStats', { count: unassignedCount })}
          </p>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : filteredVendors.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 dark:text-gray-400">
                {t('vendors.assignments.vendorList.empty')}
              </p>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredVendors.map(({ vendor, count }) => (
                  <li key={vendor.id}>
                    <button
                      type="button"
                      onClick={() => setActiveVendorId(vendor.id)}
                      className={classNames(
                        'w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
                        activeVendorId === vendor.id
                          ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-100'
                          : 'text-gray-700 dark:text-gray-200'
                      )}
                    >
                      <span className="font-medium">{vendor.name}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {t('vendors.assignments.vendorItemCount', { count })}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-6">
          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : !activeVendor ? (
            <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
              {t('vendors.assignments.pickVendor')}
            </div>
          ) : (
            <>
              {(activeVendor.contactName || activeVendor.internalContactName) && (
                <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-4 py-3 text-sm text-gray-600 dark:text-gray-300 space-y-1">
                  {activeVendor.contactName && (
                    <p>{t('vendors.assignments.contactSummary.vendor', { name: activeVendor.contactName })}</p>
                  )}
                  {activeVendor.internalContactName && (
                    <p>{t('vendors.assignments.contactSummary.internal', { name: activeVendor.internalContactName })}</p>
                  )}
                </div>
              )}
              <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      {t('vendors.assignments.assignSection.title', { name: activeVendor.name })}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('vendors.assignments.assignSection.helper')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSelectedForAssign(new Set())}
                      disabled={!selectedForAssign.size}
                    >
                      {t('vendors.assignments.clearSelection')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleBulkAssign}
                      disabled={!canEdit || isAssigning || isUnassigning || selectedForAssign.size === 0}
                    >
                      {isAssigning
                        ? t('vendors.assignments.saving')
                        : t('vendors.assignments.assignButton', { count: selectedForAssign.size })}
                    </Button>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <Input
                    label={t('common.search')}
                    placeholder={t('vendors.assignments.search.placeholder')}
                    value={assignSearch}
                    onChange={e => setAssignSearch(e.target.value)}
                  />
                  <div className="max-h-80 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
                    {assignCandidates.length === 0 ? (
                      <p className="p-4 text-sm text-gray-500 dark:text-gray-400">
                        {t('vendors.assignments.assignSection.empty')}
                      </p>
                    ) : (
                      assignCandidates.map(item => {
                        const currentVendorName = item.vendorId
                          ? vendorNameById.get(item.vendorId) ?? t('vendors.assignments.unknownVendor')
                          : t('vendors.assignments.select.none');
                        return (
                          <label
                            key={item.id}
                            className="flex items-start gap-3 px-4 py-3 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          >
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              checked={selectedForAssign.has(item.id)}
                              onChange={() => toggleAssignSelection(item.id)}
                              disabled={!canEdit || isAssigning || isUnassigning}
                            />
                            <div>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {getItemDisplayName(item, language)}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {t('vendors.assignments.currentVendor', { name: currentVendorName })}
                              </div>
                              <div className="text-xs text-gray-400 dark:text-gray-500">
                                {item.humanId || t('vendors.assignments.table.noCode')} ・ {item.sku || '-'}
                              </div>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      {t('vendors.assignments.assignedSection.title', { name: activeVendor.name })}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('vendors.assignments.assignedSection.helper')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSelectedForUnassign(new Set())}
                      disabled={!selectedForUnassign.size}
                    >
                      {t('vendors.assignments.clearSelection')}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={handleBulkUnassign}
                      disabled={!canEdit || isAssigning || isUnassigning || selectedForUnassign.size === 0}
                    >
                      {isUnassigning
                        ? t('vendors.assignments.saving')
                        : t('vendors.assignments.unassignButton', { count: selectedForUnassign.size })}
                    </Button>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <Input
                    label={t('common.search')}
                    placeholder={t('vendors.assignments.search.placeholder')}
                    value={assignedSearch}
                    onChange={e => setAssignedSearch(e.target.value)}
                  />
                  <div className="max-h-80 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
                    {assignedItems.length === 0 ? (
                      <p className="p-4 text-sm text-gray-500 dark:text-gray-400">
                        {t('vendors.assignments.assignedSection.empty')}
                      </p>
                    ) : (
                      assignedItems.map(item => (
                        <label
                          key={item.id}
                          className="flex items-start gap-3 px-4 py-3 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        >
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            checked={selectedForUnassign.has(item.id)}
                            onChange={() => toggleUnassignSelection(item.id)}
                            disabled={!canEdit || isAssigning || isUnassigning}
                          />
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {getItemDisplayName(item, language)}
                            </div>
                            <div className="text-xs text-gray-400 dark:text-gray-500">
                              {item.humanId || t('vendors.assignments.table.noCode')} ・ {item.sku || '-'}
                            </div>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};

export default VendorAssignments;
