import React, { useEffect, useState, useContext, useMemo, useCallback } from 'react';
import { api } from '../../services/api';
import { Location, Role, SubLocation, NewLocation, NewSubLocation } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { AppContext } from '../../contexts/AppContext';
import { AuthContext } from '../../contexts/AuthContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { ICONS } from '../../constants';
import { classNames, getItemDisplayName } from '../../lib/utils';
import { ensureLocationHumanId, generateNextLocationHumanId, generateNextSubLocationHumanId } from '../../lib/locations';
import Spinner from '../ui/Spinner';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Select from '../ui/Select';
import ConfirmationModal from '../ui/ConfirmationModal';
import LocationImageModal from './LocationImageModal';

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

type ImageModalState =
  | { kind: 'location'; location: Location }
  | { kind: 'sublocation'; location: Location; subLocation: SubLocation }
  | null;

const LocationRow: React.FC<{ 
    location: Location, 
    canEdit: boolean,
    isOffline: boolean,
    onEditLocation: (location: Location) => void,
    onDeleteLocation: (location: Location) => void,
    onEditSubLocation: (subLocation: SubLocation, parentId: string, parentHumanId: string) => void,
    onDeleteSubLocation: (subLocation: SubLocation, parentId: string) => void,
    onManageLocationImage: (location: Location) => void,
    onManageSubLocationImage: (subLocation: SubLocation, parent: Location) => void,
}> = ({
  location,
  canEdit,
  isOffline,
  onEditLocation,
  onDeleteLocation,
  onEditSubLocation,
  onDeleteSubLocation,
  onManageLocationImage,
  onManageSubLocationImage,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const { t } = useTranslation();
    const hasSublocations = Array.isArray(location.sublocations) && location.sublocations.length > 0;
  
    return (
      <div className="border-b dark:border-gray-700 last:border-b-0">
        <div className="hover:bg-gray-50 dark:hover:bg-gray-700">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-3">
            <div
              className={classNames("flex items-center flex-grow gap-3", hasSublocations && "cursor-pointer")}
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
              <div className="flex items-start gap-3">
                {location.imageUrl && (
                  <img
                    src={location.imageUrl}
                    alt={location.name}
                    className="h-12 w-12 rounded-md object-cover border border-gray-200 dark:border-gray-700"
                    loading="lazy"
                  />
                )}
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">
                    <span className="font-mono bg-gray-200 dark:bg-gray-600 rounded px-1.5 py-0.5 text-sm mr-2">
                      {location.humanId}
                    </span>
                    {location.name}
                  </span>
                  {location.description && (
                    <span className="block md:inline md:ml-4 text-sm text-gray-500 dark:text-gray-400">{location.description}</span>
                  )}
                </div>
              </div>
            </div>
            
            {canEdit && (
              <div className="flex space-x-2 flex-shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isOffline}
                  onClick={(e) => {
                    e.stopPropagation();
                    onManageLocationImage(location);
                  }}
                >
                  {location.imageUrl ? t('locations.image.manage') : t('locations.image.add')}
                </Button>
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
                  <div className="flex items-start gap-3 flex-grow">
                    {sub.imageUrl && (
                      <img
                        src={sub.imageUrl}
                        alt={sub.name}
                        className="h-10 w-10 rounded-md object-cover border border-gray-200 dark:border-gray-700"
                        loading="lazy"
                      />
                    )}
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">
                        <span className="font-mono bg-gray-200 dark:bg-gray-600 rounded px-1.5 py-0.5 text-sm mr-2">
                          {location.humanId}-{sub.humanId}
                        </span>
                        {sub.name}
                      </span>
                      {sub.description && (
                        <span className="block md:inline md:ml-4 text-sm text-gray-500 dark:text-gray-400">{sub.description}</span>
                      )}
                    </div>
                  </div>
                  
                  {canEdit && (
                    <div className="flex space-x-2 flex-shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isOffline}
                        onClick={(e) => {
                          e.stopPropagation();
                          onManageSubLocationImage(sub, location);
                        }}
                      >
                        {sub.imageUrl ? t('locations.image.manage') : t('locations.image.add')}
                      </Button>
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
  const { t, language } = useTranslation();
  const {
    currentStore,
    locations: contextLocations,
    items,
    stocktakes,
    addLocation,
    addSubLocation,
    updateLocation,
    updateSubLocation,
    deleteLocation,
    deleteSubLocation,
    removeStocktakes,
    showToast,
  } = useContext(AppContext);
  const { hasPermission, isOffline } = useContext(AuthContext);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const preparedLocations = useMemo(() => {
    return locations
      .map(ensureLocationHumanId)
      .map(location => ({
        ...location,
        sublocations: location.sublocations
          ? [...location.sublocations].sort((a, b) => a.humanId.localeCompare(b.humanId))
          : [],
      }))
      .sort((a, b) => a.humanId.localeCompare(b.humanId));
  }, [locations]);
  const computeNextLocationHumanId = useCallback(() => generateNextLocationHumanId(preparedLocations), [preparedLocations]);
  const computeNextSubLocationHumanId = useCallback((parentId: string) => {
    const parent = preparedLocations.find(location => location.id === parentId);
    return parent ? generateNextSubLocationHumanId(parent) : '01';
  }, [preparedLocations]);
  
  const [modalState, setModalState] = useState<ModalState>(null);
  const [deletingTarget, setDeletingTarget] = useState<DeletingTarget>(null);
  const [imageModalState, setImageModalState] = useState<ImageModalState>(null);
  
  const [formData, setFormData] = useState<Partial<NewLocation & NewSubLocation & { parentId: string }>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [assignmentsToRemove, setAssignmentsToRemove] = useState<Set<string>>(new Set());

  const fetchAndSetLocations = () => {
    if (!currentStore) {
        setLocations([]);
        setLoading(false);
        return;
    }
    setLoading(true);
    if (isOffline) {
        const storeLocations = contextLocations
          .filter(l => l.storeId === currentStore.id)
          .map(ensureLocationHumanId);
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
 
  const assignmentTargetLabel =
    modalState?.type === 'edit_sublocation'
      ? t('locations.assignments.target.sublocation')
      : t('locations.assignments.target.location');

  const unknownAssignmentLabel = t('locations.assignments.unknownItem');

  const assignmentsForModal = useMemo(() => {
    if (!modalState) {
      return [];
    }

    if (modalState.type === 'edit_location') {
      return stocktakes
        .filter(stocktake => stocktake.locationId === modalState.location.id && !stocktake.subLocationId)
        .map(stocktake => {
          const item = items.find(candidate => candidate.id === stocktake.itemId);
          const itemName = getItemDisplayName(item, language) || unknownAssignmentLabel;
          return { id: stocktake.id, itemName };
        });
    }

    if (modalState.type === 'edit_sublocation') {
      return stocktakes
        .filter(stocktake => stocktake.locationId === modalState.parentId && stocktake.subLocationId === modalState.subLocation.id)
        .map(stocktake => {
          const item = items.find(candidate => candidate.id === stocktake.itemId);
          const itemName = getItemDisplayName(item, language) || unknownAssignmentLabel;
          return { id: stocktake.id, itemName };
        });
    }

    return [];
  }, [items, language, modalState, stocktakes, unknownAssignmentLabel]);

  const toggleAssignmentRemoval = useCallback((stocktakeId: string) => {
    setAssignmentsToRemove(prev => {
      const next = new Set(prev);
      if (next.has(stocktakeId)) {
        next.delete(stocktakeId);
      } else {
        next.add(stocktakeId);
      }
      return next;
    });
  }, []);

  const canModifyAssignments = modalState?.type === 'edit_location' || modalState?.type === 'edit_sublocation';
 
  const handleOpenModal = (state: ModalState) => {
    setModalState(state);
    setErrors({});
    setAssignmentsToRemove(new Set());

    switch (state?.type) {
      case 'add_location': {
        const nextHumanId = computeNextLocationHumanId();
        setFormData({
          name: '',
          description: '',
          humanId: nextHumanId,
          storeId: currentStore?.id,
          imageUrl: null,
        });
        break;
      }
      case 'edit_location': {
        const ensured = ensureLocationHumanId(state.location);
        setFormData({
          name: ensured.name,
          description: ensured.description,
          humanId: ensured.humanId,
          storeId: ensured.storeId,
          imageUrl: ensured.imageUrl ?? null,
        });
        break;
      }
      case 'add_sublocation': {
        const defaultParentId = preparedLocations[0]?.id || '';
        const nextHumanId = defaultParentId ? computeNextSubLocationHumanId(defaultParentId) : '';
        setFormData({
          parentId: defaultParentId,
          humanId: nextHumanId,
          name: '',
          description: '',
          imageUrl: null,
        });
        break;
      }
      case 'edit_sublocation': {
        setFormData({
          parentId: state.parentId,
          humanId: state.subLocation.humanId,
          name: state.subLocation.name,
          description: state.subLocation.description,
          imageUrl: state.subLocation.imageUrl ?? null,
        });
        break;
      }
      default: {
        setFormData({});
      }
    }
  };

  const handleCloseModal = () => {
    setModalState(null);
    setAssignmentsToRemove(new Set());
  };

  const handleImageModalClose = () => {
    setImageModalState(null);
  };

  const handleImageModalCompleted = (updatedLocation: Location) => {
    setLocations(prev =>
      prev.map(loc => (loc.id === updatedLocation.id ? ensureLocationHumanId(updatedLocation) : loc)),
    );

    if (modalState?.type === 'edit_location' && modalState.location.id === updatedLocation.id) {
      setFormData(prev => ({ ...prev, imageUrl: updatedLocation.imageUrl ?? null }));
    }

    if (modalState?.type === 'edit_sublocation' && modalState.parentId === updatedLocation.id) {
      const updatedSub = updatedLocation.sublocations?.find(sub => sub.id === modalState.subLocation.id);
      if (updatedSub) {
        setFormData(prev => ({ ...prev, imageUrl: updatedSub.imageUrl ?? null }));
      }
    }

    setImageModalState(null);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    const trimmedName = formData.name?.trim();
    const requiresLocationName = modalState?.type === 'add_location' || modalState?.type === 'edit_location';

    if (requiresLocationName && !trimmedName) {
        newErrors.name = t('common.required');
    }

    if ((modalState?.type === 'add_location' || modalState?.type === 'edit_location') && !formData.humanId) {
        newErrors.humanId = t('common.required');
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
            case 'add_location': {
                const trimmedName = formData.name?.trim() || '';
                const payload: NewLocation = {
                    name: trimmedName,
                    description: formData.description?.trim() || '',
                    storeId: currentStore.id,
                };
                if (formData.humanId) {
                    payload.humanId = formData.humanId;
                }
                if (isOffline) {
                    await addLocation(payload);
                } else {
                    await api.addLocation(payload);
                    needsRefetch = true;
                }
                break;
            }
            case 'add_sublocation': {
                const parentId = formData.parentId!;
                const payload: NewSubLocation = {
                    name: formData.name?.trim() || '',
                    description: formData.description?.trim() || '',
                };
                if (formData.humanId) {
                    payload.humanId = formData.humanId;
                }
                if (isOffline) {
                    await addSubLocation(parentId, payload);
                } else {
                    await api.addSubLocation(parentId, payload);
                    needsRefetch = true;
                }
                break;
            }
            case 'edit_location': {
                const payload: Partial<NewLocation> = {
                    name: formData.name?.trim(),
                    description: formData.description?.trim() || '',
                };
                if (isOffline) {
                    await updateLocation(modalState.location.id, payload);
                } else {
                    await api.updateLocation(modalState.location.id, payload);
                    needsRefetch = true;
                }
                break;
            }
            case 'edit_sublocation': {
                const subData: SubLocation = {
                    ...modalState.subLocation,
                    name: formData.name?.trim() || '',
                    description: formData.description?.trim() || '',
                };
                if (isOffline) {
                    await updateSubLocation(modalState.parentId, subData);
                } else {
                    await api.updateSubLocation(modalState.parentId, subData);
                    needsRefetch = true;
                }
                break;
            }
        }
        if (needsRefetch) fetchAndSetLocations();
        handleCloseModal();
    } catch (error) {
        console.error("Failed to save location", error);
        if (error instanceof Error && error.message === 'LOCATION_HUMAN_ID_ALREADY_EXISTS') {
            setErrors({ humanId: t('locations.managementId.duplicateError') });
        } else {
            setErrors({ form: t('toast.saveError') });
        }
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
            {preparedLocations.length > 0 && (
                <Button onClick={() => handleOpenModal({type: 'add_sublocation'})} variant="secondary">{t('locations.addSubLocation')}</Button>
            )}
        </div>
      )}
      {loading ? <Spinner /> : (
          preparedLocations.length > 0 ? (
            <div className="border rounded-lg dark:border-gray-700">
                {preparedLocations.map(location => (
                    <LocationRow 
                        key={location.id} 
                        location={location} 
                        canEdit={canEdit}
                        isOffline={isOffline}
                        onEditLocation={(loc) => handleOpenModal({type: 'edit_location', location: loc})}
                        onDeleteLocation={(loc) => handleDelete({id: loc.id, name: loc.name, isSub: false})}
                        onEditSubLocation={(sub, parentId, parentHumanId) => handleOpenModal({type: 'edit_sublocation', subLocation: sub, parentId, parentHumanId})}
                        onDeleteSubLocation={(sub, parentId) => handleDelete({id: sub.id, name: sub.name, isSub: true, parentId})}
                        onManageLocationImage={(loc) => setImageModalState({ kind: 'location', location: loc })}
                        onManageSubLocationImage={(sub, parent) => setImageModalState({ kind: 'sublocation', location: parent, subLocation: sub })}
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
                    onChange={e => {
                      const nextParentId = e.target.value;
                      const nextHumanId = computeNextSubLocationHumanId(nextParentId);
                      setFormData(p => ({ ...p, parentId: nextParentId, humanId: nextHumanId }));
                    }}
                    error={errors.parentId}
                    disabled={modalState.type === 'edit_sublocation'}
                >
                    <option value="" disabled>-- Select --</option>
                    {preparedLocations.map(loc => (
                        <option key={loc.id} value={loc.id}>[{loc.humanId}] {loc.name}</option>
                    ))}
                </Select>
            )}
            {(modalState?.type === 'add_location' || modalState?.type === 'edit_location') && (
              <Input
                label={t('locations.managementId')}
                value={formData.humanId || ''}
                onChange={e => setFormData(p => ({ ...p, humanId: e.target.value.toUpperCase() }))}
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
            {canModifyAssignments && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4 space-y-2">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('locations.assignments.title')}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('locations.assignments.instructions', { target: assignmentTargetLabel })}</p>
                {assignmentsForModal.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('locations.assignments.none')}</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {assignmentsForModal.map(assignment => (
                      <label
                        key={assignment.id}
                        className="flex items-center justify-between rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2"
                      >
                        <span className="text-sm text-gray-800 dark:text-gray-100">{assignment.itemName}</span>
                        <input
                          type="checkbox"
                          className="form-checkbox h-4 w-4 text-primary-600"
                          checked={assignmentsToRemove.has(assignment.id)}
                          onChange={() => toggleAssignmentRemoval(assignment.id)}
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
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
    {imageModalState && (
      <LocationImageModal
        isOpen
        target={imageModalState}
        onClose={handleImageModalClose}
        isOffline={isOffline}
        showToast={showToast}
        onCompleted={handleImageModalCompleted}
        updateLocation={updateLocation}
        updateSubLocation={updateSubLocation}
      />
    )}
    </>
  );
};

export default LocationList;

