export interface User {
  _id?: string;
  id?: string;
  userId?: string;
  email?: string;
  name?: string;
  avatar?: string;
  fullname?: string;
  user_uuid?: string;
  [key: string]: unknown;
}

export interface Ad {
  _id: string;
  businessName: string;
  adDescription?: string;
  businessLocation?: string;
  businessLink?: string;
  businessCategories?: string[];
  businessCategoryOther?: string;
  videoUrl?: string;
  imageUrl?: string;
  views?: number;
  clicks?: number;
  type?: string;
  url?: string;
  websiteSelections?: WebsiteSelection[];
  websiteStatuses?: WebsiteStatus[];
}

export interface WebsiteSelection {
  websiteId: string | { _id: string };
  status?: string;
  isRejected?: boolean;
  categories?: Category[];
}

export interface WebsiteStatus {
  websiteId: string;
  status?: string;
  categories?: Category[];
}

export interface Website {
  _id: string;
  websiteName: string;
  websiteLink: string;
  imageUrl?: string;
  categories?: Category[];
  businessCategories?: string[];
  websiteSelections?: unknown[];
  monthlyTraffic?: number;
}

export interface Category {
  _id: string;
  categoryName: string;
  description: string;
  price: number;
  tier: string;
  isFullyBooked?: boolean;
}

export interface WalletData {
  amount?: number;
  balance?: number;
  totalEarned?: number;
  byDay?: Record<string, number>;
  paymentAmount?: number;
  hasWallet?: boolean;
}

export interface PaymentBreakdown {
  totalCost: number;
  walletBalance: number;
  availableRefunds: number;
  paidFromWallet: number;
  paidFromRefunds: number;
  needsExternalPayment: number;
  canAffordAll: boolean;
  isReassignment: boolean;
  paymentRestrictions: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface FlutterwaveConfig {
  public_key: string;
  tx_ref: string;
  amount: number;
  currency: string;
  payment_options?: string;
  customer?: { email: string; name?: string };
  customizations?: { title?: string; description?: string; logo?: string };
  callback?: (data: FlutterwaveCallbackData) => void;
  onclose?: () => void;
}

export interface FlutterwaveCallbackData {
  status: string;
  transaction_id: number;
  tx_ref: string;
}

declare global {
  interface Window {
    FlutterwaveCheckout: (config: FlutterwaveConfig) => { close: () => void };
  }
}
