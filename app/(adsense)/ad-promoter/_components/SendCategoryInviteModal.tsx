'use client';
// @ts-nocheck

import React, { useState } from 'react';
import { Mail, AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import { categoryAPI } from '@/app/_lib/adsense-api';

// Lets a website owner email one specific person a direct link into booking
// this ad space; clicking it (see sendCategoryInvite in
// createCategoryController.js) takes them straight to /ad-owner/pages/direct-ad
// pre-filled with this website + category, logging in first if needed.
const SendCategoryInviteModal = ({ category, tier, onClose }: any) => {
    const [email, setEmail] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);
    const [sent, setSent] = useState(false);

    const spaceLabel = tier
        ? `${category.categoryName || category.spaceType} — ${tier.label}`
        : (category.categoryName || category.spaceType);

    const send = async () => {
        if (!email.trim()) { setError('Recipient email is required.'); return; }
        setSending(true);
        setError(null);
        try {
            await categoryAPI.sendInvite(category._id, { email: email.trim(), tierKey: tier?.key });
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
                <div className="bg-white rounded-2xl overflow-hidden border border-border shadow-2xl">
                    <div className="p-8 relative z-10">
                        <div className="flex items-center mb-6">
                            <div className="p-2.5 rounded-full bg-emerald-600">
                                <Mail className="text-white" size={22} />
                            </div>
                            <div className="ml-4">
                                <h2 className="text-xl font-bold text-background">Send Ad Invite</h2>
                            </div>
                            <button onClick={onClose} className="ml-auto text-background/50 hover:text-background transition-colors">
                                <X size={22} />
                            </button>
                        </div>

                        {sent ? (
                            <>
                                <div className="flex items-center gap-3 mb-6">
                                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                                    <p className="text-background/70">
                                        {email} now has a link straight into booking "{spaceLabel}".
                                    </p>
                                </div>
                                <button onClick={onClose} className="w-full h-12 rounded-xl bg-black/5 text-background font-medium hover:bg-black/10 transition-colors duration-200">
                                    Done
                                </button>
                            </>
                        ) : (
                            <>
                                <p className="text-background/70 mb-6">
                                    Email a recipient a direct link to book "{spaceLabel}"; they log in (or sign up) and land right back here to advertise on it.
                                </p>

                                {error && (
                                    <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 mb-6">
                                        <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                                        <p className="text-red-700 text-sm">{error}</p>
                                    </div>
                                )}

                                <label className="block text-xs font-semibold text-background/60 mb-2">Recipient email</label>
                                <input
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    type="email"
                                    placeholder="someone@example.com"
                                    className="w-full mb-6 rounded-xl border border-border bg-white px-4 py-3 text-sm text-background placeholder:text-background/30 outline-none focus:border-emerald-500"
                                />

                                <div className="flex gap-3">
                                    <button
                                        onClick={onClose}
                                        disabled={sending}
                                        className="flex-1 h-12 rounded-xl bg-black/5 text-background font-medium hover:bg-black/10 transition-colors duration-200"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={send}
                                        disabled={sending}
                                        className="flex-1 h-12 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors duration-200 disabled:opacity-60"
                                    >
                                        {sending ? 'Sending…' : 'Send Invite'}
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
