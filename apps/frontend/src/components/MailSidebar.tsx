'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { IFolderCounts, ThreadFolder, ILabel } from '@recapito/shared';
import { api } from '../lib/api';

interface MailSidebarProps {
  currentFolder: ThreadFolder | 'all';
  counts: IFolderCounts | null;
  onFolderChange: (folder: ThreadFolder | 'all') => void;
  selectedLabelId?: string;
  onLabelSelect?: (labelId: string | null) => void;
}

const folders: { id: ThreadFolder | 'all'; label: string; icon: JSX.Element }[] = [
  {
    id: 'inbox',
    label: 'Inbox',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
    ),
  },
  {
    id: 'drafts',
    label: 'Drafts',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    id: 'sent',
    label: 'Sent',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ),
  },
  {
    id: 'snoozed',
    label: 'Snoozed',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'spam',
    label: 'Spam',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  {
    id: 'trash',
    label: 'Trash',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
  },
  {
    id: 'archive',
    label: 'Archive',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
  },
];

export function MailSidebar({
  currentFolder,
  counts,
  onFolderChange,
  selectedLabelId,
  onLabelSelect
}: MailSidebarProps) {
  const [labels, setLabels] = useState<ILabel[]>([]);
  const [showLabelInput, setShowLabelInput] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#3B82F6');
  const [labelsExpanded, setLabelsExpanded] = useState(true);

  const colors = [
    '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
    '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
    '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
    '#EC4899', '#F43F5E', '#64748B', '#475569', '#1E293B',
  ];

  useEffect(() => {
    loadLabels();
  }, []);

  const loadLabels = async () => {
    try {
      const data = await api.getLabels();
      setLabels(data);
    } catch (error) {
      console.error('Failed to load labels:', error);
    }
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;
    try {
      const label = await api.createLabel({ name: newLabelName.trim(), color: newLabelColor });
      setLabels([...labels, label]);
      setNewLabelName('');
      setShowLabelInput(false);
    } catch (error) {
      console.error('Failed to create label:', error);
    }
  };

  const handleDeleteLabel = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this label?')) return;
    try {
      await api.deleteLabel(id);
      setLabels(labels.filter(l => l.id !== id));
      if (selectedLabelId === id) {
        onLabelSelect?.(null);
      }
    } catch (error) {
      console.error('Failed to delete label:', error);
    }
  };

  const getCount = (folderId: ThreadFolder | 'all'): number | undefined => {
    if (!counts || folderId === 'all') return undefined;
    return counts[folderId as keyof IFolderCounts] as number;
  };

  const getUnreadCount = (): number => {
    return counts?.unread || 0;
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-4">
        <Link
          href="/compose"
          className="btn-primary w-full flex items-center justify-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Compose</span>
        </Link>
      </div>

      <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
        {folders.map((folder) => {
          const count = getCount(folder.id);
          const isActive = currentFolder === folder.id && !selectedLabelId;
          const unreadCount = folder.id === 'inbox' ? getUnreadCount() : 0;

          return (
            <button
              key={folder.id}
              onClick={() => {
                onFolderChange(folder.id);
                onLabelSelect?.(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className={isActive ? 'text-primary-600' : 'text-gray-400'}>
                  {folder.icon}
                </span>
                <span>{folder.label}</span>
              </div>
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && folder.id === 'inbox' && (
                  <span className="bg-primary-600 text-white text-xs px-2 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
                {count !== undefined && count > 0 && (
                  <span className="text-gray-400 text-xs">{count}</span>
                )}
              </div>
            </button>
          );
        })}

        {/* Labels Section */}
        <div className="pt-4 mt-4 border-t border-gray-200">
          <button
            onClick={() => setLabelsExpanded(!labelsExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-lg"
          >
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <span>Labels</span>
            </div>
            <svg
              className={`w-4 h-4 transition-transform ${labelsExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {labelsExpanded && (
            <div className="mt-1 space-y-1">
              {labels.map((label) => (
                <button
                  key={label.id}
                  onClick={() => {
                    onLabelSelect?.(label.id);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg group transition-colors ${
                    selectedLabelId === label.id
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: label.color }}
                    />
                    <span className="truncate">{label.name}</span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteLabel(label.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </button>
              ))}

              {showLabelInput ? (
                <div className="px-2 py-2 space-y-2">
                  <input
                    type="text"
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    placeholder="Label name"
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateLabel()}
                  />
                  <div className="flex flex-wrap gap-1">
                    {colors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewLabelColor(color)}
                        className={`w-5 h-5 rounded-full ${newLabelColor === color ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={handleCreateLabel}
                      className="flex-1 px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => {
                        setShowLabelInput(false);
                        setNewLabelName('');
                      }}
                      className="flex-1 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowLabelInput(true)}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 rounded-lg"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Create label</span>
                </button>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Quick Links */}
      <div className="p-2 border-t border-gray-200">
        <Link
          href="/contacts"
          className="flex items-center space-x-3 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span>Contacts</span>
        </Link>
        <Link
          href="/templates"
          className="flex items-center space-x-3 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
          <span>Templates</span>
        </Link>
      </div>
    </div>
  );
}
