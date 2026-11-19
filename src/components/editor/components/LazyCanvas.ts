import { lazy } from 'react';

// Konva is the heaviest part of the editor bundle. Loading the canvas lazily
// lets the document request and the editor chrome start before it arrives.
export const LazyCanvas = lazy(() => import('./Canvas').then((module) => ({ default: module.Canvas })));
