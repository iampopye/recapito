'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { IMailbox, ISmtpProvider } from '@rio/shared';

export default function MailboxesPage() {
  const [mailboxes, setMailboxes] = useState<IMailbox[]>([]);
  const [smtpProviders, setSmtpProviders] = useState<ISmtpProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMailbox, setEditingMailbox] = useState<IMailbox | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    imapHost: '',
    imapPort: 993,
    imapSsl: true,
    imapUsername: '',
    imapPassword: '',
    smtpProviderId: '',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [mailboxesData, providersData] = await Promise.all([
        api.getMailboxes(),
        api.getSmtpProviders(),
      ]);
      setMailboxes(mailboxesData);
      setSmtpProviders(providersData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      if (editingMailbox) {
        const updateData: Record<string, unknown> = {};
        if (formData.email !== editingMailbox.email) updateData.email = formData.email;
        if (formData.imapHost !== editingMailbox.imapHost) updateData.imapHost = formData.imapHost;
        if (formData.imapPort !== editingMailbox.imapPort) updateData.imapPort = formData.imapPort;
        if (formData.imapSsl !== editingMailbox.imapSsl) updateData.imapSsl = formData.imapSsl;
        if (formData.imapUsername !== editingMailbox.imapUsername) updateData.imapUsername = formData.imapUsername;
        if (formData.imapPassword) updateData.imapPassword = formData.imapPassword;
        updateData.smtpProviderId = formData.smtpProviderId || null;

        await api.updateMailbox(editingMailbox.id, updateData);
      } else {
        await api.createMailbox({
          ...formData,
          smtpProviderId: formData.smtpProviderId || undefined,
        });
      }
      resetForm();
      loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save mailbox');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (mailbox: IMailbox) => {
    setEditingMailbox(mailbox);
    setFormData({
      email: mailbox.email,
      imapHost: mailbox.imapHost,
      imapPort: mailbox.imapPort,
      imapSsl: mailbox.imapSsl,
      imapUsername: mailbox.imapUsername,
      imapPassword: '',
      smtpProviderId: mailbox.smtpProviderId || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this mailbox?')) return;

    try {
      await api.deleteMailbox(id);
      loadData();
    } catch (err) {
      console.error('Failed to delete mailbox:', err);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingMailbox(null);
    setFormData({
      email: '',
      imapHost: '',
      imapPort: 993,
      imapSsl: true,
      imapUsername: '',
      imapPassword: '',
      smtpProviderId: '',
    });
    setFormError('');
  };

  const getProviderName = (providerId: string | null) => {
    if (!providerId) return 'None (use global settings)';
    const provider = smtpProviders.find((p) => p.id === providerId);
    return provider ? `${provider.name} (${provider.fromEmail})` : 'Unknown';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mailboxes</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          Add Mailbox
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingMailbox ? 'Edit Mailbox' : 'Add New Mailbox'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  IMAP Username
                </label>
                <input
                  type="text"
                  value={formData.imapUsername}
                  onChange={(e) => setFormData({ ...formData, imapUsername: e.target.value })}
                  className="input"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  IMAP Host
                </label>
                <input
                  type="text"
                  value={formData.imapHost}
                  onChange={(e) => setFormData({ ...formData, imapHost: e.target.value })}
                  className="input"
                  placeholder="imap.gmail.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  IMAP Port
                </label>
                <input
                  type="number"
                  value={formData.imapPort}
                  onChange={(e) => setFormData({ ...formData, imapPort: parseInt(e.target.value) })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SSL/TLS
                </label>
                <select
                  value={formData.imapSsl ? 'true' : 'false'}
                  onChange={(e) => setFormData({ ...formData, imapSsl: e.target.value === 'true' })}
                  className="input"
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                IMAP Password {editingMailbox && '(leave empty to keep current)'}
              </label>
              <input
                type="password"
                value={formData.imapPassword}
                onChange={(e) => setFormData({ ...formData, imapPassword: e.target.value })}
                className="input"
                required={!editingMailbox}
              />
              <p className="text-xs text-gray-500 mt-1">
                For Gmail, use an App Password. For Outlook, use your account password.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Outbound SMTP Provider
              </label>
              <select
                value={formData.smtpProviderId}
                onChange={(e) => setFormData({ ...formData, smtpProviderId: e.target.value })}
                className="input"
              >
                <option value="">None (use global settings)</option>
                {smtpProviders.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name} ({provider.type}) - {provider.fromEmail}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select an SMTP provider for sending outbound emails from this mailbox.
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button type="button" onClick={resetForm} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting} className="btn-primary">
                {isSubmitting ? 'Saving...' : editingMailbox ? 'Update Mailbox' : 'Add Mailbox'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : mailboxes.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">
          <p>No mailboxes configured.</p>
          <p className="mt-2">Add a mailbox to start receiving emails.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {mailboxes.map((mailbox) => (
            <div key={mailbox.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{mailbox.email}</p>
                  <p className="text-sm text-gray-500">
                    IMAP: {mailbox.imapHost}:{mailbox.imapPort}
                    {mailbox.imapSsl && ' (SSL)'}
                  </p>
                  <p className="text-sm text-gray-500">
                    SMTP: {getProviderName(mailbox.smtpProviderId)}
                  </p>
                  {mailbox.lastSyncAt && (
                    <p className="text-xs text-gray-400 mt-1">
                      Last synced: {new Date(mailbox.lastSyncAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-4">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      mailbox.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {mailbox.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    onClick={() => handleEdit(mailbox)}
                    className="text-primary-600 hover:text-primary-700 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(mailbox.id)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
