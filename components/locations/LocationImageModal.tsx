import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UploadTask } from 'firebase/storage';

import { Location, NewLocation, SubLocation } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { api } from '../../services/api';
import {
  createLocationImageUploadTask,
  createSubLocationImageUploadTask,
} from '../../services/storage';

type ImageModalTarget =
  | { kind: 'location'; location: Location }
  | { kind: 'sublocation'; location: Location; subLocation: SubLocation };

interface LocationImageModalProps {
  isOpen: boolean;
  target: ImageModalTarget;
  onClose: () => void;
  onCompleted: (updatedLocation: Location) => void;
  isOffline: boolean;
  showToast: (message: string, type?: 'success' | 'error') => void;
  updateLocation: (locationId: string, data: Partial<NewLocation>) => Promise<void>;
  updateSubLocation: (parentId: string, subLocation: SubLocation) => Promise<Location>;
}

const LocationImageModal: React.FC<LocationImageModalProps> = ({
  isOpen,
  target,
  onClose,
  onCompleted,
  isOffline,
  showToast,
  updateLocation,
  updateSubLocation,
}) => {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadTask, setUploadTask] = useState<UploadTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const isLocationTarget = target.kind === 'location';
  const baseLocation = target.location;
  const currentImageUrl = isLocationTarget ? baseLocation.imageUrl : target.subLocation.imageUrl;
  const hasExistingImage = useMemo(() => !!currentImageUrl, [currentImageUrl]);
  const entityLabel = isLocationTarget
    ? baseLocation.name
    : `${baseLocation.name} / ${target.subLocation.name}`;

  const resetState = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsUploading(false);
    setUploadProgress(0);
    setUploadTask(null);
    setError(null);
    setIsRemoving(false);
  };

  useEffect(() => () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  }, [previewUrl]);

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen]);

  const handleBrowseClick = () => {
    if (isOffline) {
      setError(t('locations.imageUpload.offline'));
      return;
    }
    fileInputRef.current?.click();
  };

  const handleCaptureClick = () => {
    if (isOffline) {
      setError(t('locations.imageUpload.offline'));
      return;
    }
    cameraInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (isOffline) {
      setError(t('locations.imageUpload.offline'));
      return;
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
  };

  const handleCancelUpload = () => {
    uploadTask?.cancel();
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError(t('locations.imageUpload.selectFile'));
      return;
    }
    if (isOffline) {
      setError(t('locations.imageUpload.offline'));
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      if (isLocationTarget) {
        const { task, result } = await createLocationImageUploadTask(baseLocation.id, selectedFile, {
          onProgress: (percent) => setUploadProgress(percent),
        });
        setUploadTask(task);
        const { downloadUrl } = await result;
        await api.updateLocation(baseLocation.id, { imageUrl: downloadUrl });
        await updateLocation(baseLocation.id, { imageUrl: downloadUrl });
        const updatedLocation = { ...baseLocation, imageUrl: downloadUrl };
        resetState();
        showToast(t('locations.imageUpload.success'));
        onCompleted(updatedLocation);
      } else {
        const { task, result } = await createSubLocationImageUploadTask(
          baseLocation.id,
          target.subLocation.id,
          selectedFile,
          {
            onProgress: (percent) => setUploadProgress(percent),
          },
        );
        setUploadTask(task);
        const { downloadUrl } = await result;
        const updatedSub: SubLocation = { ...target.subLocation, imageUrl: downloadUrl };
        const updatedLocation = await api.updateSubLocation(baseLocation.id, updatedSub);
        await updateSubLocation(baseLocation.id, updatedSub);
        resetState();
        showToast(t('locations.imageUpload.success'));
        onCompleted(updatedLocation);
      }
    } catch (err: any) {
      const isCanceled = err?.code === 'storage/canceled';
      if (isCanceled) {
        setError(t('locations.imageUpload.canceled'));
      } else {
        console.error('Failed to upload location image', err);
        setError(t('locations.imageUpload.error'));
        showToast(t('locations.imageUpload.error'), 'error');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!hasExistingImage || !currentImageUrl) {
      return;
    }
    if (isOffline) {
      setError(t('locations.imageUpload.offline'));
      return;
    }
    setIsRemoving(true);
    setError(null);

    try {
      if (isLocationTarget) {
        await api.deleteLocationImage(currentImageUrl);
        await api.updateLocation(baseLocation.id, { imageUrl: null });
        await updateLocation(baseLocation.id, { imageUrl: null });
        const updatedLocation = { ...baseLocation, imageUrl: null };
        resetState();
        showToast(t('locations.imageUpload.removed'));
        onCompleted(updatedLocation);
      } else {
        await api.deleteSubLocationImage(currentImageUrl);
        const updatedSub: SubLocation = { ...target.subLocation, imageUrl: null };
        const updatedLocation = await api.updateSubLocation(baseLocation.id, updatedSub);
        await updateSubLocation(baseLocation.id, updatedSub);
        resetState();
        showToast(t('locations.imageUpload.removed'));
        onCompleted(updatedLocation);
      }
    } catch (err) {
      console.error('Failed to remove location image', err);
      setError(t('locations.imageUpload.error'));
      showToast(t('locations.imageUpload.error'), 'error');
    } finally {
      setIsRemoving(false);
    }
  };

  const handleModalClose = () => {
    if (isUploading) {
      setError(t('locations.imageUpload.uploadInProgress'));
      return;
    }
    resetState();
    onClose();
  };

  const canUpload = !!selectedFile && !isOffline && !isUploading;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      title={t('locations.imageUpload.modalTitle', { name: entityLabel })}
      footer={
        <>
          <Button variant="secondary" onClick={isUploading ? handleCancelUpload : handleModalClose}>
            {isUploading ? t('locations.imageUpload.cancelUpload') : t('common.close')}
          </Button>
          <Button onClick={handleUpload} disabled={!canUpload} className="ml-2">
            {t('locations.imageUpload.uploadAction')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          disabled={isOffline}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
          disabled={isOffline}
        />
        <div className="space-y-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t('locations.imageUpload.current')}
          </span>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={entityLabel}
              className="h-32 w-32 rounded-md object-cover border border-gray-200 dark:border-gray-700"
            />
          ) : hasExistingImage ? (
            <img
              src={currentImageUrl!}
              alt={entityLabel}
              className="h-32 w-32 rounded-md object-cover border border-gray-200 dark:border-gray-700"
            />
          ) : (
            <div className="flex h-32 w-32 items-center justify-center rounded-md border border-dashed border-gray-300 text-xs text-gray-500 dark:border-gray-600 dark:text-gray-400">
              {t('locations.imageUpload.placeholder')}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={handleBrowseClick} disabled={isOffline || isUploading}>
            {t('locations.imageUpload.selectButton')}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleCaptureClick} disabled={isOffline || isUploading}>
            {t('locations.imageUpload.takePhoto')}
          </Button>
          {hasExistingImage && (
            <Button variant="danger" size="sm" onClick={handleRemoveImage} disabled={isRemoving || isUploading}>
              {isRemoving ? t('locations.imageUpload.removing') : t('locations.imageUpload.remove')}
            </Button>
          )}
        </div>
        {isUploading && (
          <div>
            <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
              <div className="h-2 rounded-full bg-primary-500" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('locations.imageUpload.progress', { value: uploadProgress })}
            </p>
          </div>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {isOffline && (
          <p className="text-xs text-yellow-600 dark:text-yellow-400">{t('locations.imageUpload.offline')}</p>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('locations.imageUpload.helper')}</p>
      </div>
    </Modal>
  );
};

export default LocationImageModal;
