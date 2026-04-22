import type {
  ILoginRequest,
  ILoginResponse,
  IRegisterRequest,
  IUser,
  IMailbox,
  ICreateMailboxRequest,
  IUpdateMailboxRequest,
  IThread,
  IThreadWithMessages,
  IPaginatedResponse,
  ISendMessageRequest,
  IMessage,
  IMailgunSettings,
  IUpdateMailgunSettingsRequest,
  ICreateUserRequest,
  IUpdateUserRequest,
  ISmtpProvider,
  ICreateSmtpProviderRequest,
  IUpdateSmtpProviderRequest,
  ThreadFolder,
  IFolderCounts,
  ILabel,
  IDraft,
  ICreateDraftRequest,
  IUpdateDraftRequest,
  ISignature,
  ICreateSignatureRequest,
  IUpdateSignatureRequest,
  IContact,
  ICreateContactRequest,
  IUpdateContactRequest,
  ITemplate,
  ICreateTemplateRequest,
  IUpdateTemplateRequest,
} from '@rio/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('token', token);
      } else {
        localStorage.removeItem('token');
      }
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const token = this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${API_URL}/api${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async login(data: ILoginRequest): Promise<ILoginResponse> {
    const result = await this.request<ILoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setToken(result.accessToken);
    return result;
  }

  async register(data: IRegisterRequest): Promise<ILoginResponse> {
    const result = await this.request<ILoginResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setToken(result.accessToken);
    return result;
  }

  async getMe(): Promise<IUser> {
    return this.request<IUser>('/auth/me');
  }

  logout() {
    this.setToken(null);
  }

  // Mailboxes
  async getMailboxes(): Promise<IMailbox[]> {
    return this.request<IMailbox[]>('/mailboxes');
  }

  async createMailbox(data: ICreateMailboxRequest): Promise<IMailbox> {
    return this.request<IMailbox>('/mailboxes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteMailbox(id: string): Promise<void> {
    await this.request(`/mailboxes/${id}`, { method: 'DELETE' });
  }

  // Threads
  async getThreads(
    page = 1,
    pageSize = 20,
    mailboxId?: string,
    folder?: ThreadFolder,
    search?: string,
  ): Promise<IPaginatedResponse<IThread>> {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (mailboxId) params.append('mailboxId', mailboxId);
    if (folder) params.append('folder', folder);
    if (search) params.append('search', search);
    return this.request<IPaginatedResponse<IThread>>(`/threads?${params}`);
  }

  async getThread(id: string): Promise<IThreadWithMessages> {
    return this.request<IThreadWithMessages>(`/threads/${id}`);
  }

  async markThreadAsRead(id: string): Promise<IThread> {
    return this.request<IThread>(`/threads/${id}/read`, { method: 'POST' });
  }

  async getFolderCounts(mailboxId?: string): Promise<IFolderCounts> {
    const params = new URLSearchParams();
    if (mailboxId) params.append('mailboxId', mailboxId);
    return this.request<IFolderCounts>(`/threads/counts?${params}`);
  }

  async moveThreadToFolder(id: string, folder: ThreadFolder): Promise<IThread> {
    return this.request<IThread>(`/threads/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ folder }),
    });
  }

  async toggleThreadStar(id: string): Promise<IThread> {
    return this.request<IThread>(`/threads/${id}/star`, { method: 'POST' });
  }

  async searchMessages(
    query: string,
    page = 1,
    pageSize = 20,
    mailboxId?: string,
  ): Promise<IPaginatedResponse<IMessage>> {
    const params = new URLSearchParams({
      q: query,
      page: String(page),
      pageSize: String(pageSize),
    });
    if (mailboxId) params.append('mailboxId', mailboxId);
    return this.request<IPaginatedResponse<IMessage>>(`/threads/search?${params}`);
  }

  // Messages
  async sendMessage(mailboxId: string, data: ISendMessageRequest): Promise<IMessage> {
    return this.request<IMessage>(`/mail/send/${mailboxId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Settings (Admin only)
  async getMailgunSettings(): Promise<Partial<IMailgunSettings>> {
    return this.request<Partial<IMailgunSettings>>('/settings/mailgun');
  }

  async updateMailgunSettings(data: IUpdateMailgunSettingsRequest): Promise<IMailgunSettings> {
    return this.request<IMailgunSettings>('/settings/mailgun', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Users (Admin only)
  async getUsers(): Promise<IUser[]> {
    return this.request<IUser[]>('/users');
  }

  async createUser(data: ICreateUserRequest): Promise<IUser> {
    return this.request<IUser>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(id: string, data: IUpdateUserRequest): Promise<IUser> {
    return this.request<IUser>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id: string): Promise<void> {
    await this.request(`/users/${id}`, { method: 'DELETE' });
  }

  // SMTP Providers
  async getSmtpProviders(): Promise<ISmtpProvider[]> {
    return this.request<ISmtpProvider[]>('/smtp-providers');
  }

  async getSmtpProvider(id: string): Promise<ISmtpProvider> {
    return this.request<ISmtpProvider>(`/smtp-providers/${id}`);
  }

  async createSmtpProvider(data: ICreateSmtpProviderRequest): Promise<ISmtpProvider> {
    return this.request<ISmtpProvider>('/smtp-providers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSmtpProvider(id: string, data: IUpdateSmtpProviderRequest): Promise<ISmtpProvider> {
    return this.request<ISmtpProvider>(`/smtp-providers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSmtpProvider(id: string): Promise<void> {
    await this.request(`/smtp-providers/${id}`, { method: 'DELETE' });
  }

  async testSmtpProvider(id: string, email: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/smtp-providers/${id}/test`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async testGlobalMailgun(email: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/mail/test', {
      method: 'POST',
      body: JSON.stringify({ to: email }),
    });
  }

  // Mailbox update
  async updateMailbox(id: string, data: IUpdateMailboxRequest): Promise<IMailbox> {
    return this.request<IMailbox>(`/mailboxes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Labels
  async getLabels(): Promise<ILabel[]> {
    return this.request<ILabel[]>('/labels');
  }

  async createLabel(data: { name: string; color?: string }): Promise<ILabel> {
    return this.request<ILabel>('/labels', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLabel(id: string, data: { name?: string; color?: string }): Promise<ILabel> {
    return this.request<ILabel>(`/labels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteLabel(id: string): Promise<void> {
    await this.request(`/labels/${id}`, { method: 'DELETE' });
  }

  async addLabelToThread(labelId: string, threadId: string): Promise<IThread> {
    return this.request<IThread>(`/labels/${labelId}/threads/${threadId}`, { method: 'POST' });
  }

  async removeLabelFromThread(labelId: string, threadId: string): Promise<IThread> {
    return this.request<IThread>(`/labels/${labelId}/threads/${threadId}`, { method: 'DELETE' });
  }

  async getThreadsByLabel(labelId: string): Promise<IThread[]> {
    return this.request<IThread[]>(`/labels/${labelId}/threads`);
  }

  // Drafts
  async getDrafts(): Promise<IDraft[]> {
    return this.request<IDraft[]>('/drafts');
  }

  async getScheduledDrafts(): Promise<IDraft[]> {
    return this.request<IDraft[]>('/drafts/scheduled');
  }

  async getDraft(id: string): Promise<IDraft> {
    return this.request<IDraft>(`/drafts/${id}`);
  }

  async createDraft(data: ICreateDraftRequest): Promise<IDraft> {
    return this.request<IDraft>('/drafts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDraft(id: string, data: IUpdateDraftRequest): Promise<IDraft> {
    return this.request<IDraft>(`/drafts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteDraft(id: string): Promise<void> {
    await this.request(`/drafts/${id}`, { method: 'DELETE' });
  }

  // Signatures
  async getSignatures(): Promise<ISignature[]> {
    return this.request<ISignature[]>('/signatures');
  }

  async getDefaultSignature(): Promise<ISignature | null> {
    return this.request<ISignature | null>('/signatures/default');
  }

  async createSignature(data: ICreateSignatureRequest): Promise<ISignature> {
    return this.request<ISignature>('/signatures', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSignature(id: string, data: IUpdateSignatureRequest): Promise<ISignature> {
    return this.request<ISignature>(`/signatures/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSignature(id: string): Promise<void> {
    await this.request(`/signatures/${id}`, { method: 'DELETE' });
  }

  // Contacts
  async getContacts(search?: string): Promise<IContact[]> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    return this.request<IContact[]>(`/contacts?${params}`);
  }

  async getFavoriteContacts(): Promise<IContact[]> {
    return this.request<IContact[]>('/contacts/favorites');
  }

  async getFrequentContacts(limit = 10): Promise<IContact[]> {
    return this.request<IContact[]>(`/contacts/frequent?limit=${limit}`);
  }

  async createContact(data: ICreateContactRequest): Promise<IContact> {
    return this.request<IContact>('/contacts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateContact(id: string, data: IUpdateContactRequest): Promise<IContact> {
    return this.request<IContact>(`/contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteContact(id: string): Promise<void> {
    await this.request(`/contacts/${id}`, { method: 'DELETE' });
  }

  async toggleContactFavorite(id: string): Promise<IContact> {
    return this.request<IContact>(`/contacts/${id}/favorite`, { method: 'POST' });
  }

  // Templates
  async getTemplates(): Promise<ITemplate[]> {
    return this.request<ITemplate[]>('/templates');
  }

  async getTemplate(id: string): Promise<ITemplate> {
    return this.request<ITemplate>(`/templates/${id}`);
  }

  async createTemplate(data: ICreateTemplateRequest): Promise<ITemplate> {
    return this.request<ITemplate>('/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTemplate(id: string, data: IUpdateTemplateRequest): Promise<ITemplate> {
    return this.request<ITemplate>(`/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.request(`/templates/${id}`, { method: 'DELETE' });
  }

  async useTemplate(id: string): Promise<ITemplate> {
    return this.request<ITemplate>(`/templates/${id}/use`, { method: 'POST' });
  }
}

export const api = new ApiClient();
