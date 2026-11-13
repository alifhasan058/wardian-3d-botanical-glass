import { useEffect, useRef, useState } from 'react';
import { TerrariumEngine } from '../three/TerrariumEngine';
import type { CameraPreset, SpecimenInfo, TerrariumSettings } from '../types/terrarium';

interface TerrariumCanvasProps {
  settings: TerrariumSettings;
  engineRef: React.MutableRefObject<TerrariumEngine | null>;
  onSelectSpecimen: (specimen: SpecimenInfo | null) => void;
  onTimeTick: (hour: number) => void;
}

export function TerrariumCanvas({
  settings,
  engineRef,
  onSelectSpecimen,
  onTimeTick,
}: TerrariumCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);

  const callbacksRef = useRef({ onSelectSpecimen, onTimeTick });
  callbacksRef.current = { onSelectSpecimen, onTimeTick };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new TerrariumEngine(container, settings, {
      onSelectSpecimen: (spec) => callbacksRef.current.onSelectSpecimen(spec),
      onTimeTick: (hr) => callbacksRef.current.onTimeTick(hr),
      onContextLostChange: (lost) => setContextLost(lost),
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // Initialize WebGL scene exactly once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.updateSettings(settings);
  }, [settings, engineRef]);

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden">
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        aria-label="Interactive 3D Glass Terrarium Viewport"
      />
      {contextLost && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#121614] text-[#f2f1ec]">
          <div className="px-6 py-5 rounded-xl bg-[#1a201d] border border-white/10 text-center max-w-sm">
            <p className="font-display text-2xl font-medium mb-1">Display Interrupted</p>
            <p className="text-sm text-[#a6b0ab]">
              The 3D graphics context was suspended. Refresh or wait a moment for restoration.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export type { CameraPreset };
