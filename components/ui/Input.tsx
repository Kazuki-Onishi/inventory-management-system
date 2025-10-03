
import React from 'react';
import { classNames } from '../../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  // FIX: Allow React nodes for labels to support complex labels with icons or tooltips.
  label?: React.ReactNode;
  icon?: React.ReactNode;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ label, id, icon, className, error, ...props }, ref) => {
  // FIX: Only generate inputId from label if it's a string, otherwise it will be undefined if no id is passed.
  const inputId = id || (label && typeof label === 'string' ? label.replace(/\s+/g, '-').toLowerCase() : undefined);
  return (
    <div>
      {label && <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">{icon}</div>}
        <input
          id={inputId}
          ref={ref}
          className={classNames(
            'block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white',
            error ? 'border-red-500' : 'border-gray-300',
            icon ? 'pl-10' : '',
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;