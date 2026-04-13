'use client';

import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import type { ISignature } from '@imark/shared';

export default function SignaturesPage() {
  const [signatures, setSignatures] = useState<ISignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editSignature, setEditSignature] = useState<ISignature | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    content: '',
    isDefault: false,
  });

  useEffect(() => {
    loadSignatures();
  }, []);

  const loadSignatures = async () => {
    try {
      const data = await api.getSignatures();
      setSignatures(data);
    } catch (error) {
      console.error('Failed to load signatures:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editSignature) {
        await api.updateSignature(editSignature.id, formData);
      } else {
        await api.createSignature(formData);
      }
      setShowAddModal(false);
      setEditSignature(null);
      setFormData({ name: '', content: '', isDefault: false });
      loadSignatures();
    } catch (error) {
      console.error('Failed to save signature:', error);
      alert('Failed to save signature');
    }
  };

  const handleEdit = (signature: ISignature) => {
    setEditSignature(signature);
    setFormData({
      name: signature.name,
      content: signature.content,
      isDefault: signature.isDefault,
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this signature?')) return;
    try {
      await api.deleteSignature(id);
      loadSignatures();
    } catch (error) {
      console.error('Failed to delete signature:', error);
    }
  };

  const handleSetDefault = async (signature: ISignature) => {
    try {
      await api.updateSignature(signature.id, { isDefault: true });
      loadSignatures();
    } catch (error) {
      console.error('Failed to set default:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Email Signatures</h1>
        <button
          onClick={() => {
            setEditSignature(null);
            setFormData({ name: '', content: '', isDefault: false });
            setShowAddModal(true);
          }}
          className="btn-primary"
        >
          Add Signature
        </button>
      </div>

      <p className="text-gray-600">
        Create email signatures that will be automatically appended to your outgoing emails.
      </p>

      {/* Signatures List */}
      <div className="space-y-4">
        {loading ? (
          <div className="card p-8 text-center text-gray-500">Loading...</div>
        ) : signatures.length === 0 ? (
          <div className="card p-8 text-center text-gray-500">
            No signatures yet. Create your first signature!
          </div>
        ) : (
          signatures.map((signature) => (
            <div key={signature.id} className="card p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-2">
                  <h3 className="font-medium text-gray-900">{signature.name}</h3>
                  {signature.isDefault && (
                    <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">
                      Default
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {!signature.isDefault && (
                    <button
                      onClick={() => handleSetDefault(signature)}
                      className="text-sm text-primary-600 hover:text-primary-700"
                    >
                      Set as default
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(signature)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    title="Edit"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(signature.id)}
                    className="p-1 text-gray-400 hover:text-red-600 rounded"
                    title="Delete"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="bg-gray-50 rounded p-3 text-sm text-gray-700 whitespace-pre-wrap">
                {signature.content}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">
              {editSignature ? 'Edit Signature' : 'Add Signature'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Signature Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="e.g., Work Signature"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Signature Content *
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="input font-mono"
                  rows={8}
                  placeholder={"Best regards,\nJohn Doe\nSenior Developer\nCompany Inc.\nPhone: +1 234 567 8900"}
                  required
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="isDefault" className="ml-2 text-sm text-gray-700">
                  Set as default signature
                </label>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditSignature(null);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editSignature ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
