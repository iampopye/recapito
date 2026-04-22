'use client';

import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import type { ITemplate } from '@rio/shared';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<ITemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTemplate, setEditTemplate] = useState<ITemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    bodyText: '',
    shortcut: '',
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await api.getTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editTemplate) {
        await api.updateTemplate(editTemplate.id, formData);
      } else {
        await api.createTemplate(formData);
      }
      setShowAddModal(false);
      setEditTemplate(null);
      setFormData({ name: '', subject: '', bodyText: '', shortcut: '' });
      loadTemplates();
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('Failed to save template');
    }
  };

  const handleEdit = (template: ITemplate) => {
    setEditTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject || '',
      bodyText: template.bodyText || '',
      shortcut: template.shortcut || '',
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await api.deleteTemplate(id);
      loadTemplates();
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Quick Reply Templates</h1>
        <button
          onClick={() => {
            setEditTemplate(null);
            setFormData({ name: '', subject: '', bodyText: '', shortcut: '' });
            setShowAddModal(true);
          }}
          className="btn-primary"
        >
          Add Template
        </button>
      </div>

      <p className="text-gray-600">
        Create reusable email templates for quick replies. Use shortcuts to quickly insert templates while composing.
      </p>

      {/* Templates List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-8 text-center text-gray-500">Loading...</div>
        ) : templates.length === 0 ? (
          <div className="col-span-full card p-8 text-center text-gray-500">
            No templates yet. Create your first template!
          </div>
        ) : (
          templates.map((template) => (
            <div key={template.id} className="card p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-gray-900">{template.name}</h3>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleEdit(template)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="p-1 text-gray-400 hover:text-red-600 rounded"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              {template.shortcut && (
                <p className="text-xs text-primary-600 mb-2">
                  Shortcut: <code className="bg-primary-50 px-1 rounded">/{template.shortcut}</code>
                </p>
              )}
              {template.subject && (
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-medium">Subject:</span> {template.subject}
                </p>
              )}
              <p className="text-sm text-gray-500 line-clamp-3">
                {template.bodyText || 'No content'}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Used {template.useCount} times
              </p>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">
              {editTemplate ? 'Edit Template' : 'Add Template'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="e.g., Thank you reply"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shortcut
                </label>
                <div className="flex items-center">
                  <span className="text-gray-500 mr-1">/</span>
                  <input
                    type="text"
                    value={formData.shortcut}
                    onChange={(e) => setFormData({ ...formData, shortcut: e.target.value.replace(/\s/g, '') })}
                    className="input"
                    placeholder="thankyou"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Type /{formData.shortcut || 'shortcut'} while composing to insert this template
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject (optional)
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="input"
                  placeholder="Email subject line"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content *
                </label>
                <textarea
                  value={formData.bodyText}
                  onChange={(e) => setFormData({ ...formData, bodyText: e.target.value })}
                  className="input"
                  rows={6}
                  placeholder="Thank you for reaching out..."
                  required
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditTemplate(null);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editTemplate ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
