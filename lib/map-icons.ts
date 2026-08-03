import L from 'leaflet'

// Общая иконка метки склада — используется и на карте продавца (ZoneMapEditor),
// и на карте курьера (MapGL), чтобы склад всегда выглядел одинаково и отличался
// от круглых точек заказов/цветных пинов стадий курьера.
export function buildWarehouseIcon() {
  const size = 40
  const svg =
    `<svg width="${size}" height="${size + 8}" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg">` +
    `<path d="M20 0C8.954 0 0 8.954 0 20C0 35 20 48 20 48C20 48 40 35 40 20C40 8.954 31.046 0 20 0Z" fill="#7c3aed"/>` +
    `<path d="M11 21L20 14L29 21V33H11V21Z" fill="white"/>` +
    `<rect x="17.5" y="25" width="5" height="8" fill="#7c3aed"/>` +
    '</svg>'

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size + 8],
    popupAnchor: [0, -(size + 8)],
  })
}
