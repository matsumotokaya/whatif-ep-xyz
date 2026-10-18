'use client';

// Same client-only boundary as EditClientOnly: Konva must never prerender.
import dynamic from 'next/dynamic';

const RenderBridge = dynamic(() => import('./RenderBridge').then((mod) => mod.RenderBridge), { ssr: false });

export function RenderBridgeClientOnly() {
  return <RenderBridge />;
}
