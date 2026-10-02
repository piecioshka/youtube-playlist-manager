import { useRef, useState, type PointerEvent, type RefObject } from 'react';
import type { PlaylistVideo } from '../youtube/types';
import { dropIndex, type DropPlacement } from './reorder';

// Przeciągany film i miejsce, nad którym jest wskaźnik (overId to null poza listą)
type Drag = {
  itemId: string;
  overId: string | null;
  placement: DropPlacement;
} | null;

type DropTarget = { overId: string; placement: DropPlacement };

export type DragHandlers = {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
};

export type VideoDrag = {
  // Element, którego kolejne dzieci odpowiadają kolejnym filmom
  listRef: RefObject<HTMLTableSectionElement | null>;
  draggingId: string | null;
  dropIndicator: (index: number, itemId: string) => DropPlacement | null;
  handlers: (itemId: string) => DragHandlers;
};

// Tak blisko krawędzi okna palec zaczyna przewijać stronę
const SCROLL_EDGE = 56;
const SCROLL_STEP = 14;

// Uchwyt blokuje zwykłe przewijanie dotykiem, więc przy krawędzi okna przewijamy sami
function scrollNearEdge(clientY: number) {
  if (clientY < SCROLL_EDGE) {
    window.scrollBy(0, -SCROLL_STEP);
  } else if (clientY > window.innerHeight - SCROLL_EDGE) {
    window.scrollBy(0, SCROLL_STEP);
  }
}

/*
 * Przeciąganie filmów za uchwyt na zdarzeniach wskaźnika, więc tak samo myszą,
 * palcem i rysikiem (przeciąganie HTML5 nie działa pod palcem).
 */
export function useVideoDrag(
  videos: PlaylistVideo[],
  onMove: (from: number, to: number) => void,
): VideoDrag {
  const [drag, setDrag] = useState<Drag>(null);
  const listRef = useRef<HTMLTableSectionElement>(null);

  // Górna połowa wiersza to „przed”, dolna „za”; poza listą nie ma celu
  function targetAt(clientY: number): DropTarget | null {
    const rows = listRef.current?.children;
    if (rows === undefined) {
      return null;
    }
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows.item(index);
      const video = videos[index];
      if (row === null || video === undefined) {
        continue;
      }
      const rect = row.getBoundingClientRect();
      if (clientY >= rect.top && clientY < rect.bottom) {
        return {
          overId: video.itemId,
          placement: clientY < rect.top + rect.height / 2 ? 'before' : 'after',
        };
      }
    }
    return null;
  }

  function indexOf(itemId: string): number {
    return videos.findIndex((video) => video.itemId === itemId);
  }

  function handlers(itemId: string): DragHandlers {
    return {
      onPointerDown(event) {
        // Tylko główny przycisk myszy; palec i rysik też zgłaszają się jako 0
        if (event.button !== 0) {
          return;
        }
        // Bez tego mysz zaznaczałaby tekst pod kursorem
        event.preventDefault();
        // Kolejne zdarzenia trafiają do uchwytu, także gdy wskaźnik zjedzie z wiersza
        event.currentTarget.setPointerCapture(event.pointerId);
        setDrag({ itemId, overId: null, placement: 'after' });
      },
      onPointerMove(event) {
        if (drag === null) {
          return;
        }
        scrollNearEdge(event.clientY);
        const target = targetAt(event.clientY);
        const overId = target?.overId ?? null;
        const placement = target?.placement ?? drag.placement;
        if (overId !== drag.overId || placement !== drag.placement) {
          setDrag({ ...drag, overId, placement });
        }
      },
      onPointerUp(event) {
        if (drag === null) {
          return;
        }
        setDrag(null);
        const target = targetAt(event.clientY);
        const from = indexOf(drag.itemId);
        const over = target === null ? -1 : indexOf(target.overId);
        if (target === null || from < 0 || over < 0) {
          return;
        }
        const to = dropIndex(from, over, target.placement);
        if (to !== from) {
          onMove(from, to);
        }
      },
      onPointerCancel() {
        setDrag(null);
      },
    };
  }

  // Wskaźnik pojawia się tylko tam, gdzie upuszczenie zmieni kolejność
  function dropIndicator(index: number, itemId: string): DropPlacement | null {
    if (drag === null || drag.overId !== itemId) {
      return null;
    }
    const from = indexOf(drag.itemId);
    if (from < 0) {
      return null;
    }
    return dropIndex(from, index, drag.placement) === from
      ? null
      : drag.placement;
  }

  return {
    listRef,
    draggingId: drag?.itemId ?? null,
    dropIndicator,
    handlers,
  };
}
