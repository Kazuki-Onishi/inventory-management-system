import React from 'react';
import Modal from './Modal';
import Button from './Button';
import { useTranslation } from '../../hooks/useTranslation';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, children }) => {
  const { t } = useTranslation();
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="danger" onClick={onConfirm} className="ml-2">{t('common.confirm')}</Button>
        </>
      }
    >
      {children}
    </Modal>
  );
};

export default ConfirmationModal;