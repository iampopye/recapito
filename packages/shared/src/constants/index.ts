export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const MESSAGE_DIRECTIONS = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
} as const;

export const OUTBOUND_STATUSES = {
  QUEUED: 'queued',
  SENT: 'sent',
  DELIVERED: 'delivered',
  BOUNCED: 'bounced',
  FAILED: 'failed',
} as const;

export const MAILGUN_EVENTS = {
  DELIVERED: 'delivered',
  BOUNCED: 'bounced',
  FAILED: 'failed',
  OPENED: 'opened',
  CLICKED: 'clicked',
} as const;

export const DEFAULT_IMAP_PORTS = {
  SSL: 993,
  PLAIN: 143,
} as const;

export const COMMON_IMAP_HOSTS = {
  GMAIL: 'imap.gmail.com',
  OUTLOOK: 'outlook.office365.com',
  YAHOO: 'imap.mail.yahoo.com',
} as const;
