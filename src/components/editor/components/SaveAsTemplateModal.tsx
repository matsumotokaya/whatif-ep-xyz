import { useState } from 'react';

interface SaveAsTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (params: { planType: 'free' | 'premium'; displayOrder: number }) => Promise<void>;
  defaultName: string;
}

export function SaveAsTemplateModal({ isOpen, onClose, onSave, defaultName }: SaveAsTemplateModalProps) {
  const [planType, setPlanType] = useState<'free' | 'premium'>('free');
  const [displayOrder, setDisplayOrder] = useState<number>(999);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ planType, displayOrder });
      alert('テンプレートを登録しました');
      onClose();
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('テンプレートの保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">テンプレートとして登録</h2>
        
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              テンプレート名
            </label>
            <input
              type="text"
              value={defaultName}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
            />
            <p className="text-xs text-gray-500 mt-1">※現在のバナー名が使用されます</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              プラン種別
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
                <span className="text-sm">無料プラン</span>
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
                <span className="text-sm">プレミアムプラン</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              表示順序
            </label>
            <input
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 999)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="999"
            />
            <p className="text-xs text-gray-500 mt-1">※小さい数字ほど前に表示されます</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {isSaving ? '保存中...' : '登録する'}
          </button>
        </div>
      </div>
    </div>
  );
}
