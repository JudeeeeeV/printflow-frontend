import React, { type ReactNode, useCallback } from 'react';
import { WarningAlt } from '@carbon/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckoutCard } from '../../components/checkout/CheckoutCard/CheckoutCard';
import { CheckNowButton, StaleStatusNotice } from '../../components/common/StaleStatusNotice';
import { useLiveResource } from '../../hooks/useLiveResource';
import { ApiError } from '../../services/apiClient';
import type { DataResource } from '../../services/dataEvents';
import { orderService } from '../../services/orderService';
import { CheckoutSkeleton } from './CheckoutSkeleton';
import styles from './CheckoutPage.module.css';

interface CheckoutOrder {
 payment_method?: 'GCASH' | 'CASH_ON_PICKUP';
 payment_status?: string;
 acceptance_status?: string;
 acceptance_reason?: string;
 is_unclaimed?: boolean;
 unclaimed_reason?: string;
 total?: number;
 created_at?: string;
 expires_at?: string;
 shop_rejection_reason?: string;
 state?: string;
 payment_receipts?: Array<{ receipt_url?: string; reference_number?: string }>;
 shops?: {
 gcash_number?: string;
 gcash_qr_url?: string;
 };
}

const CHECKOUT_RESOURCES: DataResource[] = ['orders', 'receipts'];

const CheckoutAmbientBackground = () => (
 <div aria-hidden="true" className={styles.ambientLayer}>
 <span className={`${styles.glow} ${styles.primaryGlow}`} />
 <span className={`${styles.glow} ${styles.secondaryGlow}`} />
 <span className={`${styles.glow} ${styles.accentGlow}`} />
 <span className={`${styles.floatingRectangle} ${styles.rectangleOne}`} />
 <span className={`${styles.floatingRectangle} ${styles.rectangleTwo}`} />
 <span className={`${styles.floatingRectangle} ${styles.rectangleThree}`} />
 <span className={`${styles.floatingRectangle} ${styles.rectangleFour}`} />
 <span className={`${styles.floatingRectangle} ${styles.rectangleFive}`} />
 <span className={`${styles.floatingRectangle} ${styles.rectangleSix}`} />
 <span className={`${styles.floatingRectangle} ${styles.rectangleSeven}`} />
 <span className={`${styles.floatingRectangle} ${styles.rectangleEight}`} />
 <span className={`${styles.floatingRectangle} ${styles.rectangleNine}`} />
 <span className={`${styles.floatingRectangle} ${styles.rectangleTen}`} />
 </div>
);

const CheckoutPageShell: React.FC<{ children: ReactNode }> = ({ children }) => (
 <main className="relative min-h-screen overflow-x-hidden bg-black px-3 py-5 font-sans supports-[min-height:100dvh]:min-h-dvh sm:px-6 sm:py-8 lg:px-8 lg:py-10">
 <CheckoutAmbientBackground />
 <div className="relative z-10 mx-auto w-full max-w-6xl">{children}</div>
 </main>
);

const LiveCheckout: React.FC<{ orderId: string }> = ({ orderId }) => {
 const navigate = useNavigate();
 const loadOrder = useCallback(() => orderService.getOrder(orderId) as Promise<CheckoutOrder>, [orderId]);
 const { data: order, error, isLoading, confirmedAt, isOffline, refresh } = useLiveResource(orderId, loadOrder, CHECKOUT_RESOURCES);
 const returnToDashboard = () => navigate('/new-order?tab=orders');
 const dashboardButton = (
 <button
 type="button"
 onClick={returnToDashboard}
 className="mt-3 min-h-11 w-full cursor-pointer border border-carbon-gray-100 bg-white px-6 py-3 text-sm font-bold text-carbon-gray-100 transition-colors hover:bg-carbon-gray-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 motion-reduce:transition-none"
 >
 Return to Dashboard
 </button>
 );

 if (error instanceof ApiError && error.status === 404) {
 return (
 <CheckoutPageShell>
 <section className="mx-auto max-w-md border border-black border-t-4 border-t-carbon-blue-60 bg-white p-7 text-center shadow-2xl" role="alert">
 <WarningAlt aria-hidden="true" className="mx-auto h-12 w-12 text-carbon-gray-100" />
 <h1 className="mt-4 text-xl font-black text-carbon-gray-100">Order not found</h1>
 <p className="mt-2 text-sm leading-relaxed text-gray-600">Order may have expired, been cancelled, or never existed.</p>
 <button
 type="button"
 onClick={returnToDashboard}
 className="mt-6 min-h-11 w-full cursor-pointer bg-carbon-gray-100 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 motion-reduce:transition-none"
 >
 Return to Dashboard
 </button>
 </section>
 </CheckoutPageShell>
 );
 }

 if (isLoading) {
 return (
 <CheckoutPageShell>
 <CheckoutSkeleton />
 </CheckoutPageShell>
 );
 }

 // Never render the card without an order; its fallback amount would be false.
 if (!order) {
 return (
 <CheckoutPageShell>
 <section className="mx-auto max-w-md border border-black border-t-4 border-t-red-700 bg-white p-7 text-center shadow-2xl" role="alert">
 <WarningAlt aria-hidden="true" className="mx-auto h-12 w-12 text-red-700" />
 <h1 className="mt-4 text-xl font-black text-carbon-gray-100">We couldn't load this order</h1>
 <p className="mt-2 text-sm leading-relaxed text-gray-600">{isOffline ? "You're offline. Reconnect and we'll check again." : 'This may be a connection problem. Your order has not been changed.'}</p>
 <CheckNowButton onRetry={refresh} label="Try again" className="mt-6 w-full" />
 {dashboardButton}
 </section>
 </CheckoutPageShell>
 );
 }

 return (
 <CheckoutPageShell>
 {(error != null || isOffline) && (
 <div className="mb-3">
 <StaleStatusNotice confirmedAt={confirmedAt} isOffline={isOffline} onRetry={refresh} />
 </div>
 )}
 <CheckoutCard
 orderId={orderId}
 paymentMethod={order.payment_method}
 paymentStatus={order.payment_status}
 acceptanceStatus={order.acceptance_status}
 acceptanceReason={order.acceptance_reason}
 isUnclaimed={order.is_unclaimed}
 unclaimedReason={order.unclaimed_reason}
 amount={order.total ?? 15}
 gcashNumber={order.shops?.gcash_number}
 gcashQrUrl={order.shops?.gcash_qr_url}
 createdAt={order.created_at}
 expiresAt={order.expires_at}
 shopRejectionReason={order.shop_rejection_reason}
 orderState={order.state}
 paymentReceipts={order.payment_receipts}
 statusConfirmedAt={confirmedAt ?? undefined}
 onDeadlineReached={refresh}
 />
 </CheckoutPageShell>
 );
};

export const CheckoutPage: React.FC = () => {
 const { orderId } = useParams<{ orderId: string }>();

 if (!orderId) {
 return (
 <CheckoutPageShell>
 <section className="mx-auto max-w-md border border-black border-t-4 border-t-red-700 bg-white p-7 text-center shadow-2xl" role="alert">
 <WarningAlt aria-hidden="true" className="mx-auto h-12 w-12 text-red-700" />
 <h1 className="mt-4 text-xl font-black text-carbon-gray-100">Invalid order ID</h1>
 <p className="mt-2 text-sm leading-relaxed text-gray-600">Checkout cannot continue without a valid order.</p>
 </section>
 </CheckoutPageShell>
 );
 }

 return <LiveCheckout orderId={orderId} />;
};
