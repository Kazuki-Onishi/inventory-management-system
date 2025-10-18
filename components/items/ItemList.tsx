
import React, { useEffect, useState, useContext, useMemo, useCallback } from 'react';
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
import { classNames, createSearchTerms, getItemDisplayName, matchesSearch } from '../../lib/utils';
import { ensureItemHumanId, generateNextItemHumanId } from '../../lib/items';
import ConfirmationModal from '../ui/ConfirmationModal';
import { Table, TableRow, TableCell } from '../ui/Table';
import Select from '../ui/Select';
import ItemImageModal from './ItemImageModal';

type ModalState =
  | { type: 'add' }
  | { type: 'edit'; item: Item }
  | null;

const ItemList: React.FC = () => {
  const { t, language } = useTranslation();
  const { hasPermission, isOffline } = useContext(AuthContext);
  const { items: contextItems, categories, addItem, updateItem, deleteItem, showToast } = useContext(AppContext);
  const [items, setItems] = useState<Item[]>([]);
  const mapItemsWithHumanId = useCallback((list: Item[]): Item[] => list.map((item) => ensureItemHumanId(item)), []);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDiscontinued, setShowDiscontinued] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  
  const [modalState, setModalState] = useState<ModalState>(null);
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);

  const [formData, setFormData] = useState<Partial<NewItem & { isDiscontinued: boolean }>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isAdvancedVisible, setAdvancedVisible] = useState(false);
  const [imageModalItem, setImageModalItem] = useState<Item | null>(null);


  const fetchAndSetItems = () => {
    setLoading(true);
    if (isOffline) {
      setItems(mapItemsWithHumanId(contextItems));
      setLoading(false);
    } else {
      api.fetchItems().then(data => {
        setItems(mapItemsWithHumanId(data));
      }).catch(err => console.error("Failed to fetch items", err))
      .finally(() => setLoading(false));
    }
  };

  useEffect(() => {
    fetchAndSetItems();
  }, [isOffline, contextItems]);

  const searchTerms = useMemo(() => createSearchTerms(searchTerm), [searchTerm]);

  const filteredItems = useMemo(() => {
    let tempItems = items;
    if (!showDiscontinued) {
        tempItems = tempItems.filter(item => !item.isDiscontinued);
    }
    if (selectedCategoryId) {
        tempItems = tempItems.filter(item => item.categoryId === selectedCategoryId);
    }
    if (searchTerms.length > 0) {
        tempItems = tempItems.filter(item =>
            matchesSearch(
                [
                    getItemDisplayName(item, language),
                    item.shortName,
                    item.sku,
                    item.humanId,
                    item.nameEn,
                    item.description,
                ],
                searchTerms,
            )
        );
    }
    return tempItems.sort((a, b) => getItemDisplayName(a, language).localeCompare(getItemDisplayName(b, language), language === 'ja' ? 'ja-JP' : 'en-US'));
  }, [items, showDiscontinued, searchTerms, language, selectedCategoryId]);


  const handleOpenModal = (state: ModalState) => {
    setModalState(state);
    setErrors({});
    setAdvancedVisible(false);
    const baseItems = mapItemsWithHumanId(items.length > 0 ? items : contextItems);

    if (state?.type === 'edit') {
      const itemWithId = ensureItemHumanId(state.item);
      setFormData({
        ...itemWithId,
        nameEn: itemWithId.nameEn || '',
        shortName: itemWithId.shortName || '',
        description: itemWithId.description || '',
        costA: itemWithId.costA,
        costB: itemWithId.costB,
        sku: itemWithId.sku || '',
        isDiscontinued: itemWithId.isDiscontinued || false,
        janCode: itemWithId.janCode || '',
        supplier: itemWithId.supplier || '',
        categoryId: itemWithId.categoryId || '',
        imageUrl: itemWithId.imageUrl || '',
        humanId: itemWithId.humanId,
      });
    } else {
      const nextHumanId = generateNextItemHumanId(baseItems);
      setFormData({
        name: '',
        humanId: nextHumanId,
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
        imageUrl: '',
      });
    }
  };

  const handleCloseModal = () => {
    setModalState(null);
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
      const trimmedName = formData.name!.trim();
      const trimmedNameEn = formData.nameEn?.trim() || '';
      const trimmedHumanId = formData.humanId?.trim();
      const baseItemsForId = mapItemsWithHumanId(items.length > 0 ? items : contextItems);
      const humanId = trimmedHumanId && trimmedHumanId.length > 0 ? trimmedHumanId : generateNextItemHumanId(baseItemsForId);
      const currentImageUrl = formData.imageUrl?.trim() || null;

      const data: NewItem = {
        name: trimmedName,
        shortName: formData.shortName?.trim() || '',
        description: formData.description?.trim() || '',
        costA: formData.costA ?? 0,
        costB: formData.costB ?? 0,
        sku: formData.sku?.trim() || '',
        isDiscontinued: !!formData.isDiscontinued,
        nameEn: trimmedNameEn,
        janCode: formData.janCode?.trim() || '',
        supplier: formData.supplier?.trim() || '',
        categoryId: normalizedCategoryId,
        humanId,
        imageUrl: currentImageUrl,
      };

      let targetItem: Item;

      if (modalState.type === 'add') {
        if (isOffline) {
          targetItem = await addItem(data);
        } else {
          targetItem = await api.addItem(data);
          needsRefetch = true;
        }
      } else {
        const updatedItem = { ...modalState.item, ...data };
        if (isOffline) {
          await updateItem(updatedItem);
        } else {
          await api.updateItem(updatedItem);
          needsRefetch = true;
        }
        targetItem = updatedItem;
      }

      if (needsRefetch) {
        fetchAndSetItems();
      }

      setModalState(null);
      showToast(t('toast.saveSuccess'));
    } catch (error) {
      console.error('Failed to save item', error);
      showToast(t('toast.saveError'), 'error');
    }
  };


  const handleImageModalClose = () => {
    setImageModalItem(null);
  };

  const handleImageModalCompleted = (updatedItem?: Item) => {
    if (updatedItem && modalState?.type === 'edit' && modalState.item.id === updatedItem.id) {
      setFormData(prev => ({ ...prev, imageUrl: updatedItem.imageUrl || '' }));
    }
    fetchAndSetItems();
    setImageModalItem(null);
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
    <Table headers={[t('products.fullName'), t('products.humanId'), t('products.category'), t('products.sku'), t('common.actions')]}>
        {filteredItems.map(item => {
            const categoryName = categories.find(c => c.id === item.categoryId)?.name || '-';
            return (
                <TableRow key={item.id} className={classNames(item.isDiscontinued && "text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50")}>
                    <TableCell>
                        <div className="flex items-start gap-3">
                            {item.imageUrl && (
                                <img
                                    src={item.imageUrl}
                                    alt={getItemDisplayName(item, language)}
                                    className="h-14 w-14 rounded-md object-cover border border-gray-200 dark:border-gray-700"
                                    loading="lazy"
                                />
                            )}
                            <div>
                                <div className="font-medium text-gray-900 dark:text-white">{getItemDisplayName(item, language)}</div>
                                {item.description && (
                                    <div className="text-sm text-gray-500 dark:text-gray-400">{item.description}</div>
                                )}
                            </div>
                        </div>
                    </TableCell>
                    <TableCell>
                        <span className="font-mono text-sm text-gray-700 dark:text-gray-300">{item.humanId || '-'}</span>
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
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => setImageModalItem(item)}
                                    disabled={isOffline}
                                >
                                    {item.imageUrl ? t('products.imageUpload.manage') : t('products.imageUpload.add')}
                                </Button>
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
        onClose={handleCloseModal}
        title={getModalTitle()}
        maxWidthClassName="max-w-4xl"
        bodyClassName="space-y-4"
        footer={
            <>
                <Button variant="secondary" onClick={handleCloseModal}>{t('common.cancel')}</Button>
                <Button onClick={handleSave} className="ml-2">{t('common.save')}</Button>
            </>
        }
    >
            <div className="space-y-1">
                <Input
                    label={t('products.humanId')}
                    value={formData.humanId || ''}
                    readOnly
                    onFocus={(e) => e.currentTarget.select()}
                    className="bg-gray-100 dark:bg-gray-800 cursor-default"
                    error={errors.humanId}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('products.humanId.readOnly')}</p>
            </div>
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
                <Input label={t('products.nameEn')} value={formData.nameEn || ''} onChange={e => setFormData(p => ({...p, nameEn: e.target.value}))} placeholder={t('products.nameEn.placeholder')} error={errors.nameEn} />
                <Input label={t('products.janCode')} value={formData.janCode || ''} onChange={e => setFormData(p => ({...p, janCode: e.target.value}))} placeholder={t('products.janCode.placeholder')} />
                <Input label={t('products.supplier')} value={formData.supplier || ''} onChange={e => setFormData(p => ({...p, supplier: e.target.value}))} placeholder={t('products.supplier.placeholder')} />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('products.imageUpload.title')}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formData.imageUrl ? t('products.imageUpload.attached') : t('products.imageUpload.notAttached')}
                    </span>
                  </div>
                  {formData.imageUrl ? (
                    <img
                      src={formData.imageUrl}
                      alt={formData.name || formData.shortName || 'item preview'}
                      className="h-20 w-20 rounded-md object-cover border border-gray-200 dark:border-gray-700"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed border-gray-300 text-xs text-gray-500 dark:border-gray-600 dark:text-gray-400">
                      {t('products.imageUpload.placeholder')}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => modalState?.type === 'edit' && setImageModalItem(modalState.item)}
                      disabled={modalState?.type !== 'edit' || isOffline}
                    >
                      {formData.imageUrl ? t('products.imageUpload.manage') : t('products.imageUpload.add')}
                    </Button>
                    {modalState?.type === 'add' && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">{t('products.imageUpload.saveFirst')}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('products.imageUpload.helper')}</p>
                </div>

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
    </Modal>
    {imageModalItem && (
      <ItemImageModal
        isOpen
        item={imageModalItem}
        onClose={handleImageModalClose}
        onCompleted={handleImageModalCompleted}
        isOffline={isOffline}
        showToast={showToast}
      />
    )}

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

