'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { IMailbox } from '@rio/shared';

interface ReplyBoxProps {
  threadId: string;
  mailboxes: IMailbox[];
  defaultMailboxId: string;
  subject: string;
  participants: string[];
  onSent: () => void;
}

export function ReplyBox({
  threadId,
  mailboxes,
  defaultMailboxId,
  subject,
  participants,
  onSent,
}: ReplyBoxProps) {
  const [selectedMailboxId, setSelectedMailboxId] = useState(defaultMailboxId);
  const [to, setTo] = useState(participants.join(', '));
  const [cc, setCc] = useState('');
  const [body, setBody] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCc, setShowCc] = useState(false);

  const selectedMailbox = mailboxes.find(m => m.id === selectedMailboxId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const toAddresses = to
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean);
      const ccAddresses = cc
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean);

      await api.sendMessage(selectedMailboxId, {
        threadId,
        to: toAddresses,
        cc: ccAddresses.length > 0 ? ccAddresses : undefined,
        subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
        bodyText: body,
      });

      setBody('');
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Reply</h3>

      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <select
            value={selectedMailboxId}
            onChange={(e) => setSelectedMailboxId(e.target.value)}
            className="input text-sm"
          >
            {mailboxes.map((mailbox) => (
              <option key={mailbox.id} value={mailbox.id}>
                {mailbox.email}
              </option>
            ))}
          </select>
          {selectedMailbox && (
            <p className="text-xs text-gray-400 mt-1">
              via {selectedMailbox.smtpProviderId ? 'SMTP Provider' : 'Global Mailgun'}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="input text-sm"
            required
          />
        </div>

        {showCc ? (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cc</label>
            <input
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              className="input text-sm"
              placeholder="email@example.com, ..."
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowCc(true)}
            className="text-xs text-primary-600 hover:text-primary-700"
          >
            + Add Cc
          </button>
        )}

        <div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="input text-sm min-h-[120px]"
            placeholder="Type your reply..."
            required
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary text-sm"
          >
            {isLoading ? 'Sending...' : 'Send Reply'}
          </button>
        </div>
      </form>
    </div>
  );
}
