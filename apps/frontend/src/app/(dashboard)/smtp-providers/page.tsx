'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { ISmtpProvider, SmtpProviderType } from '@rio/shared';

const PROVIDER_TYPES: { value: SmtpProviderType; label: string }[] = [
  { value: 'mailgun', label: 'Mailgun' },
  { value: 'brevo', label: 'Brevo (Sendinblue)' },
  { value: 'smtp', label: 'Custom SMTP' },
];

export default function SmtpProvidersPage() {
  const [providers, setProviders] = useState<ISmtpProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ISmtpProvider | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'mailgun' as SmtpProviderType,
    fromEmail: '',
    fromName: '',
    // Mailgun
    mailgunApiKey: '',
    mailgunDomain: '',
    mailgunBaseUrl: 'https://api.mailgun.net',
    // Brevo
    brevoApiKey: '',
    // SMTP
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    smtpUsername: '',
    smtpPassword: '',
    isDefault: false,
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    setIsLoading(true);
    try {
      const data = await api.getSmtpProviders();
      setProviders(data);
    } catch (err) {
      console.error('Failed to load SMTP providers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        name: formData.name,
        type: formData.type,
        fromEmail: formData.fromEmail,
        fromName: formData.fromName || undefined,
        isDefault: formData.isDefault,
      };

      // Add type-specific fields
      if (formData.type === 'mailgun') {
        if (!editingProvider || formData.mailgunApiKey) {
          payload.mailgunApiKey = formData.mailgunApiKey;
        }
        payload.mailgunDomain = formData.mailgunDomain;
        payload.mailgunBaseUrl = formData.mailgunBaseUrl;
      } else if (formData.type === 'brevo') {
        if (!editingProvider || formData.brevoApiKey) {
          payload.brevoApiKey = formData.brevoApiKey;
        }
      } else if (formData.type === 'smtp') {
        payload.smtpHost = formData.smtpHost;
        payload.smtpPort = formData.smtpPort;
        payload.smtpSecure = formData.smtpSecure;
        payload.smtpUsername = formData.smtpUsername || undefined;
        if (!editingProvider || formData.smtpPassword) {
          payload.smtpPassword = formData.smtpPassword || undefined;
        }
      }

      if (editingProvider) {
        await api.updateSmtpProvider(editingProvider.id, payload);
      } else {
        await api.createSmtpProvider(payload as any);
      }

      resetForm();
      loadProviders();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (provider: ISmtpProvider) => {
    setEditingProvider(provider);
    setFormData({
      name: provider.name,
      type: provider.type,
      fromEmail: provider.fromEmail,
      fromName: provider.fromName || '',
      mailgunApiKey: '',
      mailgunDomain: provider.mailgunDomain || '',
      mailgunBaseUrl: provider.mailgunBaseUrl || 'https://api.mailgun.net',
      brevoApiKey: '',
      smtpHost: provider.smtpHost || '',
      smtpPort: provider.smtpPort || 587,
      smtpSecure: provider.smtpSecure,
      smtpUsername: provider.smtpUsername || '',
      smtpPassword: '',
      isDefault: provider.isDefault,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this SMTP provider?')) return;

    try {
      await api.deleteSmtpProvider(id);
      loadProviders();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete provider');
    }
  };

  const handleTest = async (providerId: string) => {
    if (!testEmail) {
      alert('Please enter a test email address');
      return;
    }

    setTestingId(providerId);
    setTestResult(null);

    try {
      const result = await api.testSmtpProvider(providerId, testEmail);
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Test failed',
      });
    } finally {
      setTestingId(null);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingProvider(null);
    setFormData({
      name: '',
      type: 'mailgun',
      fromEmail: '',
      fromName: '',
      mailgunApiKey: '',
      mailgunDomain: '',
      mailgunBaseUrl: 'https://api.mailgun.net',
      brevoApiKey: '',
      smtpHost: '',
      smtpPort: 587,
      smtpSecure: false,
      smtpUsername: '',
      smtpPassword: '',
      isDefault: false,
    });
    setFormError('');
  };

  const getProviderTypeLabel = (type: SmtpProviderType) => {
    return PROVIDER_TYPES.find((t) => t.value === type)?.label || type;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">SMTP Providers</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          Add Provider
        </button>
      </div>

      {/* Test Email Input */}
      <div className="card p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Test Email Address (for testing providers)
        </label>
        <input
          type="email"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          placeholder="test@example.com"
          className="input max-w-md"
        />
        {testResult && (
          <div
            className={`mt-2 p-3 rounded-lg text-sm ${
              testResult.success
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {testResult.message}
          </div>
        )}
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingProvider ? 'Edit SMTP Provider' : 'Add New SMTP Provider'}
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
                  Provider Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="My Mailgun Account"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Provider Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as SmtpProviderType })}
                  className="input"
                >
                  {PROVIDER_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Email
                </label>
                <input
                  type="email"
                  value={formData.fromEmail}
                  onChange={(e) => setFormData({ ...formData, fromEmail: e.target.value })}
                  className="input"
                  placeholder="noreply@yourdomain.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Name (optional)
                </label>
                <input
                  type="text"
                  value={formData.fromName}
                  onChange={(e) => setFormData({ ...formData, fromName: e.target.value })}
                  className="input"
                  placeholder="Your Company"
                />
              </div>
            </div>

            {/* Mailgun Settings */}
            {formData.type === 'mailgun' && (
              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Mailgun Settings</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      API Key {editingProvider && '(leave empty to keep current)'}
                    </label>
                    <input
                      type="password"
                      value={formData.mailgunApiKey}
                      onChange={(e) => setFormData({ ...formData, mailgunApiKey: e.target.value })}
                      className="input"
                      placeholder="key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      required={!editingProvider}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Domain
                    </label>
                    <input
                      type="text"
                      value={formData.mailgunDomain}
                      onChange={(e) => setFormData({ ...formData, mailgunDomain: e.target.value })}
                      className="input"
                      placeholder="mg.yourdomain.com"
                      required
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Base URL
                  </label>
                  <select
                    value={formData.mailgunBaseUrl}
                    onChange={(e) => setFormData({ ...formData, mailgunBaseUrl: e.target.value })}
                    className="input max-w-md"
                  >
                    <option value="https://api.mailgun.net">US Region (api.mailgun.net)</option>
                    <option value="https://api.eu.mailgun.net">EU Region (api.eu.mailgun.net)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Brevo Settings */}
            {formData.type === 'brevo' && (
              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Brevo Settings</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key {editingProvider && '(leave empty to keep current)'}
                  </label>
                  <input
                    type="password"
                    value={formData.brevoApiKey}
                    onChange={(e) => setFormData({ ...formData, brevoApiKey: e.target.value })}
                    className="input"
                    placeholder="xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    required={!editingProvider}
                  />
                </div>
              </div>
            )}

            {/* Custom SMTP Settings */}
            {formData.type === 'smtp' && (
              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">SMTP Settings</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SMTP Host
                    </label>
                    <input
                      type="text"
                      value={formData.smtpHost}
                      onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
                      className="input"
                      placeholder="smtp.example.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Port
                    </label>
                    <input
                      type="number"
                      value={formData.smtpPort}
                      onChange={(e) => setFormData({ ...formData, smtpPort: parseInt(e.target.value) || 587 })}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Security
                    </label>
                    <select
                      value={formData.smtpSecure ? 'ssl' : 'tls'}
                      onChange={(e) => setFormData({ ...formData, smtpSecure: e.target.value === 'ssl' })}
                      className="input"
                    >
                      <option value="tls">STARTTLS (Port 587)</option>
                      <option value="ssl">SSL/TLS (Port 465)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Username (optional)
                    </label>
                    <input
                      type="text"
                      value={formData.smtpUsername}
                      onChange={(e) => setFormData({ ...formData, smtpUsername: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password {editingProvider && '(leave empty to keep current)'}
                    </label>
                    <input
                      type="password"
                      value={formData.smtpPassword}
                      onChange={(e) => setFormData({ ...formData, smtpPassword: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isDefault"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="isDefault" className="ml-2 text-sm text-gray-700">
                Set as default provider
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button type="button" onClick={resetForm} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting} className="btn-primary">
                {isSubmitting ? 'Saving...' : editingProvider ? 'Update Provider' : 'Add Provider'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : providers.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">
          <p>No SMTP providers configured.</p>
          <p className="mt-2 text-sm">Add a provider to start sending emails.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {providers.map((provider) => (
            <div key={provider.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-medium text-gray-900">{provider.name}</h3>
                      {provider.isDefault && (
                        <span className="px-2 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">
                          Default
                        </span>
                      )}
                      {!provider.isActive && (
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {getProviderTypeLabel(provider.type)} - {provider.fromEmail}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleTest(provider.id)}
                    disabled={testingId === provider.id || !testEmail}
                    className="text-sm text-primary-600 hover:text-primary-700 disabled:text-gray-400"
                  >
                    {testingId === provider.id ? 'Testing...' : 'Test'}
                  </button>
                  <button
                    onClick={() => handleEdit(provider)}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(provider.id)}
                    className="text-sm text-red-600 hover:text-red-700"
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
