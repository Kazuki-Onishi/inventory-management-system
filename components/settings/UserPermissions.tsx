
import React, { useEffect, useState, useContext, useMemo, useCallback } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import { AppContext } from '../../contexts/AppContext';
import { api } from '../../services/api';
import { User, Store, Permission, Role, Invite, NewInvite } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import Card from '../ui/Card';
import { Table, TableRow, TableCell } from '../ui/Table';
import InviteManager from './InviteManager';
import Select from '../ui/Select';
import { ensureItemHumanId } from '../../lib/items';
import Spinner from '../ui/Spinner';
import Button from '../ui/Button';

const MAX_INVITES_PER_BATCH = 20;

const formatCsvValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  return /[",\r\n]/.test(stringValue)
    ? `"${stringValue.replace(/"/g, '""')}"`
    : stringValue;
};

const createCsvContent = (headers: string[], rows: (unknown[])[]): string => {
  const headerLine = headers.map(formatCsvValue).join(',');
  const dataLines = rows.map(row => row.map(formatCsvValue).join(','));
  return [headerLine, ...dataLines].join('\r\n');
};

const downloadCsvFile = (filename: string, csvContent: string) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const UserPermissions: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const { showToast, items, locations, stocktakes } = useContext(AppContext);
  const [users, setUsers] = useState<User[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  const storeNameById = useMemo(() => {
    return new Map(stores.map(store => [store.id, store.name]));
  }, [stores]);

  const handleExportItems = useCallback(() => {
    const headers = [
      'itemId',
      'humanId',
      'nameJa',
      'nameEn',
      'shortName',
      'description',
      'sku',
      'costA',
      'costB',
      'supplier',
      'imageUrl',
      'categoryId',
    ];

    const normalizedItems = items.map(item => ensureItemHumanId(item));

    const rows = normalizedItems.map(item => [
      item.id,
      item.humanId,
      item.name,
      item.nameEn ?? '',
      item.shortName,
      item.description,
      item.sku ?? '',
      item.costA,
      item.costB,
      item.supplier ?? '',
      item.imageUrl ?? '',
      item.categoryId ?? '',
    ]);

    const csvContent = createCsvContent(headers, rows);
    downloadCsvFile('items.csv', csvContent);
  }, [items]);

  const handleExportLocations = useCallback(() => {
    const headers = [
      'storeId',
      'storeName',
      'locationId',
      'locationHumanId',
      'locationName',
      'locationDescription',
      'subLocationId',
      'subLocationHumanId',
      'subLocationName',
      'subLocationDescription',
    ];

    const rows: (unknown[])[] = [];
    locations.forEach(location => {
      const storeName = storeNameById.get(location.storeId) ?? '';

      if (location.sublocations && location.sublocations.length > 0) {
        location.sublocations.forEach(sub => {
          rows.push([
            location.storeId,
            storeName,
            location.id,
            location.humanId,
            location.name,
            location.description ?? '',
            sub.id,
            sub.humanId,
            sub.name,
            sub.description ?? '',
          ]);
        });
      } else {
        rows.push([
          location.storeId,
          storeName,
          location.id,
          location.humanId,
          location.name,
          location.description ?? '',
          '',
          '',
          '',
          '',
        ]);
      }
    });

    const csvContent = createCsvContent(headers, rows);
    downloadCsvFile('locations.csv', csvContent);
  }, [locations, storeNameById]);

  const handleExportAssignments = useCallback(() => {
    const headers = [
      'stocktakeId',
      'storeId',
      'storeName',
      'itemId',
      'itemNameJa',
      'itemNameEn',
      'locationId',
      'locationHumanId',
      'locationName',
      'subLocationId',
      'subLocationHumanId',
      'subLocationName',
      'lastCount',
      'lastCountedAt',
      'note',
    ];

    const locationById = new Map(locations.map(location => [location.id, location]));
    const itemById = new Map(items.map(item => [item.id, item]));

    const rows = stocktakes.map(stocktake => {
      const storeName = storeNameById.get(stocktake.storeId) ?? '';
      const location = locationById.get(stocktake.locationId);
      const subLocation = stocktake.subLocationId
        ? location?.sublocations?.find(sub => sub.id === stocktake.subLocationId)
        : undefined;
      const item = itemById.get(stocktake.itemId);

      return [
        stocktake.id,
        stocktake.storeId,
        storeName,
        stocktake.itemId,
        item?.name ?? '',
        item?.nameEn ?? '',
        stocktake.locationId,
        location?.humanId ?? '',
        location?.name ?? '',
        stocktake.subLocationId ?? '',
        subLocation?.humanId ?? '',
        subLocation?.name ?? '',
        stocktake.lastCount,
        stocktake.lastCountedAt,
        stocktake.description ?? '',
      ];
    });

    const csvContent = createCsvContent(headers, rows);
    downloadCsvFile('item-assignments.csv', csvContent);
  }, [items, locations, stocktakes, storeNameById]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setInvitesLoading(true);
      try {
        const [fetchedUsers, fetchedStores, fetchedPermissions] = await Promise.all([
          api.fetchAllUsers(),
          api.fetchAllStores(),
          api.fetchAllPermissions(),
        ]);
        setUsers(fetchedUsers);
        setStores(fetchedStores);
        setPermissions(fetchedPermissions);

        const storeIds = user?.isAdmin ? undefined : fetchedStores.map(store => store.id);
        const fetchedInvites = await api.fetchInvites(storeIds);
        setInvites(fetchedInvites);
      } catch (error) {
        console.error('Failed to load settings data', error);
      } finally {
        setLoading(false);
        setInvitesLoading(false);
      }
    };
    fetchData();
  }, [user?.isAdmin]);
  
  const getPermission = (userId: string, storeId: string) => {
    return permissions.find(p => p.userId === userId && p.storeId === storeId) || {
      // FIX: Add composite id to new permission objects to conform to the updated Permission type.
      id: `${userId}_${storeId}`,
      userId, storeId, role: Role.NoAccess, canViewCost: false
    };
  };

  const handlePermissionChange = async (userId: string, storeId: string, field: 'role' | 'canViewCost', value: Role | boolean) => {
    const currentPermission = getPermission(userId, storeId);
    const newPermission = { ...currentPermission, [field]: value };
    
    const updatedPermission = await api.updatePermission(newPermission);
    
    setPermissions(prev => {
        const index = prev.findIndex(p => p.userId === userId && p.storeId === storeId);
        if (index !== -1) {
            const newPerms = [...prev];
            newPerms[index] = updatedPermission;
            return newPerms;
        }
        return [...prev, updatedPermission];
    });
  };

  const handleCreateInvites = async (payload: NewInvite, count: number): Promise<Invite[]> => {
    try {
      const invitesCreated = await api.createInvites(payload, count);
      if (invitesCreated.length > 0) {
        setInvites(prev => [...invitesCreated, ...prev]);
      }
      showToast(t(count > 1 ? 'settings.invites.create.bulkSuccess' : 'settings.invites.create.success', { count }));
      return invitesCreated;
    } catch (error) {
      console.error('Failed to create invites', error);
      showToast(t('settings.invites.create.error'), 'error');
      throw error;
    }
  };

  const handleRevokeInvite = async (invite: Invite): Promise<void> => {
    try {
      await api.revokeInvite(invite.id);
      const timestamp = new Date().toISOString();
      setInvites(prev => prev.map(existing => existing.id === invite.id ? { ...existing, status: 'revoked', revokedAt: timestamp, revokedBy: user?.id } : existing));
      showToast(t('settings.invites.revoke.success'));
    } catch (error) {
      console.error('Failed to revoke invite', error);
      showToast(t('settings.invites.revoke.error'), 'error');
      throw error;
    }
  };


  const headers = [t('common.user'), ...stores.map(s => s.name)];

  return (
    <>
      <Card title={t('settings.export.title')}>
        <p className="mb-4 text-gray-600 dark:text-gray-400">{t('settings.export.description')}</p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleExportItems}>{t('settings.export.items')}</Button>
          <Button variant="secondary" onClick={handleExportLocations}>{t('settings.export.locations')}</Button>
          <Button variant="secondary" onClick={handleExportAssignments}>{t('settings.export.assignments')}</Button>
        </div>
      </Card>
      <Card title={t('settings.title')}>
        <p className="mb-4 text-gray-600 dark:text-gray-400">{t('settings.description')}</p>
        {loading ? <Spinner /> : (
          <Table headers={headers}>
            {users.map(user => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="font-medium">{user.name}</div>
                  <div className="text-xs text-gray-500">{user.email}</div>
                </TableCell>
                {stores.map(store => {
                  const permission = getPermission(user.id, store.id);
                  return (
                    <TableCell key={store.id}>
                      <div className="space-y-2">
                        <Select
                          label={t('common.role')}
                          value={permission.role}
                          onChange={e => handlePermissionChange(user.id, store.id, 'role', e.target.value as Role)}
                        >
                          {Object.values(Role).map(role => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </Select>
                        <label className="flex items-center space-x-2 text-sm">
                          <input
                            type="checkbox"
                            checked={permission.canViewCost}
                            onChange={e => handlePermissionChange(user.id, store.id, 'canViewCost', e.target.checked)}
                            className="rounded text-primary-600 focus:ring-primary-500"
                          />
                          <span>{t('common.viewCost')}</span>
                        </label>
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </Table>
        )}
      </Card>
      <InviteManager
        stores={stores}
        invites={invites}
        loading={invitesLoading}
        onCreateInvites={handleCreateInvites}
        onRevokeInvite={handleRevokeInvite}
        maxBulkCount={MAX_INVITES_PER_BATCH}
      />
    </>
  );
};

export default UserPermissions;
