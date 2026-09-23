import React, { useCallback, useState, useEffect } from 'react';
import { Document, TrashCan, Edit } from '@carbon/icons-react';
import { orderService } from '../../services/orderService';
import { TableSkeleton } from '../common/TableSkeleton';
import { Pagination } from '../common/Pagination';
import { AlertModal } from '../common/AlertModal';
import { ConfirmModal } from '../common/ConfirmModal';

export interface DraftOrder {
 id: string;
 shopId: string;
 shopName: string;
 fileName: string;
 originalFileName?: string | null;
 fileUrl: string;
 total: number;
 updatedAt: string;
 paperSize: string;
 printColorMode: string;
 pageCount: number;
}

interface MyDraftsListProps {
 onEditDraft: (draft: DraftOrder) => void;
}

export const MyDraftsList: React.FC<MyDraftsListProps> = ({ onEditDraft }) => {
 const [drafts, setDrafts] = useState<DraftOrder[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
 const [currentPage, setCurrentPage] = useState(1);
 const [totalPages, setTotalPages] = useState(1);
 const [draftToDelete, setDraftToDelete] = useState<string | null>(null);

 const [alertState, setAlertState] = useState<{isOpen: boolean; title?: string; message: string; type?: 'info' | 'success' | 'error' | 'warning'}>({ isOpen: false, message: '' });
 const showAlert = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info', title?: string) => {
 setAlertState({ isOpen: true, message, type, title });
 };

 const fetchDrafts = useCallback(async () => {
 setIsLoading(true);
 try {
 const res = await orderService.getDrafts(currentPage, 6);
 setDrafts(res.data as DraftOrder[]);
 setTotalPages(res.meta.totalPages);
 } catch (error) {
 console.error('Failed to fetch drafts:', error);
 } finally {
 setIsLoading(false);
 }
 }, [currentPage]);

 useEffect(() => {
 const timer = window.setTimeout(() => void fetchDrafts(), 0);
 return () => window.clearTimeout(timer);
 }, [fetchDrafts]);

 const handleDeleteDraft = async (draftId: string) => {
 setIsActionLoading(draftId);
 try {
 await orderService.deleteDraft(draftId);
 setDrafts(prev => prev.filter(draft => draft.id !== draftId));
 } catch {
 showAlert('Failed to delete draft.', 'error', 'Delete Failed');
 } finally {
 setIsActionLoading(null);
 setDraftToDelete(null);
 }
 };

 if (isLoading) return <TableSkeleton columns={4} rows={4} />;

 if (drafts.length === 0) return (
 <div className="bg-white border-2 border-dashed border-[#8d8d8d] p-12 text-center flex flex-col items-center justify-center">
 <Document className="w-12 h-12 text-gray-300 mb-4" />
 <h3 className="text-lg font-bold text-carbon-gray-100 mb-2">No Drafts Found</h3>
 <p className="text-gray-500 text-sm">Your saved drafts will appear here.</p>
 </div>
 );

 return (
 <>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {drafts.map((draft) => (
 <div key={draft.id} className="flex min-w-0 flex-col border-2 border-black bg-white p-5 transition-colors duration-200 hover:border-carbon-blue-60 motion-reduce:transition-none sm:p-6">
 <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
 <div className="min-w-0">
 <h4 className="break-words text-lg font-bold leading-snug text-carbon-gray-100" title={draft.originalFileName || undefined}>
 {draft.originalFileName || 'Original filename unavailable'}
 </h4>
 <p className="mt-2 break-words text-sm font-medium text-gray-600">{draft.shopName}</p>
 </div>
 <button
 type="button"
 onClick={() => setDraftToDelete(draft.id)}
 disabled={isActionLoading === draft.id}
 aria-label={`Delete draft ${draft.originalFileName || 'with unavailable filename'}`}
 className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center text-gray-600 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
 >
 <TrashCan className="h-5 w-5" aria-hidden="true" />
 </button>
 </div>

 <div className="flex-grow space-y-2 mb-6">
 <div className="text-xs text-gray-400">
 Saved on {new Date(draft.updatedAt).toLocaleDateString()}
 </div>
 <div className="pt-4 mt-4 border-t border-gray-100 flex justify-between items-end">
 <span className="text-sm font-bold text-gray-500">Est. Total</span>
 <span className="font-extrabold text-xl text-carbon-gray-100">₱{draft.total.toFixed(2)}</span>
 </div>
 </div>

 <button
 type="button"
 onClick={() => onEditDraft(draft)}
 disabled={isActionLoading === draft.id}
 className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 border-2 border-black bg-black px-4 py-3 font-bold text-white transition-colors hover:border-carbon-gray-100 hover:bg-carbon-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
 >
 REVIEW &amp; EDIT <Edit className="h-4 w-4" aria-hidden="true" />
 </button>
 </div>
 ))}
 </div>
 {drafts.length > 0 && totalPages > 1 && (
 <div className="col-span-full mt-8 p-4 border border-gray-100 bg-carbon-gray-10 flex items-center justify-center">
 <Pagination 
 currentPage={currentPage}
 totalPages={totalPages}
 onPageChange={(p) => {
 setCurrentPage(p);
 window.scrollTo(0, 0);
 }}
 />
 </div>
 )}

 <AlertModal 
 isOpen={alertState.isOpen}
 message={alertState.message}
 title={alertState.title}
 type={alertState.type}
 onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
 />
 <ConfirmModal
 isOpen={Boolean(draftToDelete)}
 title="Delete this draft?"
 message="This draft will be permanently removed and cannot be recovered."
 confirmLabel="Delete draft"
 cancelLabel="Keep draft"
 isBusy={Boolean(draftToDelete && isActionLoading === draftToDelete)}
 onCancel={() => setDraftToDelete(null)}
 onConfirm={() => {
 if (draftToDelete) void handleDeleteDraft(draftToDelete);
 }}
 />
 </>
 );
};
