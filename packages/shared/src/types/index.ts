// User types
export interface IUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILoginRequest {
  email: string;
  password: string;
}

export interface ILoginResponse {
  accessToken: string;
  user: Omit<IUser, 'createdAt' | 'updatedAt'>;
}

export interface IRegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface ICreateUserRequest {
  email: string;
  password: string;
  name: string;
  isAdmin?: boolean;
}

export interface IUpdateUserRequest {
  email?: string;
  password?: string;
  name?: string;
  isAdmin?: boolean;
}

// Settings types
export interface IMailgunSettings {
  apiKey: string;
  domain: string;
  fromEmail: string;
  fromName: string;
  webhookSigningKey: string;
  baseUrl: string;
}

export interface IUpdateMailgunSettingsRequest {
  apiKey?: string;
  domain?: string;
  fromEmail?: string;
  fromName?: string;
  webhookSigningKey?: string;
  baseUrl?: string;
}

// SMTP Provider types
export type SmtpProviderType = 'mailgun' | 'brevo' | 'smtp';

export interface ISmtpProvider {
  id: string;
  userId: string;
  name: string;
  type: SmtpProviderType;
  fromEmail: string;
  fromName: string | null;
  // Mailgun settings (masked in response)
  mailgunApiKey: string | null;
  mailgunDomain: string | null;
  mailgunBaseUrl: string | null;
  // Brevo settings (masked in response)
  brevoApiKey: string | null;
  // SMTP settings
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUsername: string | null;
  smtpPassword: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateSmtpProviderRequest {
  name: string;
  type: SmtpProviderType;
  fromEmail: string;
  fromName?: string;
  // Mailgun settings
  mailgunApiKey?: string;
  mailgunDomain?: string;
  mailgunBaseUrl?: string;
  // Brevo settings
  brevoApiKey?: string;
  // SMTP settings
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUsername?: string;
  smtpPassword?: string;
  isDefault?: boolean;
}

export interface IUpdateSmtpProviderRequest {
  name?: string;
  type?: SmtpProviderType;
  fromEmail?: string;
  fromName?: string;
  // Mailgun settings
  mailgunApiKey?: string;
  mailgunDomain?: string;
  mailgunBaseUrl?: string;
  // Brevo settings
  brevoApiKey?: string;
  // SMTP settings
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUsername?: string;
  smtpPassword?: string;
  isActive?: boolean;
  isDefault?: boolean;
}

// Mailbox types
export interface IMailbox {
  id: string;
  userId: string;
  email: string;
  imapHost: string;
  imapPort: number;
  imapSsl: boolean;
  imapUsername: string;
  isActive: boolean;
  smtpProviderId: string | null;
  smtpProvider?: ISmtpProvider | null;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateMailboxRequest {
  email: string;
  imapHost: string;
  imapPort: number;
  imapSsl: boolean;
  imapUsername: string;
  imapPassword: string;
  smtpProviderId?: string;
}

export interface IUpdateMailboxRequest {
  email?: string;
  imapHost?: string;
  imapPort?: number;
  imapSsl?: boolean;
  imapUsername?: string;
  imapPassword?: string;
  smtpProviderId?: string | null;
  isActive?: boolean;
}

// Thread types
export type ThreadFolder = 'inbox' | 'sent' | 'spam' | 'trash' | 'archive' | 'drafts' | 'snoozed';
export type ThreadPriority = 'low' | 'normal' | 'high';

export interface ILabel {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IThread {
  id: string;
  mailboxId: string;
  subject: string;
  participants: string[];
  lastMessageAt: Date;
  messageCount: number;
  isRead: boolean;
  isStarred: boolean;
  folder: ThreadFolder;
  priority: ThreadPriority;
  snoozedUntil: Date | null;
  labels?: ILabel[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IFolderCounts {
  inbox: number;
  sent: number;
  spam: number;
  trash: number;
  archive: number;
  drafts: number;
  snoozed: number;
  unread: number;
}

export interface IThreadWithMessages extends IThread {
  messages: IMessage[];
}

// Message types
export type MessageDirection = 'inbound' | 'outbound';

export interface IMessage {
  id: string;
  threadId: string;
  mailboxId: string;
  messageId: string; // Email Message-ID header
  inReplyTo: string | null;
  direction: MessageDirection;
  fromAddress: string;
  fromName: string | null;
  toAddresses: string[];
  ccAddresses: string[];
  subject: string;
  bodyText: string | null;
  bodyHtml: string | null;
  receivedAt: Date;
  createdAt: Date;
}

export interface ISendMessageRequest {
  threadId?: string;
  to: string[];
  cc?: string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
}

// Outbound log types
export type OutboundStatus = 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed';

export interface IOutboundLog {
  id: string;
  messageId: string;
  mailgunId: string | null;
  status: OutboundStatus;
  statusDetails: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Mailgun webhook types
export type MailgunEventType = 'delivered' | 'bounced' | 'failed' | 'opened' | 'clicked';

export interface IMailgunWebhookEvent {
  event: MailgunEventType;
  timestamp: number;
  messageId: string;
  recipient: string;
  reason?: string;
}

// API Response types
export interface IApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface IPaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Pagination request
export interface IPaginationQuery {
  page?: number;
  pageSize?: number;
}

// Draft types
export interface IDraft {
  id: string;
  mailboxId: string;
  threadId: string | null;
  inReplyTo: string | null;
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];
  subject: string;
  bodyText: string | null;
  bodyHtml: string | null;
  scheduledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateDraftRequest {
  mailboxId: string;
  threadId?: string;
  inReplyTo?: string;
  toAddresses?: string[];
  ccAddresses?: string[];
  bccAddresses?: string[];
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  scheduledAt?: string;
}

export interface IUpdateDraftRequest {
  toAddresses?: string[];
  ccAddresses?: string[];
  bccAddresses?: string[];
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  scheduledAt?: string | null;
}

// Signature types
export interface ISignature {
  id: string;
  userId: string;
  name: string;
  content: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateSignatureRequest {
  name: string;
  content: string;
  isDefault?: boolean;
}

export interface IUpdateSignatureRequest {
  name?: string;
  content?: string;
  isDefault?: boolean;
}

// Contact types
export interface IContact {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  notes: string | null;
  avatarUrl: string | null;
  isFavorite: boolean;
  lastContactedAt: Date | null;
  contactCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateContactRequest {
  email: string;
  name?: string;
  company?: string;
  phone?: string;
  notes?: string;
}

export interface IUpdateContactRequest {
  name?: string;
  company?: string;
  phone?: string;
  notes?: string;
  isFavorite?: boolean;
}

// Template types
export interface ITemplate {
  id: string;
  userId: string;
  name: string;
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  shortcut: string;
  useCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateTemplateRequest {
  name: string;
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  shortcut?: string;
}

export interface IUpdateTemplateRequest {
  name?: string;
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  shortcut?: string;
}
