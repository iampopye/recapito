'use client';

import type { IMessage } from '@rio/shared';

interface MessageListProps {
  messages: IMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="divide-y divide-gray-200">
      {messages.map((message) => (
        <div key={message.id} className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-medium text-gray-900">
                {message.fromName || message.fromAddress}
                {message.direction === 'outbound' && (
                  <span className="ml-2 text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">
                    Sent
                  </span>
                )}
              </p>
              <p className="text-sm text-gray-500">
                To: {message.toAddresses.join(', ')}
                {message.ccAddresses.length > 0 && (
                  <span className="ml-2">Cc: {message.ccAddresses.join(', ')}</span>
                )}
              </p>
            </div>
            <p className="text-xs text-gray-500">{formatDate(message.receivedAt)}</p>
          </div>

          <div className="prose prose-sm max-w-none">
            {message.bodyHtml ? (
              <div
                dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
                className="text-gray-700"
              />
            ) : message.bodyText ? (
              <pre className="whitespace-pre-wrap font-sans text-gray-700 text-sm">
                {message.bodyText}
              </pre>
            ) : (
              <p className="text-gray-400 italic">No content</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
