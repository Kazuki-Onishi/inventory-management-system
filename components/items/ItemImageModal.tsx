import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UploadTask } from 'firebase/storage';

import { Item } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { createItemImageUploadTask } from '../../services/storage';
import { api } from '../../services/api';

interface ItemImageModalProps {
  isOpen: boolean;
  item: Item;
  onClose: () => void;
  onCompleted: (updatedItem?: Item) => void;
  isOffline: boolean;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

const REAR_CAMERA_CAPTURE = 'environment';

const ItemImageModal: React.FC<ItemImageModalProps> = ({
  isOpen,
  item,
  onClose,
  onCompleted,
  isOffline,
  showToast,
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

  const hasExistingImage = useMemo(() => !!item.imageUrl, [item.imageUrl]);

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
    } else {
      setError(null);
      setSelectedFile(null);
      setPreviewUrl(null);
      setUploadProgress(0);
      setIsUploading(false);
      setUploadTask(null);
      setIsRemoving(false);
    }
  }, [isOpen, item.id]);

  const handleBrowseClick = () => {
    if (isOffline) {
      setError(t('products.imageUpload.offline'));
      return;
    }
    fileInputRef.current?.click();
  };

  const handleCaptureClick = () => {
    if (isOffline) {
      setError(t('products.imageUpload.offline'));
      return;
    }
    cameraInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (isOffline) {
      setError(t('products.imageUpload.offline'));
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
      setError(t('products.imageUpload.selectFile'));
      return;
    }
    if (isOffline) {
      setError(t('products.imageUpload.offline'));
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const { task, result } = await createItemImageUploadTask(item.id, selectedFile, {
        onProgress: (percent) => setUploadProgress(percent),
      });
      setUploadTask(task);
      const { downloadUrl } = await result;
      const updatedItem = { ...item, imageUrl: downloadUrl };
      await api.updateItem(updatedItem);
      resetState();
      showToast(t('products.imageUpload.success'));
      onCompleted(updatedItem);
    } catch (err: any) {
      const isCanceled = err?.code === 'storage/canceled';
      if (isCanceled) {
        setError(t('products.imageUpload.canceled'));
      } else {
        console.error('Failed to upload image', err);
        setError(t('products.imageUpload.error'));
        showToast(t('products.imageUpload.error'), 'error');
      }
    } finally {
      setIsUploading(false);
      setUploadTask(null);
      setUploadProgress(0);
    }
  };

  const handleRemoveImage = async () => {
    if (!item.imageUrl || isOffline) {
      setError(isOffline ? t('products.imageUpload.offline') : t('products.imageUpload.notAttached'));
      return;
    }
    setIsRemoving(true);
    setError(null);
    try {
      await api.deleteItemImage(item.imageUrl);
      const updatedItem = { ...item, imageUrl: null };
      await api.updateItem(updatedItem);
      showToast(t('products.imageUpload.removed'));
      resetState();
      onCompleted(updatedItem);
    } catch (err) {
      console.error('Failed to remove image', err);
      setError(t('products.imageUpload.error'));
      showToast(t('products.imageUpload.error'), 'error');
    } finally {
      setIsRemoving(false);
    }
  };

  const handleModalClose = () => {
    if (isUploading) {
      setError(t('products.imageUpload.uploadInProgress'));
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
      title={t('products.imageUpload.modalTitle', { name: item.name })}
      footer={(
        <>
          <Button variant="secondary" onClick={isUploading ? handleCancelUpload : handleModalClose}>
            {isUploading ? t('products.imageUpload.cancelUpload') : t('common.close')}
          </Button>
          <Button onClick={handleUpload} disabled={!canUpload} className="ml-2">
            {t('products.imageUpload.uploadAction')}
          </Button>
        </>
      )}
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
          capture={REAR_CAMERA_CAPTURE}
          className="hidden"
          onChange={handleFileChange}
          disabled={isOffline}
        />
        <div className="space-y-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('products.imageUpload.current')}</span>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={item.name}
              className="h-32 w-32 rounded-md object-cover border border-gray-200 dark:border-gray-700"
            />
          ) : hasExistingImage ? (
            <img
              src={item.imageUrl!}
              alt={item.name}
              className="h-32 w-32 rounded-md object-cover border border-gray-200 dark:border-gray-700"
            />
          ) : (
            <div className="flex h-32 w-32 items-center justify-center rounded-md border border-dashed border-gray-300 text-xs text-gray-500 dark:border-gray-600 dark:text-gray-400">
              {t('products.imageUpload.placeholder')}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={handleBrowseClick} disabled={isOffline || isUploading}>
            {t('products.imageUpload.selectButton')}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleCaptureClick} disabled={isOffline || isUploading}>
            {t('products.imageUpload.takePhoto')}
          </Button>
          {hasExistingImage && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleRemoveImage}
              disabled={isRemoving || isUploading}
            >
              {isRemoving ? t('products.imageUpload.removing') : t('products.imageUpload.remove')}
            </Button>
          )}
        </div>
        {isUploading && (
          <div>
            <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-2 rounded-full bg-primary-500"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('products.imageUpload.progress', { value: uploadProgress })}
            </p>
          </div>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {isOffline && (
          <p className="text-xs text-yellow-600 dark:text-yellow-400">{t('products.imageUpload.offline')}</p>
        )}
      </div>
    </Modal>
  );
};

export default ItemImageModal;




