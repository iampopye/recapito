'use client';

import { useEffect, useState } from 'react';
import { api, type IAttachment } from '@/lib/api';

interface MessageAttachmentsProps {
  messageId: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Lists a message's attachments and downloads them on demand.
 *
 * The download goes through `fetch` with the auth header rather than a plain
 * link, because the API requires a bearer token that an `<a href>` cannot
 * carry. The response is turned into an object URL and clicked programmatically.
 *
 * Inline parts (embedded images referenced from the HTML body) are filtered
 * out -- listing them as files is confusing, since the user never attached them.
 */
export function MessageAttachments({ messageId }: MessageAttachmentsProps) {
  const [attachments, setAttachments] = useState<IAttachment[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getMessageAttachments(messageId)
      .then((data) => {
        if (!cancelled) setAttachments(data.filter((a) => !a.isInline));
      })
      .catch(() => {
        // A failure to list attachments should not blank out the message.
        if (!cancelled) setAttachments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [messageId]);

  const handleDownload = async (attachment: IAttachment) => {
    setDownloading(attachment.id);
    setError(null);
    let objectUrl: string | null = null;
    try {
      const blob = await api.downloadAttachment(attachment.id);
      objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = attachment.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      // Revoke on the next tick -- revoking synchronously can cancel the
      // download in some browsers before it has started.
      if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl as string), 30_000);
      setDownloading(null);
    }
  };

  if (attachments.length === 0) return null;

  return (
    <div className="mt-4 border-t border-gray-200 pt-3">
      <p className="text-xs font-medium text-gray-500 mb-2">
        {attachments.length} attachment{attachments.length === 1 ? '' : 's'}
      </p>
      <ul className="flex flex-wrap gap-2">
        {attachments.map((attachment) => (
          <li key={attachment.id}>
            <button
              type="button"
              onClick={() => handleDownload(attachment)}
              disabled={downloading === attachment.id}
              className="flex items-center gap-2 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              title={`${attachment.filename} (${formatSize(attachment.size)})`}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4 text-gray-400"
              >
                <path d="M8 4a3 3 0 0 1 6 0v7a5 5 0 0 1-10 0V6h2v5a3 3 0 1 0 6 0V4a1 1 0 1 0-2 0v7a1 1 0 1 1-2 0V4Z" />
              </svg>
              <span className="max-w-[14rem] truncate">{attachment.filename}</span>
              <span className="text-xs text-gray-400">{formatSize(attachment.size)}</span>
              {downloading === attachment.id && (
                <span className="text-xs text-gray-400">…</span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
