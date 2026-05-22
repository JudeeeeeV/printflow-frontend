import React from 'react';

interface ShopSelectorProps {
    shops: Array<{ id: string; name: string; rating: number; status: string }>;
    selectedShopId: string | null;
    onSelect: (id: string) => void;
}

export const ShopSelector: React.FC<ShopSelectorProps> = ({ shops, selectedShopId, onSelect }) => {
    return (
        <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Selected Print Shop</h3>
            <div className="flex flex-col gap-3">
                {shops.map((shop) => (
                    <button
                        key={shop.id}
                        type="button"
                        onClick={() => onSelect(shop.id)}
                        disabled={shop.status !== 'OPEN'}
                        className={`flex items-center p-4 text-left border-2 transition-all duration-200 ${
                            selectedShopId === shop.id
                                ? 'border-black bg-gray-50'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                        } ${shop.status !== 'OPEN' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                        <div className="flex-shrink-0 w-12 h-12 bg-gray-100 flex items-center justify-center mr-4">
                            <span className="font-bold text-gray-500">Shop</span>
                        </div>
                        <div>
                            <h4 className="font-bold text-black text-lg">{shop.name}</h4>
                            <p className="text-sm text-gray-500">
                                ⭐ {shop.rating} <span className="mx-2">•</span>
                                <span className={shop.status === 'OPEN' ? 'text-blue-600' : 'text-red-500'}>
                  {shop.status}
                </span>
                            </p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};