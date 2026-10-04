import React from 'react';
import styles from './MyDraftsSkeleton.module.css';

export const MyDraftsSkeleton: React.FC = () => (
  <div role="status" aria-label="Loading drafts">
    <span className="sr-only">Loading drafts</span>
    <div aria-hidden="true" className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className={`${styles.card} flex min-w-0 flex-col border-2 border-black bg-white p-5 sm:p-6`}>
          <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="h-6 w-4/5 bg-gray-200" />
              <div className="mt-2 h-5 w-2/3 bg-gray-100" />
            </div>
            <div className="h-11 w-11 shrink-0 bg-gray-100" />
          </div>
          <div className="mb-6 grow space-y-2">
            <div className="h-4 w-28 max-w-full bg-gray-100" />
            <div className="mt-4 flex items-end justify-between gap-3 border-t border-gray-100 pt-4">
              <div className="h-5 w-20 bg-gray-100" />
              <div className="h-7 w-24 bg-gray-200" />
            </div>
          </div>
          <div className="h-[3.25rem] w-full bg-gray-200" />
        </div>
      ))}
    </div>
  </div>
);
