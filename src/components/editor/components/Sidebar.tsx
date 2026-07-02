import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ColorSelector } from './ColorSelector';
import { TextEditor } from './TextEditor';
import { ImageUploader } from './ImageUploader';
import { ImageLibraryModal } from './ImageLibraryModal';
import { ShapeSelector } from './ShapeSelector';
import { CanvasSizeSelector } from './CanvasSizeSelector';
import { UpgradeModal } from './UpgradeModal';
import type { CanvasElement } from '../types/template';

interface SidebarProps {
  canvasColor: string;
  canvasWidth: number;
  canvasHeight: number;
  onSelectColor: (color: string) => void;
  onCanvasSizeChange: (width: number, height: number) => void;
  onAddText: () => void;
  textPlacementMode?: boolean;
  onAddShape: (shapeType: 'rectangle' | 'triangle' | 'star' | 'circle' | 'heart') => void;
  onAddImage: (src: string, width: number, height: number) => void;
  elements?: CanvasElement[];
  selectedElementIds?: string[];
  onSelectElement?: (ids: string[]) => void;
  onReorderElements?: (newOrder: CanvasElement[]) => void;
  onToggleLock?: (id: string) => void;
  onToggleVisibility?: (id: string) => void;
  isMobile?: boolean;
  panMode?: boolean;
  onPanModeChange?: (mode: boolean) => void;
}

type TabType = 'tool' | 'layer';

// Get layer name for display (will be called from component with t function)
const getLayerName = (element: CanvasElement, t: (key: string) => string): string => {
  if (element.type === 'text') {
    return element.text.length > 20 ? element.text.substring(0, 20) + '...' : element.text;
  } else if (element.type === 'image') {
    // Extract filename from URL
    try {
      const url = new URL(element.src);
      const pathParts = url.pathname.split('/');
      const filename = pathParts[pathParts.length - 1];
      return filename.length > 20 ? filename.substring(0, 20) + '...' : filename;
    } catch {
      return t('editor:object.image');
    }
  } else if (element.type === 'shape') {
    return t(`editor:shapes.${element.shapeType}`);
  }
  return t('editor:properties.layer');
};

// Get icon for layer type
const getLayerIcon = (element: CanvasElement): string => {
  if (element.type === 'text') return 'text_fields';
  if (element.type === 'image') return 'image';
  if (element.type === 'shape') {
    const iconMap: Record<string, string> = {
      rectangle: 'rectangle',
      circle: 'circle',
      triangle: 'change_history',
      star: 'star',
      heart: 'favorite',
    };
    return iconMap[element.shapeType] || 'category';
  }
  return 'layers';
};

// Sortable layer item component
interface SortableLayerItemProps {
  element: CanvasElement;
  isSelected: boolean;
  onSelect: (shiftKey: boolean) => void;
  onToggleLock: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  t: (key: string) => string;
}

const SortableLayerItem = ({ element, isSelected, onSelect, onToggleLock, onToggleVisibility, t }: SortableLayerItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: element.id });
  const isVisible = element.visible ?? true;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-center gap-1">
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="p-2 hover:bg-[#444444] rounded cursor-grab active:cursor-grabbing flex-shrink-0"
          title={t('editor:dragToReorder')}
        >
          <span className="material-symbols-outlined text-[18px] text-gray-400">
            drag_indicator
          </span>
        </div>

        {/* Layer info - clickable for selection */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(e.shiftKey);
          }}
          className={`flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded text-left transition-colors ${
            isSelected
              ? 'bg-indigo-100 text-indigo-900'
              : 'hover:bg-[#333333] text-gray-300'
          } ${isVisible ? '' : 'opacity-60'}`}
        >
          <span className="material-symbols-outlined text-[18px] flex-shrink-0">
            {getLayerIcon(element)}
          </span>
          <span className="flex-1 min-w-0 text-sm truncate">
            {getLayerName(element, t)}
          </span>
          <span className="text-xs text-gray-400 flex-shrink-0">
            {element.type === 'text' ? 'T' : element.type === 'image' ? 'I' : 'S'}
          </span>
        </button>

        {/* Visibility button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility(element.id);
          }}
          className="p-2 hover:bg-[#444444] rounded transition-colors flex-shrink-0"
          title={isVisible ? t('layerVisibility.hide') : t('layerVisibility.show')}
        >
          <span className="material-symbols-outlined text-[18px] text-gray-400">
            {isVisible ? 'visibility' : 'visibility_off'}
          </span>
        </button>

        {/* Lock button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock(element.id);
          }}
          className={`p-2 rounded transition-colors flex-shrink-0 ${
            element.locked
              ? 'bg-white hover:bg-gray-200'
              : 'hover:bg-[#444444]'
          }`}
          title={element.locked ? t('editor:unlock') : t('editor:lock')}
        >
          <span className={`material-symbols-outlined text-[18px] ${
            element.locked ? 'text-gray-900' : 'text-gray-400'
          }`}>
            {element.locked ? 'lock' : 'lock_open'}
          </span>
        </button>
      </div>
    </div>
  );
};

export const Sidebar = ({
  canvasColor,
  canvasWidth,
  canvasHeight,
  onSelectColor,
  onCanvasSizeChange,
  onAddText,
  onAddShape,
  onAddImage,
  elements = [],
  selectedElementIds = [],
  onSelectElement,
  onReorderElements,
  onToggleLock,
  onToggleVisibility,
  isMobile = false,
  textPlacementMode = false,
  panMode = false,
  onPanModeChange,
}: SidebarProps) => {
  const { t } = useTranslation('editor');
  const { profile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('tool');
  const [showImageLibrary, setShowImageLibrary] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const isPremium = !!profile && profile.subscriptionTier !== 'free';

  const handleImageLibraryClick = () => {
    if (loading) return;
    if (!profile || profile.subscriptionTier === 'free') {
      setShowUpgradeModal(true);
    } else {
      setShowImageLibrary(true);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const reversedElements = [...elements].reverse();
      const oldIndex = reversedElements.findIndex((el) => el.id === active.id);
      const newIndex = reversedElements.findIndex((el) => el.id === over.id);

      const reordered = arrayMove(reversedElements, oldIndex, newIndex);
      // Reverse back to original order (bottom to top)
      const finalOrder = reordered.reverse();
      onReorderElements?.(finalOrder);
    }
  };
  if (isMobile) {
    return (
      <aside className="bg-[#1a1a1a] border-t border-[#2b2b2b] overflow-x-auto overflow-y-hidden">
        <div className="flex gap-6 p-4 min-w-max">
          {/* Tool mode toggle */}
          <div className="flex flex-col items-center gap-2 min-w-[80px]">
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase">{t('tabs.tool')}</h3>
            <div className="flex bg-[#222222] rounded p-0.5">
              <button
                onClick={() => onPanModeChange?.(false)}
                className={`p-1.5 rounded transition-colors ${!panMode ? 'bg-[#444444] text-white' : 'text-gray-500'}`}
                title={t('tabs.selectTool')}
              >
                <span className="material-symbols-outlined text-[20px]">arrow_selector_tool</span>
              </button>
              <button
                onClick={() => onPanModeChange?.(true)}
                className={`p-1.5 rounded transition-colors ${panMode ? 'bg-[#444444] text-white' : 'text-gray-500'}`}
                title={t('tabs.handTool')}
              >
                <span className="material-symbols-outlined text-[20px]">pan_tool</span>
              </button>
            </div>
          </div>

          {/* Text section */}
          <div className="flex flex-col items-center gap-2 min-w-[80px]">
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase">{t('object.text')}</h3>
            <TextEditor onAddText={onAddText} isActive={textPlacementMode} />
          </div>

          {/* Shape section */}
          <div className="flex flex-col items-center gap-2 min-w-[80px]">
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase">{t('object.shapes')}</h3>
            <ShapeSelector onAddShape={onAddShape} />
          </div>

          {/* Image upload section */}
          <div className="flex flex-col items-center gap-2 min-w-[80px]">
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase">{t('object.image')}</h3>
            <ImageUploader onAddImage={onAddImage} />
          </div>

          {/* Image library section */}
          <div className="flex flex-col items-center gap-2 min-w-[80px]">
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase">{t('imageUploader.imageLibrary')}</h3>
            <button
              onClick={handleImageLibraryClick}
              className={`p-2 rounded transition-colors relative ${isPremium ? 'hover:bg-[#333333]' : 'hover:bg-[#333333] opacity-60'}`}
              title={isPremium ? t('imageUploader.chooseFromLibrary') : 'Premium members only'}
            >
              <span className="material-symbols-outlined text-[24px] text-gray-300">photo_library</span>
              {!isPremium && (
                <span className="material-symbols-outlined text-[12px] text-yellow-400 absolute top-0 right-0">lock</span>
              )}
            </button>
          </div>

          {/* Background section */}
          <div className="flex flex-col items-center gap-2 min-w-[240px] max-w-[240px] px-3">
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase">{t('page.backgroundColor')}</h3>
            <ColorSelector selectedColor={canvasColor} onColorChange={onSelectColor} showInput={true} />
          </div>
        </div>

        <ImageLibraryModal
          isOpen={showImageLibrary}
          onClose={() => setShowImageLibrary(false)}
          onSelectImage={onAddImage}
          initialTab="user"
        />
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
        />
      </aside>
    );
  }

  return (
    <aside className="w-60 bg-[#1a1a1a] border-r border-[#2b2b2b] flex flex-col">
      {/* Tabs */}
      <div className="flex bg-[#111111] p-1 gap-0.5">
        <button
          onClick={() => setActiveTab('tool')}
          className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'tool'
              ? 'bg-[#2b2b2b] text-gray-100'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">build</span>
          {t('tabs.tool')}
        </button>
        <button
          onClick={() => setActiveTab('layer')}
          className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'layer'
              ? 'bg-[#2b2b2b] text-gray-100'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">layers</span>
          {t('tabs.layer')}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'tool' && (
          <div className="p-4 space-y-6">
            <div className="pb-6 border-b border-[#2b2b2b]">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {t('tabs.tool')}
              </h2>
              <div className="flex bg-[#222222] rounded p-0.5 mb-4">
                <button
                  onClick={() => onPanModeChange?.(false)}
                  className={`flex-1 py-1.5 text-xs rounded flex items-center justify-center gap-1 transition-colors ${
                    !panMode ? 'bg-[#444444] text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">arrow_selector_tool</span>
                  {t('tabs.selectTool')}
                </button>
                <button
                  onClick={() => onPanModeChange?.(true)}
                  className={`flex-1 py-1.5 text-xs rounded flex items-center justify-center gap-1 transition-colors ${
                    panMode ? 'bg-[#444444] text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">pan_tool</span>
                  {t('tabs.handTool')}
                </button>
              </div>
              <div className="space-y-4">
                <TextEditor onAddText={onAddText} isActive={textPlacementMode} />
                <ShapeSelector onAddShape={onAddShape} />
                <ImageUploader onAddImage={onAddImage} />
                <button
                  onClick={handleImageLibraryClick}
                  className={`w-full px-3 py-2 text-xs font-medium text-gray-300 bg-[#333333] hover:bg-[#444444] rounded transition-colors flex items-center justify-center gap-1 relative ${!isPremium ? 'opacity-60' : ''}`}
                  title={isPremium ? t('imageUploader.chooseFromLibrary') : 'Premium members only'}
                >
                  <span className="material-symbols-outlined text-[16px]">photo_library</span>
                  <span>{t('imageUploader.chooseFromLibrary')}</span>
                  {!isPremium && (
                    <span className="material-symbols-outlined text-[14px] text-yellow-400 ml-1">lock</span>
                  )}
                </button>
              </div>
            </div>

            <div className="pb-6">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {t('page.canvasSettings')}
              </h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs text-gray-500 mb-2">{t('page.canvasSize')}</h3>
                  <CanvasSizeSelector
                    width={canvasWidth}
                    height={canvasHeight}
                    onSizeChange={onCanvasSizeChange}
                  />
                </div>
                <div>
                  <h3 className="text-xs text-gray-500 mb-2">{t('page.backgroundColor')}</h3>
                  <ColorSelector selectedColor={canvasColor} onColorChange={onSelectColor} showInput={true} />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'layer' && (
          <div className="p-2">
            {elements.length === 0 ? (
              <div className="text-center text-gray-400 py-12">
                <span className="material-symbols-outlined text-5xl mb-2">layers</span>
                <p className="text-sm">{t('page.noLayers')}</p>
                <p className="text-xs mt-2">{t('page.addObjects')}</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={[...elements].reverse().map((el) => el.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1">
                    {/* Display layers in reverse order (top layer first) */}
                    {[...elements].reverse().map((element) => {
                      const isSelected = selectedElementIds.includes(element.id);
                      return (
                        <SortableLayerItem
                          key={element.id}
                          element={element}
                          isSelected={isSelected}
                          onSelect={(shiftKey) => {
                            if (shiftKey) {
                              // Shift + Click: Toggle selection
                              if (isSelected) {
                                // Remove from selection
                                onSelectElement?.(selectedElementIds.filter(id => id !== element.id));
                              } else {
                                // Add to selection
                                onSelectElement?.([...selectedElementIds, element.id]);
                              }
                            } else {
                              // Regular click: Select only this element
                              onSelectElement?.([element.id]);
                            }
                          }}
                          onToggleLock={(id) => onToggleLock?.(id)}
                          onToggleVisibility={(id) => onToggleVisibility?.(id)}
                          t={t}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        )}
      </div>

      <ImageLibraryModal
        isOpen={showImageLibrary}
        onClose={() => setShowImageLibrary(false)}
        onSelectImage={onAddImage}
        initialTab="user"
      />
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </aside>
  );
};
