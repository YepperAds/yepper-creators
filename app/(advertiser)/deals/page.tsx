import { getPublicHotDeals, getPublicWebsites, getPublicCreators } from '@/app/_lib/public-home';
import DealsGrid from '../_components/DealsGrid';

export default async function DealsPage() {
  const [deals, websites, creators] = await Promise.all([
    getPublicHotDeals(),
    getPublicWebsites(),
    getPublicCreators(),
  ]);
  return <DealsGrid deals={deals} websites={websites} creators={creators} />;
}
