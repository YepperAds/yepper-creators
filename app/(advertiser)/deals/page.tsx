import { getPublicHotDeals } from '@/app/_lib/public-home';
import DealsGrid from '../_components/DealsGrid';

export default async function DealsPage() {
  const deals = await getPublicHotDeals();
  return <DealsGrid deals={deals} />;
}
