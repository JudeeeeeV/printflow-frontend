import React from 'react';
import { QrCode } from '@carbon/icons-react';

interface QRCodeDisplayProps {
 gcashNumber: string;
 gcashQrUrl?: string;
 amount: number;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ gcashNumber, gcashQrUrl, amount }) => {
 return (
 <div className="bg-white border-2 border-gray-100 p-6 flex flex-col items-center text-center">
 <h3 className="text-xl font-bold text-carbon-gray-100 mb-2">Scan to Pay via GCash</h3>
 <p className="text-gray-500 mb-6 text-sm">Please scan the QR code using your GCash app</p>
 
 <div className="bg-blue-50 p-4 border border-blue-100 mb-6 relative group">
 {/* QR Code */}
 <div className="w-48 h-48 bg-white border-4 border-blue-500 flex items-center justify-center p-2 relative overflow-hidden">
 {gcashQrUrl ? (
 <img src={gcashQrUrl} alt="GCash QR" className="w-full h-full object-cover " />
 ) : (
 <QrCode className="w-full h-full text-blue-600" />
 )}
 <div className="absolute inset-0 bg-carbon-blue-60/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
 <span className="font-bold text-blue-800 text-sm bg-white px-3 py-1 ">GCash QR</span>
 </div>
 </div>
 </div>

 <div className="space-y-2 w-full">
 <div className="flex justify-between items-center px-4 py-2 bg-carbon-gray-10 ">
 <span className="text-sm text-gray-500">Amount Due</span>
 <span className="font-bold text-lg text-carbon-gray-100">₱{amount.toFixed(2)}</span>
 </div>
 <div className="flex justify-between items-center px-4 py-2 bg-carbon-gray-10 ">
 <span className="text-sm text-gray-500">GCash Number</span>
 <span className="font-mono font-semibold text-carbon-gray-100">{gcashNumber}</span>
 </div>
 </div>
 </div>
 );
};
