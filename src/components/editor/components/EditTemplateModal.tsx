import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TemplateRecord } from '../types/template';

interface EditTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: TemplateRecord | null;
  onSave: (params: {
    name: string;
    planType: 'free' | 'premium';
  }) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function EditTemplateModal({
  isOpen,
  onClose,
  template,
  onSave,
  onDelete,
}: EditTemplateModalProps) {
  const { t } = useTranslation('modal');
  const [name, setName] = useState('');
  const [planType, setPlanType] = useState<'free' | 'premium'>('free');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setPlanType(template.planType || 'free');
      setShowDeleteConfirm(false);
    }
  }, [template]);

  const handleSave = async () => {
    if (!name.trim()) {
      alert(t('editTemplate.errors.nameEmpty'));
      return;
    }

    setIsSaving(true);
    try {
      await onSave({ name: name.trim(), planType });
      onClose();
    } catch (error) {
      console.error('Failed to save template:', error);
      alert(t('editTemplate.errors.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert(t('editTemplate.errors.deleteFailed'));
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!isOpen || !template) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-bold text-gray-900">{t('editTemplate.title')}</h2>

        <div className="mb-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {t('editTemplate.templateName')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              placeholder={t('editTemplate.templateNamePlaceholder')}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {t('editTemplate.planType')}
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="planType"
                  value="free"
                  checked={planType === 'free'}
                  onChange={(e) => setPlanType(e.target.value as 'free' | 'premium')}
                  className="mr-2"
                />
                <span className="text-sm">{t('editTemplate.free')}</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="planType"
                  value="premium"
                  checked={planType === 'premium'}
                  onChange={(e) => setPlanType(e.target.value as 'free' | 'premium')}
                  className="mr-2"
                />
                <span className="text-sm">{t('editTemplate.premium')}</span>
              </label>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {t('editTemplate.size')}
            </label>
            <p className="text-sm text-gray-600">
              {template.width} × {template.height}
            </p>
          </div>
        </div>

        <div className="mb-4 flex gap-3">
          <button
            onClick={onClose}
            disabled={isSaving || isDeleting}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {t('editTemplate.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isDeleting}
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSaving ? t('editTemplate.saving') : t('editTemplate.save')}
          </button>
        </div>

        <div className="border-t border-gray-200 pt-4">
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isSaving || isDeleting}
              className="w-full rounded-lg border border-red-300 px-4 py-2 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              {t('editTemplate.deleteTemplate')}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-center text-sm font-medium text-red-600">
                {t('editTemplate.deleteConfirm')}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  {t('editTemplate.cancel')}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeleting ? t('editTemplate.deleting') : t('editTemplate.delete')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
