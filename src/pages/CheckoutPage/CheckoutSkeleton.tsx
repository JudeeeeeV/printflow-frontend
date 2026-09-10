import React from 'react';

export const CheckoutSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-carbon-gray-10 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white border border-[#e0e0e0] overflow-hidden">
          {/* Header */}
          <div className="bg-black text-white p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[#e0e0e0]">
            <div>
              <div className="h-6 w-48 bg-gray-700 animate-pulse mb-2"></div>
              <div className="h-4 w-32 bg-gray-800 animate-pulse"></div>
            </div>
            <div className="h-8 w-24 bg-gray-700 animate-pulse mt-4 sm:mt-0"></div>
          </div>

          <div className="p-6 sm:p-8 space-y-8">
            {/* Amount Section */}
            <div className="bg-gray-50 border border-[#e0e0e0] p-6 text-center">
              <div className="h-4 w-32 bg-gray-200 animate-pulse mx-auto mb-2"></div>
              <div className="h-10 w-48 bg-gray-300 animate-pulse mx-auto"></div>
            </div>

            {/* Payment Details */}
            <div className="space-y-4">
              <div className="h-5 w-40 bg-gray-200 animate-pulse mb-4"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="h-4 w-full bg-gray-100 animate-pulse"></div>
                  <div className="h-4 w-3/4 bg-gray-100 animate-pulse"></div>
                  <div className="h-4 w-5/6 bg-gray-100 animate-pulse"></div>
                </div>
                <div className="flex justify-center items-center p-4 border border-[#e0e0e0] bg-gray-50">
                  <div className="w-48 h-48 bg-gray-200 animate-pulse"></div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4 pt-6 border-t border-[#e0e0e0]">
              <div className="h-12 w-full bg-gray-200 animate-pulse"></div>
              <div className="h-12 w-full bg-gray-100 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
