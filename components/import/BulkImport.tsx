
import React, { useState, useContext } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import Card from '../ui/Card';
import { ICONS } from '../../constants';
import { ensureItemHumanId, generateNextItemHumanId } from '../../lib/items';
import Button from '../ui/Button';
import { Table, TableRow, TableCell } from '../ui/Table';
import { AppContext } from '../../contexts/AppContext';
import { api } from '../../services/api';
import { Item, NewItem } from '../../types';
import { AuthContext } from '../../contexts/AuthContext';
import Spinner from '../ui/Spinner';
import ConfirmationModal from '../ui/ConfirmationModal';

enum ImportStatus {
  Created = 'Created',
  Updated = 'Updated',
  Error = 'Error',
  Warning = 'Warning'
}

interface ImportResult {
  row: number;
  status: ImportStatus;
  message: string;
}

const REQUIRED_HEADERS = ['name'];
const ALL_HEADERS = [
    'sku', 'name', 'shortName', 'description', 'costA', 'costB',
    'isDiscontinued', 'nameEn', 'janCode', 'supplier'
];

const BulkImport: React.FC = () => {
  const { t } = useTranslation();
  const { items, addItem, updateItem, showToast, currentStore } = useContext(AppContext);
  const { isOffline } = useContext(AuthContext);
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirmModalOpen, setConfirmModalOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setResults(null);
    }
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if(e.dataTransfer.files && e.dataTransfer.files[0]) {
          setFile(e.dataTransfer.files[0]);
          setResults(null);
      }
  }

  const handleDownloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8," + ALL_HEADERS.join(',');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "item_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSV = (text: string): { headers: string[], data: { [key: string]: string }[] } => {
      const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
      if (rows.length === 0) return { headers: [], data: [] };
      const headers = rows[0].split(',').map(h => h.trim());
      const data = rows.slice(1).map(row => {
          const values = row.split(',');
          return headers.reduce((obj, header, index) => {
              obj[header] = values[index]?.trim();
              return obj;
          }, {} as { [key: string]: string });
      });
      return { headers, data };
  }
  
  const handleImportClick = () => {
    if (!file) return;
    if (!currentStore) {
        showToast(t('import.errors.noStoreSelected'), 'error');
        return;
    }
    setConfirmModalOpen(true);
  };


  const processImport = async () => {
    if (!file) return;
    setIsLoading(true);

    const fileContent = await file.text();
    const { headers, data } = parseCSV(fileContent);

    // 1. Validate Headers
    const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
        setResults([{
            row: 1, status: ImportStatus.Error,
            message: t('import.errors.missingRequiredHeaders', { headers: missingHeaders.join(', ')})
        }]);
        setIsLoading(false);
        return;
    }

    // 2. Fetch existing items for checking duplicates/updates
    const rawExistingItems = isOffline ? items : await api.fetchItems();
    const existingItemsWithIds = rawExistingItems.map(item => ensureItemHumanId(item));
    const existingSkuMap = new Map(existingItemsWithIds.filter(i => i.sku).map(item => [item.sku!, item]));
    const existingNameMap = new Map(existingItemsWithIds.map(item => [item.name.toLowerCase(), item]));
    const existingHumanIdMap = new Map(existingItemsWithIds.filter(item => item.humanId).map(item => [item.humanId!.toLowerCase(), item]));

    const usedHumanIds = new Map<string, string>();
    existingItemsWithIds.forEach(item => {
      if (item.humanId) {
        usedHumanIds.set(item.humanId.toLowerCase(), item.id);
      }
    });
    const plannedItemsForIds: Array<{ id: string; humanId?: string | null }> = existingItemsWithIds.map(item => ({ id: item.id, humanId: item.humanId }));

    const importResults: ImportResult[] = [];

    // 3. Process each row
    for (let i = 0; i < data.length; i++) {
        const rowData = data[i];
        const rowNum = i + 2; // CSV row number (1-based, plus header)

        const sku = rowData.sku?.trim();
        const name = rowData.name?.trim();
        const humanIdFromRow = rowData.humanId?.trim();
        let existingItem: Item | undefined = undefined;

        if (sku) {
          existingItem = existingSkuMap.get(sku);
        }
        if (!existingItem && humanIdFromRow) {
          existingItem = existingHumanIdMap.get(humanIdFromRow.toLowerCase());
        }
        if (!existingItem && name) {
          existingItem = existingNameMap.get(name.toLowerCase());
        }

        const costA = rowData.costA ? parseFloat(rowData.costA) : existingItem?.costA ?? 0;
        if (rowData.costA && isNaN(costA)) {
            importResults.push({ row: rowNum, status: ImportStatus.Error, message: t('import.errors.invalidCost', { field: 'costA' }) });
            continue;
        }

        const costB = rowData.costB ? parseFloat(rowData.costB) : existingItem?.costB ?? 0;
        if (rowData.costB && isNaN(costB)) {
            importResults.push({ row: rowNum, status: ImportStatus.Error, message: t('import.errors.invalidCost', { field: 'costB' }) });
            continue;
        }

        let isDiscontinued: boolean;
        if (rowData.isDiscontinued) {
            const val = rowData.isDiscontinued.toUpperCase();
            if (val !== 'TRUE' && val !== 'FALSE') {
                 importResults.push({ row: rowNum, status: ImportStatus.Error, message: t('import.errors.invalidBoolean') });
                 continue;
            }
            isDiscontinued = val === 'TRUE';
        } else {
            isDiscontinued = existingItem?.isDiscontinued || false;
        }

        const imageUrlValue = rowData.imageUrl ? rowData.imageUrl.trim() : undefined;

        let humanId = humanIdFromRow && humanIdFromRow.length > 0 ? humanIdFromRow : undefined;
        if (!humanId && existingItem?.humanId) {
          humanId = existingItem.humanId;
        }
        const previousHumanIdLower = existingItem?.humanId ? existingItem.humanId.toLowerCase() : null;
        const plannedId = existingItem?.id ?? `import-${rowNum}`;
        if (!humanId) {
          humanId = generateNextItemHumanId(plannedItemsForIds);
        }
        const normalizedHumanIdLower = humanId.toLowerCase();
        const humanIdOwner = usedHumanIds.get(normalizedHumanIdLower);
        if (humanIdOwner && (!existingItem || humanIdOwner !== existingItem.id)) {
          importResults.push({ row: rowNum, status: ImportStatus.Error, message: t('import.errors.duplicateHumanId', { humanId }) });
          continue;
        }
        usedHumanIds.set(normalizedHumanIdLower, plannedId);
        const plannedIndex = plannedItemsForIds.findIndex(entry => entry.id === plannedId);
        if (plannedIndex >= 0) {
          plannedItemsForIds[plannedIndex] = { id: plannedId, humanId };
        } else {
          plannedItemsForIds.push({ id: plannedId, humanId });
        }

        try {
            if (existingItem) {
                const updatedName = name || existingItem.name;
                const updatedShortName = rowData.shortName || existingItem.shortName;
                const updatedDescription = rowData.description || existingItem.description;
                const updatedNameEn = rowData.nameEn || existingItem.nameEn || '';
                const updatedJanCode = rowData.janCode || existingItem.janCode || '';
                const updatedSupplier = rowData.supplier || existingItem.supplier || '';
                const updatedImageUrl = imageUrlValue !== undefined ? (imageUrlValue.length > 0 ? imageUrlValue : null) : existingItem.imageUrl ?? null;

                const itemToUpdate: Item = {
                    ...existingItem,
                    sku: sku || existingItem.sku || '',
                    name: updatedName,
                    normalizedName: updatedName.toLowerCase(),
                    shortName: updatedShortName,
                    description: updatedDescription,
                    costA,
                    costB,
                    isDiscontinued,
                    nameEn: updatedNameEn,
                    janCode: updatedJanCode,
                    supplier: updatedSupplier,
                    humanId,
                    imageUrl: updatedImageUrl,
                };
                isOffline ? await updateItem(itemToUpdate) : await api.updateItem(itemToUpdate);
                importResults.push({ row: rowNum, status: ImportStatus.Updated, message: sku ? `SKU: ${sku}` : updatedName });

                if (existingItem.sku && existingItem.sku !== itemToUpdate.sku) {
                  existingSkuMap.delete(existingItem.sku);
                }
                if (itemToUpdate.sku) {
                  existingSkuMap.set(itemToUpdate.sku, itemToUpdate);
                }
                if (existingItem.name.toLowerCase() !== itemToUpdate.name.toLowerCase()) {
                  existingNameMap.delete(existingItem.name.toLowerCase());
                }
                existingNameMap.set(itemToUpdate.name.toLowerCase(), itemToUpdate);
                if (previousHumanIdLower && previousHumanIdLower !== normalizedHumanIdLower) {
                  usedHumanIds.delete(previousHumanIdLower);
                  existingHumanIdMap.delete(previousHumanIdLower);
                }
                existingHumanIdMap.set(normalizedHumanIdLower, itemToUpdate);
            } else {
                if (!name) {
                    importResults.push({ row: rowNum, status: ImportStatus.Error, message: t('import.errors.missingName') });
                    continue;
                }
                if (existingNameMap.has(name.toLowerCase())) {
                    importResults.push({ row: rowNum, status: ImportStatus.Error, message: t('import.errors.duplicateName', { name }) });
                    continue;
                }

                const newItem: NewItem = {
                    sku,
                    name,
                    shortName: rowData.shortName || '',
                    description: rowData.description || '',
                    costA,
                    costB,
                    isDiscontinued,
                    nameEn: rowData.nameEn || '',
                    janCode: rowData.janCode || '',
                    supplier: rowData.supplier || '',
                    humanId,
                    imageUrl: imageUrlValue && imageUrlValue.length > 0 ? imageUrlValue : null,
                    categoryId: null,
                };
                const createdItem = isOffline ? await addItem(newItem) : await api.addItem(newItem);
                const createdWithId = ensureItemHumanId(createdItem);

                if (createdWithId.sku) {
                    existingSkuMap.set(createdWithId.sku, createdWithId);
                }
                existingNameMap.set(createdWithId.name.toLowerCase(), createdWithId);
                if (createdWithId.humanId) {
                  existingHumanIdMap.set(createdWithId.humanId.toLowerCase(), createdWithId);
                  usedHumanIds.set(createdWithId.humanId.toLowerCase(), createdWithId.id);
                }
                const createdIndex = plannedItemsForIds.findIndex(entry => entry.id === plannedId);
                if (createdIndex >= 0) {
                  plannedItemsForIds[createdIndex] = { id: createdWithId.id, humanId: createdWithId.humanId };
                }

                let successMessage = `Name: ${name}`;
                if (sku) successMessage += `, SKU: ${sku}`;
                if (createdWithId.humanId) successMessage += `, ID: ${createdWithId.humanId}`;
                importResults.push({ row: rowNum, status: ImportStatus.Created, message: successMessage });
            }
        } catch (error) {
            console.error(`Failed to process row ${rowNum}:`, error);
            importResults.push({ row: rowNum, status: ImportStatus.Error, message: (error as Error).message });
        }
    }

    setResults(importResults);
    setIsLoading(false);
  };

  const summary = results ? results.reduce((acc, result) => {
      if(result.status === ImportStatus.Created) acc.created++;
      if(result.status === ImportStatus.Updated) acc.updated++;
      if(result.status === ImportStatus.Warning) acc.warning++;
      if(result.status === ImportStatus.Error) acc.error++;
      return acc;
  }, {created: 0, updated: 0, warning: 0, error: 0}) : null;

  return (
    <>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('import.title')}</h1>
        
        <Card title={t('import.upload.title')}>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t('import.upload.description')}</p>
          <div className="mb-4">
              <Button variant="secondary" onClick={handleDownloadTemplate}>{t('import.downloadTemplate')}</Button>
          </div>
          <div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              {ICONS.import}
              <div className="flex text-sm text-gray-600 dark:text-gray-400">
                <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500">
                  <span>Upload a file</span>
                  <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".csv" />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                CSV up to 10MB
              </p>
            </div>
          </div>
          {file && <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">Selected file: {file.name}</p>}
          <div className="mt-4 flex justify-end">
              <Button onClick={handleImportClick} disabled={!file || isLoading}>
                  {isLoading ? <Spinner /> : t('import.title')}
              </Button>
          </div>
        </Card>
        
        {results && summary && (
          <Card title={t('import.results')}>
              <div className="mb-4">
                  <h3 className="text-lg font-medium">{t('import.summary')}</h3>
                  <p className="text-green-600">{t('import.status.created')}: {summary.created}</p>
                  <p className="text-blue-600">{t('import.status.updated')}: {summary.updated}</p>
                  <p className="text-yellow-600">{t('import.warning')}: {summary.warning}</p>
                  <p className="text-red-600">{t('import.error')}: {summary.error}</p>
              </div>
            <Table headers={[t('import.row'), t('import.status'), t('import.message')]}>
              {results.map(result => (
                <TableRow key={result.row}>
                  <TableCell>{result.row}</TableCell>
                  <TableCell>
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      result.status === ImportStatus.Created ? 'bg-green-100 text-green-800' :
                      result.status === ImportStatus.Updated ? 'bg-blue-100 text-blue-800' :
                      result.status === ImportStatus.Warning ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {t(`import.status.${result.status.toLowerCase()}` as any)}
                    </span>
                  </TableCell>
                  <TableCell>{result.message}</TableCell>
                </TableRow>
              ))}
            </Table>
          </Card>
        )}
      </div>
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleConfirmImport}
        title={t('import.confirm.title')}
        >
        <p>
            {t('import.confirm.message', {
            fileName: file?.name || '',
            storeName: currentStore?.name || '',
            })}
        </p>
      </ConfirmationModal>
    </>
  );
};

export default BulkImport;
