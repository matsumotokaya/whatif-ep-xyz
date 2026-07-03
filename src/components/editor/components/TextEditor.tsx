import { useTranslation } from 'react-i18next';

interface TextEditorProps {
  onAddText: () => void;
  isActive?: boolean;
}

export const TextEditor = ({ onAddText, isActive }: TextEditorProps) => {
  const { t } = useTranslation('editor');

  return (
    <button
      onClick={onAddText}
      className={`w-full px-3 py-2 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1 ${
        isActive
          ? 'bg-indigo-600 text-white'
          : 'text-gray-300 bg-[#333333] hover:bg-[#444444]'
      }`}
      title={isActive ? t('textInput.clickCanvas') : t('textInput.add')}
    >
      <span className="material-symbols-outlined text-[16px]">text_fields</span>
      <span>{isActive ? t('textInput.clickCanvas') : t('textInput.add')}</span>
    </button>
  );
};
