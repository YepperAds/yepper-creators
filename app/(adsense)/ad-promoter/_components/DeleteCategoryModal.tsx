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
                <div className="backdrop-blur-md bg-gradient-to-b from-red-900/30 to-red-900/10 rounded-3xl overflow-hidden border border-[#fff]/10 shadow-2xl">
                    <div className="p-10 relative z-10">
                        {/* Header Section */}
                        <div className="flex items-center mb-8">
                            <div className="relative">
                                <div className="absolute inset-0 rounded-full bg-red-500 blur-md opacity-40"></div>
                                <div className="relative p-3 rounded-full bg-gradient-to-r from-red-600 to-red-400">
                                    <Trash2 className="text-[#fff]" size={24} />
                                </div>
                            </div>
                            <div className="ml-4">
                                <h2 className="text-3xl font-bold text-[#fff]">Delete Category</h2>
                            </div>
                            <button
                                onClick={onCancel}
                                className="ml-auto text-[#fff]/70 hover:text-[#fff] transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Content Section */}
                        <p className="text-[#fff]/80 mb-8 text-lg">
                            Are you sure you want to delete this ad category? 
                            This action cannot be undone and will affect all related ads.
                        </p>

                        {/* Error Handling */}
                        {error && (
                            <div className="bg-red-500/20 border border-red-500/30 p-4 rounded-xl flex items-center gap-3 mb-8">
                                <AlertTriangle className="w-6 h-6 text-red-400" />
                                <p className="text-red-200 text-sm">{error}</p>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-4">
                            <button
                                onClick={onCancel}
                                className="flex-1 h-12 rounded-xl bg-surface-1/10 text-white font-medium 
                                           hover:bg-surface-1/20 transition-all duration-300"
                                disabled={isDeleting}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteCategory}
                                className="flex-1 group relative h-12 rounded-xl 
                                           bg-gradient-to-r from-red-600 to-rose-600 
                                           text-white font-medium overflow-hidden 
                                           transition-all duration-300"
                                disabled={isDeleting}
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-rose-400 
                                                opacity-0 group-hover:opacity-100 
                                                transition-opacity duration-300"></div>
                                <span className="relative z-10 flex items-center justify-center">
                                    {isDeleting ? 'Deleting...' : 'Delete Category'}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeleteCategoryModal;