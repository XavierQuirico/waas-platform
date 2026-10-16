export type PortalNotification = {
  id: string;
  title: string;
  desc?: string;
  time: string;
  read: boolean;
  icon: string;
  href: string;
};

// Empty list — no notifications table yet
export async function getClientNotifications(
  _clientId: string,
): Promise<PortalNotification[]> {
  return [];
}
