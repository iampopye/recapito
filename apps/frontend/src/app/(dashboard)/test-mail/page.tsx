'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { ISmtpProvider, IMailgunSettings } from '@rio/shared';

interface SendOption {
  id: string;
  name: string;
  type: string;
  fromEmail: string;
}

export default function TestMailPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [sendOptions, setSendOptions] = useState<SendOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadSendOptions();
  }, [user]);

  const loadSendOptions = async () => {
    try {
      const options: SendOption[] = [];

      // Load SMTP providers
      const providers = await api.getSmtpProviders();
      providers.forEach(p => {
        options.push({
          id: p.id,
          name: p.name + (p.isDefault ? ' (Default)' : ''),
          type: p.type.charAt(0).toUpperCase() + p.type.slice(1),
          fromEmail: p.fromEmail,
        });
      });

      // Load Global Mailgun if admin
      if (user?.isAdmin) {
        try {
          const settings = await api.getMailgunSettings();
          if (settings.apiKey && settings.domain && settings.fromEmail) {
            options.push({
              id: 'global-mailgun',
              name: 'Global Mailgun (Fallback)',
              type: 'Mailgun',
              fromEmail: settings.fromEmail,
            });
          }
        } catch (err) {
          console.error('Failed to load global Mailgun settings:', err);
        }
      }

      setSendOptions(options);

      // Auto-select first option
      if (options.length > 0) {
        setSelectedOptionId(options[0].id);
      }
    } catch (err) {
      console.error('Failed to load send options:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOptionId || !recipientEmail) return;

    setIsSending(true);
    setResult(null);

    try {
      let response: { success: boolean; message: string };

      if (selectedOptionId === 'global-mailgun') {
        response = await api.testGlobalMailgun(recipientEmail);
      } else {
        response = await api.testSmtpProvider(selectedOptionId, recipientEmail);
      }

      setResult(response);
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to send test email',
      });
    } finally {
      setIsSending(false);
    }
  };

  const selectedOption = sendOptions.find(o => o.id === selectedOptionId);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Test Mail</h1>

      <div className="card p-6 max-w-xl">
        <p className="text-sm text-gray-600 mb-6">
          Send a test email to verify your SMTP configuration is working.
        </p>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : sendOptions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No email sending options configured.</p>
            <p className="mt-2 text-sm">
              Go to <a href="/settings" className="text-primary-600 hover:underline">Settings</a> to configure Global Mailgun or add an SMTP provider.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSendTest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Send From
              </label>
              <select
                value={selectedOptionId}
                onChange={(e) => setSelectedOptionId(e.target.value)}
                className="input"
                required
              >
                {sendOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} - {option.fromEmail}
                  </option>
                ))}
              </select>
            </div>

            {selectedOption && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="grid grid-cols-2 gap-2 text-gray-600">
                  <span>Type:</span>
                  <span className="font-medium text-gray-900">{selectedOption.type}</span>
                  <span>From:</span>
                  <span className="font-medium text-gray-900">{selectedOption.fromEmail}</span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Send To
              </label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="input"
                placeholder="your-email@example.com"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter your email to receive the test.
              </p>
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
              disabled={isSending || !selectedOptionId || !recipientEmail}
              className="btn-primary w-full"
            >
              {isSending ? 'Sending...' : 'Send Test Email'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
