import React from 'react';

export const ShopInventoryPage: React.FC = () => {
    return (
        <div className="p-8 font-sans max-w-4xl">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Inventory Management</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Paper Supplies</h2>
                    <ul className="space-y-4">
                        <li className="flex justify-between items-center pb-2 border-b border-gray-100">
                            <span className="text-sm text-gray-700">A4 Standard (80gsm)</span>
                            <span className="text-sm font-semibold text-green-600">Good (12,000 sheets)</span>
                        </li>
                        <li className="flex justify-between items-center pb-2 border-b border-gray-100">
                            <span className="text-sm text-gray-700">A4 Premium (100gsm)</span>
                            <span className="text-sm font-semibold text-orange-500">Low (1,500 sheets)</span>
                        </li>
                    </ul>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Ink Levels</h2>
                    <ul className="space-y-4">
                        <li className="flex justify-between items-center pb-2 border-b border-gray-100">
                            <span className="text-sm text-gray-700">Black (K)</span>
                            <span className="text-sm font-semibold text-green-600">85%</span>
                        </li>
                        <li className="flex justify-between items-center pb-2 border-b border-gray-100">
                            <span className="text-sm text-gray-700">Cyan (C)</span>
                            <span className="text-sm font-semibold text-green-600">60%</span>
                        </li>
                        <li className="flex justify-between items-center pb-2 border-b border-gray-100">
                            <span className="text-sm text-gray-700">Magenta (M)</span>
                            <span className="text-sm font-semibold text-red-600">12%</span>
                        </li>
                        <li className="flex justify-between items-center pb-2 border-b border-gray-100">
                            <span className="text-sm text-gray-700">Yellow (Y)</span>
                            <span className="text-sm font-semibold text-green-600">45%</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
};
