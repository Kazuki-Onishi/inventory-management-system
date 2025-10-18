import imageCompression from 'browser-image-compression';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
  uploadBytesResumable,
  UploadTask,
  UploadTaskSnapshot,
  StorageReference,
} from 'firebase/storage';

import { storage } from './firebase';

const ITEM_IMAGE_MAX_DIMENSION = 512;
const ITEM_IMAGE_MAX_SIZE_MB = 0.8;
const DEFAULT_IMAGE_MIME = 'image/jpeg';

export type StorageUploadResult = {
  downloadUrl: string;
  storagePath: string;
};

export type ImageUploadOptions = {
  onProgress?: (progressPercent: number, snapshot: UploadTaskSnapshot) => void;
  signal?: AbortSignal;
};

type PreparedUpload = {
  storageRef: StorageReference;
  storagePath: string;
  preparedFile: File;
};

const sanitizeExtension = (fileName: string, fallback: string): string => {
  const ext = fileName.split('.').pop();
  if (!ext) return fallback;
  const sanitized = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
  return sanitized || fallback;
};

export const buildItemImagePath = (itemId: string, fileName: string): string => {
  const extension = sanitizeExtension(fileName, 'jpg');
  return `items/${itemId}/${Date.now()}.${extension}`;
};

export const buildLocationImagePath = (locationId: string, fileName: string): string => {
  const extension = sanitizeExtension(fileName, 'jpg');
  return `locations/${locationId}/${Date.now()}.${extension}`;
};

export const buildSubLocationImagePath = (locationId: string, subLocationId: string, fileName: string): string => {
  const extension = sanitizeExtension(fileName, 'jpg');
  return `locations/${locationId}/sublocations/${subLocationId}/${Date.now()}.${extension}`;
};

export const compressImageIfNeeded = async (file: File): Promise<File> => {
  const maxSizeBytes = ITEM_IMAGE_MAX_SIZE_MB * 1024 * 1024;
  if (file.size <= maxSizeBytes) {
    return file;
  }

  try {
    return await imageCompression(file, {
      maxSizeMB: ITEM_IMAGE_MAX_SIZE_MB,
      maxWidthOrHeight: ITEM_IMAGE_MAX_DIMENSION,
      useWebWorker: true,
      initialQuality: 0.82,
      fileType: DEFAULT_IMAGE_MIME,
    });
  } catch (error) {
    console.warn('Image compression failed; falling back to original file', error);
    return file;
  }
};

const prepareItemImageUpload = async (itemId: string, file: File): Promise<PreparedUpload> => {
  const preparedFile = await compressImageIfNeeded(file);
  const storagePath = buildItemImagePath(itemId, preparedFile.name || file.name || 'image.jpg');
  const storageRef = ref(storage, storagePath);
  return { preparedFile, storagePath, storageRef };
};

const prepareLocationImageUpload = async (locationId: string, file: File): Promise<PreparedUpload> => {
  const preparedFile = await compressImageIfNeeded(file);
  const storagePath = buildLocationImagePath(locationId, preparedFile.name || file.name || 'image.jpg');
  const storageRef = ref(storage, storagePath);
  return { preparedFile, storagePath, storageRef };
};

const prepareSubLocationImageUpload = async (
  locationId: string,
  subLocationId: string,
  file: File,
): Promise<PreparedUpload> => {
  const preparedFile = await compressImageIfNeeded(file);
  const storagePath = buildSubLocationImagePath(locationId, subLocationId, preparedFile.name || file.name || 'image.jpg');
  const storageRef = ref(storage, storagePath);
  return { preparedFile, storagePath, storageRef };
};

export const uploadItemImageToStorage = async (itemId: string, file: File): Promise<StorageUploadResult> => {
  const { preparedFile, storagePath, storageRef } = await prepareItemImageUpload(itemId, file);
  await uploadBytes(storageRef, preparedFile, { contentType: preparedFile.type || DEFAULT_IMAGE_MIME });
  const downloadUrl = await getDownloadURL(storageRef);
  return { downloadUrl, storagePath };
};

export const createItemImageUploadTask = async (
  itemId: string,
  file: File,
  options: ImageUploadOptions = {},
): Promise<{ task: UploadTask; result: Promise<StorageUploadResult> }> => {
  const { onProgress, signal } = options;
  const { preparedFile, storagePath, storageRef } = await prepareItemImageUpload(itemId, file);
  const uploadTask = uploadBytesResumable(storageRef, preparedFile, {
    contentType: preparedFile.type || DEFAULT_IMAGE_MIME,
  });

  const result = new Promise<StorageUploadResult>((resolve, reject) => {
    let abortHandler: (() => void) | null = null;

    if (signal) {
      if (signal.aborted) {
        uploadTask.cancel();
      } else {
        abortHandler = () => uploadTask.cancel();
        signal.addEventListener('abort', abortHandler);
      }
    }

    const cleanup = () => {
      if (abortHandler && signal) {
        signal.removeEventListener('abort', abortHandler);
      }
    };

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress(percent, snapshot);
        }
      },
      (error) => {
        cleanup();
        reject(error);
      },
      async () => {
        cleanup();
        const downloadUrl = await getDownloadURL(storageRef);
        resolve({ downloadUrl, storagePath });
      },
    );
  });

  return { task: uploadTask, result };
};

export const uploadLocationImageToStorage = async (locationId: string, file: File): Promise<StorageUploadResult> => {
  const { preparedFile, storagePath, storageRef } = await prepareLocationImageUpload(locationId, file);
  await uploadBytes(storageRef, preparedFile, { contentType: preparedFile.type || DEFAULT_IMAGE_MIME });
  const downloadUrl = await getDownloadURL(storageRef);
  return { downloadUrl, storagePath };
};

export const createLocationImageUploadTask = async (
  locationId: string,
  file: File,
  options: ImageUploadOptions = {},
): Promise<{ task: UploadTask; result: Promise<StorageUploadResult> }> => {
  const { onProgress, signal } = options;
  const { preparedFile, storagePath, storageRef } = await prepareLocationImageUpload(locationId, file);
  const uploadTask = uploadBytesResumable(storageRef, preparedFile, {
    contentType: preparedFile.type || DEFAULT_IMAGE_MIME,
  });

  const result = new Promise<StorageUploadResult>((resolve, reject) => {
    let abortHandler: (() => void) | null = null;

    if (signal) {
      if (signal.aborted) {
        uploadTask.cancel();
      } else {
        abortHandler = () => uploadTask.cancel();
        signal.addEventListener('abort', abortHandler);
      }
    }

    const cleanup = () => {
      if (abortHandler && signal) {
        signal.removeEventListener('abort', abortHandler);
      }
    };

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress(percent, snapshot);
        }
      },
      (error) => {
        cleanup();
        reject(error);
      },
      async () => {
        cleanup();
        const downloadUrl = await getDownloadURL(storageRef);
        resolve({ downloadUrl, storagePath });
      },
    );
  });

  return { task: uploadTask, result };
};

export const uploadSubLocationImageToStorage = async (
  locationId: string,
  subLocationId: string,
  file: File,
): Promise<StorageUploadResult> => {
  const { preparedFile, storagePath, storageRef } = await prepareSubLocationImageUpload(locationId, subLocationId, file);
  await uploadBytes(storageRef, preparedFile, { contentType: preparedFile.type || DEFAULT_IMAGE_MIME });
  const downloadUrl = await getDownloadURL(storageRef);
  return { downloadUrl, storagePath };
};

export const createSubLocationImageUploadTask = async (
  locationId: string,
  subLocationId: string,
  file: File,
  options: ImageUploadOptions = {},
): Promise<{ task: UploadTask; result: Promise<StorageUploadResult> }> => {
  const { onProgress, signal } = options;
  const { preparedFile, storagePath, storageRef } = await prepareSubLocationImageUpload(locationId, subLocationId, file);
  const uploadTask = uploadBytesResumable(storageRef, preparedFile, {
    contentType: preparedFile.type || DEFAULT_IMAGE_MIME,
  });

  const result = new Promise<StorageUploadResult>((resolve, reject) => {
    let abortHandler: (() => void) | null = null;

    if (signal) {
      if (signal.aborted) {
        uploadTask.cancel();
      } else {
        abortHandler = () => uploadTask.cancel();
        signal.addEventListener('abort', abortHandler);
      }
    }

    const cleanup = () => {
      if (abortHandler && signal) {
        signal.removeEventListener('abort', abortHandler);
      }
    };

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress(percent, snapshot);
        }
      },
      (error) => {
        cleanup();
        reject(error);
      },
      async () => {
        cleanup();
        const downloadUrl = await getDownloadURL(storageRef);
        resolve({ downloadUrl, storagePath });
      },
    );
  });

  return { task: uploadTask, result };
};

export const deleteImageByUrl = async (imageUrl: string | null | undefined): Promise<void> => {
  if (!imageUrl) return;

  try {
    const imageRef = ref(storage, imageUrl);
    await deleteObject(imageRef);
  } catch (error) {
    console.warn('Failed to delete image from storage', error);
  }
};
