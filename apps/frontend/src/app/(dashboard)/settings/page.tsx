'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { IMailgunSettings, ISmtpProvider, SmtpProviderType } from '@rio/shared';

const PROVIDER_TYPES: { value: SmtpProviderType; label: string }[] = [
  { value: 'mailgun', label: 'Mailgun' },
  { value: 'brevo', label: 'Brevo (Sendinblue)' },
  { value: 'smtp', label: 'Custom SMTP' },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'providers' | 'global'>('providers');

  // Global settings state
  const [isLoadingGlobal, setIsLoadingGlobal] = useState(true);
  const [isSavingGlobal, setIsSavingGlobal] = useState(false);
  const [globalMessage, setGlobalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [globalSettings, setGlobalSettings] = useState<Partial<IMailgunSettings>>({
    apiKey: '',
    domain: '',
    fromEmail: '',
    fromName: '',
    webhookSigningKey: '',
    baseUrl: 'https://api.mailgun.net',
  });

  // SMTP Providers state
  const [providers, setProviders] = useState<ISmtpProvider[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ISmtpProvider | null>(null);
  const [providerFormData, setProviderFormData] = useState({
    name: '',
    type: 'mailgun' as SmtpProviderType,
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
  const [providerFormError, setProviderFormError] = useState('');
  const [isSubmittingProvider, setIsSubmittingProvider] = useState(false);

  useEffect(() => {
    if (user?.isAdmin) {
      loadGlobalSettings();
      loadProviders();
    } else {
      setIsLoadingGlobal(false);
      setIsLoadingProviders(false);
    }
  }, [user]);

  const loadGlobalSettings = async () => {
    try {
      const data = await api.getMailgunSettings();
      setGlobalSettings({
        apiKey: data.apiKey || '',
        domain: data.domain || '',
        fromEmail: data.fromEmail || '',
        fromName: data.fromName || '',
        webhookSigningKey: data.webhookSigningKey || '',
        baseUrl: data.baseUrl || 'https://api.mailgun.net',
      });
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoadingGlobal(false);
    }
  };

  const loadProviders = async () => {
    setIsLoadingProviders(true);
    try {
      const data = await api.getSmtpProviders();
      setProviders(data);
    } catch (err) {
      console.error('Failed to load SMTP providers:', err);
    } finally {
      setIsLoadingProviders(false);
    }
  };

  const handleGlobalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGlobal(true);
    setGlobalMessage(null);

    try {
      await api.updateMailgunSettings(globalSettings);
      setGlobalMessage({ type: 'success', text: 'Settings saved successfully!' });
      loadGlobalSettings();
    } catch (err) {
      setGlobalMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save settings' });
    } finally {
      setIsSavingGlobal(false);
    }
  };

  const handleProviderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProviderFormError('');
    setIsSubmittingProvider(true);

    try {
      const payload: Record<string, unknown> = {
        name: providerFormData.name,
        type: providerFormData.type,
        fromEmail: providerFormData.fromEmail,
        fromName: providerFormData.fromName || undefined,
        isDefault: providerFormData.isDefault,
      };

      if (providerFormData.type === 'mailgun') {
        if (!editingProvider || providerFormData.mailgunApiKey) {
          payload.mailgunApiKey = providerFormData.mailgunApiKey;
        }
        payload.mailgunDomain = providerFormData.mailgunDomain;
        payload.mailgunBaseUrl = providerFormData.mailgunBaseUrl;
      } else if (providerFormData.type === 'brevo') {
        if (!editingProvider || providerFormData.brevoApiKey) {
          payload.brevoApiKey = providerFormData.brevoApiKey;
        }
      } else if (providerFormData.type === 'smtp') {
        payload.smtpHost = providerFormData.smtpHost;
        payload.smtpPort = providerFormData.smtpPort;
        payload.smtpSecure = providerFormData.smtpSecure;
        payload.smtpUsername = providerFormData.smtpUsername || undefined;
        if (!editingProvider || providerFormData.smtpPassword) {
          payload.smtpPassword = providerFormData.smtpPassword || undefined;
        }
      }

      if (editingProvider) {
        await api.updateSmtpProvider(editingProvider.id, payload);
      } else {
        await api.createSmtpProvider(payload as any);
      }

      resetProviderForm();
      loadProviders();
    } catch (err) {
      setProviderFormError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setIsSubmittingProvider(false);
    }
  };

  const handleEditProvider = (provider: ISmtpProvider) => {
    setEditingProvider(provider);
    setProviderFormData({
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
    setShowProviderForm(true);
  };

  const handleDeleteProvider = async (id: string) => {
    if (!confirm('Are you sure you want to delete this SMTP provider?')) return;

    try {
      await api.deleteSmtpProvider(id);
      loadProviders();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete provider');
    }
  };

  const resetProviderForm = () => {
    setShowProviderForm(false);
    setEditingProvider(null);
    setProviderFormData({
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
    setProviderFormError('');
  };

  const getProviderTypeLabel = (type: SmtpProviderType) => {
    return PROVIDER_TYPES.find((t) => t.value === type)?.label || type;
  };

  if (!user?.isAdmin) {
    return (
      <div className="card p-12 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600">You need admin privileges to access this page.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('providers')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'providers'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            SMTP Providers
          </button>
          <button
            onClick={() => setActiveTab('global')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'global'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Global Mailgun (Fallback)
          </button>
        </nav>
      </div>

      {/* SMTP Providers Tab */}
      {activeTab === 'providers' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600">
              Configure SMTP providers for sending outbound emails. Assign providers to specific mailboxes.
            </p>
            <button onClick={() => setShowProviderForm(true)} className="btn-primary">
              Add Provider
            </button>
          </div>

          {showProviderForm && (
            <div className="card p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">
                {editingProvider ? 'Edit SMTP Provider' : 'Add New SMTP Provider'}
              </h2>
              <form onSubmit={handleProviderSubmit} className="space-y-4">
                {providerFormError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {providerFormError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Provider Name</label>
                    <input
                      type="text"
                      value={providerFormData.name}
                      onChange={(e) => setProviderFormData({ ...providerFormData, name: e.target.value })}
                      className="input"
                      placeholder="My Mailgun Account"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Provider Type</label>
                    <select
                      value={providerFormData.type}
                      onChange={(e) => setProviderFormData({ ...providerFormData, type: e.target.value as SmtpProviderType })}
                      className="input"
                    >
                      {PROVIDER_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
                    <input
                      type="email"
                      value={providerFormData.fromEmail}
                      onChange={(e) => setProviderFormData({ ...providerFormData, fromEmail: e.target.value })}
                      className="input"
                      placeholder="noreply@yourdomain.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">From Name (optional)</label>
                    <input
                      type="text"
                      value={providerFormData.fromName}
                      onChange={(e) => setProviderFormData({ ...providerFormData, fromName: e.target.value })}
                      className="input"
                      placeholder="Your Company"
                    />
                  </div>
                </div>

                {/* Mailgun Settings */}
                {providerFormData.type === 'mailgun' && (
                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Mailgun Settings</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          API Key {editingProvider && '(leave empty to keep current)'}
                        </label>
                        <input
                          type="password"
                          value={providerFormData.mailgunApiKey}
                          onChange={(e) => setProviderFormData({ ...providerFormData, mailgunApiKey: e.target.value })}
                          className="input"
                          placeholder="key-xxxxxxxx"
                          required={!editingProvider}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
                        <input
                          type="text"
                          value={providerFormData.mailgunDomain}
                          onChange={(e) => setProviderFormData({ ...providerFormData, mailgunDomain: e.target.value })}
                          className="input"
                          placeholder="mg.yourdomain.com"
                          required
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
                      <select
                        value={providerFormData.mailgunBaseUrl}
                        onChange={(e) => setProviderFormData({ ...providerFormData, mailgunBaseUrl: e.target.value })}
                        className="input max-w-md"
                      >
                        <option value="https://api.mailgun.net">US Region (api.mailgun.net)</option>
                        <option value="https://api.eu.mailgun.net">EU Region (api.eu.mailgun.net)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Brevo Settings */}
                {providerFormData.type === 'brevo' && (
                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Brevo Settings</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        API Key {editingProvider && '(leave empty to keep current)'}
                      </label>
                      <input
                        type="password"
                        value={providerFormData.brevoApiKey}
                        onChange={(e) => setProviderFormData({ ...providerFormData, brevoApiKey: e.target.value })}
                        className="input"
                        placeholder="xkeysib-xxxxxxxx"
                        required={!editingProvider}
                      />
                    </div>
                  </div>
                )}

                {/* Custom SMTP Settings */}
                {providerFormData.type === 'smtp' && (
                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">SMTP Settings</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
                        <input
                          type="text"
                          value={providerFormData.smtpHost}
                          onChange={(e) => setProviderFormData({ ...providerFormData, smtpHost: e.target.value })}
                          className="input"
                          placeholder="smtp.example.com"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                        <input
                          type="number"
                          value={providerFormData.smtpPort}
                          onChange={(e) => setProviderFormData({ ...providerFormData, smtpPort: parseInt(e.target.value) || 587 })}
                          className="input"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Security</label>
                        <select
                          value={providerFormData.smtpSecure ? 'ssl' : 'tls'}
                          onChange={(e) => setProviderFormData({ ...providerFormData, smtpSecure: e.target.value === 'ssl' })}
                          className="input"
                        >
                          <option value="tls">STARTTLS (Port 587)</option>
                          <option value="ssl">SSL/TLS (Port 465)</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Username (optional)</label>
                        <input
                          type="text"
                          value={providerFormData.smtpUsername}
                          onChange={(e) => setProviderFormData({ ...providerFormData, smtpUsername: e.target.value })}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Password {editingProvider && '(leave empty to keep current)'}
                        </label>
                        <input
                          type="password"
                          value={providerFormData.smtpPassword}
                          onChange={(e) => setProviderFormData({ ...providerFormData, smtpPassword: e.target.value })}
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
                    checked={providerFormData.isDefault}
                    onChange={(e) => setProviderFormData({ ...providerFormData, isDefault: e.target.checked })}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isDefault" className="ml-2 text-sm text-gray-700">
                    Set as default provider
                  </label>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button type="button" onClick={resetProviderForm} className="btn-secondary">Cancel</button>
                  <button type="submit" disabled={isSubmittingProvider} className="btn-primary">
                    {isSubmittingProvider ? 'Saving...' : editingProvider ? 'Update Provider' : 'Add Provider'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {isLoadingProviders ? (
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
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-medium text-gray-900">{provider.name}</h3>
                        {provider.isDefault && (
                          <span className="px-2 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">Default</span>
                        )}
                        {!provider.isActive && (
                          <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">Inactive</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{getProviderTypeLabel(provider.type)} - {provider.fromEmail}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button onClick={() => handleEditProvider(provider)} className="text-sm text-primary-600 hover:text-primary-700">Edit</button>
                      <button onClick={() => handleDeleteProvider(provider.id)} className="text-sm text-red-600 hover:text-red-700">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Global Mailgun Tab */}
      {activeTab === 'global' && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Global Mailgun Configuration</h2>
          <p className="text-sm text-gray-600 mb-6">
            Fallback settings used when no SMTP provider is assigned to a mailbox.
          </p>

          {globalMessage && (
            <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${
              globalMessage.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {globalMessage.text}
            </div>
          )}

          {isLoadingGlobal ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <form onSubmit={handleGlobalSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                  <input
                    type="password"
                    value={globalSettings.apiKey}
                    onChange={(e) => setGlobalSettings({ ...globalSettings, apiKey: e.target.value })}
                    className="input"
                    placeholder="Enter new API key to update"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty to keep current key</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
                  <input
                    type="text"
                    value={globalSettings.domain}
                    onChange={(e) => setGlobalSettings({ ...globalSettings, domain: e.target.value })}
                    className="input"
                    placeholder="mg.yourdomain.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
                  <input
                    type="email"
                    value={globalSettings.fromEmail}
                    onChange={(e) => setGlobalSettings({ ...globalSettings, fromEmail: e.target.value })}
                    className="input"
                    placeholder="noreply@yourdomain.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
                  <input
                    type="text"
                    value={globalSettings.fromName}
                    onChange={(e) => setGlobalSettings({ ...globalSettings, fromName: e.target.value })}
                    className="input"
                    placeholder="Sales Team"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Webhook Signing Key</label>
                  <input
                    type="password"
                    value={globalSettings.webhookSigningKey}
                    onChange={(e) => setGlobalSettings({ ...globalSettings, webhookSigningKey: e.target.value })}
                    className="input"
                    placeholder="Enter new key to update"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Base URL</label>
                  <select
                    value={globalSettings.baseUrl}
                    onChange={(e) => setGlobalSettings({ ...globalSettings, baseUrl: e.target.value })}
                    className="input"
                  >
                    <option value="https://api.mailgun.net">US Region (api.mailgun.net)</option>
                    <option value="https://api.eu.mailgun.net">EU Region (api.eu.mailgun.net)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button type="submit" disabled={isSavingGlobal} className="btn-primary">
                  {isSavingGlobal ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
