'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import WhatsAppReportsSettings from './WhatsAppReportsSettings';

export default function WhatsAppReportsSetupPrompt() {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (searchParams.get('whatsappSetup') !== '1') return null;

  const close = () => router.replace('/', { scroll: false });
  return (
    <WhatsAppReportsSettings
      mode="prompt"
      onClose={close}
      onSaved={close}
    />
  );
}
