import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ControlDock } from './components/ControlDock';
import { TerrariumCanvas } from './components/TerrariumCanvas';
import { TopOverlay } from './components/TopOverlay';
import type { TerrariumEngine } from './three/TerrariumEngine';
import type {
  CameraPreset,
  MicroclimateMetrics,
  SpecimenInfo,
  TerrariumSettings,
} from './types/terrarium';

function formatHour(hour: number): string {
  const h = Math.floor(((hour % 24) + 24) % 24);
  const m = Math.floor((hour - Math.floor(hour)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function computeMicroclimate(settings: TerrariumSettings): MicroclimateMetrics {
  const h = ((settings.timeOfDay % 24) + 24) % 24;
  let lightLabel = 'Night';
  if (h >= 5.5 && h < 8.5) lightLabel = 'Dawn';
  else if (h >= 8.5 && h < 16.5) lightLabel = 'Daylight';
  else if (h >= 16.5 && h < 19.5) lightLabel = 'Golden Hour';
  else if (h >= 19.5 && h < 21.0) lightLabel = 'Twilight';

  // Diurnal temperature curve peaking around 14:30
  const sunCurve = Math.sin(((h - 5) / 18) * Math.PI);
  const weatherCool =
    settings.weather === 'storm'
      ? -3.2
      : settings.weather === 'rain'
        ? -2.1
        : settings.weather === 'mist'
          ? -1.2
          : 0;
  const temperatureC = Math.round(18.5 + Math.max(-1, sunCurve) * 4.8 + weatherCool);

  const baseRh =
    settings.weather === 'storm'
      ? 92
      : settings.weather === 'rain'
        ? 86
        : settings.weather === 'mist'
          ? 81
          : 64;
  const humidityPct = Math.min(98, Math.round(baseRh + (1 - Math.max(0, sunCurve)) * 5));

  return { temperatureC, humidityPct, lightLabel };
}

export default function App() {
  const engineRef = useRef<TerrariumEngine | null>(null);

  const [settings, setSettings] = useState<TerrariumSettings>({
    timeOfDay: 13.5,
    autoCycle: false,
    weather: 'clear',
    vesselStyle: 'wardian',
    biomeSeed: 104729,
    soundEnabled: false,
  });

  const [selectedSpecimen, setSelectedSpecimen] = useState<SpecimenInfo | null>(null);
  const [activeCamera, setActiveCamera] = useState<CameraPreset>('overview');
  const [dockCollapsed, setDockCollapsed] = useState(false);

  const handleUpdateSettings = useCallback((patch: Partial<TerrariumSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleTimeTick = useCallback((hour: number) => {
    setSettings((prev) => (prev.autoCycle ? { ...prev, timeOfDay: hour } : prev));
  }, []);

  const handleSelectCamera = useCallback((preset: CameraPreset) => {
    setActiveCamera(preset);
    engineRef.current?.setCameraPreset(preset);
  }, []);

  const handleMistBurst = useCallback(() => {
    engineRef.current?.triggerMistBurst();
  }, []);

  const handleRegenerateBiome = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      biomeSeed: Math.floor(Math.random() * 899999) + 100000,
    }));
  }, []);

  // Keyboard shortcut 'H' to toggle Cinema/Zen mode (collapse bottom dock)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((c) => !c);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const formattedTime = useMemo(() => formatHour(settings.timeOfDay), [settings.timeOfDay]);
  const metrics = useMemo(() => computeMicroclimate(settings), [settings]);

  return (
    <main className="relative w-screen h-screen overflow-hidden select-none">
      <TerrariumCanvas
        settings={settings}
        engineRef={engineRef}
        onSelectSpecimen={setSelectedSpecimen}
        onTimeTick={handleTimeTick}
      />

      <TopOverlay
        formattedTime={formattedTime}
        metrics={metrics}
        selectedSpecimen={selectedSpecimen}
        onCloseSpecimen={() => setSelectedSpecimen(null)}
      />

      <ControlDock
        settings={settings}
        formattedTime={formattedTime}
        activeCamera={activeCamera}
        collapsed={dockCollapsed}
        onToggleCollapse={() => setDockCollapsed((c) => !c)}
        onUpdateSettings={handleUpdateSettings}
        onSelectCamera={handleSelectCamera}
        onMistBurst={handleMistBurst}
        onRegenerateBiome={handleRegenerateBiome}
      />
    </main>
  );
}
