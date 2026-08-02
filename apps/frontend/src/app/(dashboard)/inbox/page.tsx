'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { ThreadList } from '@/components/ThreadList';
import { MailSidebar } from '@/components/MailSidebar';
import { SearchBar } from '@/components/SearchBar';
import type { IThread, IMailbox, IPaginatedResponse, ThreadFolder, IFolderCounts, ILabel } from '@recapito/shared';

export default function InboxPage() {
  const [threads, setThreads] = useState<IThread[]>([]);
  const [mailboxes, setMailboxes] = useState<IMailbox[]>([]);
  const [labels, setLabels] = useState<ILabel[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState<string>('');
  const [currentFolder, setCurrentFolder] = useState<ThreadFolder | 'all'>('inbox');
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [folderCounts, setFolderCounts] = useState<IFolderCounts | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMailboxes();
    loadLabels();
  }, []);

  useEffect(() => {
    if (selectedLabelId) {
      loadThreadsByLabel();
    } else {
      loadThreads();
    }
    loadFolderCounts();
  }, [page, selectedMailbox, currentFolder, searchQuery, selectedLabelId]);

  // Auto-refresh every 5 seconds for realtime emails (silent refresh - no loading spinner)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!selectedLabelId) {
        loadThreads(false); // Silent refresh - no loading spinner
      }
      loadFolderCounts();
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedMailbox, currentFolder, searchQuery, selectedLabelId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'c':
          // Compose new email
          window.location.href = '/compose';
          break;
        case 'r':
          // Refresh
          loadThreads(true);
          break;
        case 'g':
          // Focus on navigation - next key determines folder
          break;
        case '/':
          // Focus search
          e.preventDefault();
          document.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadMailboxes = async () => {
    try {
      const data = await api.getMailboxes();
      setMailboxes(data);
    } catch (err) {
      console.error('Failed to load mailboxes:', err);
    }
  };

  const loadLabels = async () => {
    try {
      const data = await api.getLabels();
      setLabels(data);
    } catch (err) {
      console.error('Failed to load labels:', err);
    }
  };

  const loadFolderCounts = async () => {
    try {
      const counts = await api.getFolderCounts(selectedMailbox || undefined);
      setFolderCounts(counts);
    } catch (err) {
      console.error('Failed to load folder counts:', err);
    }
  };

  const loadThreads = async (showLoading = true) => {
    // Show loading spinner when explicitly requested (initial load, refresh button, folder change)
    // Don't show spinner for background auto-refresh (showLoading = false)
    if (showLoading) {
      setIsLoading(true);
    }
    try {
      const folder = currentFolder === 'all' ? undefined : currentFolder;
      const data: IPaginatedResponse<IThread> = await api.getThreads(
        page,
        20,
        selectedMailbox || undefined,
        folder,
        searchQuery || undefined,
      );
      setThreads(data.items);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error('Failed to load threads:', err);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  const loadThreadsByLabel = async (showLoading = true) => {
    if (!selectedLabelId) return;
    if (showLoading) {
      setIsLoading(true);
    }
    try {
      const data = await api.getThreadsByLabel(selectedLabelId);
      setThreads(data);
      setTotalPages(1);
    } catch (err) {
      console.error('Failed to load threads by label:', err);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  const handleFolderChange = useCallback((folder: ThreadFolder | 'all') => {
    setCurrentFolder(folder);
    setSelectedLabelId(null);
    setPage(1);
    setSearchQuery('');
  }, []);

  const handleLabelSelect = useCallback((labelId: string | null) => {
    setSelectedLabelId(labelId);
    setPage(1);
    setSearchQuery('');
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setSelectedLabelId(null);
    setPage(1);
  }, []);

  const handleMoveToFolder = async (threadId: string, folder: ThreadFolder) => {
    try {
      await api.moveThreadToFolder(threadId, folder);
      if (selectedLabelId) {
        loadThreadsByLabel();
      } else {
        loadThreads();
      }
      loadFolderCounts();
    } catch (err) {
      console.error('Failed to move thread:', err);
    }
  };

  const handleToggleStar = async (threadId: string) => {
    try {
      await api.toggleThreadStar(threadId);
      if (selectedLabelId) {
        loadThreadsByLabel();
      } else {
        loadThreads();
      }
    } catch (err) {
      console.error('Failed to toggle star:', err);
    }
  };

  const handleBulkMove = async (threadIds: string[], folder: ThreadFolder) => {
    try {
      await Promise.all(threadIds.map(id => api.moveThreadToFolder(id, folder)));
      if (selectedLabelId) {
        loadThreadsByLabel();
      } else {
        loadThreads();
      }
      loadFolderCounts();
    } catch (err) {
      console.error('Failed to move threads:', err);
    }
  };

  const handleBulkDelete = async (threadIds: string[]) => {
    try {
      await Promise.all(threadIds.map(id => api.moveThreadToFolder(id, 'trash')));
      if (selectedLabelId) {
        loadThreadsByLabel();
      } else {
        loadThreads();
      }
      loadFolderCounts();
    } catch (err) {
      console.error('Failed to delete threads:', err);
    }
  };

  const handleAddLabel = async (threadId: string, labelId: string) => {
    try {
      await api.addLabelToThread(labelId, threadId);
      if (selectedLabelId) {
        loadThreadsByLabel();
      } else {
        loadThreads();
      }
    } catch (err) {
      console.error('Failed to add label:', err);
    }
  };

  const getFolderTitle = () => {
    if (selectedLabelId) {
      const label = labels.find(l => l.id === selectedLabelId);
      return label?.name || 'Label';
    }
    switch (currentFolder) {
      case 'inbox': return 'Inbox';
      case 'sent': return 'Sent';
      case 'drafts': return 'Drafts';
      case 'snoozed': return 'Snoozed';
      case 'spam': return 'Spam';
      case 'trash': return 'Trash';
      case 'archive': return 'Archive';
      default: return 'All Mail';
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)]">
      <MailSidebar
        currentFolder={currentFolder}
        counts={folderCounts}
        onFolderChange={handleFolderChange}
        selectedLabelId={selectedLabelId || undefined}
        onLabelSelect={handleLabelSelect}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl font-bold text-gray-900">{getFolderTitle()}</h1>

            <SearchBar onSearch={handleSearch} />

            <div className="flex items-center space-x-3">
              <select
                value={selectedMailbox}
                onChange={(e) => {
                  setSelectedMailbox(e.target.value);
                  setPage(1);
                }}
                className="input w-auto text-sm"
              >
                <option value="">All mailboxes</option>
                {mailboxes.map((mailbox) => (
                  <option key={mailbox.id} value={mailbox.id}>
                    {mailbox.email}
                  </option>
                ))}
              </select>
              <button onClick={() => selectedLabelId ? loadThreadsByLabel() : loadThreads(true)} className="btn-secondary text-sm">
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : threads.length === 0 ? (
            <div className="card p-12 text-center text-gray-500">
              {searchQuery ? (
                <p>No messages found for "{searchQuery}".</p>
              ) : (
                <>
                  <p>No messages in {getFolderTitle().toLowerCase()}.</p>
                  {mailboxes.length === 0 && currentFolder === 'inbox' && (
                    <p className="mt-2">
                      <a href="/mailboxes" className="text-primary-600 hover:underline">
                        Add a mailbox
                      </a>{' '}
                      to start receiving emails.
                    </p>
                  )}
                </>
              )}
            </div>
          ) : (
            <>
              <ThreadList
                threads={threads}
                onMoveToFolder={handleMoveToFolder}
                onToggleStar={handleToggleStar}
                onBulkMove={handleBulkMove}
                onBulkDelete={handleBulkDelete}
                onAddLabel={handleAddLabel}
                labels={labels}
                currentFolder={currentFolder}
              />

              {totalPages > 1 && (
                <div className="flex justify-center mt-6 space-x-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-secondary disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-gray-600">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="btn-secondary disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Keyboard shortcuts help */}
      <div className="fixed bottom-4 right-4">
        <button
          onClick={() => {
            alert('Keyboard Shortcuts:\n\nc - Compose new email\nr - Refresh\n/ - Focus search');
          }}
          className="p-2 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700"
          title="Keyboard shortcuts"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
