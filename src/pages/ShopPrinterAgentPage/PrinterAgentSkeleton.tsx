import React from "react";

interface PrinterAgentSkeletonProps {
  variant?: "page" | "computers";
}

const ComputerSkeletons = () => (
  <div className="space-y-4 p-4 sm:p-6">
    {[0, 1].map((computer) => (
      <div key={computer} className="min-w-0 border border-black">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-300 bg-carbon-gray-10 p-4 sm:p-5">
          <div className="flex min-w-0 flex-1 gap-3">
            <div className="h-11 w-11 shrink-0 bg-gray-200" />
            <div className="w-full max-w-xs space-y-3">
              <div className="h-5 w-3/4 bg-gray-200" />
              <div className="h-3 w-full bg-gray-200" />
            </div>
          </div>
          <div className="h-11 w-48 max-w-full bg-gray-200" />
        </div>
        <div className="p-4 sm:p-5">
          <div className="mb-3 h-3 w-36 max-w-full bg-gray-200" />
          <div className="divide-y divide-gray-200 border border-black">
            {[0, 1].map((printer) => (
              <div
                key={printer}
                className="flex items-center gap-3 px-3 py-4 sm:px-4"
              >
                <div className="h-11 w-11 shrink-0 bg-gray-200" />
                <div className="h-4 w-full max-w-xs bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    ))}
  </div>
);

export const PrinterAgentSkeleton: React.FC<PrinterAgentSkeletonProps> = ({
  variant = "page",
}) => (
  <div role="status" aria-label="Loading printer-agent information">
    <span className="sr-only">Loading printer-agent information</span>
    <div
      aria-hidden="true"
      className="min-w-0 animate-pulse space-y-5 motion-reduce:animate-none sm:space-y-6"
    >
      {variant === "page" && (
        <>
          <div className="space-y-2 border border-black bg-carbon-gray-100 px-4 py-3 sm:px-6 sm:py-4">
            <div className="h-3 w-28 bg-blue-300/40" />
            <div className="h-6 w-40 bg-white/20 sm:h-8" />
            <div className="h-3 w-full max-w-xl bg-white/10" />
          </div>
          <div className="border border-black bg-white shadow-[0_8px_24px_rgba(22,22,22,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-300 p-4 sm:p-6">
              <div className="w-full max-w-sm space-y-3">
                <div className="h-5 w-3/4 bg-gray-200" />
                <div className="h-3 w-full bg-gray-100" />
                <div className="h-6 w-40 bg-gray-100" />
              </div>
              <div className="h-11 w-48 max-w-full bg-carbon-blue-60/30" />
            </div>
            <div className="p-4 sm:p-6">
              <div className="mb-4 h-3 w-48 max-w-full bg-gray-200" />
              <div className="grid gap-3 lg:grid-cols-3">
                {[0, 1, 2].map((step) => (
                  <div
                    key={step}
                    className="border border-black bg-carbon-gray-10 p-4"
                  >
                    <div className="mb-4 h-9 w-9 bg-carbon-blue-60/30" />
                    <div className="h-4 w-32 max-w-full bg-gray-200" />
                    <div className="mt-3 space-y-2">
                      <div className="h-3 w-full bg-gray-200" />
                      <div className="h-3 w-5/6 bg-gray-200" />
                      <div className="h-3 w-2/3 bg-gray-200" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2 border-t border-gray-300 bg-carbon-gray-10 px-4 py-3 sm:px-6">
              <div className="h-3 w-48 max-w-full bg-gray-200" />
              <div className="h-3 w-full max-w-lg bg-gray-200" />
            </div>
          </div>
        </>
      )}
      {variant === "page" ? (
        <div className="border border-black bg-white shadow-[0_8px_24px_rgba(22,22,22,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-300 p-4 sm:p-6">
            <div className="w-full max-w-sm space-y-3">
              <div className="h-5 w-3/4 bg-gray-200" />
              <div className="h-3 w-full bg-gray-100" />
            </div>
            <div className="h-11 w-28 bg-gray-100" />
          </div>
          <ComputerSkeletons />
        </div>
      ) : (
        <ComputerSkeletons />
      )}
    </div>
  </div>
);
