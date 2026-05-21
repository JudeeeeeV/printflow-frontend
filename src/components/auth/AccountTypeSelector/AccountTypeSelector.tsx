// src/components/auth/AccountTypeSelector/AccountTypeSelector.tsx
import React from 'react';

export type AccountRole = 'Student' | 'Print Shop';

interface AccountTypeSelectorProps {
  selectedType: AccountRole;
  onChange: (type: AccountRole) => void;
}

export const AccountTypeSelector: React.FC<AccountTypeSelectorProps> = ({
  selectedType,
  onChange,
}) => {
  return (
    <div className="mb-6">
      <p className="text-sm font-semibold text-black mb-3">Account Type</p>
      <div className="flex flex-col gap-3">
        <label
          className={`flex items-center cursor-pointer p-4 transition-all duration-200 ring-inset ${
            selectedType === 'Student' ? 'ring-2 ring-black bg-black text-white' : 'ring-1 ring-gray-300 bg-white text-black hover:ring-2 hover:ring-black'
          }`}
        >
          <input
            type="radio"
            name="accountType"
            value="Student"
            checked={selectedType === 'Student'}
            onChange={() => onChange('Student')}
            className="sr-only"
          />
          <span className="text-[0.95rem] font-bold">I am a Student</span>
        </label>
        
        <label
          className={`flex items-center cursor-pointer p-4 transition-all duration-200 ring-inset ${
            selectedType === 'Print Shop' ? 'ring-2 ring-black bg-black text-white' : 'ring-1 ring-gray-300 bg-white text-black hover:ring-2 hover:ring-black'
          }`}
        >
          <input
            type="radio"
            name="accountType"
            value="Print Shop"
            checked={selectedType === 'Print Shop'}
            onChange={() => onChange('Print Shop')}
            className="sr-only"
          />
          <span className="text-[0.95rem] font-bold">I am a Print Shop</span>
        </label>
      </div>
    </div>
  );
};
