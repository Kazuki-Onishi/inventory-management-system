
import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import { AppContext } from '../../contexts/AppContext';
import { api } from '../../services/api';
import { User, Store, Permission, Role, Invite, NewInvite } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import Card from '../ui/Card';
import { Table, TableRow, TableCell } from '../ui/Table';
import InviteManager from './InviteManager';
import Select from '../ui/Select';
import Spinner from '../ui/Spinner';

const UserPermissions: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const { showToast } = useContext(AppContext);
  const [users, setUsers] = useState<User[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [loading, setLoading] = useState(true);

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

  const handleCreateInvite = async (payload: NewInvite): Promise<void> => {
    try {
      const invite = await api.createInvite(payload);
      setInvites(prev => [invite, ...prev]);
      showToast(t('settings.invites.create.success'));
    } catch (error) {
      console.error('Failed to create invite', error);
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
        onCreateInvite={handleCreateInvite}
        onRevokeInvite={handleRevokeInvite}
      />
    </>
  );
};

export default UserPermissions;