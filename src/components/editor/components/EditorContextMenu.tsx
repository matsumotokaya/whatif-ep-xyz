import { useEffect, useLayoutEffect, useRef } from 'react';
import { useEventCallback } from '../hooks/useEventCallback';

export interface ContextMenuItem {
  key: string;
  label: string;
  // Keyboard shortcut shown on the right, already formatted for the platform.
  hint?: string;
  disabled?: boolean;
  onSelect: () => void;
}

interface EditorContextMenuProps {
  // Viewport position of the pointer when the menu was requested.
  x: number;
  y: number;
  // Groups are separated by a divider. Empty groups are skipped.
  groups: ContextMenuItem[][];
  onClose: () => void;
}

const VIEWPORT_MARGIN = 8;

// Right-click menu for the canvas.
export function EditorContextMenu({ x, y, groups, onClose }: EditorContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const close = useEventCallback(onClose);

  // Keep the whole menu on screen: pull it back from the right and bottom
  // edges once its size is known.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const { width, height } = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(VIEWPORT_MARGIN, Math.min(x, window.innerWidth - width - VIEWPORT_MARGIN))}px`;
    menu.style.top = `${Math.max(VIEWPORT_MARGIN, Math.min(y, window.innerHeight - height - VIEWPORT_MARGIN))}px`;
    menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
  }, [x, y]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) close();
    };

    // While the menu is open the keyboard belongs to it: no key may reach the
    // editor shortcuts (Escape would clear the selection, arrows would nudge).
    const handleKeyDown = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        close();
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

      event.preventDefault();
      const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
      if (items.length === 0) return;
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      items[(current + step + items.length) % items.length].focus({ preventScroll: true });
    };

    // Capture phase: the menu reacts before the canvas or the editor shortcuts.
    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('wheel', close, { passive: true });
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('wheel', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
    };
  }, [close]);

  const visibleGroups = groups.filter((group) => group.length > 0);

  return (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-[130] min-w-52 overflow-hidden rounded-lg border border-[#444444] bg-[#1a1a1a] py-1 shadow-2xl"
      style={{ left: x, top: y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {visibleGroups.map((group, index) => (
        <div key={group[0].key} className={index > 0 ? 'mt-1 border-t border-[#2b2b2b] pt-1' : undefined}>
          {group.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                close();
                item.onSelect();
              }}
              className="flex w-full items-center justify-between gap-6 px-3 py-1.5 text-left text-sm text-gray-200 transition-colors hover:bg-[#333333] focus-visible:bg-[#333333] disabled:text-gray-600 disabled:hover:bg-transparent"
            >
              <span>{item.label}</span>
              {item.hint && <span className="text-xs tabular-nums text-gray-500">{item.hint}</span>}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
