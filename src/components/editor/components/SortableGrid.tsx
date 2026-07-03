import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
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
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Generic interface for sortable items
interface SortableItem {
  id: string;
}

// Props for the sortable item wrapper
interface SortableItemWrapperProps {
  id: string;
  disabled: boolean;
  children: ReactNode;
}

// Wrapper component for each sortable item
export function SortableItemWrapper({ id, disabled, children }: SortableItemWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: disabled ? undefined : 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...(disabled ? {} : listeners)}>
      {children}
    </div>
  );
}

// Props for the sortable grid
interface SortableGridProps<T extends SortableItem> {
  items: T[];
  disabled: boolean;
  gridClassName: string;
  onReorder: (reorderedItems: T[]) => void | Promise<void>;
  renderItem: (item: T) => ReactNode;
}

// Main sortable grid component
export function SortableGrid<T extends SortableItem>({
  items,
  disabled,
  gridClassName,
  onReorder,
  renderItem,
}: SortableGridProps<T>) {
  // Local state for optimistic updates
  const [localItems, setLocalItems] = useState<T[]>(items);

  // Sync local state when props change (e.g., after refetch)
  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = localItems.findIndex((item) => item.id === active.id);
    const newIndex = localItems.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedItems = arrayMove(localItems, oldIndex, newIndex);

    // Optimistic update: immediately update local state
    setLocalItems(reorderedItems);

    // Then persist to backend (fire and forget)
    onReorder(reorderedItems);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={localItems.map((item) => item.id)} strategy={rectSortingStrategy}>
        <div className={gridClassName}>
          {localItems.map((item) => (
            <SortableItemWrapper key={item.id} id={item.id} disabled={disabled}>
              {renderItem(item)}
            </SortableItemWrapper>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
