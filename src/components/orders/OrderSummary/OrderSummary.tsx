import React from "react";
import type { PaymentMethod } from "../../../services/orderService";

interface OrderSummaryProps {
  paymentMethod?: PaymentMethod;
  setPaymentMethod?: (method: PaymentMethod) => void;
  estimate: {
    total: number;
    pageCount: number;
    basePrice: number;
    colorAdditive: number;
  } | null;
  isSubmitting: boolean;
  onSubmit: () => void;
  onSaveDraft: () => void;
  isReady: boolean;
  paperSize: string;
  setPaperSize: (size: string) => void;
  pageCount: number;
  printColorMode: string;
  setPrintColorMode: (mode: string) => void;
  orderName: string;
  setOrderName: (name: string) => void;
  orientation: string;
  setOrientation: (orientation: string) => void;
  copies: number;
  setCopies: (copies: number) => void;
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({
  estimate,
  isSubmitting,
  onSubmit,
  onSaveDraft,
  isReady,
  paperSize,
  setPaperSize,
  printColorMode,
  setPrintColorMode,
  orderName,
  setOrderName,
  orientation,
  setOrientation,
  copies,
  setCopies,
  paymentMethod = 'GCASH',
  setPaymentMethod,
}) => {
  return (
    <div className="bg-white border-2 border-gray-100 p-6 flex flex-col min-h-[500px] h-fit">
      <h3 className="text-xl font-bold text-carbon-gray-100 mb-6">
        Order Summary
      </h3>

      <div className="mb-6 space-y-4">
        <fieldset disabled={isSubmitting}>
          <legend className="mb-2 text-sm font-bold text-gray-700">Payment method</legend>
          <div className="grid grid-cols-2 gap-1 bg-gray-200 p-1">
            {(['GCASH', 'CASH_ON_PICKUP'] as const).map(method => (
              <button key={method} type="button" aria-pressed={paymentMethod === method}
                onClick={() => setPaymentMethod?.(method)}
                className={`min-h-11 px-2 py-2 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60 disabled:opacity-50 ${paymentMethod === method ? 'bg-carbon-blue-60 text-white' : 'bg-white text-carbon-gray-100 hover:bg-gray-100'}`}>
                {method === 'GCASH' ? 'GCash' : 'Cash on pickup'}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-gray-600">{paymentMethod === 'GCASH' ? 'Submit your receipt for review after placing the order.' : 'Pay the full amount at the shop before collecting your prints.'} Payment method is locked after submission.</p>
        </fieldset>
        <div>
          <label
            htmlFor="order-name"
            className="mb-2 block text-sm font-bold text-gray-700"
          >
            Order Name
          </label>
          <input
            id="order-name"
            type="text"
            maxLength={120}
            value={orderName}
            onChange={(event) => setOrderName(event.target.value)}
            disabled={isSubmitting}
            placeholder="e.g. Test Paper - Dela Cruz"
            className="w-full border-2 border-[#e0e0e0] bg-white p-2 font-medium text-carbon-gray-100 focus:border-black focus:outline-carbon-blue-60 disabled:bg-carbon-gray-10 disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-gray-500">
            Shown prominently to the shop operator.
          </p>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Paper Size
          </label>
          <select
            value={paperSize}
            onChange={(e) => setPaperSize(e.target.value)}
            disabled={isSubmitting}
            className="w-full border-2 border-[#e0e0e0] p-2 bg-white text-carbon-gray-100 font-bold focus:outline-carbon-blue-60 focus:border-black disabled:opacity-50 disabled:bg-carbon-gray-10"
          >
            <option value="A4">A4</option>
            <option value="SHORT">Short (Letter)</option>
            <option value="LONG">Long (Legal)</option>
          </select>
        </div>
        <div>
          <div
            id="print-orientation-label"
            className="mb-2 block text-sm font-bold text-gray-700"
          >
            Orientation
          </div>
          <div
            role="group"
            aria-labelledby="print-orientation-label"
            className="flex bg-gray-200 p-1"
          >
            {["PORTRAIT", "LANDSCAPE"].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setOrientation(value)}
                disabled={isSubmitting}
                aria-pressed={orientation === value}
                className={`inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 px-2 py-2 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 motion-reduce:transition-none ${orientation === value ? "bg-black/90 text-white" : "text-gray-500 hover:text-gray-700"}`}
              >
                <svg
                  aria-hidden="true"
                  focusable="false"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className="h-5 w-5 shrink-0"
                >
                  <rect
                    x={value === "PORTRAIT" ? 5 : 2}
                    y={value === "PORTRAIT" ? 2 : 5}
                    width={value === "PORTRAIT" ? 14 : 20}
                    height={value === "PORTRAIT" ? 20 : 14}
                  />
                  <path
                    d={
                      value === "PORTRAIT"
                        ? "M8 8h8M8 12h8M8 16h5"
                        : "M5 9h14M5 12h14M5 15h10"
                    }
                  />
                </svg>
                {value === "PORTRAIT" ? "Portrait" : "Landscape"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label
            htmlFor="print-copies"
            className="mb-2 block text-sm font-bold text-gray-700"
          >
            Number of Copies
          </label>
          <input
            id="print-copies"
            type="number"
            min={1}
            max={99}
            step={1}
            value={copies}
            onChange={(event) =>
              setCopies(
                Math.min(
                  99,
                  Math.max(1, Number.parseInt(event.target.value, 10) || 1),
                ),
              )
            }
            disabled={isSubmitting}
            className="w-full border-2 border-[#e0e0e0] bg-white p-2 font-bold text-carbon-gray-100 focus:border-black focus:outline-carbon-blue-60 disabled:bg-carbon-gray-10 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Color Mode
          </label>
          <div className="flex bg-gray-200 p-1 ">
            <button
              onClick={() => setPrintColorMode("BLACK_AND_WHITE")}
              disabled={isSubmitting}
              className={`flex-1 py-2 text-sm font-bold transition-all ${printColorMode === "BLACK_AND_WHITE" ? "bg-black/90 text-white " : "text-gray-500 hover:text-gray-700"}`}
            >
              B&W
            </button>
            <button
              onClick={() => setPrintColorMode("COLOR")}
              disabled={isSubmitting}
              className={`flex-1 py-2 text-sm font-bold transition-all ${printColorMode === "COLOR" ? "text-white" : "text-gray-500 hover:text-gray-700"}`}
              style={
                printColorMode === "COLOR"
                  ? {
                      backgroundImage:
                        "linear-gradient(rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.35)), linear-gradient(to right, #00ffff 0%, #ff00ff 33%, #ffff00 67%, #000000 100%)",
                      textShadow: "0 1px 2px rgba(0, 0, 0, 0.9)",
                    }
                  : undefined
              }
            >
              Color
            </button>
          </div>
        </div>
      </div>

      {estimate ? (
        <div className="grow">
          <div className="flex justify-between mb-2 text-sm text-gray-600 gap-2">
            <span className="truncate">
              Base (
              {paperSize === "SHORT"
                ? "Short"
                : paperSize === "LONG"
                  ? "Long"
                  : "A4"}
              )
            </span>
            <span className="whitespace-nowrap font-medium text-right">
              ₱{estimate.basePrice.toFixed(2)} / pg
            </span>
          </div>
          <div className="flex justify-between mb-2 text-sm text-gray-600 gap-2">
            <span className="truncate">
              Color ({printColorMode === "COLOR" ? "Color" : "B&W"})
            </span>
            <span className="whitespace-nowrap font-medium text-right">
              + ₱{estimate.colorAdditive.toFixed(2)} / pg
            </span>
          </div>
          <div className="flex justify-between mb-4 text-sm text-gray-600 gap-2">
            <span className="truncate">Pages</span>
            <span className="whitespace-nowrap font-medium text-right">
              x {estimate.pageCount}
            </span>
          </div>
          <div className="mb-4 flex justify-between gap-2 text-sm text-gray-600">
            <span>Copies</span>
            <span className="whitespace-nowrap text-right font-medium">
              x {copies}
            </span>
          </div>
          <div className="border-t-2 border-black pt-4 mb-2 flex justify-between items-end">
            <span className="font-bold text-lg">Total</span>
            <span className="font-extrabold text-2xl text-carbon-gray-100">
              ₱{estimate.total.toFixed(2)}
            </span>
          </div>
        </div>
      ) : (
        <div className="grow flex items-center justify-center text-gray-400 text-sm text-center">
          Select a shop and upload a file to view pricing.
        </div>
      )}

      <div className="mt-auto">
        <button
          onClick={onSubmit}
          disabled={!isReady || isSubmitting}
          className="w-full min-h-11 bg-carbon-blue-60 hover:bg-carbon-blue-70 text-white font-bold py-2 mb-3 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? "PROCESSING..." : "SUBMIT ORDER"}
        </button>
        <button
          onClick={onSaveDraft}
          disabled={!isReady || isSubmitting}
          className="w-full min-h-11 border-2 border-black text-carbon-gray-100 font-bold py-2 hover:bg-carbon-gray-10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          a Save as Draft
        </button>
      </div>
    </div>
  );
};
