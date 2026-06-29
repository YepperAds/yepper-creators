'use client';
// @ts-nocheck

import React, { useState } from 'react';
import { Mail, AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import { categoryAPI } from '@/app/_lib/adsense-api';

// Lets a website owner email one specific person a direct link into booking
// this ad space — clicking it (see sendCategoryInvite in
// createCategoryController.js) takes them straight to /ad-owner/pages/direct-ad
// pre-filled with this website + category, logging in first if needed.
const SendCategoryInviteModal = ({ category, onClose }: any) => {
    const [email, setEmail] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);
    const [sent, setSent] = useState(false);

    const send = async () => {
        if (!email.trim()) { setError('Recipient email is required.'); return; }
        setSending(true);
        setError(null);
        try {
            await categoryAPI.sendInvite(category._id, { email: email.trim() });
            setSent(true);
        } catch (err: any) {
            setError(err?.message || 'Failed to send email');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 backdrop-blur-sm bg-black/30" onClick={onClose}></div>

            <div className="relative w-full max-w-md mx-4">
                <div className="backdrop-blur-md bg-gradient-to-b from-emerald-900/30 to-emerald-900/10 rounded-3xl overflow-hidden border border-[#fff]/10 shadow-2xl">
                    <div className="p-10 relative z-10">
                        <div className="flex items-center mb-8">
                            <div className="relative">
                                <div className="absolute inset-0 rounded-full bg-emerald-500 blur-md opacity-40"></div>
                                <div className="relative p-3 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400">
                                    <Mail className="text-[#fff]" size={24} />
                                </div>
                            </div>
                            <div className="ml-4">
                                <h2 className="text-2xl font-bold text-[#fff]">Send Ad Invite</h2>
                            </div>
                            <button onClick={onClose} className="ml-auto text-[#fff]/70 hover:text-[#fff] transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        {sent ? (
                            <>
                                <div className="flex items-center gap-3 mb-8">
                                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                                    <p className="text-[#fff]/80">
                                        {email} now has a link straight into booking "{category.categoryName || category.spaceType}".
                                    </p>
                                </div>
                                <button onClick={onClose} className="w-full h-12 rounded-xl bg-surface-1/10 text-white font-medium hover:bg-surface-1/20 transition-all duration-300">
                                    Done
                                </button>
                            </>
                        ) : (
                            <>
                                <p className="text-[#fff]/80 mb-6">
                                    Email a recipient a direct link to book "{category.categoryName || category.spaceType}" — they log in (or sign up) and land right back here to advertise on it.
                                </p>

                                {error && (
                                    <div className="bg-red-500/20 border border-red-500/30 p-4 rounded-xl flex items-center gap-3 mb-6">
                                        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                                        <p className="text-red-200 text-sm">{error}</p>
                                    </div>
                                )}

                                <label className="block text-xs font-semibold text-[#fff]/60 mb-2">Recipient email</label>
                                <input
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    type="email"
                                    placeholder="someone@example.com"
                                    className="w-full mb-8 rounded-xl border border-[#fff]/15 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-[#fff]/30 outline-none focus:border-emerald-400/50"
                                />

                                <div className="flex gap-4">
                                    <button
                                        onClick={onClose}
                                        disabled={sending}
                                        className="flex-1 h-12 rounded-xl bg-surface-1/10 text-white font-medium hover:bg-surface-1/20 transition-all duration-300"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={send}
                                        disabled={sending}
                                        className="flex-1 group relative h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-400 text-white font-medium overflow-hidden transition-all duration-300 disabled:opacity-60"
                                    >
                                        <span className="relative z-10">{sending ? 'Sending…' : 'Send Invite'}</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SendCategoryInviteModal;
