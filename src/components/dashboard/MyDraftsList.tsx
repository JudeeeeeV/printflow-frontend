import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Trash2, ArrowRight } from 'lucide-react';
import { orderService } from '../../services/orderService';

// Assuming this shape based on your SDD; adjust to match your actual Order interface
interface DraftOrder {
    id: string;
    shopName: string;
    fileName: string;
    total: number;
    updatedAt: string;
}

export const MyDraftsList: React.FC = () => {
    const navigate = useNavigate();
    const [drafts, setDrafts] = useState<DraftOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

    useEffect(() => {
        fetchDrafts();
    }, []);

    const fetchDrafts = async () => {
        setIsLoading(true);
        try {
            const data = await orderService.getDrafts() as DraftOrder[];
            setDrafts(data);
        } catch (error) {
            console.error('Failed to fetch drafts:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResumeDraft = async (draftId: string) => {
        setIsActionLoading(draftId);
        try {
            // Trigger the transition from DRAFT to OPEN_INQUIRY on the backend
            // which will also start the 15-minute GCash payment timer
            await orderService.submitDraft(draftId);
            
            // Navigate to checkout once successfully submitted
            navigate(`/checkout/${draftId}`);
        } catch (error) {
            alert('Failed to resume draft. Please try again.');
            setIsActionLoading(null);
        }
    };

    const handleDeleteDraft = async (draftId: string) => {
        if (!window.confirm('Are you sure you want to delete this draft?')) return;
        
        setIsActionLoading(draftId);
        try {
            await orderService.deleteDraft(draftId);
            // Remove the deleted draft from the local state
            setDrafts(prev => prev.filter(draft => draft.id !== draftId));
        } catch (error) {
            alert('Failed to delete draft.');
        } finally {
            setIsActionLoading(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
            </div>
        );
    }

    if (drafts.length === 0) {
        return (
            <div className="bg-white border-2 border-dashed border-gray-300 p-12 text-center flex flex-col items-center justify-center">
                <FileText className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-bold text-black mb-2">No Drafts Found</h3>
                <p className="text-gray-500 text-sm">Your saved drafts will appear here.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {drafts.map((draft) => (
                <div key={draft.id} className="bg-white border-2 border-gray-100 p-6 flex flex-col hover:border-black transition-colors duration-200">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded tracking-wide uppercase">
                                Draft
                            </span>
                            <h4 className="font-bold text-black mt-3 text-lg">{draft.shopName}</h4>
                        </div>
                        <button 
                            onClick={() => handleDeleteDraft(draft.id)}
                            disabled={isActionLoading === draft.id}
                            className="text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                            title="Delete Draft"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-grow space-y-2 mb-6">
                        <div className="flex items-center text-sm text-gray-600">
                            <FileText className="w-4 h-4 mr-2" />
                            <span className="truncate">{draft.fileName}</span>
                        </div>
                        <div className="text-xs text-gray-400">
                            Saved on {new Date(draft.updatedAt).toLocaleDateString()}
                        </div>
                        <div className="pt-4 mt-4 border-t border-gray-100 flex justify-between items-end">
                            <span className="text-sm font-bold text-gray-500">Est. Total</span>
                            <span className="font-extrabold text-xl text-black">₱{draft.total.toFixed(2)}</span>
                        </div>
                    </div>

                    <button
                        onClick={() => handleResumeDraft(draft.id)}
                        disabled={isActionLoading === draft.id}
                        className="w-full bg-black text-white font-bold py-3 flex items-center justify-center gap-2 hover:bg-gray-800 disabled:opacity-50 transition-colors"
                    >
                        {isActionLoading === draft.id ? 'PROCESSING...' : (
                            <>
                                SUBMIT ORDER <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </div>
            ))}
        </div>
    );
};