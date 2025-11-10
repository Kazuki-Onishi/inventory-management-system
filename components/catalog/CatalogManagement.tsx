import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { Table, TableCell, TableRow } from '../ui/Table';
import { useTranslation } from '../../hooks/useTranslation';
import { AppContext } from '../../contexts/AppContext';
import { AuthContext } from '../../contexts/AuthContext';
import { CatalogItem, NewCatalogItem } from '../../types';
import { api } from '../../services/api';
import { uploadCatalogImageToStorage } from '../../services/storage';
import { classNames } from '../../lib/utils';

type CatalogFormState = {
  nameJa: string;
  skuOrTag: string;
  nameEn: string;
  nameZhHans: string;
  nameZhHant: string;
  nameKo: string;
  descriptionJa: string;
  descriptionEn: string;
};

type FormErrors = Partial<Record<keyof CatalogFormState | 'mainImage', string>>;

const initialFormState: CatalogFormState = {
  nameJa: '',
  skuOrTag: '',
  nameEn: '',
  nameZhHans: '',
  nameZhHant: '',
  nameKo: '',
  descriptionJa: '',
  descriptionEn: '',
};

const TRANSLATION_FIELDS: Array<{
  key: keyof Pick<CatalogItem, 'nameEn' | 'nameZhHans' | 'nameZhHant' | 'nameKo'>;
  labelKey: string;
}> = [
  { key: 'nameEn', labelKey: 'catalogManager.manage.languages.en' },
  { key: 'nameZhHans', labelKey: 'catalogManager.manage.languages.zhHans' },
  { key: 'nameZhHant', labelKey: 'catalogManager.manage.languages.zhHant' },
  { key: 'nameKo', labelKey: 'catalogManager.manage.languages.ko' },
];

const generateCatalogId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `catalog-${Date.now()}`;
};

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const CatalogManagerSection: React.FC = () => {
  const { t } = useTranslation();
  const {
    catalogItems: contextCatalogItems,
    setCatalogItems,
    addCatalogItem,
    showToast,
  } = useContext(AppContext);
  const { isOffline } = useContext(AuthContext);

  const [catalogItems, setLocalCatalogItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);
  const [formState, setFormState] = useState<CatalogFormState>(initialFormState);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isSaving, setSaving] = useState(false);
  const showToastRef = useRef(showToast);
  const fetchErrorMessageRef = useRef(t('catalogManager.manage.errors.fetchFailed'));

  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  useEffect(() => {
    fetchErrorMessageRef.current = t('catalogManager.manage.errors.fetchFailed');
  }, [t]);

  useEffect(() => {
    let isMounted = true;
    if (isOffline) {
      setLocalCatalogItems(contextCatalogItems);
      setLoading(false);
      return () => {
        isMounted = false;
      };
    }

    setLoading(true);
    api
      .fetchCatalogItems()
      .then((items) => {
        if (!isMounted) return;
        setCatalogItems(items);
        setLocalCatalogItems(items);
      })
      .catch((error) => {
        console.error('Failed to load catalog items', error);
        if (isMounted) {
          showToastRef.current(fetchErrorMessageRef.current, 'error');
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOffline, setCatalogItems]);

  useEffect(() => {
    if (isOffline) {
      setLocalCatalogItems(contextCatalogItems);
    }
  }, [contextCatalogItems, isOffline]);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const resetForm = () => {
    setFormState(initialFormState);
    setFormErrors({});
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview('');
    setImageFile(null);
  };

  const handleOpenModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSaving) return;
    setModalOpen(false);
    resetForm();
  };

  const handleChange = (field: keyof CatalogFormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormState((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setFormErrors((prev) => ({ ...prev, mainImage: undefined }));
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    if (!formState.nameJa.trim()) {
      errors.nameJa = t('catalogManager.manage.errors.nameRequired');
    }
    if (!imageFile && !imagePreview) {
      errors.mainImage = t('catalogManager.manage.errors.imageRequired');
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const cleanOptional = (value: string): string | undefined => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    if (!imageFile && !imagePreview) return;

    setSaving(true);
    try {
      const trimmedJa = formState.nameJa.trim();
      const basePayload: Omit<NewCatalogItem, 'mainImageUrl' | 'thumbnailUrl'> = {
        nameJa: trimmedJa,
        skuOrTag: cleanOptional(formState.skuOrTag),
        nameEn: cleanOptional(formState.nameEn),
        nameZhHans: cleanOptional(formState.nameZhHans),
        nameZhHant: cleanOptional(formState.nameZhHant),
        nameKo: cleanOptional(formState.nameKo),
        descriptionJa: cleanOptional(formState.descriptionJa),
        descriptionEn: cleanOptional(formState.descriptionEn),
      };

      let savedItem: CatalogItem;

      if (isOffline) {
        const dataUrl = imagePreview || (imageFile ? await fileToDataUrl(imageFile) : '');
        const offlinePayload: NewCatalogItem = {
          ...basePayload,
          mainImageUrl: dataUrl,
          thumbnailUrl: dataUrl,
        };
        savedItem = await addCatalogItem(offlinePayload);
        setLocalCatalogItems((prev) => [...prev, savedItem]);
      } else {
        if (!imageFile) {
          throw new Error('IMAGE_REQUIRED');
        }
        const catalogId = generateCatalogId();
        const { downloadUrl } = await uploadCatalogImageToStorage(catalogId, imageFile);
        const newPayload: NewCatalogItem = {
          ...basePayload,
          mainImageUrl: downloadUrl,
          thumbnailUrl: downloadUrl,
        };
        savedItem = await api.addCatalogItem(newPayload, { id: catalogId });
        setCatalogItems((prev) => [...prev, savedItem]);
        setLocalCatalogItems((prev) => [...prev, savedItem]);
      }

      showToast(t('toast.saveSuccess'));
      setModalOpen(false);
      resetForm();
    } catch (error) {
      console.error('Failed to create catalog item', error);
      showToast(t('catalogManager.manage.errors.createFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
            {t('catalogManager.manage.title')}
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {t('catalogManager.manage.description')}
          </p>
          {isOffline && (
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
              {t('catalogManager.manage.offlineNotice')}
            </p>
          )}
        </div>
        <Button onClick={handleOpenModal} className="self-start">
          {t('catalogManager.manage.addButton')}
        </Button>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : catalogItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-300">
            {t('catalogManager.manage.table.empty')}
          </div>
        ) : (
          <Table
            headers={[
              t('catalogManager.manage.table.thumbnail'),
              t('catalogManager.manage.table.name'),
              t('catalogManager.manage.table.skuOrTag'),
              t('catalogManager.manage.table.translations'),
              t('catalogManager.manage.table.updatedAt'),
            ]}
          >
            {catalogItems.map((item) => {
              const previewUrl = item.thumbnailUrl || item.mainImageUrl;
              const translationBadges = TRANSLATION_FIELDS.filter(({ key }) => {
                const value = item[key];
                return typeof value === 'string' && value.trim().length > 0;
              });

              return (
                <TableRow key={item.id}>
                  <TableCell>
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={item.nameJa}
                        className="h-12 w-12 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-md border border-gray-300 text-xs text-gray-400 dark:border-gray-600 dark:text-gray-500">
                        {t('catalogManager.manage.table.noImage')}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-gray-900 dark:text-gray-100">
                    {item.nameJa}
                  </TableCell>
                  <TableCell>{item.skuOrTag || t('catalogManager.manage.table.noSku')}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                        {t('catalogManager.manage.languages.ja')}
                      </span>
                      {translationBadges.map(({ key, labelKey }) => (
                        <span
                          key={key}
                          className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                        >
                          {t(labelKey as never)}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500 dark:text-gray-300">
                    {new Date(item.updatedAt || item.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              );
            })}
          </Table>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={t('catalogManager.manage.modal.title')}
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="secondary" onClick={handleCloseModal} disabled={isSaving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? t('catalogManager.manage.actions.saving') : t('common.save')}
            </Button>
          </div>
        }
        maxWidthClassName="max-w-2xl"
        bodyClassName="space-y-4"
      >
        <Input
          label={t('catalogManager.manage.form.nameJa')}
          value={formState.nameJa}
          onChange={handleChange('nameJa')}
          required
          error={formErrors.nameJa}
        />
        <Input
          label={t('catalogManager.manage.form.skuOrTag')}
          value={formState.skuOrTag}
          onChange={handleChange('skuOrTag')}
        />
        <Input
          label={t('catalogManager.manage.form.nameEn')}
          value={formState.nameEn}
          onChange={handleChange('nameEn')}
        />
        <Input
          label={t('catalogManager.manage.form.nameZhHans')}
          value={formState.nameZhHans}
          onChange={handleChange('nameZhHans')}
        />
        <Input
          label={t('catalogManager.manage.form.nameZhHant')}
          value={formState.nameZhHant}
          onChange={handleChange('nameZhHant')}
        />
        <Input
          label={t('catalogManager.manage.form.nameKo')}
          value={formState.nameKo}
          onChange={handleChange('nameKo')}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('catalogManager.manage.form.descriptionJa')}
          </label>
          <textarea
            value={formState.descriptionJa}
            onChange={(event) => setFormState((prev) => ({ ...prev, descriptionJa: event.target.value }))}
            rows={3}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t('catalogManager.manage.form.descriptionHelper')}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('catalogManager.manage.form.descriptionEn')}
          </label>
          <textarea
            value={formState.descriptionEn}
            onChange={(event) => setFormState((prev) => ({ ...prev, descriptionEn: event.target.value }))}
            rows={3}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('catalogManager.manage.form.imageLabel')}
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="mt-1 block w-full text-sm text-gray-900 file:mr-4 file:rounded-md file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-primary-700 file:font-semibold hover:file:bg-primary-100 dark:text-gray-100 dark:file:bg-primary-900/20 dark:file:text-primary-200"
          />
          {formErrors.mainImage && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.mainImage}</p>
          )}
          {imagePreview && (
            <img
              src={imagePreview}
              alt={formState.nameJa || 'preview'}
              className="mt-3 h-32 w-32 rounded-md object-cover"
            />
          )}
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {t('catalogManager.manage.form.imageHelper')}
          </p>
        </div>
      </Modal>
    </Card>
  );
};

const CatalogPlanSection: React.FC = () => {
  const { t } = useTranslation();

  const fieldConfig = useMemo(
    () => [
      {
        key: 'nameJa',
        requirementKey: 'catalogManager.field.type.required',
        label: t('catalogManager.fields.nameJa.label'),
        notes: t('catalogManager.fields.nameJa.notes'),
      },
      {
        key: 'mainImage',
        requirementKey: 'catalogManager.field.type.required',
        label: t('catalogManager.fields.mainImage.label'),
        notes: t('catalogManager.fields.mainImage.notes'),
      },
      {
        key: 'skuOrTag',
        requirementKey: 'catalogManager.field.type.optional',
        label: t('catalogManager.fields.skuOrTag.label'),
        notes: t('catalogManager.fields.skuOrTag.notes'),
      },
      {
        key: 'nameEn',
        requirementKey: 'catalogManager.field.type.optional',
        label: t('catalogManager.fields.nameEn.label'),
        notes: t('catalogManager.fields.nameEn.notes'),
      },
      {
        key: 'nameZh',
        requirementKey: 'catalogManager.field.type.optional',
        label: t('catalogManager.fields.nameZh.label'),
        notes: t('catalogManager.fields.nameZh.notes'),
      },
    ],
    [t],
  );

  const phase1Acceptance = useMemo(
    () => [
      'catalogManager.phase1.acceptance.registerFlow',
      'catalogManager.phase1.acceptance.lazyImages',
      'catalogManager.phase1.acceptance.searchNormalization',
    ],
    [],
  );

  const phase2Fields = useMemo(
    () => [
      'catalogManager.phase2.fields.price',
      'catalogManager.phase2.fields.taxNote',
      'catalogManager.phase2.fields.taxRate',
      'catalogManager.phase2.fields.currency',
      'catalogManager.phase2.fields.startDate',
      'catalogManager.phase2.historyNote',
    ],
    [],
  );

  const phase2Acceptance = useMemo(
    () => [
      'catalogManager.phase2.acceptance.storeSwitch',
      'catalogManager.phase2.acceptance.history',
    ],
    [],
  );

  const phase3Markdown = useMemo(
    () => [
      'catalogManager.phase3.md.customer',
      'catalogManager.phase3.md.staff',
      'catalogManager.phase3.md.language',
    ],
    [],
  );

  const phase3Storage = useMemo(
    () => [
      'catalogManager.phase3.storage.images',
      'catalogManager.phase3.storage.lazy',
    ],
    [],
  );

  const phase3WhyMarkdown = useMemo(
    () => [
      'catalogManager.phase3.mdWhy.lightweight',
      'catalogManager.phase3.mdWhy.imageSeparation',
      'catalogManager.phase3.mdWhy.editFriendly',
      'catalogManager.phase3.mdWhy.multilingual',
      'catalogManager.phase3.mdWhy.aiReady',
    ],
    [],
  );

  const phase3Acceptance = useMemo(
    () => [
      'catalogManager.phase3.acceptance.performance',
      'catalogManager.phase3.acceptance.simple',
    ],
    [],
  );

  const integrationPoints = useMemo(
    () => [
      'catalogManager.integration.inventory',
      'catalogManager.integration.search',
      'catalogManager.integration.i18n',
      'catalogManager.integration.offline',
      'catalogManager.integration.storageRules',
    ],
    [],
  );

  const nextSteps = useMemo(
    () => [
      'catalogManager.nextSteps.catalogForm',
      'catalogManager.nextSteps.priceForm',
      'catalogManager.nextSteps.descriptionTarget',
      'catalogManager.nextSteps.storageNaming',
      'catalogManager.nextSteps.acceptanceReview',
    ],
    [],
  );

  const renderBulletList = (keys: string[]) => (
    <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
      {keys.map((key) => (
        <li key={key} className="flex items-start">
          <span className="mt-1 mr-2 h-2 w-2 flex-shrink-0 rounded-full bg-primary-500" />
          <span>{t(key as never)}</span>
        </li>
      ))}
    </ul>
  );

  const renderTag = (requirementKey: string) => {
    const isRequired = requirementKey === 'catalogManager.field.type.required';
    return (
      <span
        className={classNames(
          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
          isRequired
            ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
            : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
        )}
      >
        {t(requirementKey as never)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <Card title={t('catalogManager.phase1.title')}>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {t('catalogManager.phase1.goal')}
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t('catalogManager.phase1.fieldsTableTitle')}
            </h4>
            <Table
              headers={[
                t('catalogManager.field.column.field'),
                t('catalogManager.field.column.requirement'),
                t('catalogManager.field.column.notes'),
              ]}
            >
              {fieldConfig.map((field) => (
                <TableRow key={field.key}>
                  <TableCell className="font-medium">{field.label}</TableCell>
                  <TableCell className="align-top">{renderTag(field.requirementKey)}</TableCell>
                  <TableCell className="align-top text-gray-600 dark:text-gray-300">
                    {field.notes}
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t('catalogManager.phase1.acceptanceTitle')}
            </h4>
            {renderBulletList(phase1Acceptance)}
          </div>
        </div>
      </Card>

      <Card title={t('catalogManager.phase2.title')}>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {t('catalogManager.phase2.goal')}
        </p>
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {t('catalogManager.phase2.fieldsTitle')}
          </h4>
          {renderBulletList(phase2Fields)}
        </div>
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {t('catalogManager.phase2.acceptanceTitle')}
          </h4>
          {renderBulletList(phase2Acceptance)}
        </div>
      </Card>

      <Card title={t('catalogManager.phase3.title')}>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {t('catalogManager.phase3.goal')}
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t('catalogManager.phase3.mdTitle')}
            </h4>
            {renderBulletList(phase3Markdown)}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t('catalogManager.phase3.storageTitle')}
            </h4>
            {renderBulletList(phase3Storage)}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t('catalogManager.phase3.mdWhyTitle')}
            </h4>
            {renderBulletList(phase3WhyMarkdown)}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t('catalogManager.phase3.acceptanceTitle')}
            </h4>
            {renderBulletList(phase3Acceptance)}
          </div>
        </div>
      </Card>

      <Card title={t('catalogManager.integration.title')}>
        {renderBulletList(integrationPoints)}
      </Card>

      <Card title={t('catalogManager.nextSteps.title')}>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {t('catalogManager.nextSteps.caption')}
        </p>
        {renderBulletList(nextSteps)}
      </Card>
    </div>
  );
};

const CatalogManagement: React.FC = () => {
  return (
    <div className="space-y-6">
      <CatalogManagerSection />
      <CatalogPlanSection />
    </div>
  );
};

export default CatalogManagement;
