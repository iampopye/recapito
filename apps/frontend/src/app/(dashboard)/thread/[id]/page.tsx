'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { MessageList } from '@/components/MessageList';
import { ReplyBox } from '@/components/ReplyBox';
import type { IThreadWithMessages, IMailbox } from '@rio/shared';

export default function ThreadPage() {
  const params = useParams();
  const router = useRouter();
  const threadId = params.id as string;

  const [thread, setThread] = useState<IThreadWithMessages | null>(null);
  const [mailboxes, setMailboxes] = useState<IMailbox[]>([]);
  const [defaultMailboxId, setDefaultMailboxId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadThread();
  }, [threadId]);

  const loadThread = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await api.getThread(threadId);
      setThread(data);
      await api.markThreadAsRead(threadId);

      // Load all mailboxes
      const allMailboxes = await api.getMailboxes();
      setMailboxes(allMailboxes);

      // Set default to the mailbox that received this thread
      setDefaultMailboxId(data.mailboxId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load thread');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReplySent = () => {
    loadThread();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className="card p-12 text-center">
        <p className="text-red-600">{error || 'Thread not found'}</p>
        <button onClick={() => router.push('/inbox')} className="btn-primary mt-4">
          Back to Inbox
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => router.push('/inbox')}
        className="text-gray-600 hover:text-gray-900 mb-4 inline-flex items-center"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Inbox
      </button>

      {mailboxes.length > 0 && (
        <ReplyBox
          threadId={thread.id}
          mailboxes={mailboxes}
          defaultMailboxId={defaultMailboxId}
          subject={thread.subject}
          participants={thread.participants}
          onSent={handleReplySent}
        />
      )}

      <div className="card mt-6">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">{thread.subject}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {thread.messageCount} message{thread.messageCount !== 1 ? 's' : ''} &middot;{' '}
            {thread.participants.slice(0, 3).join(', ')}
            {thread.participants.length > 3 && ` +${thread.participants.length - 3} more`}
          </p>
        </div>

        <MessageList messages={thread.messages} />
      </div>
    </div>
  );
}
