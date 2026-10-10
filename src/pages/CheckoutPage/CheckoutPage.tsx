import React, { type ReactNode, useCallback, useEffect, useState } from 'react';
import { WarningAlt } from '@carbon/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckoutCard } from '../../components/checkout/CheckoutCard/CheckoutCard';
import { orderService } from '../../services/orderService';
import { CheckoutSkeleton } from './CheckoutSkeleton';
import styles from './CheckoutPage.module.css';
import { useDataEvents } from '../../hooks/useDataEvents';

interface CheckoutOrder {
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

export const CheckoutPage: React.FC = () => {
 const { orderId } = useParams<{ orderId: string }>();
 const navigate = useNavigate();
 const [order, setOrder] = useState<CheckoutOrder | null>(null);
 const [isLoading, setIsLoading] = useState(true);
 const [orderNotFound, setOrderNotFound] = useState(false);

 const fetchOrder = useCallback(() => {
 if (!orderId) return Promise.resolve();
 return orderService.getOrder(orderId)
 .then((data) => {
 setOrder(data);
 setOrderNotFound(false);
 setIsLoading(false);
 })
 .catch(() => {
 setOrderNotFound(true);
 setIsLoading(false);
 });
 }, [orderId]);

 useEffect(() => {
 if (!orderId) return;
 void fetchOrder();
 const intervalId = setInterval(() => void fetchOrder(), 5000);
 return () => {
 clearInterval(intervalId);
 };
 }, [fetchOrder, orderId]);

 useDataEvents(['orders', 'receipts'], () => void fetchOrder());

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

 if (orderNotFound) {
 return (
 <CheckoutPageShell>
 <section className="mx-auto max-w-md border border-black border-t-4 border-t-carbon-blue-60 bg-white p-7 text-center shadow-2xl" role="alert">
 <WarningAlt aria-hidden="true" className="mx-auto h-12 w-12 text-carbon-gray-100" />
 <h1 className="mt-4 text-xl font-black text-carbon-gray-100">Order not found</h1>
 <p className="mt-2 text-sm leading-relaxed text-gray-600">Order may have expired, been cancelled, or never existed.</p>
 <button
 type="button"
 onClick={() => navigate('/new-order?tab=orders')}
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

 return (
 <CheckoutPageShell>
 <CheckoutCard
 orderId={orderId}
 amount={order?.total ?? 15}
 gcashNumber={order?.shops?.gcash_number || '09123456789'}
 gcashQrUrl={order?.shops?.gcash_qr_url}
 createdAt={order?.created_at}
 expiresAt={order?.expires_at}
 shopRejectionReason={order?.shop_rejection_reason}
 orderState={order?.state}
 paymentReceipts={order?.payment_receipts}
 />
 </CheckoutPageShell>
 );
};
