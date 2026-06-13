'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api, AUTH_ENDPOINTS } from '@/app/_lib/api';
import type { AuthResponse, User, UsernameCheckResponse } from '@/app/_types/auth';
import {
  UserCircleIcon,
  AtSymbolIcon,
  FingerPrintIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  CameraIcon,
  VideoCameraIcon,
  CodeBracketIcon,
} from '@heroicons/react/24/outline';

const CREATOR_TYPES: { value: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'Content Creator', label: 'Content Creator', icon: VideoCameraIcon },
  { value: 'Web Developer',   label: 'Web Developer',   icon: CodeBracketIcon },
];

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Form state
  const [username, setUsername] = useState('');
  const [whatTheyDo, setWhatTheyDo] = useState('');
  const [avatar, setAvatar] = useState('');

  // Track original values for dirty check
  const [initialForm, setInitialForm] = useState({ username: '', whatTheyDo: '', avatar: '' });

  // Validation state
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [usernameReason, setUsernameReason] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

  useEffect(() => {
    async function fetchUser() {
      const result = await api.get<AuthResponse>(AUTH_ENDPOINTS.checkSession);
      if (result.ok && result.data?.data?.user) {
        const u = result.data.data.user;
        setUser(u);
        
        const vals = {
          username: u.username || '',
          whatTheyDo: u.what_they_do || '',
          avatar: u.avatar || ''
        };
        
        setUsername(vals.username);
        setWhatTheyDo(vals.whatTheyDo);
        setAvatar(vals.avatar);
        setInitialForm(vals);
      }
      setLoading(false);
    }
    fetchUser();
  }, []);

  const isDirty = 
    username.trim() !== initialForm.username || 
    whatTheyDo !== initialForm.whatTheyDo || 
    avatar !== initialForm.avatar;

  const checkUsername = useCallback(async (value: string) => {
    const raw = value.trim().toLowerCase();
    
    // No check needed if it's the original username
    if (!raw || raw === initialForm.username) {
      setUsernameStatus('idle');
      return;
    }

    setUsernameStatus('checking');
    try {
      const res = await fetch(`${apiBaseUrl}/auth/creator/check-username?username=${encodeURIComponent(raw)}`);
      const data: UsernameCheckResponse = await res.json();
      setUsernameStatus(data.available ? 'available' : 'taken');
      setUsernameReason(data.reason);
    } catch {
      setUsernameStatus('idle');
    }
  }, [apiBaseUrl, initialForm.username]);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^a-z0-9_\.]/gi, '').toLowerCase();
    setUsername(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => checkUsername(val), 500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // We'll compress the image in the background using Canvas
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        // Create canvas
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400; // Profile pics don't need to be huge
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          
          // Output compressed version (0.7 quality is sweet spot)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setAvatar(dataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleCancel = () => {
    setUsername(initialForm.username);
    setWhatTheyDo(initialForm.whatTheyDo);
    setAvatar(initialForm.avatar);
    setUsernameStatus('idle');
    setMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    if (usernameStatus === 'taken') {
      setMessage({ type: 'error', text: 'Username is already taken.' });
      return;
    }
    if (!username.trim()) {
      setMessage({ type: 'error', text: 'Username cannot be empty.' });
      return;
    }

    setSaving(true);
    setMessage(null);

    const result = await api.post<{ success: boolean, message: string }>('/api/auth/complete-profile', {
      username: username.trim(),
      what_they_do: whatTheyDo,
      avatar: avatar // sends the base64 string (backend may accept)
    });

    setSaving(false);
    if (result.ok) {
      // Pull the persisted avatar URL back from the response (Cloudinary URL replaces base64)
      const savedUser = (result.data as any)?.data?.user;
      const savedAvatar = savedUser?.avatar ?? avatar;
      setAvatar(savedAvatar);
      setUser(prev => prev ? { ...prev, avatar: savedAvatar } : prev);
      setInitialForm({ username: username.trim(), whatTheyDo, avatar: savedAvatar });
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setUsernameStatus('idle');
      // Notify other components (e.g. Navbar) that the session has changed
      window.dispatchEvent(new CustomEvent('yepper-session-changed'));
    } else {
      setMessage({ type: 'error', text: result.error?.message || 'Failed to update profile.' });
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <ArrowPathIcon className="w-6 h-6 animate-spin text-(--color-muted)" />
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-4xl mx-auto px-6 py-10">
      
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
      />

      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-(--color-white)">Profile Settings</h1>
          <p className="text-sm text-(--color-muted) mt-1">Manage your creator identity and public information.</p>
        </div>
        {isDirty && (
          <button 
            onClick={handleCancel}
            className="text-xs font-bold text-(--color-muted) hover:text-(--color-white) transition-colors uppercase tracking-wider"
          >
            Cancel changes
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* ── Left Column: Avatar & Summary ── */}
        <div className="space-y-6">
          <div className="bg-(--color-surface-1) border border-(--color-border) rounded-2xl p-6 flex flex-col items-center text-center">
            <button 
              onClick={handleAvatarClick}
              className="relative group cursor-pointer mb-4"
              title="Click to change profile picture"
            >
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-(--color-border) bg-(--color-surface-2) transition-transform group-hover:scale-[1.02]">
                  {avatar ? (
                    <img src={avatar} alt={user?.name ?? user?.fullName ?? user?.fullname} className="w-full h-full object-cover" />
                  ) : (
                  <div className="w-full h-full flex items-center justify-center text-(--color-muted)">
                    <UserCircleIcon className="w-16 h-16" />
                  </div>
                )}
              </div>
              <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center">
                <CameraIcon className="w-6 h-6 text-white mb-1" />
                <span className="text-[10px] text-white font-bold uppercase tracking-tighter">Edit</span>
              </div>
            </button>
            
              <h2 className="text-lg font-bold text-(--color-white)">{user?.name ?? user?.fullName ?? user?.fullname}</h2>
            <p className="text-xs text-(--color-muted) tracking-wide">@{username || 'handle'}</p>
            
            <div className="mt-4 pt-4 border-t border-(--color-border) w-full">
              <span className="px-2 py-1 bg-(--color-surface-3) rounded text-[10px] font-bold text-(--color-white) uppercase">
                Creator Account
              </span>
            </div>
          </div>

          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <FingerPrintIcon className="w-3.5 h-3.5" /> Google Sync
            </h3>
            <p className="text-[11px] text-blue-300/80 leading-relaxed">
              Your name and email are synced from your Google account. To change them, please update your Google profile.
            </p>
          </div>
        </div>

        {/* ── Right Column: Form ── */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Section: Basics */}
          <section className="bg-(--color-surface-1) border border-(--color-border) rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-(--color-border) bg-(--color-surface-2)/50">
              <h3 className="text-sm font-bold text-(--color-white)">Personal Information</h3>
            </div>
            <div className="p-6 space-y-6">
              
              {/* Full Name (Read Only) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-(--color-muted) uppercase tracking-wider">Full Name</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-(--color-surface-2) border border-(--color-border) rounded-xl opacity-60 text-sm text-(--color-white)">
                  <UserCircleIcon className="w-5 h-5 opacity-50" />
                  {user?.fullname}
                </div>
              </div>

              {/* Email (Read Only) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-(--color-muted) uppercase tracking-wider">Email Address</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-(--color-surface-2) border border-(--color-border) rounded-xl opacity-60 text-sm text-(--color-white)">
                  <AtSymbolIcon className="w-5 h-5 opacity-50" />
                  {user?.email}
                </div>
              </div>

              {/* Username (Editable) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-end">
                  <label className="text-[11px] font-bold text-(--color-muted) uppercase tracking-wider">Username</label>
                  {usernameStatus === 'checking' && <span className="text-[10px] text-zinc-500 animate-pulse">Checking...</span>}
                  {usernameStatus === 'available' && <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1"><CheckCircleIcon className="w-3 h-3"/> Available</span>}
                  {usernameStatus === 'taken' && <span className="text-[10px] text-rose-500 font-bold flex items-center gap-1"><ExclamationCircleIcon className="w-3 h-3"/> Taken</span>}
                </div>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-muted) text-sm group-focus-within:text-(--color-white) transition-colors">@</span>
                  <input 
                    type="text" 
                    value={username}
                    onChange={handleUsernameChange}
                    className={`w-full bg-(--color-surface-2) border ${usernameStatus === 'taken' ? 'border-rose-500/50' : 'border-(--color-border)'} focus:border-(--color-white) rounded-xl pl-9 pr-4 py-3 text-sm text-(--color-white) outline-none transition-all`}
                    placeholder="yourhandle"
                  />
                </div>
                {usernameStatus === 'taken' && <p className="text-[10px] text-rose-500/80 mt-1">{usernameReason}</p>}
              </div>

            </div>
          </section>

          {/* Section: Creator Identity */}
          <section className="bg-(--color-surface-1) border border-(--color-border) rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-(--color-border) bg-(--color-surface-2)/50">
              <h3 className="text-sm font-bold text-(--color-white)">Creator Identity</h3>
            </div>
            <div className="p-6 space-y-4">
              <label className="text-[11px] font-bold text-(--color-muted) uppercase tracking-wider block mb-2">What best describes you?</label>
              <div className="grid grid-cols-2 gap-3">
                {CREATOR_TYPES.map((type) => {
                  const selected = whatTheyDo === type.value;
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setWhatTheyDo(type.value)}
                      className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center transition-all ${
                        selected
                          ? 'border-(--color-white) bg-(--color-white)/5 text-(--color-white)'
                          : 'border-(--color-border) bg-(--color-surface-2) text-(--color-muted) hover:border-(--color-subtle) hover:text-(--color-subtle)'
                      }`}
                    >
                      <Icon className="w-6 h-6" />
                      <span className="text-[11px] font-bold leading-tight">{type.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Messages & Actions */}
          <div className="flex flex-col gap-4">
            {message && (
              <div className={`p-4 rounded-xl text-sm flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 ${
                message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
                {message.type === 'success' ? <CheckCircleIcon className="w-5 h-5 flex-shrink-0" /> : <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0" />}
                {message.text}
              </div>
            )}
            
            <button
              onClick={handleSave}
              disabled={!isDirty || saving || usernameStatus === 'checking'}
              className="w-full bg-(--color-white) text-black font-bold py-4 rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : isDirty ? 'Save Changes' : 'All up to date'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
