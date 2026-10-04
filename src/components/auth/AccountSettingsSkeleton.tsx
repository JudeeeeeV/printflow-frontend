export function AccountSettingsSkeleton({ showShopGcashQr = false }: { showShopGcashQr?: boolean }) {
  return (
    <div role="status" aria-label="Loading account settings">
      <span className="sr-only">Loading account settings...</span>
      <div aria-hidden="true" className="animate-pulse motion-reduce:animate-none">
        <div className="mb-6 border-b border-gray-200 pb-6">
          <div className="mb-2 h-5 w-24 bg-gray-200" />
          <div className="mb-4 h-5 w-56 max-w-full bg-gray-100" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[1, 2].map(field => (
              <div key={field}>
                <div className="mb-2 h-5 w-20 bg-gray-200" />
                <div className="h-12 border border-gray-200 bg-gray-100" />
              </div>
            ))}
          </div>
          <div className="mt-4 h-11 w-28 bg-gray-200" />
        </div>
        {showShopGcashQr && (
          <div className="mb-6 border-b border-gray-200 pb-6">
            <div className="mb-2 h-5 w-32 bg-gray-200" />
            <div className="mb-4 h-16 bg-gray-100" />
            <div className="mx-auto mb-4 h-44 w-44 max-w-full border border-gray-200 bg-gray-100" />
            <div className="flex justify-center gap-2">
              <div className="h-11 w-28 bg-gray-200" />
              <div className="h-11 w-20 bg-gray-200" />
            </div>
            <div className="mx-auto mt-4 h-11 w-28 bg-gray-200" />
          </div>
        )}
        <div className="mb-4 h-5 w-36 bg-gray-200" />
        {[1, 2].map(field => (
          <div key={field} className="mb-5">
            <div className="mb-2 h-5 w-36 bg-gray-200" />
            <div className="h-12 border border-gray-200 bg-gray-100" />
          </div>
        ))}
        <div className="h-40 border border-gray-200 bg-gray-100" />
        <div className="mt-4 h-14 bg-gray-200" />
      </div>
    </div>
  );
}
