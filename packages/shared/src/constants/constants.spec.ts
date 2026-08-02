import {
  COMMON_IMAP_HOSTS,
  DEFAULT_IMAP_PORTS,
  DEFAULT_PAGE_SIZE,
  MAILGUN_EVENTS,
  MAX_PAGE_SIZE,
  MESSAGE_DIRECTIONS,
  OUTBOUND_STATUSES,
} from './index';

/**
 * These constants are a contract between three independently deployed
 * processes (backend, IMAP daemon, frontend) and, in the Mailgun case, an
 * external webhook payload. Their VALUES are the API -- changing a string here
 * silently breaks stored rows and in-flight webhooks, so the literals are
 * asserted explicitly rather than compared against themselves.
 */
describe('shared constants', () => {
  describe('pagination', () => {
    it('has a sane default below the maximum', () => {
      expect(DEFAULT_PAGE_SIZE).toBe(20);
      expect(MAX_PAGE_SIZE).toBe(100);
      expect(DEFAULT_PAGE_SIZE).toBeLessThan(MAX_PAGE_SIZE);
    });

    it('uses positive integers', () => {
      for (const value of [DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE]) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      }
    });
  });

  describe('MESSAGE_DIRECTIONS', () => {
    it('matches the database enum values', () => {
      expect(MESSAGE_DIRECTIONS).toEqual({
        INBOUND: 'inbound',
        OUTBOUND: 'outbound',
      });
    });
  });

  describe('OUTBOUND_STATUSES', () => {
    it('matches the database enum values', () => {
      expect(OUTBOUND_STATUSES).toEqual({
        QUEUED: 'queued',
        SENT: 'sent',
        DELIVERED: 'delivered',
        BOUNCED: 'bounced',
        FAILED: 'failed',
      });
    });

    it('has no duplicate values', () => {
      const values = Object.values(OUTBOUND_STATUSES);
      expect(new Set(values).size).toBe(values.length);
    });
  });

  describe('MAILGUN_EVENTS', () => {
    it('matches the event names Mailgun sends on its webhook', () => {
      expect(MAILGUN_EVENTS).toEqual({
        DELIVERED: 'delivered',
        BOUNCED: 'bounced',
        FAILED: 'failed',
        OPENED: 'opened',
        CLICKED: 'clicked',
      });
    });

    it('shares delivery-state names with OUTBOUND_STATUSES', () => {
      // The webhook handler maps these across directly; a divergence would
      // leave messages stuck in `queued` forever.
      for (const key of ['DELIVERED', 'BOUNCED', 'FAILED'] as const) {
        expect(MAILGUN_EVENTS[key]).toBe(OUTBOUND_STATUSES[key]);
      }
    });
  });

  describe('DEFAULT_IMAP_PORTS', () => {
    it('uses the IANA-assigned IMAP ports', () => {
      expect(DEFAULT_IMAP_PORTS.SSL).toBe(993);
      expect(DEFAULT_IMAP_PORTS.PLAIN).toBe(143);
    });
  });

  describe('COMMON_IMAP_HOSTS', () => {
    it('lists resolvable-looking hostnames, not URLs', () => {
      for (const host of Object.values(COMMON_IMAP_HOSTS)) {
        expect(host).not.toMatch(/^[a-z]+:\/\//);
        expect(host).not.toContain('/');
        expect(host).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/);
      }
    });

    it('pins the known provider endpoints', () => {
      expect(COMMON_IMAP_HOSTS).toEqual({
        GMAIL: 'imap.gmail.com',
        OUTLOOK: 'outlook.office365.com',
        YAHOO: 'imap.mail.yahoo.com',
      });
    });
  });
});
