
import React, { useEffect, useState, useContext } from 'react';
import { api } from '../../services/api';
import { Location, Role, SubLocation, NewLocation, NewSubLocation } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { AppContext } from '../../contexts/AppContext';
import { AuthContext } from '../../contexts/AuthContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { ICONS } from '../../constants';
import { classNames } from '../../lib/utils';
import Spinner from '../ui/Spinner';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Select from '../ui/Select';
import ConfirmationModal from '../ui/ConfirmationModal';

type ModalState = 
  | { type: 'add_location' }
  | { type: 'add_sublocation' }
  | { type: 'edit_location', location: Location }
  | { type: 'edit_sublocation', subLocation: SubLocation, parentId: string, parentHumanId: string }
  | null;

type DeletingTarget = 
  | { id: string, name: string, isSub: false }
  | { id: string, name: string, isSub: true, parentId: string }
  | null;

const LocationRow: React.FC<{ 
    location: Location, 
    canEdit: boolean,
    onEditLocation: (location: Location) => void,
    onDeleteLocation: (location: Location) => void,
    onEditSubLocation: (subLocation: SubLocation, parentId: string, parentHumanId: string) => void,
    onDeleteSubLocation: (subLocation: SubLocation, parentId: string) => void,
}> = ({ location, canEdit, onEditLocation, onDeleteLocation, onEditSubLocation, onDeleteSubLocation }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { t } = useTranslation();
    const hasSublocations = location.sublocations && location.sublocations.length > 0;
  
    return (
      <div className="border-b dark:border-gray-700 last:border-b-0">
        <div className="hover:bg-gray-50 dark:hover:bg-gray-700">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-3">
            <div 
              className={classNames("flex items-center flex-grow", hasSublocations && "cursor-pointer")}
              onClick={() => hasSublocations && setIsOpen(!isOpen)}
              aria-expanded={isOpen}
            >
              {hasSublocations ? (
                <span className={classNames("transition-transform duration-200 text-gray-500", isOpen ? "rotate-90" : "")}>
                  {ICONS.chevronRight}
                </span>
              ) : (
                <span className="w-5 inline-block"></span>
              )}
              <div className="ml-2">
                <span className="font-medium text-gray-900 dark:text-white">
                  <span className="font-mono bg-gray-200 dark:bg-gray-600 rounded px-1.5 py-0.5 text-sm mr-2">
                    {location.humanId}
                  </span>
                  {location.name}
                </span>
                {location.description && <span className="block md:inline md:ml-4 text-sm text-gray-500 dark:text-gray-400">{location.description}</span>}
              </div>
            </div>
            
            {canEdit && (
              <div className="flex space-x-2 flex-shrink-0">
                <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); onEditLocation(location); }}>{t('common.edit')}</Button>
                <Button variant="danger" size="sm" onClick={(e) => { e.stopPropagation(); onDeleteLocation(location); }}>{t('common.delete')}</Button>
              </div>
            )}
          </div>
        </div>

        {isOpen && hasSublocations && (
          <div className="bg-gray-50 dark:bg-gray-900/50">
            {location.sublocations?.map(sub => (
              <div key={sub.id} className="border-t dark:border-gray-700">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-3 pl-8">
                  <div className="flex-grow">
                    <span className="font-medium text-gray-900 dark:text-white">
                      <span className="font-mono bg-gray-200 dark:bg-gray-600 rounded px-1.5 py-0.5 text-sm mr-2">
                        {location.humanId}-{sub.humanId}
                      </span>
                      {sub.name}
                    </span>
                    {sub.description && <span className="block md:inline md:ml-4 text-sm text-gray-500 dark:text-gray-400">{sub.description}</span>}
                  </div>
                  
                  {canEdit && (
                    <div className="flex space-x-2 flex-shrink-0">
                      <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); onEditSubLocation(sub, location.id, location.humanId); }}>{t('common.edit')}</Button>
                      <Button variant="danger" size="sm" onClick={(e) => { e.stopPropagation(); onDeleteSubLocation(sub, location.id); }}>{t('common.delete')}</Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

const LocationList: React.FC = () => {
  const { t } = useTranslation();
  const { currentStore, locations: contextLocations, addLocation, addSubLocation, updateLocation, updateSubLocation, deleteLocation, deleteSubLocation } = useContext(AppContext);
  const { hasPermission, isOffline } = useContext(AuthContext);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [modalState, setModalState] = useState<ModalState>(null);
  const [deletingTarget, setDeletingTarget] = useState<DeletingTarget>(null);
  
  const [formData, setFormData] = useState<Partial<NewLocation & NewSubLocation & { parentId: string }>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchAndSetLocations = () => {
    if (!currentStore) {
        setLocations([]);
        setLoading(false);
        return;
    }
    setLoading(true);
    if (isOffline) {
        const storeLocations = contextLocations.filter(l => l.storeId === currentStore.id);
        setLocations(storeLocations);
        setLoading(false);
    } else {
        api.fetchLocationsByStore(currentStore.id).then(data => {
            setLocations(data);
            setLoading(false);
        }).catch(err => {
            console.error("Failed to fetch locations:", err);
            setLoading(false);
        });
    }
  };

  useEffect(() => {
    fetchAndSetLocations();
  }, [currentStore, isOffline, contextLocations]);
  
  const handleOpenModal = (state: ModalState) => {
      setModalState(state);
      setErrors({});
      if (state?.type === 'edit_location') {
        setFormData({ name: state.location.name, description: state.location.description, humanId: state.location.humanId });
      } else if (state?.type === 'edit_sublocation') {
        setFormData({ name: state.subLocation.name, description: state.subLocation.description, parentId: state.parentId });
      } else {
        setFormData({});
      }
  };

  const handleCloseModal = () => setModalState(null);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name?.trim()) newErrors.name = t('common.required');

    if(modalState?.type === 'add_location' || modalState?.type === 'edit_location') {
        if (!formData.humanId?.trim()) {
            newErrors.humanId = t('common.required');
        } else {
            const isDuplicate = locations.some(loc => 
                loc.humanId.toLowerCase() === formData.humanId?.toLowerCase() &&
                (modalState?.type === 'edit_location' ? loc.id !== modalState.location.id : true)
            );
            if (isDuplicate) {
                newErrors.humanId = t('locations.managementId.duplicateError');
            }
        }
    }

    if (modalState?.type === 'add_sublocation' && !formData.parentId) {
        newErrors.parentId = t('common.required');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSave = async () => {
    if (!validateForm() || !currentStore || !modalState) return;

    try {
        let needsRefetch = false;
        switch(modalState.type) {
            case 'add_location':
                const newLoc: NewLocation = { name: formData.name!, humanId: formData.humanId!, description: formData.description || '', storeId: currentStore.id };
                isOffline ? await addLocation(newLoc) : (await api.addLocation(newLoc), needsRefetch = true);
                break;
            case 'add_sublocation':
                const newSub: NewSubLocation = { name: formData.name!, description: formData.description || '', humanId: '' }; // humanId is generated in context/api
                isOffline ? await addSubLocation(formData.parentId!, newSub) : (await api.addSubLocation(formData.parentId!, newSub), needsRefetch = true);
                break;
            case 'edit_location':
                const locData: Partial<NewLocation> = { name: formData.name, humanId: formData.humanId, description: formData.description };
                isOffline ? await updateLocation(modalState.location.id, locData) : (await api.updateLocation(modalState.location.id, locData), needsRefetch = true);
                break;
            case 'edit_sublocation':
                // humanId for sublocation is not editable from this modal
                const subData: SubLocation = { ...modalState.subLocation, name: formData.name!, description: formData.description || '' };
                isOffline ? await updateSubLocation(modalState.parentId, subData) : (await api.updateSubLocation(modalState.parentId, subData), needsRefetch = true);
                break;
        }
        
        if (needsRefetch) fetchAndSetLocations();
        handleCloseModal();
    } catch (e) {
        console.error("Failed to save location", e);
        setErrors({ form: "Failed to save location." });
    }
  };

  const handleDelete = (target: DeletingTarget) => {
    setDeletingTarget(target);
  };

  const handleConfirmDelete = async () => {
    if (!deletingTarget) return;

    try {
        let needsRefetch = false;
        if (deletingTarget.isSub) {
            isOffline ? await deleteSubLocation(deletingTarget.parentId, deletingTarget.id) : (await api.deleteSubLocation(deletingTarget.parentId, deletingTarget.id), needsRefetch = true);
        } else {
            isOffline ? await deleteLocation(deletingTarget.id) : (await api.deleteLocation(deletingTarget.id), needsRefetch = true);
        }
        if (needsRefetch) fetchAndSetLocations();
        setDeletingTarget(null);
    } catch(e) {
        console.error("Failed to delete location:", e);
        // You might want to show an error to the user here
        setDeletingTarget(null);
    }
  };


  const canEdit = hasPermission(Role.Editor);

  if (!currentStore) {
    return <Card title={t('locations.title')}><p>{t('header.selectStore')}</p></Card>;
  }
  
  const getModalTitle = () => {
    if(!modalState) return '';
    switch(modalState.type) {
        case 'add_location': return t('locations.addLocation.title');
        case 'add_sublocation': return t('locations.addSubLocation.title');
        case 'edit_location': return t('locations.editLocation.title');
        case 'edit_sublocation': return t('locations.editSubLocation.title');
        default: return '';
    }
  }

  return (
    <>
    <Card title={`${t('locations.title')} - ${currentStore.name}`}>
      {canEdit && (
        <div className="flex justify-end gap-2 mb-4">
            <Button onClick={() => handleOpenModal({type: 'add_location'})}>{t('locations.addLocation')}</Button>
            {locations.length > 0 && (
                <Button onClick={() => handleOpenModal({type: 'add_sublocation'})} variant="secondary">{t('locations.addSubLocation')}</Button>
            )}
        </div>
      )}
      {loading ? <Spinner /> : (
          locations.length > 0 ? (
            <div className="border rounded-lg dark:border-gray-700">
                {locations.map(location => (
                    <LocationRow 
                        key={location.id} 
                        location={location} 
                        canEdit={canEdit}
                        onEditLocation={(loc) => handleOpenModal({type: 'edit_location', location: loc})}
                        onDeleteLocation={(loc) => handleDelete({id: loc.id, name: loc.name, isSub: false})}
                        onEditSubLocation={(sub, parentId, parentHumanId) => handleOpenModal({type: 'edit_sublocation', subLocation: sub, parentId, parentHumanId})}
                        onDeleteSubLocation={(sub, parentId) => handleDelete({id: sub.id, name: sub.name, isSub: true, parentId})}
                    />
                ))}
            </div>
          ) : (
            <div className="text-center py-10 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {t('locations.noLocations.title')}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {t('locations.noLocations.description')}
                </p>
                {canEdit && (
                    <div className="mt-6">
                        <Button onClick={() => handleOpenModal({type: 'add_location'})}>
                           <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="-ml-1 mr-2 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                            {t('locations.addFirstLocation')}
                           </>
                        </Button>
                    </div>
                )}
            </div>
          )
      )}
    </Card>
    <Modal
        isOpen={!!modalState}
        onClose={handleCloseModal}
        title={getModalTitle()}
        footer={
            <>
                <Button variant="secondary" onClick={handleCloseModal}>{t('common.cancel')}</Button>
                <Button onClick={handleSave} className="ml-2">{t('common.save')}</Button>
            </>
        }
    >
        <div className="space-y-4">
            {(modalState?.type === 'add_sublocation' || modalState?.type === 'edit_sublocation') && (
                <Select
                    label={t('locations.selectParent')}
                    value={formData.parentId || ''}
                    onChange={e => setFormData(p => ({ ...p, parentId: e.target.value }))}
                    error={errors.parentId}
                    disabled={modalState.type === 'edit_sublocation'}
                >
                    <option value="" disabled>-- Select --</option>
                    {locations.map(loc => (
                        <option key={loc.id} value={loc.id}>[{loc.humanId}] {loc.name}</option>
                    ))}
                </Select>
            )}
             {(modalState?.type === 'add_location' || modalState?.type === 'edit_location') && (
                <Input 
                    label={t('locations.managementId')}
                    value={formData.humanId || ''}
                    onChange={e => setFormData(p => ({...p, humanId: e.target.value.toUpperCase()}))}
                    placeholder={t('locations.managementId.placeholder')}
                    error={errors.humanId}
                    maxLength={5}
                />
             )}
            <Input 
                label={t('common.name')}
                value={formData.name || ''}
                onChange={e => setFormData(p => ({...p, name: e.target.value}))}
                placeholder={modalState?.type.includes('sub') ? t('locations.subLocationName.placeholder') : t('locations.locationName.placeholder')}
                error={errors.name}
            />
            <Input 
                label={t('common.description')}
                value={formData.description || ''}
                onChange={e => setFormData(p => ({...p, description: e.target.value}))}
            />
            {errors.form && <p className="text-red-500 text-sm">{errors.form}</p>}
        </div>
    </Modal>
    <ConfirmationModal
        isOpen={!!deletingTarget}
        onClose={() => setDeletingTarget(null)}
        onConfirm={handleConfirmDelete}
        title={t('locations.delete.confirm.title')}
    >
        <p>
            {deletingTarget?.isSub 
                ? t('locations.delete.confirm.subMessage', { name: deletingTarget.name })
                : t('locations.delete.confirm.parentMessage', { name: deletingTarget?.name })}
        </p>
    </ConfirmationModal>
    </>
  );
};

export default LocationList;
