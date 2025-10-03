

import React, { useContext } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { AppContext } from '../../contexts/AppContext';
import { AuthContext } from '../../contexts/AuthContext';
import { classNames } from '../../lib/utils';
import Toast from '../ui/Toast';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isSidebarOpen, toast, hideToast } = useContext(AppContext);
  const { connectionError } = useContext(AuthContext);

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
      <Sidebar />
      <div className={classNames(
        "flex-1 flex flex-col transition-all duration-300 ease-in-out",
        isSidebarOpen ? "lg:ml-64" : "lg:ml-0"
      )}>
        {connectionError && (
          <div className="bg-yellow-500 text-center p-2 text-sm text-white font-semibold shadow-md z-50">
            {connectionError}
          </div>
        )}
        <Header />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;