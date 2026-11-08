import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Opportunity } from '../types'

/** OpenStreetMap map (no API key). Shows the search center, radius and numbered result pins. */
export function MapView({ origin, radius, items, activeId, onSelect }: { origin: { lat: number; lng: number; label: string }; radius: number; items: Opportunity[]; activeId: string | null; onSelect: (id: string) => void }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const markers = useRef(new Map<string, L.Marker>())

  useEffect(() => {
    if (!el.current || map.current) return
    map.current = L.map(el.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false })
    // Tile server is configurable at build time. These values are PUBLIC (they ship to the browser),
    // so if your provider needs a key, use a browser key restricted to your domain in its dashboard.
    const tileUrl = (import.meta.env.VITE_MAP_TILE_URL as string | undefined) || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    const attribution = (import.meta.env.VITE_MAP_ATTRIBUTION as string | undefined) || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    L.tileLayer(tileUrl, { maxZoom: 18, attribution }).addTo(map.current)
    layer.current = L.layerGroup().addTo(map.current)
    const ro = new ResizeObserver(() => map.current?.invalidateSize())
    ro.observe(el.current)
    return () => {
      ro.disconnect()
      map.current?.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    const m = map.current
    const g = layer.current
    if (!m || !g) return
    g.clearLayers()
    markers.current.clear()
    L.circle([origin.lat, origin.lng], { radius: radius * 1609.34, color: '#717744', weight: 2, fillColor: '#BCBD8B', fillOpacity: 0.15 }).addTo(g)
    L.marker([origin.lat, origin.lng], { icon: L.divIcon({ className: 'vt-origin', iconSize: [18, 18] }), keyboard: false, title: origin.label }).addTo(g)
    items
      .filter((o) => o.lat != null && o.lng != null)
      .forEach((o, i) => {
        const mk = L.marker([o.lat!, o.lng!], {
          icon: L.divIcon({ className: '', html: `<div class="vt-pin" style="width:26px;height:26px">${i + 1}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }),
          title: o.title,
          alt: o.title,
        })
          .on('click', () => onSelect(o.id))
          .addTo(g)
        markers.current.set(o.id, mk)
      })
    // compute bounds directly (circle.getBounds() needs a fully laid-out map); fit after layout settles
    const bounds = L.latLng(origin.lat, origin.lng).toBounds(radius * 1609.34 * 2)
    const fit = () => {
      if (!map.current) return
      map.current.invalidateSize()
      map.current.fitBounds(bounds, { padding: [12, 12] })
    }
    fit()
    const t = setTimeout(fit, 250)
    return () => clearTimeout(t)
  }, [origin.lat, origin.lng, origin.label, radius, items, onSelect])

  useEffect(() => {
    markers.current.forEach((mk, id) => mk.getElement()?.querySelector('.vt-pin')?.classList.toggle('active', id === activeId))
  }, [activeId, items])

  return <div ref={el} className="h-full min-h-[320px] w-full overflow-hidden rounded-xl" role="region" aria-label={`Map of ${items.length} opportunities within ${radius} miles of ${origin.label}`} />
}
