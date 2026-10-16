import { notFound } from 'next/navigation';
import { getTicketDetail } from '../actions';
import { TicketDetailClient } from './TicketDetailClient';

interface Props {
  params: Promise<{ ticketNumber: string }>;
}

export default async function TicketDetailPage({ params }: Props) {
  const { ticketNumber } = await params;
  const ticket = await getTicketDetail(ticketNumber);

  if (!ticket) notFound();

  return <TicketDetailClient ticket={ticket} />;
}
