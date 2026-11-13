import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CloudFog,
  CloudLightning,
  CloudRain,
  Droplets,
  Pause,
  Play,
  RefreshCw,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  CameraPreset,
  TerrariumSettings,
  VesselStyle,
  WeatherType,
} from '../types/terrarium';

interface ControlDockProps {
  settings: TerrariumSettings;
  formattedTime: string;
  activeCamera: CameraPreset;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onUpdateSettings: (patch: Partial<TerrariumSettings>) => void;
  onSelectCamera: (preset: CameraPreset) => void;
  onMistBurst: () => void;
  onRegenerateBiome: () => void;
}

type MobileTab = 'lighting' | 'weather' | 'biome';

const WEATHER_OPTIONS: { id: WeatherType; label: string; icon: typeof Sun }[] = [
  { id: 'clear', label: 'Clear', icon: Sun },
  { id: 'mist', label: 'Mist', icon: CloudFog },
  { id: 'rain', label: 'Rain', icon: CloudRain },
  { id: 'storm', label: 'Storm', icon: CloudLightning },
];

const VESSEL_OPTIONS: { id: VesselStyle; label: string }[] = [
  { id: 'wardian', label: 'Wardian' },
  { id: 'cloche', label: 'Cloche' },
  { id: 'geodesic', label: 'Dome' },
];

const CAMERA_OPTIONS: { id: CameraPreset; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'canopy', label: 'Canopy' },
  { id: 'moss', label: 'Moss' },
  { id: 'pond', label: 'Pond' },
];

const TIME_PRESETS: { label: string; hour: number }[] = [
  { label: 'Dawn', hour: 6.5 },
  { label: 'Noon', hour: 13.0 },
  { label: 'Golden', hour: 17.5 },
  { label: 'Night', hour: 22.5 },
];

export function ControlDock({
  settings,
  formattedTime,
  activeCamera,
  collapsed,
  onToggleCollapse,
  onUpdateSettings,
  onSelectCamera,
  onMistBurst,
  onRegenerateBiome,
}: ControlDockProps) {
  const [mobileTab, setMobileTab] = useState<MobileTab>('lighting');

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(920px,94vw)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        collapsed ? 'translate-y-[calc(100%+18px)]' : 'translate-y-0'
      }`}
    >
      {/* Collapse / Expand Drawer Handle */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-t-xl bg-[#121614]/92 border border-b-0 border-white/12 text-xs font-medium text-[#cfd6d2] hover:text-white transition-colors whitespace-nowrap ${
            collapsed ? '-translate-y-9 rounded-b-xl border-b shadow-lg' : ''
          }`}
        >
          {collapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Show Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Hide Controls</span>
            </>
          )}
        </button>
      </div>

      {/* Main Unified Bottom Dock (solid/rgba surface — zero backdrop-filter over WebGL) */}
      <div className="rounded-2xl bg-[#121614]/92 border border-white/12 px-4 py-3 shadow-2xl text-[#f2f1ec]">
        {/* Mobile Tab Switcher (keeps mobile height <= 15% cap) */}
        <div className="flex md:hidden items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-white/10">
          <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg">
            {(
              [
                { id: 'lighting', label: 'Lighting' },
                { id: 'weather', label: 'Weather' },
                { id: 'biome', label: 'Biome & View' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMobileTab(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  mobileTab === tab.id
                    ? 'bg-emerald-500/20 text-[#86efac]'
                    : 'text-[#a6b2ac] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
            aria-label={settings.soundEnabled ? 'Mute sound' : 'Enable sound'}
            className="p-1.5 rounded-lg bg-white/5 text-[#cfd6d2] hover:text-white"
          >
            {settings.soundEnabled ? (
              <Volume2 className="w-4 h-4 text-[#86efac]" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Desktop 2-Row Compact Layout / Mobile Tabbed Content */}
        <div className="flex flex-col gap-2.5">
          {/* Row 1: Day/Night Lighting & Utility Actions */}
          <div
            className={`${
              mobileTab === 'lighting' ? 'flex' : 'hidden md:flex'
            } flex-wrap items-center justify-between gap-3`}
          >
            <div className="flex items-center gap-3 flex-1 min-w-[240px]">
              <span className="text-xs font-medium text-[#a6b2ac] whitespace-nowrap">
                Time
              </span>
              <span className="text-xs font-mono-tabular text-[#f2f1ec] w-11 whitespace-nowrap">
                {formattedTime}
              </span>
              <input
                type="range"
                min={0}
                max={24}
                step={0.05}
                value={settings.timeOfDay}
                aria-label="Time of day"
                onChange={(e) =>
                  onUpdateSettings({
                    timeOfDay: parseFloat(e.target.value),
                    autoCycle: false,
                  })
                }
                className="wardian-slider flex-1 min-w-[90px]"
              />
              <button
                type="button"
                onClick={() => onUpdateSettings({ autoCycle: !settings.autoCycle })}
                aria-label={settings.autoCycle ? 'Pause day-night cycle' : 'Play day-night cycle'}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  settings.autoCycle
                    ? 'bg-emerald-500/20 text-[#86efac] border border-emerald-400/25'
                    : 'bg-white/6 text-[#cfd6d2] hover:text-white border border-transparent'
                }`}
              >
                {settings.autoCycle ? (
                  <Pause className="w-3 h-3" />
                ) : (
                  <Play className="w-3 h-3" />
                )}
                <span>Cycle</span>
              </button>
            </div>

            {/* Time Presets */}
            <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg shrink-0">
              {TIME_PRESETS.map((preset) => {
                const isNear = Math.abs(settings.timeOfDay - preset.hour) < 1.1;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ timeOfDay: preset.hour, autoCycle: false })
                    }
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      isNear
                        ? 'bg-white/14 text-white'
                        : 'text-[#a6b2ac] hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Sound Toggle (Desktop) */}
            <button
              type="button"
              onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
              aria-label={settings.soundEnabled ? 'Mute sound' : 'Enable sound'}
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                settings.soundEnabled
                  ? 'bg-emerald-500/20 text-[#86efac]'
                  : 'bg-white/6 text-[#a6b2ac] hover:text-white'
              }`}
            >
              {settings.soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" />
              )}
              <span>{settings.soundEnabled ? 'Sound On' : 'Muted'}</span>
            </button>
          </div>

          {/* Row 2: Weather, Vessel & Camera */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 md:border-t md:border-white/8">
            {/* Weather Controls */}
            <div
              className={`${
                mobileTab === 'weather' ? 'flex' : 'hidden md:flex'
              } items-center gap-2 flex-wrap`}
            >
              <span className="text-xs font-medium text-[#a6b2ac] whitespace-nowrap">
                Weather
              </span>
              <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg">
                {WEATHER_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = settings.weather === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onUpdateSettings({ weather: opt.id })}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-emerald-500/20 text-[#86efac]'
                          : 'text-[#a6b2ac] hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={onMistBurst}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/7 hover:bg-white/12 text-xs font-medium text-[#dce8e2] transition-colors whitespace-nowrap shrink-0"
              >
                <Droplets className="w-3.5 h-3.5 text-[#86efac]" />
                <span>Mist Burst</span>
              </button>
            </div>

            {/* Vessel, Biome Seed & Camera Presets */}
            <div
              className={`${
                mobileTab === 'biome' ? 'flex' : 'hidden md:flex'
              } items-center gap-2 flex-wrap`}
            >
              <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg">
                {VESSEL_OPTIONS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onUpdateSettings({ vesselStyle: v.id })}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      settings.vesselStyle === v.id
                        ? 'bg-white/14 text-white'
                        : 'text-[#a6b2ac] hover:text-white'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg">
                {CAMERA_OPTIONS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectCamera(c.id)}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      activeCamera === c.id
                        ? 'bg-white/14 text-white'
                        : 'text-[#a6b2ac] hover:text-white'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={onRegenerateBiome}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/7 hover:bg-white/12 text-xs font-medium text-[#dce8e2] transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>New Biome</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
