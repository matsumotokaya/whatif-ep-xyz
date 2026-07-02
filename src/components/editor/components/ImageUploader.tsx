import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface ImageUploaderProps {
  onAddImage: (src: string, width: number, height: number) => void;
}

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const ImageUploader = ({ onAddImage }: ImageUploaderProps) => {
  const { t } = useTranslation('editor');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      if (file.size > MAX_FILE_SIZE_BYTES) {
        alert(`File "${file.name}" exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => {
          onAddImage(dataUrl, img.width, img.height);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });

    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full px-3 py-2 text-xs font-medium text-gray-300 bg-[#333333] hover:bg-[#444444] rounded transition-colors flex items-center justify-center gap-1"
        title={`${t('imageUploader.uploadImage')} (Max ${MAX_FILE_SIZE_MB}MB)`}
      >
        <span className="material-symbols-outlined text-[16px]">upload</span>
        <span>{t('imageUploader.uploadImage')}</span>
      </button>
      <p className="text-xs text-gray-500">
        {t('imageUploader.dragDropHint')}
      </p>
    </div>
  );
};
