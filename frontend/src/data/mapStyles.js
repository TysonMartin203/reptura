// All free, no API key required. Note: Esri's ArcGIS tile services use a
// {z}/{y}/{x} URL order (y before x) — different from the {z}/{x}/{y} order
// most other providers (including OpenStreetMap below) use.
// "reptura" reuses the Light Gray base with a CSS filter tinting it toward
// the app's own cream/warm palette — verified to keep the orange route line
// clearly visible against the tinted background before shipping this.
export const MAP_STYLES = {
  reptura: { label: 'Reptura', url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', maxZoom: 16, filter: 'sepia(.25) saturate(1.1) hue-rotate(-10deg) brightness(1.08)' },
  standard: { label: 'Standard', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19 },
  light:    { label: 'Light',    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', maxZoom: 16 },
  dark:     { label: 'Dark',     url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', maxZoom: 16 },
  terrain:  { label: 'Terrain',  url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', maxZoom: 17 },
};

export const MAP_STYLE_STORAGE_KEY = 'reptura_map_style';

export function getSavedMapStyle() {
  const saved = localStorage.getItem(MAP_STYLE_STORAGE_KEY);
  return saved && MAP_STYLES[saved] ? saved : 'reptura';
}
