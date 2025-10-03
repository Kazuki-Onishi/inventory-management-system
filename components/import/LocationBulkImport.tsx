
import React, { useState, useContext } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import Card from '../ui/Card';
import { ICONS } from '../../constants';
import Button from '../ui/Button';
import { Table, TableRow, TableCell } from '../ui/Table';
import { AppContext } from '../../contexts/AppContext';
import { api } from '../../services/api';
import { Location, NewLocation, NewSubLocation } from '../../types';
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
const ALL_HEADERS = ['humanId', 'name', 'description', 'parentHumanId'];

const LocationBulkImport: React.FC = () => {
  const { t } = useTranslation();
  const { currentStore, locations, addLocation, addSubLocation, updateLocation, updateSubLocation, showToast } = useContext(AppContext);
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
    link.setAttribute("download", "location_template.csv");
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
    if (!file || !currentStore) return;
    
    setIsLoading(true);

    const fileContent = await file.text();
    const { headers, data } = parseCSV(fileContent);

    if (REQUIRED_HEADERS.filter(h => !headers.includes(h)).length > 0) {
        setResults([{ row: 1, status: ImportStatus.Error, message: t('import.errors.missingRequiredHeaders', { headers: REQUIRED_HEADERS.join(', ')}) }]);
        setIsLoading(false);
        return;
    }

    const existingLocations = isOffline ? locations.filter(l => l.storeId === currentStore.id) : await api.fetchLocationsByStore(currentStore.id);
    const locationMap = new Map(existingLocations.map(l => [l.humanId.toLowerCase(), l]));
    const importResults: ImportResult[] = [];
    
    const parentsToProcess = data.filter(row => !row.parentHumanId);
    const subsToProcess = data.filter(row => row.parentHumanId);

    // Process Parents
    for (const rowData of parentsToProcess) {
        const rowNum = data.indexOf(rowData) + 2;
        const { humanId, name, description } = rowData;

        if (!humanId) {
            importResults.push({ row: rowNum, status: ImportStatus.Error, message: t('import.errors.missingHumanIdForParent') });
            continue;
        }
        if (!name) {
            importResults.push({ row: rowNum, status: ImportStatus.Error, message: t('import.errors.missingName') });
            continue;
        }

        const existing = locationMap.get(humanId.toLowerCase());

        try {
            if (existing) {
                const locData: Partial<NewLocation> = { name, description: description || '' };
                await (isOffline ? updateLocation(existing.id, locData) : api.updateLocation(existing.id, locData));
                const updatedLocation = { ...existing, ...locData };
                locationMap.set(humanId.toLowerCase(), updatedLocation);
                importResults.push({ row: rowNum, status: ImportStatus.Updated, message: `Parent: [${humanId}] ${name}` });
            } else {
                const newLoc: NewLocation = { name, humanId, description: description || '', storeId: currentStore.id };
                const created = await (isOffline ? addLocation(newLoc) : api.addLocation(newLoc));
                locationMap.set(humanId.toLowerCase(), created);
                importResults.push({ row: rowNum, status: ImportStatus.Created, message: `Parent: [${humanId}] ${name}` });
            }
        } catch (e) {
            importResults.push({ row: rowNum, status: ImportStatus.Error, message: (e as Error).message });
        }
    }

    // Process Sub-locations
    for (const rowData of subsToProcess) {
        const rowNum = data.indexOf(rowData) + 2;
        const { name, description, parentHumanId } = rowData;
        
        if (!name) {
             importResults.push({ row: rowNum, status: ImportStatus.Error, message: t('import.errors.missingName') });
            continue;
        }

        const parent = locationMap.get(parentHumanId.toLowerCase());
        if (!parent) {
            importResults.push({ row: rowNum, status: ImportStatus.Error, message: t('import.errors.parentNotFound', { humanId: parentHumanId }) });
            continue;
        }

        const existingSub = parent.sublocations?.find(s => s.name.toLowerCase() === name.toLowerCase());

        try {
             if (existingSub) {
                const subData = { ...existingSub, description: description || '' };
                const updatedParent = await (isOffline ? updateSubLocation(parent.id, subData) : api.updateSubLocation(parent.id, subData));
                locationMap.set(parent.humanId.toLowerCase(), updatedParent);
                importResults.push({ row: rowNum, status: ImportStatus.Updated, message: `Sub: ${name} under [${parent.humanId}]` });
            } else {
                const newSub: NewSubLocation = { name, description: description || '', humanId: '' }; // humanId is generated by backend/context
                const updatedParent = await (isOffline ? addSubLocation(parent.id, newSub) : api.addSubLocation(parent.id, newSub));
                locationMap.set(parent.humanId.toLowerCase(), updatedParent);
                importResults.push({ row: rowNum, status: ImportStatus.Created, message: `Sub: ${name} under [${parent.humanId}]` });
            }
        } catch (e) {
            importResults.push({ row: rowNum, status: ImportStatus.Error, message: (e as Error).message });
        }
    }
    
    setResults(importResults);
    setIsLoading(false);
  };

  const handleConfirmImport = async () => {
    setConfirmModalOpen(false);
    await processImport();
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
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('import.locations.title')}</h1>
      
      <Card title={t('import.locations.upload.title')}>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t('import.locations.upload.description')}</p>
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
            <Button onClick={handleImportClick} disabled={!file || isLoading || !currentStore}>
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
            {results.map((result, index) => (
              <TableRow key={`${result.row}-${index}`}>
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

export default LocationBulkImport;