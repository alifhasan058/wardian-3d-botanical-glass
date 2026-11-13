import { X } from 'lucide-react';
import type { MicroclimateMetrics, SpecimenInfo } from '../types/terrarium';

interface TopOverlayProps {
  formattedTime: string;
  metrics: MicroclimateMetrics;
  selectedSpecimen: SpecimenInfo | null;
  onCloseSpecimen: () => void;
}

export function TopOverlay({
  formattedTime,
  metrics,
  selectedSpecimen,
  onCloseSpecimen,
}: TopOverlayProps) {
  return (
    <div className="fixed inset-x-0 top-0 z-20 pointer-events-none flex items-start justify-between gap-4 p-4 sm:p-6">
      {/* Top-Left Brand & Live Microclimate Readout (unboxed text, zero pills, zero pulsing dots) */}
      <div className="pointer-events-auto px-4 py-2.5 rounded-xl bg-[#121614]/88 border border-white/10 shadow-lg">
        <h1 className="font-display text-2xl sm:text-[26px] font-medium leading-none tracking-tight text-[#f4f3ee]">
          Wardian
        </h1>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-[#b7c2bc] font-mono-tabular whitespace-nowrap">
          <span>{formattedTime}</span>
          <span aria-hidden="true" className="text-white/30">·</span>
          <span>{metrics.lightLabel}</span>
          <span aria-hidden="true" className="text-white/30">·</span>
          <span>{metrics.temperatureC}°C</span>
          <span aria-hidden="true" className="text-white/30">·</span>
          <span>{metrics.humidityPct}% RH</span>
        </div>
      </div>

      {/* Top-Right: Discreet Botanical Specimen Card on Click, or Quiet Interaction Hint */}
      {selectedSpecimen ? (
        <aside
          aria-label="Selected botanical specimen"
          className="pointer-events-auto w-72 sm:w-80 rounded-xl bg-[#121614]/92 border border-white/12 p-4 shadow-xl text-[#f2f1ec]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold leading-snug text-[#f2f1ec]">
                {selectedSpecimen.commonName}
              </h2>
              <p className="font-display italic text-base text-[#86efac] leading-tight mt-0.5">
                {selectedSpecimen.latinName}
              </p>
            </div>
            <button
              type="button"
              onClick={onCloseSpecimen}
              aria-label="Close specimen details"
              className="p-1.5 -m-1 rounded-lg text-[#9ca8a1] hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-xs text-[#a6b2ac]">
            <span>{selectedSpecimen.category}</span>
            <span aria-hidden="true" className="text-white/30">·</span>
            <span className="font-mono-tabular">{selectedSpecimen.humidityPreference}</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#cfd6d2]">
            {selectedSpecimen.notes}
          </p>
        </aside>
      ) : (
        <div className="hidden sm:block px-3.5 py-2 rounded-xl bg-[#121614]/80 border border-white/10 text-xs text-[#b7c2bc] whitespace-nowrap">
          Drag to orbit · Scroll to zoom · Click flora to inspect
        </div>
      )}
    </div>
  );
}
