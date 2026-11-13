export type WeatherType = 'clear' | 'mist' | 'rain' | 'storm';

export type VesselStyle = 'wardian' | 'cloche' | 'geodesic';

export type CameraPreset = 'overview' | 'canopy' | 'moss' | 'pond';

export interface SpecimenInfo {
  id: string;
  commonName: string;
  latinName: string;
  category: 'Canopy' | 'Understory' | 'Succulent' | 'Fungi' | 'Hardscape';
  humidityPreference: string;
  notes: string;
}

export interface TerrariumSettings {
  timeOfDay: number; // 0 to 24 hours
  autoCycle: boolean;
  weather: WeatherType;
  vesselStyle: VesselStyle;
  biomeSeed: number;
  soundEnabled: boolean;
}

export interface MicroclimateMetrics {
  temperatureC: number;
  humidityPct: number;
  lightLabel: string;
}
