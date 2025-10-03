
import React from 'react';
import { classNames } from '../../lib/utils';

interface TableProps {
  headers: string[];
  children: React.ReactNode;
}

export const Table: React.FC<TableProps> = ({ headers, children }) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            {headers.map((header, index) => (
              <th key={index} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {children}
        </tbody>
      </table>
    </div>
  );
};

interface TableRowProps {
    children: React.ReactNode;
    className?: string;
}

// FIX: Add className prop to allow custom styling on table rows.
export const TableRow: React.FC<TableRowProps> = ({ children, className }) => {
  return <tr className={className}>{children}</tr>;
};


interface TableCellProps {
    children: React.ReactNode;
    className?: string;
}

export const TableCell: React.FC<TableCellProps> = ({ children, className }) => {
  return <td className={classNames('px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200', className)}>{children}</td>;
};