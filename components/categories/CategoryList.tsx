
import React, { useEffect, useState, useContext } from 'react';
import { api } from '../../services/api';
import { Category, NewCategory, Role } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { AuthContext } from '../../contexts/AuthContext';
import { AppContext } from '../../contexts/AppContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import Modal from '../ui/Modal';
import ConfirmationModal from '../ui/ConfirmationModal';
import { Table, TableRow, TableCell } from '../ui/Table';
import Input from '../ui/Input';

type ModalState =
  | { type: 'add' }
  | { type: 'edit'; category: Category }
  | null;

const CategoryList: React.FC = () => {
  const { t } = useTranslation();
  const { hasPermission, isOffline } = useContext(AuthContext);
  const { categories: contextCategories, addCategory, updateCategory, deleteCategory, showToast } = useContext(AppContext);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [modalState, setModalState] = useState<ModalState>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  const [formData, setFormData] = useState<Partial<NewCategory>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchAndSetCategories = async () => {
    setLoading(true);
    try {
      const data = isOffline ? contextCategories : await api.fetchCategories();
      setCategories(data);
    } catch (err) {
      console.error("Failed to fetch categories", err);
      showToast('Failed to load categories.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAndSetCategories();
  }, [isOffline, contextCategories]);
  
  const handleOpenModal = (state: ModalState) => {
    setModalState(state);
    setErrors({});
    if (state?.type === 'edit') {
        setFormData({ name: state.category.name });
    } else {
        setFormData({ name: '' });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name?.trim()) newErrors.name = t('common.required');
    
    const isDuplicate = categories.some(c => 
        c.name.toLowerCase() === formData.name?.toLowerCase() &&
        (modalState?.type === 'edit' ? c.id !== modalState.category.id : true)
    );
    if (isDuplicate) newErrors.name = t('products.duplicateError');

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !modalState) {
        showToast(t('toast.saveError'), 'error');
        return;
    }

    try {
        let needsRefetch = false;
        const data: NewCategory = { name: formData.name! };

        if (modalState.type === 'add') {
            isOffline ? await addCategory(data) : (await api.addCategory(data), needsRefetch = true);
        } else { // edit
            const updatedCategory = { ...modalState.category, ...data };
            isOffline ? await updateCategory(updatedCategory) : (await api.updateCategory(updatedCategory), needsRefetch = true);
        }

        if (needsRefetch) await fetchAndSetCategories();
        setModalState(null);
        showToast(t('toast.saveSuccess'));
    } catch (e) {
        console.error("Failed to save category", e);
        showToast(t('toast.saveError'), 'error');
    }
  };
  
  const handleConfirmDelete = async () => {
    if (!deletingCategory) return;
    try {
        let needsRefetch = false;
        isOffline ? await deleteCategory(deletingCategory.id) : (await api.deleteCategory(deletingCategory.id), needsRefetch = true);

        if (needsRefetch) await fetchAndSetCategories();
        setDeletingCategory(null);
        showToast(t('toast.deleteSuccess'));
    } catch (e) {
        console.error("Failed to delete category", e);
        showToast(t('toast.deleteError'), 'error');
    }
  };

  const getModalTitle = () => {
      if(!modalState) return '';
      return modalState.type === 'add' ? t('categories.addCategory.title') : t('categories.editCategory.title');
  }

  const canEdit = hasPermission(Role.Editor); // Or Admin, depending on desired strictness

  return (
    <>
      <Card title={t('categories.title')}>
        <div className="flex justify-end mb-4">
          {canEdit && (
            <Button onClick={() => handleOpenModal({ type: 'add' })}>{t('categories.addCategory')}</Button>
          )}
        </div>

        {loading ? <Spinner /> : (
            categories.length > 0 ? (
                <Table headers={[t('common.name'), t('common.actions')]}>
                {categories.map(category => (
                    <TableRow key={category.id}>
                    <TableCell>
                        <div className="font-medium text-gray-900 dark:text-white">{category.name}</div>
                    </TableCell>
                    <TableCell className="text-right">
                        {canEdit && (
                        <div className="flex justify-end space-x-2">
                            <Button size="sm" variant="secondary" onClick={() => handleOpenModal({ type: 'edit', category })}>{t('common.edit')}</Button>
                            <Button size="sm" variant="danger" onClick={() => setDeletingCategory(category)}>{t('common.delete')}</Button>
                        </div>
                        )}
                    </TableCell>
                    </TableRow>
                ))}
                </Table>
            ) : (
                 <p className="text-center text-gray-500 py-4">{t('common.noResults')}</p>
            )
        )}
      </Card>

      <Modal
        isOpen={!!modalState}
        onClose={() => setModalState(null)}
        title={getModalTitle()}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalState(null)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} className="ml-2">{t('common.save')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input 
            label={t('common.name')} 
            value={formData.name || ''} 
            onChange={e => setFormData(p => ({...p, name: e.target.value}))} 
            placeholder={t('categories.name.placeholder')}
            error={errors.name} 
          />
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={!!deletingCategory}
        onClose={() => setDeletingCategory(null)}
        onConfirm={handleConfirmDelete}
        title={t('categories.delete.confirm.title')}
      >
        <p>{t('categories.delete.confirm.message', { name: deletingCategory?.name || '' })}</p>
      </ConfirmationModal>
    </>
  );
};

export default CategoryList;
