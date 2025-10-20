import React, { useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import { AppContext } from '../../contexts/AppContext';
import { AuthContext } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import { Vendor, NewVendor, Role } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Spinner from '../ui/Spinner';
import Modal from '../ui/Modal';
import ConfirmationModal from '../ui/ConfirmationModal';
import { Table, TableRow, TableCell } from '../ui/Table';
import { createSearchTerms, matchesSearch } from '../../lib/utils';

type ModalState = { type: 'add' } | { type: 'edit'; vendor: Vendor } | null;

const VendorManagement: React.FC = () => {
  const { t } = useTranslation();
  const { hasPermission, isOffline } = useContext(AuthContext);
  const { vendors: contextVendors, setVendors, addVendor, updateVendor, deleteVendor, showToast } = useContext(AppContext);

  const [vendors, setVendorList] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalState, setModalState] = useState<ModalState>(null);
  const [deletingVendor, setDeletingVendor] = useState<Vendor | null>(null);
  const [formData, setFormData] = useState<Partial<NewVendor>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const searchTerms = useMemo(() => createSearchTerms(searchTerm), [searchTerm]);

  const filteredVendors = useMemo(() => {
    if (searchTerms.length === 0) {
      return vendors;
    }
    return vendors.filter(vendor =>
      matchesSearch(
        [
          vendor.name,
          vendor.contactName,
          vendor.internalContactName,
          vendor.email,
          vendor.phone,
          vendor.notes,
        ],
        searchTerms,
      )
    );
  }, [vendors, searchTerms]);

  const fetchAndSetVendors = async () => {
    setLoading(true);
    try {
      const data = isOffline ? contextVendors : await api.fetchVendors();
      setVendorList(data);
      if (!isOffline) {
        setVendors(data);
      }
    } catch (error) {
      console.error('Failed to fetch vendors', error);
      showToast(t('vendors.fetchError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOffline) {
      setVendorList(contextVendors);
      setLoading(false);
      return;
    }
    fetchAndSetVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffline]);

  useEffect(() => {
    if (isOffline) {
      setVendorList(contextVendors);
    }
  }, [isOffline, contextVendors]);

  const handleOpenModal = (state: ModalState) => {
    setModalState(state);
    setErrors({});
    if (state?.type === 'edit') {
      const { vendor } = state;
      setFormData({
        name: vendor.name,
        contactName: vendor.contactName || '',
        internalContactName: vendor.internalContactName || '',
        email: vendor.email || '',
        phone: vendor.phone || '',
        notes: vendor.notes || '',
      });
    } else {
      setFormData({
        name: '',
        contactName: '',
        internalContactName: '',
        email: '',
        phone: '',
        notes: '',
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name?.trim()) {
      newErrors.name = t('common.required');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!modalState) {
      return;
    }
    if (!validateForm()) {
      showToast(t('toast.saveError'), 'error');
      return;
    }

    const basePayload: NewVendor = {
      name: formData.name!.trim(),
      contactName: formData.contactName?.trim() || undefined,
      internalContactName: formData.internalContactName?.trim() || undefined,
      email: formData.email?.trim() || undefined,
      phone: formData.phone?.trim() || undefined,
      notes: formData.notes?.trim() || undefined,
    };

    try {
      if (modalState.type === 'add') {
        if (isOffline) {
          await addVendor(basePayload);
        } else {
          await api.addVendor(basePayload);
        }
      } else {
        const updatedVendor: Vendor = { ...modalState.vendor, ...basePayload };
        if (isOffline) {
          await updateVendor(updatedVendor);
        } else {
          await api.updateVendor(updatedVendor);
        }
      }

      await fetchAndSetVendors();
      setModalState(null);
      showToast(t('toast.saveSuccess'));
    } catch (error) {
      console.error('Failed to save vendor', error);
      showToast(t('toast.saveError'), 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingVendor) {
      return;
    }
    try {
      if (isOffline) {
        await deleteVendor(deletingVendor.id);
      } else {
        await api.deleteVendor(deletingVendor.id);
      }
      await fetchAndSetVendors();
      setDeletingVendor(null);
      showToast(t('toast.deleteSuccess'));
    } catch (error) {
      console.error('Failed to delete vendor', error);
      showToast(t('toast.deleteError'), 'error');
    }
  };

  const canEdit = hasPermission(Role.Editor);

  const getModalTitle = () => {
    if (!modalState) return '';
    return modalState.type === 'add'
      ? t('vendors.addModal.title')
      : t('vendors.editModal.title');
  };

  return (
    <>
      <Card title={t('vendors.title')}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div className="w-full sm:w-72">
            <Input
              label={t('vendors.search.label')}
              placeholder={t('vendors.search.placeholder')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          {canEdit && (
            <Button onClick={() => handleOpenModal({ type: 'add' })}>
              {t('vendors.addVendor')}
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : filteredVendors.length > 0 ? (
          <Table
            headers={[
              t('common.name'),
              t('vendors.table.contact'),
              t('vendors.table.internalContact'),
              t('vendors.table.email'),
              t('vendors.table.phone'),
              t('common.actions'),
            ]}
          >
            {filteredVendors.map(vendor => (
              <TableRow key={vendor.id}>
                <TableCell>
                  <div className="font-semibold text-gray-900 dark:text-white">{vendor.name}</div>
                  {vendor.notes && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">{vendor.notes}</div>
                  )}
                </TableCell>
                <TableCell>{vendor.contactName || '-'}</TableCell>
                <TableCell>{vendor.internalContactName || '-'}</TableCell>
                <TableCell>{vendor.email || '-'}</TableCell>
                <TableCell>{vendor.phone || '-'}</TableCell>
                <TableCell className="text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleOpenModal({ type: 'edit', vendor })}
                      >
                        {t('common.edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setDeletingVendor(vendor)}
                      >
                        {t('common.delete')}
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </Table>
        ) : (
          <p className="py-6 text-center text-gray-500 dark:text-gray-400">
            {t('vendors.empty')}
          </p>
        )}
      </Card>

      <Modal
        isOpen={!!modalState}
        onClose={() => setModalState(null)}
        title={getModalTitle()}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalState(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} className="ml-2">
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            id="vendor-name"
            label={
              <span className="flex items-center">
                <span>{t('vendors.form.name')}</span>
                <span className="ml-1 text-red-500" aria-hidden="true">*</span>
              </span>
            }
            required
            aria-required="true"
            value={formData.name || ''}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            error={errors.name}
            placeholder={t('vendors.form.namePlaceholder')}
          />
          <Input
            label={t('vendors.form.contactName')}
            value={formData.contactName || ''}
            onChange={e => setFormData(prev => ({ ...prev, contactName: e.target.value }))}
            placeholder={t('vendors.form.contactPlaceholder')}
          />
          <Input
            label={t('vendors.form.internalContactName')}
            value={formData.internalContactName || ''}
            onChange={e => setFormData(prev => ({ ...prev, internalContactName: e.target.value }))}
            placeholder={t('vendors.form.internalContactPlaceholder')}
          />
          <Input
            label={t('vendors.form.email')}
            type="email"
            value={formData.email || ''}
            onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
            placeholder={t('vendors.form.emailPlaceholder')}
          />
          <Input
            label={t('vendors.form.phone')}
            value={formData.phone || ''}
            onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            placeholder={t('vendors.form.phonePlaceholder')}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('vendors.form.notes')}
            </label>
            <textarea
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              rows={3}
              value={formData.notes || ''}
              onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder={t('vendors.form.notesPlaceholder')}
            />
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={!!deletingVendor}
        onClose={() => setDeletingVendor(null)}
        onConfirm={handleConfirmDelete}
        title={t('vendors.delete.title')}
      >
        <p>{t('vendors.delete.message', { name: deletingVendor?.name || '' })}</p>
      </ConfirmationModal>
    </>
  );
};

export default VendorManagement;
