import { useTranslation } from 'react-i18next';
import { ColorSelector } from '../components/ColorSelector';
import { StoriesSheet } from './StoriesSheet';

// Stories background tool (E3).
//
// Wraps the existing ColorSelector in a bottom sheet. `showInput={false}` keeps
// it to preset swatches only (no hex field or native color picker) per the
// Stories spec. `selectedColor` / `onColorChange` are wired straight to the
// canvas background state (canvasColor / setCanvasColor) in BannerEditor — the
// exact same state the desktop Sidebar drives, so there is no new logic here.
interface StoriesBackgroundSheetProps {
  color: string;
  onColorChange: (color: string) => void;
  onClose: () => void;
}

export const StoriesBackgroundSheet = ({ color, onColorChange, onClose }: StoriesBackgroundSheetProps) => {
  const { t } = useTranslation('editor');
  return (
    <StoriesSheet title={t('stories.background')} onClose={onClose}>
      <ColorSelector selectedColor={color} onColorChange={onColorChange} showInput={false} />
    </StoriesSheet>
  );
};
