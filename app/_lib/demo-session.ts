export interface DemoViewer {
  id: string;
  city: string;
  country: string;
  device: string;
  viewedAt: string;
  watchTime: string;
}

export interface DemoCampaign {
  id: string;
  channelName: string;
  channelSubscribers: number;
  videoTitle: string;
  packageName: string;
  paymentMethod: 'mobile_money' | 'card';
  amount: number;
  brandName: string;
  headline: string;
  description: string;
  destinationUrl: string;
  creativeImage: string;
  createdAt: string;
  views: number;
  likes: number;
  comments: number;
  clicks: number;
  viewers: DemoViewer[];
}

export interface DemoSession {
  version: 1;
  createdAt: string;
  campaigns: DemoCampaign[];
}

const SESSION_KEY = 'yepper_demo_session_v1';

function assertBrowser(): void {
  if (typeof window === 'undefined') {
    throw new Error('Demo data is only available in a browser session.');
  }
}

export function readDemoSession(): DemoSession | null {
  assertBrowser();
  const raw = window.sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  const session: unknown = JSON.parse(raw);
  if (
    !session ||
    typeof session !== 'object' ||
    (session as DemoSession).version !== 1 ||
    !Array.isArray((session as DemoSession).campaigns)
  ) {
    throw new Error('The saved demo session is invalid. Restart the demo to continue.');
  }
  return session as DemoSession;
}

export function writeDemoSession(session: DemoSession): void {
  assertBrowser();
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function startDemoSession(): DemoSession {
  const session: DemoSession = {
    version: 1,
    createdAt: new Date().toISOString(),
    campaigns: [],
  };
  writeDemoSession(session);
  return session;
}

export function ensureDemoSession(): DemoSession {
  return readDemoSession() ?? startDemoSession();
}

export function clearDemoSession(): void {
  assertBrowser();
  window.sessionStorage.removeItem(SESSION_KEY);
}
