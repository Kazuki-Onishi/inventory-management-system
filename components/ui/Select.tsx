
import React from 'react';
import { classNames } from '../../lib/utils';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: React.ReactNode;
  error?: string;
}

const Select: React.FC<SelectProps> = ({ label, id, children, className, error, ...props }) => {
  const selectId = id || (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);
  return (
    <div>
      {label && <label htmlFor={selectId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
      <select
        id={selectId}
        className={classNames(
          'block w-full pl-3 pr-10 py-2 text-base focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white',
          error ? 'border-red-500' : 'border-gray-300',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
};

export default Select;
