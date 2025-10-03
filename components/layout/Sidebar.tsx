
import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../hooks/useTranslation';
import { ICONS } from '../../constants';
import { classNames } from '../../lib/utils';
import Select from '../ui/Select';

const Sidebar: React.FC = () => {
  const { user, logout } = useContext(AuthContext);
  const { isSidebarOpen, toggleSidebar } = useContext(AppContext);
  const { t, language, setLanguage } = useTranslation();

  const navItems = [
    { to: '/', label: t('nav.dashboard'), icon: ICONS.dashboard, admin: false },
    { to: '/items', label: t('nav.items'), icon: ICONS.items, admin: false },
    { to: '/locations', label: t('nav.locations'), icon: ICONS.locations, admin: false },
    { to: '/inventory', label: t('nav.inventory'), icon: ICONS.inventory, admin: false },
    { to: '/categories', label: t('nav.categories'), icon: ICONS.categories, admin: true },
    { to: '/import/items', label: t('nav.importItems'), icon: ICONS.import, admin: true },
    { to: '/import/locations', label: t('nav.importLocations'), icon: ICONS.locations, admin: true },
    { to: '/settings', label: t('nav.settings'), icon: ICONS.settings, admin: true },
  ];
  
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as 'en' | 'ja');
  };

  const NavItem: React.FC<{ to: string, icon: React.ReactNode, label: string }> = ({ to, icon, label }) => (
    <NavLink
      to={to}
      end
      className={({ isActive }) => classNames(
        'flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200',
        isActive ? 'bg-primary-500 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
      )}
    >
      {icon}
      <span className="ml-4">{label}</span>
    </NavLink>
  );

  return (
    <>
      <div className={classNames(
        'fixed inset-0 z-40 bg-black bg-opacity-25 lg:hidden',
        isSidebarOpen ? 'block' : 'hidden'
      )} onClick={toggleSidebar}></div>
      <aside className={classNames(
        'fixed top-0 left-0 z-50 w-64 h-full bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0',
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between h-16 px-4 border-b dark:border-gray-700">
            <h1 className="text-xl font-bold text-primary-600 dark:text-primary-400">{t('appName')}</h1>
            <button onClick={toggleSidebar} className="text-gray-500 dark:text-gray-400 focus:outline-none lg:hidden">
              {ICONS.close}
            </button>
          </div>
          <nav className="flex-1 px-4 py-4 space-y-2">
            {navItems.map(item => (
              (!item.admin || user?.isAdmin) && <NavItem key={item.to} {...item} />
            ))}
          </nav>
          <div className="px-4 py-4 border-t dark:border-gray-700 space-y-4">
              <div className="flex items-center text-gray-600 dark:text-gray-300">
                {ICONS.language}
                <Select value={language} onChange={handleLanguageChange} className="ml-2 bg-transparent border-0 focus:ring-0">
                    <option value="en">English</option>
                    <option value="ja">日本語</option>
                </Select>
              </div>
              <button onClick={logout} className="w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">
                {ICONS.logout}
                <span className="ml-4">{t('nav.logout')}</span>
              </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;