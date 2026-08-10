'use client';
// @ts-nocheck

import React, { useState } from 'react';
import { 
    Trash2, 
    AlertTriangle,
    X 
} from 'lucide-react';

const DeleteCategoryModal = ({  
    categoryId, 
    onDeleteSuccess, 
    onCancel 
 }: any) => {
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState(null);
  
    const handleDeleteCategory = async () => {
        setIsDeleting(true);
        try {
          
          
          // Handle successful deletion
          onDeleteSuccess();
        } catch (error: unknown) {
          if ((error as any).response?.status === 400) {
            // Specific handling for ads preventing deletion
            const affectedAds = (error as any).response.data.affectedAds;
            setError(`Cannot delete. ${affectedAds.length} active ads use this category.`);
          } else {
            setError('Failed to delete category');
          }
          setIsDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Blurred background overlay */}
            <div 
                className="fixed inset-0 backdrop-blur-sm bg-black/30" 
                onClick={onCancel}
            ></div>
            
            <div className="relative w-full max-w-md mx-4">
                <div className="bg-white rounded-2xl overflow-hidden border border-border shadow-2xl">
                    <div className="p-8 relative z-10">
                        {/* Header Section */}
                        <div className="flex items-center mb-6">
                            <div className="p-2.5 rounded-full bg-red-600">
                                <Trash2 className="text-white" size={22} />
                            </div>
                            <div className="ml-4">
                                <h2 className="text-xl font-bold text-background">Delete Category</h2>
                            </div>
                            <button
                                onClick={onCancel}
                                className="ml-auto text-background/50 hover:text-background transition-colors"
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {/* Content Section */}
                        <p className="text-background/70 mb-6">
                            Are you sure you want to delete this ad category?
                            This action cannot be undone and will affect all related ads.
                        </p>

                        {/* Error Handling */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 mb-6">
                                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                                <p className="text-red-700 text-sm">{error}</p>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={onCancel}
                                className="flex-1 h-12 rounded-xl bg-black/5 text-background font-medium
                                           hover:bg-black/10 transition-colors duration-200"
                                disabled={isDeleting}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteCategory}
                                className="flex-1 h-12 rounded-xl bg-red-600 text-white font-medium
                                           hover:bg-red-700 transition-colors duration-200"
                                disabled={isDeleting}
                            >
                                {isDeleting ? 'Deleting...' : 'Delete Category'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeleteCategoryModal;