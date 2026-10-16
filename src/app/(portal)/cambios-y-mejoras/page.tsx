import { getHubData } from './actions';
import { HubClient } from './HubClient';

interface Props {
  searchParams: Promise<{ proyecto?: string }>;
}

export default async function CambiosYMejorasPage({ searchParams }: Props) {
  const { proyecto } = await searchParams;
  const hubData = await getHubData(proyecto);

  return <HubClient hubData={hubData} />;
}
