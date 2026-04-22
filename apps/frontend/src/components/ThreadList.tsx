'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { IThread, ThreadFolder, ILabel } from '@rio/shared';

interface ThreadListProps {
  threads: IThread[];
  currentFolder?: ThreadFolder | 'all';
  onMoveToFolder?: (threadId: string, folder: ThreadFolder) => void;
  onToggleStar?: (threadId: string) => void;
  onBulkMove?: (threadIds: string[], folder: ThreadFolder) => void;
  onBulkDelete?: (threadIds: string[]) => void;
  onAddLabel?: (threadId: string, labelId: string) => void;
  labels?: ILabel[];
}

const folderOptions: { value: ThreadFolder; label: string }[] = [
  { value: 'inbox', label: 'Inbox' },
  { value: 'sent', label: 'Sent' },
  { value: 'spam', label: 'Spam' },
  { value: 'trash', label: 'Trash' },
  { value: 'archive', label: 'Archive' },
];

export function ThreadList({
  threads,
  currentFolder,
  onMoveToFolder,
  onToggleStar,
  onBulkMove,
  onBulkDelete,
  onAddLabel,
  labels = [],
}: ThreadListProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [selectedThreads, setSelectedThreads] = useState<Set<string>>(new Set());
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [showLabelMenu, setShowLabelMenu] = useState<string | null>(null);

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return d.toLocaleDateString([], { weekday: 'short' });
    } else {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const handleMoveClick = (e: React.MouseEvent, threadId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenMenu(openMenu === threadId ? null : threadId);
    setShowLabelMenu(null);
  };

  const handleMoveToFolder = (e: React.MouseEvent, threadId: string, folder: ThreadFolder) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenMenu(null);
    onMoveToFolder?.(threadId, folder);
  };

  const handleStarClick = (e: React.MouseEvent, threadId: string) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleStar?.(threadId);
  };

  const handleCheckboxClick = (e: React.MouseEvent, threadId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const newSelected = new Set(selectedThreads);
    if (newSelected.has(threadId)) {
      newSelected.delete(threadId);
    } else {
      newSelected.add(threadId);
    }
    setSelectedThreads(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedThreads.size === threads.length) {
      setSelectedThreads(new Set());
    } else {
      setSelectedThreads(new Set(threads.map(t => t.id)));
    }
  };

  const handleBulkMove = (folder: ThreadFolder) => {
    if (selectedThreads.size > 0) {
      onBulkMove?.(Array.from(selectedThreads), folder);
      setSelectedThreads(new Set());
      setShowBulkMenu(false);
    }
  };

  const handleBulkDelete = () => {
    if (selectedThreads.size > 0 && confirm(`Delete ${selectedThreads.size} selected emails?`)) {
      onBulkDelete?.(Array.from(selectedThreads));
      setSelectedThreads(new Set());
    }
  };

  const handleLabelClick = (e: React.MouseEvent, threadId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setShowLabelMenu(showLabelMenu === threadId ? null : threadId);
    setOpenMenu(null);
  };

  const handleAddLabel = (e: React.MouseEvent, threadId: string, labelId: string) => {
    e.preventDefault();
    e.stopPropagation();
    onAddLabel?.(threadId, labelId);
    setShowLabelMenu(null);
  };

  return (
    <div className="card">
      {/* Bulk Actions Bar */}
      {threads.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-200 flex items-center space-x-4 bg-gray-50">
          <button
            onClick={handleSelectAll}
            className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <div className={`w-4 h-4 border rounded flex items-center justify-center ${
              selectedThreads.size === threads.length && threads.length > 0
                ? 'bg-primary-600 border-primary-600'
                : selectedThreads.size > 0
                ? 'bg-primary-200 border-primary-400'
                : 'border-gray-300'
            }`}>
              {selectedThreads.size === threads.length && threads.length > 0 && (
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {selectedThreads.size > 0 && selectedThreads.size < threads.length && (
                <svg className="w-3 h-3 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <span>Select all</span>
          </button>

          {selectedThreads.size > 0 && (
            <>
              <span className="text-sm text-gray-500">
                {selectedThreads.size} selected
              </span>

              <div className="flex items-center space-x-2">
                {/* Archive */}
                <button
                  onClick={() => handleBulkMove('archive')}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
                  title="Archive"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                </button>

                {/* Spam */}
                <button
                  onClick={() => handleBulkMove('spam')}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
                  title="Mark as spam"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </button>

                {/* Delete */}
                <button
                  onClick={handleBulkDelete}
                  className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                  title="Delete"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>

                {/* More actions */}
                <div className="relative">
                  <button
                    onClick={() => setShowBulkMenu(!showBulkMenu)}
                    className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
                    title="More actions"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                  {showBulkMenu && (
                    <div className="absolute left-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                      <p className="px-3 py-1 text-xs text-gray-500 font-medium">Move to</p>
                      {folderOptions.map((folder) => (
                        <button
                          key={folder.value}
                          onClick={() => handleBulkMove(folder.value)}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          {folder.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div className="divide-y divide-gray-200">
        {threads.map((thread) => (
          <div key={thread.id} className="relative">
            <Link
              href={`/thread/${thread.id}`}
              className={`block p-4 hover:bg-gray-50 transition-colors ${
                !thread.isRead ? 'bg-blue-50' : ''
              } ${selectedThreads.has(thread.id) ? 'bg-primary-50' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  {/* Checkbox */}
                  <button
                    onClick={(e) => handleCheckboxClick(e, thread.id)}
                    className={`w-4 h-4 border rounded flex items-center justify-center ${
                      selectedThreads.has(thread.id)
                        ? 'bg-primary-600 border-primary-600'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {selectedThreads.has(thread.id) && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>

                  {onToggleStar && (
                    <button
                      onClick={(e) => handleStarClick(e, thread.id)}
                      className="text-gray-400 hover:text-yellow-500 transition-colors"
                    >
                      {thread.isStarred ? (
                        <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      )}
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p
                        className={`text-sm truncate ${
                          !thread.isRead ? 'font-semibold text-gray-900' : 'text-gray-700'
                        }`}
                      >
                        {thread.participants.slice(0, 2).join(', ')}
                        {thread.participants.length > 2 && ` +${thread.participants.length - 2}`}
                      </p>
                      {thread.messageCount > 1 && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          {thread.messageCount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <p
                        className={`text-sm truncate ${
                          !thread.isRead ? 'font-medium text-gray-900' : 'text-gray-600'
                        }`}
                      >
                        {thread.subject || '(No subject)'}
                      </p>
                      {/* Labels */}
                      {thread.labels && thread.labels.length > 0 && (
                        <div className="flex items-center space-x-1">
                          {thread.labels.slice(0, 2).map((label) => (
                            <span
                              key={label.id}
                              className="text-xs px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: `${label.color}20`,
                                color: label.color,
                              }}
                            >
                              {label.name}
                            </span>
                          ))}
                          {thread.labels.length > 2 && (
                            <span className="text-xs text-gray-400">
                              +{thread.labels.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="ml-4 flex items-center space-x-2">
                  <p className="text-xs text-gray-500">{formatDate(thread.lastMessageAt)}</p>
                  {!thread.isRead && (
                    <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
                  )}

                  {/* Label button */}
                  {labels.length > 0 && onAddLabel && (
                    <div className="relative">
                      <button
                        onClick={(e) => handleLabelClick(e, thread.id)}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                        title="Add label"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                      </button>
                      {showLabelMenu === thread.id && (
                        <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                          <p className="px-3 py-1 text-xs text-gray-500 font-medium">Add label</p>
                          {labels.map((label) => (
                            <button
                              key={label.id}
                              onClick={(e) => handleAddLabel(e, thread.id, label.id)}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                            >
                              <span
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: label.color }}
                              />
                              <span>{label.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {onMoveToFolder && (
                    <div className="relative">
                      <button
                        onClick={(e) => handleMoveClick(e, thread.id)}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                      {openMenu === thread.id && (
                        <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                          <p className="px-3 py-1 text-xs text-gray-500 font-medium">Move to</p>
                          {folderOptions
                            .filter(f => f.value !== currentFolder)
                            .map((folder) => (
                              <button
                                key={folder.value}
                                onClick={(e) => handleMoveToFolder(e, thread.id, folder.value)}
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                {folder.label}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
