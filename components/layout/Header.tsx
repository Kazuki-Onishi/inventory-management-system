
import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { AuthContext } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import Select from '../ui/Select';
import { ICONS } from '../../constants';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { api } from '../../services/api';
import { NewStore } from '../../types';

const Header: React.FC = () => {
  const { t } = useTranslation();
  // FIX: Destructure toggleSidebar from context.
  const { currentStore, setCurrentStore, accessibleStores, setAccessibleStores, addStore: addStoreOffline, toggleSidebar, showToast } = useContext(AppContext);
  const { user, isOffline, redeemInvite } = useContext(AuthContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [error, setError] = useState('');
  const [isInviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [redeemingInvite, setRedeemingInvite] = useState(false);

  const handleStoreChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === 'add-new-store') {
        setIsModalOpen(true);
        // Don't change the current store selection
    } else {
        const store = accessibleStores.find(s => s.id === e.target.value);
        setCurrentStore(store || null);
    }
  };

  const handleCreateStore = async () => {
    if (!newStoreName.trim()) {
      setError(t('common.required'));
      return;
    }
    setError('');

    const newStoreData: NewStore = { name: newStoreName.trim() };
    
    try {
        let createdStore;
        if (isOffline) {
            createdStore = await addStoreOffline(newStoreData);
        } else {
            createdStore = await api.addStore(newStoreData);
            setAccessibleStores(prev => [...prev, createdStore]);
        }
        setCurrentStore(createdStore);
        setNewStoreName('');
        setIsModalOpen(false);
    } catch (e) {
        console.error("Failed to create store", e);
        setError("Failed to create store. Please try again.");
    }
  };
  
  const handleRedeemInvite = async () => {
    if (!inviteCode.trim()) {
      setInviteError(t('common.required'));
      return;
    }
    setInviteError(null);
    setRedeemingInvite(true);
    try {
      await redeemInvite(inviteCode.trim());
      showToast(t('header.invite.success'));
      setInviteModalOpen(false);
      setInviteCode('');
    } catch (error) {
      console.error('Failed to redeem invite', error);
      const message = error instanceof Error ? error.message : t('header.invite.error');
      setInviteError(message);
      showToast(t('header.invite.error'), 'error');
    } finally {
      setRedeemingInvite(false);
    }
  };
  
  return (
    <>
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button onClick={toggleSidebar} className="text-gray-500 dark:text-gray-400 focus:outline-none lg:hidden mr-4">
                {ICONS.menu}
              </button>
              <div className="flex items-center gap-2">
                {accessibleStores.length > 0 && (
                  <div className="w-64">
                    <Select
                      value={currentStore?.id || ''}
                      onChange={handleStoreChange}
                      aria-label={t('header.selectStore')}
                    >
                      <option value="" disabled>{t('header.selectStore')}</option>
                      {accessibleStores.map(store => (
                        <option key={store.id} value={store.id}>{store.name}</option>
                      ))}
                      {user?.isAdmin && (
                        <option value="add-new-store" className="font-bold text-primary-600">
                            + {t('header.createStore')}
                        </option>
                      )}
                    </Select>
                  </div>
                )}
                {user?.isAdmin && (
                    <Button variant="secondary" onClick={() => setIsModalOpen(true)}>
                        + {t('header.createStore')}
                    </Button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isOffline && (
                <Button variant="secondary" onClick={() => { setInviteModalOpen(true); setInviteError(null); }}>
                  {t('header.invite.button')}
                </Button>
              )}
              <span className="text-gray-700 dark:text-gray-300">{user?.name}</span>
            </div>
          </div>
        </div>
      </header>
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('header.createStore.title')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleCreateStore} className="ml-2">{t('common.save')}</Button>
          </>
        }
      >
        <Input 
          label={t('common.name')}
          value={newStoreName}
          onChange={e => setNewStoreName(e.target.value)}
          placeholder={t('header.storeName.placeholder')}
          required
        />
        {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      </Modal>
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => { setInviteModalOpen(false); setInviteError(null); }}
        title={t('header.invite.title')}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setInviteModalOpen(false); setInviteError(null); }}>{t('common.cancel')}</Button>
            <Button onClick={handleRedeemInvite} className="ml-2" disabled={redeemingInvite}>
              {redeemingInvite ? t('header.invite.submitting') : t('header.invite.submit')}
            </Button>
          </>
        }
      >
        <Input
          label={t('header.invite.label')}
          value={inviteCode}
          onChange={e => setInviteCode(e.target.value)}
          placeholder={t('header.invite.placeholder')}
          required
        />
        {inviteError && <p className="text-red-500 text-sm mt-2">{inviteError}</p>}
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">{t('header.invite.helper')}</p>
      </Modal>
    </>
  );
};

export default Header;
