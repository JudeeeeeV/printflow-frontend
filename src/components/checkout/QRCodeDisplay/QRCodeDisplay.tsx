import React from 'react';
import { QrCode } from '@carbon/icons-react';

interface QRCodeDisplayProps {
 gcashNumber?: string;
 gcashQrUrl?: string;
 amount: number;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ gcashNumber, gcashQrUrl, amount }) => {
 return (
 <section aria-labelledby="payment-details-heading" className="h-full border border-black bg-carbon-gray-10">
 <div className="border-b border-gray-300 bg-white px-5 py-4 sm:px-6">
 <p className="text-xs font-bold uppercase tracking-[0.16em] text-carbon-blue-60">Step 01</p>
 <h3 id="payment-details-heading" className="mt-1 text-xl font-black text-carbon-gray-100">Pay through GCash</h3>
 <p className="mt-2 text-sm leading-relaxed text-gray-600">Scan the shop QR code and send the exact amount shown below.</p>
 </div>

 <div className="p-5 sm:p-6">
 <div className="mx-auto flex w-full max-w-[17rem] items-center justify-center border border-gray-300 bg-white p-4 shadow-[0_8px_20px_rgba(22,22,22,0.08)]">
 <div className="aspect-square w-full border-4 border-carbon-blue-60 bg-white p-2">
 {gcashQrUrl ? (
 <img src={gcashQrUrl} alt="GCash payment QR code" className="h-full w-full object-contain" />
 ) : (
 <QrCode aria-label="GCash QR code unavailable" className="h-full w-full text-carbon-blue-60" />
 )}
 </div>
 </div>

 <dl className="mt-6 divide-y divide-gray-300 border border-gray-300 bg-white">
 <div className="flex flex-col gap-1 px-4 py-4 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
 <dt className="text-sm font-semibold text-gray-600">Amount due</dt>
 <dd className="text-2xl font-black tabular-nums text-carbon-gray-100">₱{amount.toFixed(2)}</dd>
 </div>
 <div className="flex flex-col gap-1 px-4 py-4 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
 <dt className="text-sm font-semibold text-gray-600">GCash number</dt>
 <dd className="break-all font-mono text-base font-bold text-carbon-gray-100">{gcashNumber || 'Not provided by the shop'}</dd>
 </div>
 </dl>

 <div className="mt-4 border-l-4 border-carbon-blue-60 bg-blue-50 px-4 py-3">
 <p className="text-xs font-semibold leading-relaxed text-carbon-gray-100">Keep your transaction receipt. You will need it for verification.</p>
 </div>
 </div>
 </section>
 );
};
