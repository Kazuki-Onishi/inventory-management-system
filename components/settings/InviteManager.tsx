import React, { useEffect, useMemo, useState, useContext } from 'react';
import { Invite, NewInvite, Role, Store } from '../../types';
import { TranslationKey } from '../../locales/index';
import { useTranslation } from '../../hooks/useTranslation';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import { Table, TableRow, TableCell } from '../ui/Table';
import ConfirmationModal from '../ui/ConfirmationModal';
import { AppContext } from '../../contexts/AppContext';
import { ICONS } from '../../constants';

interface InviteManagerProps {
  stores: Store[];
  invites: Invite[];
  loading: boolean;
  onCreateInvites: (payload: NewInvite, count: number) => Promise<Invite[]>;
  onRevokeInvite: (invite: Invite) => Promise<void>;
  maxBulkCount: number;
}

const InviteManager: React.FC<InviteManagerProps> = ({ stores, invites, loading, onCreateInvites, onRevokeInvite, maxBulkCount }) => {
  const { t } = useTranslation();
  const { showToast } = useContext(AppContext);

  const [form, setForm] = useState<{ storeId: string; role: Role; canViewCost: boolean; email: string }>({
    storeId: '',
    role: Role.Editor,
    canViewCost: true,
    email: '',
  });
  const [quantity, setQuantity] = useState<number>(1);
  const [errors, setErrors] = useState<{ storeId?: string; email?: string; quantity?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [inviteToRevoke, setInviteToRevoke] = useState<Invite | null>(null);

  useEffect(() => {
    if (!form.storeId && stores.length > 0) {
      setForm(prev => ({ ...prev, storeId: stores[0].id }));
    }
  }, [stores, form.storeId]);

  const pendingInvites = useMemo(() => invites.filter(invite => invite.status === 'pending'), [invites]);

  const validate = () => {
    const nextErrors: { storeId?: string; email?: string; quantity?: string } = {};
    if (!form.storeId) {
      nextErrors.storeId = t('common.required');
    }
    const trimmedEmail = form.email.trim();
    if (trimmedEmail && !trimmedEmail.includes('@')) {
      nextErrors.email = t('settings.invites.email.invalid');
    }
    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
      nextErrors.quantity = t('settings.invites.create.quantity.invalid');
    } else if (parsedQuantity > maxBulkCount) {
      nextErrors.quantity = t('settings.invites.create.quantity.limit', { limit: maxBulkCount });
    } else if (trimmedEmail && parsedQuantity > 1) {
      nextErrors.quantity = t('settings.invites.create.quantity.emailRestriction');
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const trimmedEmail = form.email.trim();
      const parsedQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
      await onCreateInvites({
        storeId: form.storeId,
        role: form.role,
        canViewCost: form.canViewCost,
        email: trimmedEmail ? trimmedEmail : undefined,
      }, parsedQuantity);
      setForm(prev => ({ ...prev, email: '' }));
      setQuantity(1);
    } catch (error) {
      // Error already surfaced via toast in the parent handler.
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      showToast(t('settings.invites.copy.success'));
    } catch (error) {
      console.error('Failed to copy invite code', error);
      showToast(t('settings.invites.copy.error'), 'error');
    }
  };

  const handleConfirmRevoke = async () => {
    if (!inviteToRevoke) return;
    try {
      await onRevokeInvite(inviteToRevoke);
    } catch (error) {
      // Parent handler shows toast
    } finally {
      setInviteToRevoke(null);
    }
  };

  const renderStatus = (status: Invite['status']) => {
    const key = ('settings.invites.status.' + status) as TranslationKey;
    return t(key);
  };

  const renderCreatedAt = (invite: Invite) => {
    if (!invite.createdAt) return '--';
    try {
      return new Date(invite.createdAt).toLocaleString();
    } catch (error) {
      return invite.createdAt;
    }
  };

  return (
    <Card title={t('settings.invites.title')} className="mt-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleSubmit} className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('settings.invites.create.title')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('settings.invites.create.subtitle')}
          </p>
          <Select
            label={t('settings.invites.storeLabel')}
            value={form.storeId}
            onChange={e => setForm(prev => ({ ...prev, storeId: e.target.value }))}
            disabled={stores.length === 0 || submitting}
            error={errors.storeId}
          >
            {stores.length === 0 ? (
              <option value="" disabled>
                {t('settings.invites.noStores')}
              </option>
            ) : (
              stores.map(store => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))
            )}
          </Select>
          <Select
            label={t('settings.invites.roleLabel')}
            value={form.role}
            onChange={e => setForm(prev => ({ ...prev, role: e.target.value as Role }))}
            disabled={submitting}
          >
            {Object.values(Role).map(role => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </Select>
          <Input
            label={t('settings.invites.emailLabel')}
            placeholder={t('settings.invites.emailPlaceholder')}
            value={form.email}
            onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
            disabled={submitting}
            error={errors.email}
          />
          <Input
            type="number"
            min={1}
            max={maxBulkCount}
            label={t('settings.invites.create.quantityLabel')}
            value={quantity}
            onChange={e => setQuantity(Math.max(0, Number(e.target.value)))}
            disabled={submitting}
            error={errors.quantity}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.invites.create.quantityHelp', { limit: maxBulkCount })}</p>
          <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={form.canViewCost}
              onChange={e => setForm(prev => ({ ...prev, canViewCost: e.target.checked }))}
              disabled={submitting}
              className="rounded text-primary-600 focus:ring-primary-500"
            />
            <span>{t('settings.invites.costToggle')}</span>
          </label>
          <div className="flex justify-end">
            <Button type="submit" disabled={submitting || stores.length === 0}>
              {submitting ? t('common.save') : t('settings.invites.create.button')}
            </Button>
          </div>
        </form>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('settings.invites.summary.title', { count: pendingInvites.length })}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('settings.invites.summary.description')}
          </p>
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : invites.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
            {t('settings.invites.empty')}
          </p>
        ) : (
          <Table
            headers={[
              t('settings.invites.table.code'),
              t('settings.invites.table.store'),
              t('settings.invites.table.role'),
              t('settings.invites.table.email'),
              t('settings.invites.table.status'),
              t('settings.invites.table.created'),
              t('settings.invites.table.actions'),
            ]}
          >
            {invites.map(invite => (
              <TableRow key={invite.id}>
                <TableCell className="font-mono text-sm">{invite.code}</TableCell>
                <TableCell>{stores.find(store => store.id === invite.storeId)?.name || invite.storeId}</TableCell>
                <TableCell>{invite.role}</TableCell>
                <TableCell>{invite.email || '--'}</TableCell>
                <TableCell>{renderStatus(invite.status)}</TableCell>
                <TableCell>{renderCreatedAt(invite)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => handleCopy(invite.code)}
                      disabled={invite.status !== 'pending'}
                      title={t('settings.invites.copy.tooltip')}
                    >
                      <span className="flex items-center gap-1">
                        {ICONS.copy}
                        <span>{t('settings.invites.copy.button')}</span>
                      </span>
                    </Button>
                    {invite.status === 'pending' && (
                      <Button
                        variant="danger"
                        onClick={() => setInviteToRevoke(invite)}
                      >
                        {t('settings.invites.revoke.button')}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </div>

      <ConfirmationModal
        isOpen={!!inviteToRevoke}
        onClose={() => setInviteToRevoke(null)}
        onConfirm={handleConfirmRevoke}
        title={t('settings.invites.revoke.confirmTitle')}
      >
        <p>{t('settings.invites.revoke.confirmMessage', { code: inviteToRevoke?.code ?? '' })}</p>
      </ConfirmationModal>
    </Card>
  );
};

export default InviteManager;
