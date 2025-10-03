
import React, { useEffect, useState, useContext, useMemo } from 'react';
import { api } from '../../services/api';
import { Item, Role, NewItem } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { AuthContext } from '../../contexts/AuthContext';
import { AppContext } from '../../contexts/AppContext';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { ICONS } from '../../constants';
import Spinner from '../ui/Spinner';
import Modal from '../ui/Modal';
import { classNames, getItemDisplayName } from '../../lib/utils';
import ConfirmationModal from '../ui/ConfirmationModal';
import { Table, TableRow, TableCell } from '../ui/Table';
import Select from '../ui/Select';

type ModalState =
  | { type: 'add' }
  | { type: 'edit'; item: Item }
  | null;

const ItemList: React.FC = () => {
  const { t, language } = useTranslation();
  const { hasPermission, isOffline } = useContext(AuthContext);
  const { items: contextItems, categories, addItem, updateItem, deleteItem, showToast } = useContext(AppContext);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDiscontinued, setShowDiscontinued] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  
  const [modalState, setModalState] = useState<ModalState>(null);
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);

  const [formData, setFormData] = useState<Partial<NewItem & { isDiscontinued: boolean }>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isAdvancedVisible, setAdvancedVisible] = useState(false);

  const fetchAndSetItems = () => {
    setLoading(true);
    if (isOffline) {
      setItems(contextItems);
      setLoading(false);
    } else {
      api.fetchItems().then(data => {
        setItems(data);
      }).catch(err => console.error("Failed to fetch items", err))
      .finally(() => setLoading(false));
    }
  };

  useEffect(() => {
    fetchAndSetItems();
  }, [isOffline, contextItems]);

  const filteredItems = useMemo(() => {
    let tempItems = items;
    if (!showDiscontinued) {
        tempItems = tempItems.filter(item => !item.isDiscontinued);
    }
    if (selectedCategoryId) {
        tempItems = tempItems.filter(item => item.categoryId === selectedCategoryId);
    }
    if (searchTerm) {
        const lowerSearchTerm = searchTerm.toLowerCase();
        tempItems = tempItems.filter(item => 
            getItemDisplayName(item, language).toLowerCase().includes(lowerSearchTerm) ||
            item.shortName.toLowerCase().includes(lowerSearchTerm) ||
            item.sku?.toLowerCase().includes(lowerSearchTerm)
        );
    }
    return tempItems.sort((a, b) => getItemDisplayName(a, language).localeCompare(getItemDisplayName(b, language), language === 'ja' ? 'ja-JP' : 'en-US'));
  }, [items, showDiscontinued, searchTerm, language, selectedCategoryId]);


  const handleOpenModal = (state: ModalState) => {
    setModalState(state);
    setErrors({});
    setAdvancedVisible(false);
    if (state?.type === 'edit') {
        setFormData(state.item);
    } else {
        setFormData({
            name: '',
            shortName: '',
            description: '',
            costA: 0,
            costB: 0,
            sku: '',
            isDiscontinued: false,
            nameEn: '',
            janCode: '',
            supplier: '',
            categoryId: '',
        });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name?.trim()) newErrors.name = t('common.required');
    
    const isDuplicate = items.some(i => 
        i.name.toLowerCase() === formData.name?.toLowerCase() &&
        (modalState?.type === 'edit' ? i.id !== modalState.item.id : true)
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
        const normalizedCategoryId = formData.categoryId ? formData.categoryId : null;
        const data: NewItem = {
            name: formData.name!,
            shortName: formData.shortName || '',
            description: formData.description || '',
            costA: formData.costA || 0,
            costB: formData.costB || 0,
            sku: formData.sku || '',
            isDiscontinued: formData.isDiscontinued || false,
            nameEn: formData.nameEn || '',
            janCode: formData.janCode || '',
            supplier: formData.supplier || '',
            categoryId: normalizedCategoryId,
        };

        if (modalState.type === 'add') {
            if(isOffline) { await addItem(data); } else { await api.addItem(data); needsRefetch = true; }
        } else { // edit
            const updatedItem = { ...modalState.item, ...data };
            if(isOffline) { await updateItem(updatedItem); } else { await api.updateItem(updatedItem); needsRefetch = true; }
        }

        if (needsRefetch) fetchAndSetItems();
        setModalState(null);
        showToast(t('toast.saveSuccess'));
    } catch (e) {
        console.error("Failed to save item", e);
        showToast(t('toast.saveError'), 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    try {
        let needsRefetch = false;
        if (isOffline) {
            await deleteItem(deletingItem.id);
        } else {
            await api.deleteItem(deletingItem.id);
            needsRefetch = true;
        }

        if (needsRefetch) fetchAndSetItems();
        setDeletingItem(null);
        showToast(t('toast.deleteSuccess'));
    } catch (e) {
        console.error("Failed to delete item", e);
        showToast(t('toast.deleteError'), 'error');
    }
  };

  const getModalTitle = () => {
      if(!modalState) return '';
      return modalState.type === 'add' ? t('products.addItem.title') : t('products.editItem.title');
  }
  
  const canEdit = hasPermission(Role.Editor);

  const renderItemTable = () => (
    <Table headers={[t('products.fullName'), t('products.category'), t('products.sku'), t('common.actions')]}>
        {filteredItems.map(item => {
            const categoryName = categories.find(c => c.id === item.categoryId)?.name || '-';
            return (
                <TableRow key={item.id} className={classNames(item.isDiscontinued && "text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50")}>
                    <TableCell>
                        <div className="font-medium text-gray-900 dark:text-white">{getItemDisplayName(item, language)}</div>
                        <div className="text-sm text-gray-500">{item.description}</div>
                    </TableCell>
                    <TableCell>{categoryName}</TableCell>
                    <TableCell>
                        {item.sku && (
                            <span className="font-mono bg-gray-100 dark:bg-gray-700 rounded px-2 py-1 text-xs">
                                {item.sku}
                            </span>
                        )}
                    </TableCell>
                    <TableCell className="text-right">
                        {canEdit && (
                            <div className="flex justify-end space-x-2">
                                <Button size="sm" variant="secondary" onClick={() => handleOpenModal({ type: 'edit', item })}>{t('common.edit')}</Button>
                                <Button size="sm" variant="danger" onClick={() => setDeletingItem(item)}>{t('common.delete')}</Button>
                            </div>
                        )}
                    </TableCell>
                </TableRow>
            )
        })}
    </Table>
  );

  const SkuLabel = () => (
    <div className="flex items-center space-x-1">
        <span>{t('products.sku')}</span>
        <div className="group relative flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="absolute bottom-full mb-2 w-64 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-2 px-3 z-10 shadow-lg">
                {t('products.sku.tooltip')}
            </div>
        </div>
    </div>
  );

  return (
    <>
    <Card title={t('products.title')}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        <div className="flex-grow flex flex-col md:flex-row md:items-center gap-4 w-full">
            <Input
                type="text"
                placeholder={t('common.search')}
                icon={ICONS.search}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:max-w-xs"
            />
             <Select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="w-full md:max-w-xs"
                aria-label={t('products.filterByCategory')}
             >
                <option value="">{t('products.allCategories')}</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
             </Select>
            <label className="flex items-center space-x-2">
                <input
                    type="checkbox"
                    checked={showDiscontinued}
                    onChange={e => setShowDiscontinued(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{t('products.showDiscontinued')}</span>
            </label>
        </div>
        <div className="flex items-center space-x-4 self-end w-full md:w-auto justify-end">
            {canEdit && (
                <Button onClick={() => handleOpenModal({ type: 'add' })}>{t('products.addItem')}</Button>
            )}
        </div>
      </div>

      {loading ? <Spinner/> : renderItemTable()}
      { !loading && filteredItems.length === 0 && <p className="text-center text-gray-500 py-4">{t('common.noResults')}</p> }
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
            <Input label={t('products.fullName')} value={formData.name || ''} onChange={e => setFormData(p => ({...p, name: e.target.value}))} placeholder={t('products.fullName.placeholder')} error={errors.name} />
            <Input label={t('products.shortName')} value={formData.shortName || ''} onChange={e => setFormData(p => ({...p, shortName: e.target.value}))} placeholder={t('products.shortName.placeholder')} />
            <Select 
                label={t('products.category')}
                value={formData.categoryId || ''}
                onChange={e => setFormData(p => ({ ...p, categoryId: e.target.value }))}
            >
                <option value="">-- {t('products.selectCategory')} --</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </Select>
            <div>
                 <label htmlFor="details" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('products.details')}</label>
                 <textarea
                    id="details"
                    value={formData.description || ''}
                    onChange={e => setFormData(p => ({...p, description: e.target.value}))}
                    rows={3}
                    className="block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white border-gray-300"
                 />
            </div>
            
            <div className="border-t dark:border-gray-700 pt-4">
              <button 
                onClick={() => setAdvancedVisible(p => !p)}
                className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline flex items-center"
                type="button"
              >
                {t('products.advancedSettings')}
                <span className={classNames("ml-1 transition-transform", isAdvancedVisible && "rotate-180")}>
                  {ICONS.chevronDown}
                </span>
              </button>
            </div>
            
            {isAdvancedVisible && (
              <div className="space-y-4 pt-2">
                <Input label={<SkuLabel />} value={formData.sku || ''} onChange={e => setFormData(p => ({...p, sku: e.target.value}))} placeholder={t('products.sku.placeholder')} />
                <div className="grid grid-cols-2 gap-4">
                    <Input label={t('products.costA')} type="number" value={formData.costA ?? 0} onChange={e => setFormData(p => ({...p, costA: parseFloat(e.target.value) || 0}))} error={errors.costA} />
                    <Input label={t('products.costB')} type="number" value={formData.costB ?? 0} onChange={e => setFormData(p => ({...p, costB: parseFloat(e.target.value) || 0}))} error={errors.costB} />
                </div>
                <Input label={t('products.nameEn')} value={formData.nameEn || ''} onChange={e => setFormData(p => ({...p, nameEn: e.target.value}))} placeholder={t('products.nameEn.placeholder')} />
                <Input label={t('products.janCode')} value={formData.janCode || ''} onChange={e => setFormData(p => ({...p, janCode: e.target.value}))} placeholder={t('products.janCode.placeholder')} />
                {/* FIX: Complete the supplier Input component, which was truncated. */}
                <Input label={t('products.supplier')} value={formData.supplier || ''} onChange={e => setFormData(p => ({...p, supplier: e.target.value}))} placeholder={t('products.supplier.placeholder')} />
                <label className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    checked={!!formData.isDiscontinued}
                    onChange={e => setFormData(p => ({ ...p, isDiscontinued: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('products.discontinued')}</span>
                </label>
              </div>
            )}
        </div>
    </Modal>
    <ConfirmationModal
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirm={handleConfirmDelete}
        title={t('products.delete.confirm.title')}
    >
        <p>{t('products.delete.confirm.message', { name: getItemDisplayName(deletingItem || undefined, language) })}</p>
    </ConfirmationModal>
    </>
  );
};

// FIX: Add default export to resolve module import error in App.tsx.
export default ItemList;