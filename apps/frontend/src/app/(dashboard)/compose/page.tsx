'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { IMailbox } from '@imark/shared';

export default function ComposePage() {
  const [mailboxes, setMailboxes] = useState<IMailbox[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMailboxId, setSelectedMailboxId] = useState('');
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadMailboxes();
  }, []);

  const loadMailboxes = async () => {
    try {
      const data = await api.getMailboxes();
      setMailboxes(data);
      if (data.length > 0) {
        setSelectedMailboxId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load mailboxes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMailboxId || !to || !subject) return;

    setIsSending(true);
    setResult(null);

    try {
      // Parse recipients
      const toAddresses = to.split(',').map(email => email.trim()).filter(Boolean);
      const ccAddresses = cc ? cc.split(',').map(email => email.trim()).filter(Boolean) : undefined;

      await api.sendMessage(selectedMailboxId, {
        to: toAddresses,
        cc: ccAddresses,
        subject,
        bodyText: body,
        bodyHtml: `<p>${body.replace(/\n/g, '<br>')}</p>`,
      });

      setResult({ success: true, message: 'Email sent successfully!' });

      // Clear form
      setTo('');
      setCc('');
      setSubject('');
      setBody('');
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to send email',
      });
    } finally {
      setIsSending(false);
    }
  };

  const selectedMailbox = mailboxes.find(m => m.id === selectedMailboxId);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Compose Email</h1>

      <div className="card p-6 max-w-2xl">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : mailboxes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No mailboxes configured.</p>
            <p className="mt-2 text-sm">
              Go to <a href="/mailboxes" className="text-primary-600 hover:underline">Mailboxes</a> to add a mailbox first.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From
              </label>
              <select
                value={selectedMailboxId}
                onChange={(e) => setSelectedMailboxId(e.target.value)}
                className="input"
                required
              >
                {mailboxes.map((mailbox) => (
                  <option key={mailbox.id} value={mailbox.id}>
                    {mailbox.email}
                  </option>
                ))}
              </select>
              {selectedMailbox && (
                <p className="text-xs text-gray-500 mt-1">
                  Sending via: {selectedMailbox.smtpProviderId ? 'Assigned SMTP Provider' : 'Global Mailgun'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To
              </label>
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="input"
                placeholder="recipient@example.com"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Separate multiple emails with commas
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CC (optional)
              </label>
              <input
                type="text"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                className="input"
                placeholder="cc@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="input"
                placeholder="Email subject"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="input min-h-[200px]"
                placeholder="Type your message here..."
                required
              />
            </div>

            {result && (
              <div
                className={`p-4 rounded-lg ${
                  result.success
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}
              >
                <div className="flex items-start">
                  <span className="mr-2">{result.success ? '✓' : '✗'}</span>
                  <span>{result.message}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSending || !selectedMailboxId || !to || !subject || !body}
              className="btn-primary w-full"
            >
              {isSending ? 'Sending...' : 'Send Email'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
