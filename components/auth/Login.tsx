import React, { useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import Button from '../ui/Button';
import { ICONS } from '../../constants';

const Login: React.FC = () => {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [copied, setCopied] = useState(false);
  const isInAppBrowser = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /Line\/|FBAN|FBAV|Instagram|Messenger/.test(ua);
  }, []);

  const handleLogin = async (isOffline: boolean, role?: 'Admin' | 'Editor') => {
    setError(null); // Reset error on new login attempt
    setCopied(false);
    try {
      await login(isOffline, role);
      navigate('/');
    } catch (err: any) {
      console.error("Login failed", err);
        if (err.code === 'auth/unauthorized-domain') {
          const domain = window.location.hostname;
          if (domain) {
            const handleCopy = () => {
              navigator.clipboard.writeText(domain).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            };

            const errorMessage = (
              <div>
                <p className="font-bold mb-2">{t('login.error.unauthorized.title')}</p>
                <p className="mb-2">{t('login.error.unauthorized.description')}</p>
                <ol className="list-decimal list-inside space-y-1 mb-3">
                  <li dangerouslySetInnerHTML={{ __html: t('login.error.unauthorized.step1') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('login.error.unauthorized.step2') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('login.error.unauthorized.step3') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('login.error.unauthorized.step4') }} />
                </ol>
                <div className="flex items-center justify-between p-2 rounded-md bg-red-200 dark:bg-red-800/50">
                  <code className="font-mono text-lg font-bold text-red-900 dark:text-red-100">{domain}</code>
                  <button
                    onClick={handleCopy}
                    className="flex items-center px-3 py-1 text-sm rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-100 dark:focus:ring-offset-red-900/20 focus:ring-primary-500 transition-all"
                  >
                    {ICONS.copy}
                    <span className="ml-2 text-left whitespace-nowrap">
                      {copied ? t('login.error.unauthorized.copied') : t('login.error.unauthorized.copy')}
                    </span>
                  </button>
                </div>

                <p className="text-xs italic mt-3">{t('login.error.unauthorized.note')}</p>
              </div>
            );
            setError(errorMessage);
          } else {
            setError(t('login.error.unauthorized.detectFailed'));
          }
        } else {
          setError(t('login.error.generic'));
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          {t('login.title')}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10 space-y-6">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 dark:bg-red-900/20 dark:border-red-500/50 dark:text-red-300 px-4 py-3 rounded-md relative text-sm" role="alert">
              {error}
            </div>
          )}
          {isInAppBrowser && (
            <div className="rounded-md border border-yellow-400 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 space-y-3">
              <div className="font-semibold">{t('login.inAppBrowser.title')}</div>
              <p>{t('login.inAppBrowser.body')}</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>{t('login.inAppBrowser.step1')}</li>
                <li>{t('login.inAppBrowser.step2')}</li>
                <li>{t('login.inAppBrowser.step3')}</li>
              </ol>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => window.open(window.location.href, '_blank')}
              >
                {t('login.inAppBrowser.openExternal')}
              </Button>
            </div>
          )}
          <Button onClick={() => handleLogin(false)} className="w-full flex justify-center">
            {t('login.button')}
          </Button>
          <div className="relative">
              <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                    {t('login.orContinue')}
                  </span>
              </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button onClick={() => handleLogin(true, 'Admin')} variant="secondary" className="w-full flex justify-center">
                {t('login.offlineAdmin')}
            </Button>
            <Button onClick={() => handleLogin(true, 'Editor')} variant="secondary" className="w-full flex justify-center">
                {t('login.offlineEditor')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
