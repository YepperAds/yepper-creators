import HotDealsSection from '@/app/_components/home/HotDealsSection';
import type { HotDeal, PublicWebsite, PublicCreator } from '@/app/_lib/public-home';

const websites: PublicWebsite[] = [
  { id: 'w1', websiteName: 'Kigali Bites', websiteLink: 'https://example.com', imageUrl: null, businessCategories: ['food-beverage'], trafficTier: 'mid' },
];
const creators: PublicCreator[] = [
  { id: 1, username: 'chefke', name: 'Chef Ke', avatar: null, whatTheyDo: null, channelName: 'Chef Ke Kitchen', channelUrl: null, subscribers: 12400, totalViews: 200000, videos: [{ title: 'Cook with me', views: 1000, likes: 10, published_at: null, thumbnail: null, url: null }] },
];
const deals: HotDeal[] = [
  {
    id: 'd1',
    title: 'Reach every foodie in Kigali this week',
    description: null,
    businessCategory: 'food-beverage',
    coverImageUrl: null,
    status: 'active',
    totalPrice: 45000,
    items: [
      { id: 'i1', itemType: 'website', creatorId: null, slotType: null, durationBand: null, adType: null, websiteId: 'w1', categoryId: null, systemPrice: 30000, dealPrice: 20000 },
      { id: 'i2', itemType: 'youtube', creatorId: 1, slotType: null, durationBand: null, adType: null, websiteId: null, categoryId: null, systemPrice: 30000, dealPrice: 25000 },
    ],
  },
];

export default function DevHotDealPreview() {
  return (
    <div className="min-h-screen bg-[#0b0d12] p-8">
      <HotDealsSection deals={deals} websites={websites} creators={creators} />
    </div>
  );
}
