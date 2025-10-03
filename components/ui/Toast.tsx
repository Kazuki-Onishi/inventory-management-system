
import React, { useEffect, useState } from 'react';
import { classNames } from '../../lib/utils';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Mount animation
    setVisible(true);

    const timer = setTimeout(() => {
      // Unmount animation
      setVisible(false);
      // Wait for animation to finish before calling onClose
      setTimeout(onClose, 300); 
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const typeClasses = {
    success: 'bg-green-500',
    error: 'bg-red-500',
  };

  return (
    <div
      className={classNames(
        'fixed top-5 right-5 z-[100] p-4 rounded-md shadow-lg text-white transition-all duration-300 ease-in-out',
        typeClasses[type],
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-5'
      )}
    >
      {message}
    </div>
  );
};

export default Toast;
