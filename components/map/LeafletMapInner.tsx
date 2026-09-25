'use client';

/**
 * The real Leaflet map. Never import this file directly — Leaflet touches
 * `window` at module load, so it must only be reached through the
 * `ssr: false` dynamic import in `components/LeafletMap.tsx`.
 */

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { LoaderCircle, LocateFixed, Users, Wrench } from 'lucide-react';
import {
  CATEGORY_META,
  DEDUP_RADIUS_METERS,
  SEVERITY_META,
  STATUS_META,
  type CivicTicket,
  type GeoPoint,
  type ToolDepot,
} from '@/types/civic';
import { PLACEHOLDER_IMAGE, TKR_COLLEGE_CENTER } from '@/lib/seedData';
import { isDemoTicket } from '@/lib/demo';
import { cn } from '@/lib/cn';
import { useTranslate } from '@/components/AppLanguageProvider';

export interface LeafletMapProps {
  tickets?: CivicTicket[];
  center?: GeoPoint;
  zoom?: number;
  selectedTicketId?: string | null;
  onSelectTicket?: (ticketId: string) => void;
  /** Draws the 75 m deduplication radius around every master ticket. */
  showDedupRadius?: boolean;
  /** Enables picker mode: click or drag to place the report pin. */
  pickedLocation?: GeoPoint | null;
  onPickLocation?: (point: GeoPoint) => void;
  userLocation?: GeoPoint | null;
  /**
   * Shows a "Use my location" button on ordinary (non-picker) maps, so a
   * viewer can centre the map and light up their own blue dot without going
   * through onboarding or the report-intake picker. Ignored when
   * `onPickLocation` is set — that mode has its own locate button.
   */
  onLocateMe?: (point: GeoPoint) => void;
  className?: string;
  /** Free CSR-funded materials pickup points, shown behind the "Show Tool Depots" toggle. */
  depots?: ToolDepot[];
}

const RESOLVED_STATUSES = new Set<CivicTicket['status']>(['Resolved', 'Pending Citizen Confirmation']);

/**
 * Builds the teardrop severity pin. Only values from our own constant tables
 * (colours, emoji, counts) are interpolated — never user-supplied text — so
 * the raw HTML string cannot carry an injection.
 */
function ticketIcon(ticket: CivicTicket, selected: boolean): L.DivIcon {
  const resolved = RESOLVED_STATUSES.has(ticket.status);
  const color = resolved ? '#10b981' : SEVERITY_META[ticket.severity].pin;
  const breached = !resolved && ticket.sla.health === 'breached';
  const scale = selected ? 1.25 : 1;
  const count = ticket.impactCount > 1 ? Math.min(ticket.impactCount, 99) : 0;

  const html = `
    <div style="position:relative;width:34px;height:44px;transform:scale(${scale});transform-origin:bottom center;transition:transform .2s">
      ${breached ? `<span class="animate-ping" style="position:absolute;left:5px;top:3px;width:24px;height:24px;border-radius:9999px;background:${color};opacity:.55"></span>` : ''}
      <svg width="34" height="44" viewBox="0 0 34 44" style="position:absolute;inset:0;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">
        <path d="M17 1C8.2 1 1 8 1 16.8 1 28.5 17 43 17 43s16-14.5 16-26.2C33 8 25.8 1 17 1z" fill="${color}" stroke="${selected ? '#0f172a' : '#ffffff'}" stroke-width="2"/>
        <circle cx="17" cy="16.5" r="10" fill="#ffffff"/>
      </svg>
      <span style="position:absolute;left:0;top:6px;width:34px;text-align:center;font-size:13px;line-height:20px">${
        resolved ? '✅' : CATEGORY_META[ticket.category].icon
      }</span>
      ${
        count
          ? `<span style="position:absolute;right:-8px;top:-6px;min-width:18px;height:18px;padding:0 4px;border-radius:9999px;background:#0f172a;color:#fff;font:600 10px/18px system-ui,sans-serif;text-align:center;border:1.5px solid #fff">${count}</span>`
          : ''
      }
    </div>`;

  return L.divIcon({
    html,
    className: 'civic-pin',
    iconSize: [34, 44],
    iconAnchor: [17, 44],
    popupAnchor: [0, -40],
  });
}

const depotIcon = L.divIcon({
  html: `
    <div style="position:relative;width:30px;height:40px">
      <svg width="30" height="40" viewBox="0 0 30 40" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">
        <path d="M15 1C7.8 1 2 6.7 2 13.9 2 23.6 15 39 15 39s13-15.4 13-25.1C28 6.7 22.2 1 15 1z" fill="#2563eb" stroke="#fff" stroke-width="2"/>
        <circle cx="15" cy="14.5" r="9" fill="#fff"/>
      </svg>
      <span style="position:absolute;left:0;top:6px;width:30px;text-align:center;font-size:13px;line-height:18px">🔧</span>
    </div>`,
  className: 'civic-pin',
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  popupAnchor: [0, -36],
});

function DepotToggle({ enabled, onToggle }: { enabled: boolean; onToggle: (next: boolean) => void }) {
  const t = useTranslate();
  const wrapRef = useRef<HTMLLabelElement>(null);
  useEffect(() => {
    if (wrapRef.current) L.DomEvent.disableClickPropagation(wrapRef.current);
  }, []);

  return (
    <label
      ref={wrapRef}
      className="absolute left-3 top-3 z-[1000] flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-md"
    >
      <input
        type="checkbox"
        checked={enabled}
        onChange={(event) => onToggle(event.target.checked)}
        className="h-3.5 w-3.5 accent-blue-600"
      />
      <Wrench className="h-3.5 w-3.5 text-blue-600" /> {t(enabled ? 'Hide tool depots' : 'Show Tool Depots')}
    </label>
  );
}

const pickerIcon = L.divIcon({
  html: `
    <div style="position:relative;width:30px;height:42px">
      <svg width="30" height="42" viewBox="0 0 30 42" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))">
        <path d="M15 1C7.3 1 1 7.2 1 14.9 1 25.3 15 41 15 41s14-15.7 14-26.1C29 7.2 22.7 1 15 1z" fill="#2563eb" stroke="#fff" stroke-width="2"/>
        <circle cx="15" cy="15" r="5.5" fill="#fff"/>
      </svg>
    </div>`,
  className: 'civic-pin',
  iconSize: [30, 42],
  iconAnchor: [15, 42],
});

function FlyTo({ target, zoom }: { target: GeoPoint | null; zoom?: number }) {
  const map = useMap();
  const lat = target?.lat;
  const lng = target?.lng;

  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    map.flyTo([lat, lng], zoom ?? Math.max(map.getZoom(), 15), { duration: 0.8 });
  }, [map, lat, lng, zoom]);

  return null;
}

function PickerEvents({ onPick }: { onPick: (point: GeoPoint) => void }) {
  useMapEvents({
    click(event) {
      onPick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

function LocateControl({ onPick }: { onPick: (point: GeoPoint) => void }) {
  const t = useTranslate();
  const map = useMap();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (buttonRef.current) L.DomEvent.disableClickPropagation(buttonRef.current);
  }, []);

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setError('Location is not available in this browser.');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point: GeoPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyMeters: Math.round(position.coords.accuracy),
        };
        onPick(point);
        map.flyTo([point.lat, point.lng], 17, { duration: 0.8 });
        setLocating(false);
      },
      (geoError) => {
        setError(
          geoError.code === geoError.PERMISSION_DENIED
            ? 'Location permission denied — tap the map to place your pin.'
            : 'Could not get your location — tap the map to place your pin.',
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  };

  return (
    <div className="absolute right-3 top-3 z-[1000] flex flex-col items-end gap-2">
      <button
        ref={buttonRef}
        type="button"
        onClick={locate}
        disabled={locating}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-md hover:bg-slate-50 disabled:opacity-70"
      >
        {locating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4 text-blue-600" />}
        {locating ? t('Finding your location…') : t('Use my location')}
      </button>
      {error && (
        <div className="max-w-56 rounded-md bg-white/95 px-2.5 py-1.5 text-[11px] text-amber-700 shadow">{t(error)}</div>
      )}
    </div>
  );
}

function TicketPopup({ ticket, onSelect }: { ticket: CivicTicket; onSelect?: (id: string) => void }) {
  const t = useTranslate();
  const photo = ticket.beforePhotos[0];
  const breached = ticket.sla.health === 'breached' && !RESOLVED_STATUSES.has(ticket.status);

  return (
    <div className="w-60 font-sans">
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element -- evidence may be a base64 data: URL inside a Leaflet portal
        <img
          src={photo.url}
          alt={photo.caption ?? ticket.title}
          className="mb-2 h-28 w-full rounded-md object-cover"
          onError={(event) => {
            event.currentTarget.src = PLACEHOLDER_IMAGE;
          }}
        />
      )}
      <div className="text-sm font-semibold leading-snug text-slate-900">
        {CATEGORY_META[ticket.category].icon} {ticket.title}
      </div>
      {isDemoTicket(ticket) && (
        <div className="mt-1 rounded bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">
          {t('Illustrative sample — not a real report')}
        </div>
      )}
      <div className="mt-0.5 text-[11px] text-slate-500">
        {ticket.referenceCode}
        {ticket.location.address ? ` · ${ticket.location.address}` : ''}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-semibold', SEVERITY_META[ticket.severity].badgeClass)}>
          {t(SEVERITY_META[ticket.severity].label)}
        </span>
        <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-semibold', STATUS_META[ticket.status].badgeClass)}>
          {t(ticket.status)}
        </span>
        {breached && (
          <span className="rounded border border-red-400 bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {t('SLA Breached · Auto-Escalated')}
          </span>
        )}
      </div>
      {ticket.impactCount > 1 && (
        <div className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-700">
          <Users className="h-3.5 w-3.5" /> {t('Reported by')} {ticket.impactCount} {t('citizens')}
        </div>
      )}
      {onSelect && (
        <button
          type="button"
          onClick={() => onSelect(ticket.id)}
          className="mt-2 w-full rounded-md bg-slate-900 px-2 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
        >
          {t('View details')}
        </button>
      )}
    </div>
  );
}

export default function LeafletMapInner({
  tickets = [],
  center,
  zoom = 13,
  selectedTicketId = null,
  onSelectTicket,
  showDedupRadius = true,
  pickedLocation = null,
  onPickLocation,
  userLocation = null,
  onLocateMe,
  className,
  depots = [],
}: LeafletMapProps) {
  const t = useTranslate();
  const masters = tickets.filter((ticket) => ticket.isMaster);
  const duplicates = tickets.filter((ticket) => !ticket.isMaster);
  const selectedTicket = masters.find((ticket) => ticket.id === selectedTicketId) ?? null;
  const pickerEnabled = Boolean(onPickLocation);
  const initialCenter = center ?? pickedLocation ?? userLocation ?? TKR_COLLEGE_CENTER;
  const [depotsVisible, setDepotsVisible] = useState(false);

  return (
    <MapContainer
      center={[initialCenter.lat, initialCenter.lng]}
      zoom={zoom}
      scrollWheelZoom
      className={cn('h-full w-full', pickerEnabled && 'cursor-crosshair', className)}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      <FlyTo target={center ?? null} zoom={zoom} />
      <FlyTo target={selectedTicket?.location ?? null} />

      {depots.length > 0 && <DepotToggle enabled={depotsVisible} onToggle={setDepotsVisible} />}
      {depotsVisible &&
        depots.map((depot) => (
          <Marker key={depot.id} position={[depot.location.lat, depot.location.lng]} icon={depotIcon} zIndexOffset={500}>
            <Popup>
              <div className="w-52 font-sans">
                <div className="text-sm font-semibold text-slate-900">🔧 {depot.name}</div>
                <div className="mt-1 text-[11px] font-semibold uppercase text-slate-400">{t('Free CSR-funded stock')}</div>
                <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                  {depot.inventory.map((item) => (
                    <li key={item.item} className="flex justify-between gap-2">
                      <span>{item.item}</span>
                      <span className="font-semibold text-slate-800">×{item.quantity}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Popup>
          </Marker>
        ))}

      {showDedupRadius &&
        masters.map((ticket) => (
          <Circle
            key={`radius-${ticket.id}`}
            center={[ticket.location.lat, ticket.location.lng]}
            radius={DEDUP_RADIUS_METERS}
            pathOptions={{
              color: SEVERITY_META[ticket.severity].pin,
              weight: 1.5,
              dashArray: '4 6',
              fillOpacity: ticket.id === selectedTicketId ? 0.18 : 0.08,
            }}
          />
        ))}

      {duplicates.map((ticket) => (
        <CircleMarker
          key={`dup-${ticket.id}`}
          center={[ticket.location.lat, ticket.location.lng]}
          radius={4}
          pathOptions={{ color: '#475569', weight: 1, fillColor: '#94a3b8', fillOpacity: 0.9 }}
        />
      ))}

      {masters.map((ticket) => (
        <Marker
          key={ticket.id}
          position={[ticket.location.lat, ticket.location.lng]}
          icon={ticketIcon(ticket, ticket.id === selectedTicketId)}
          zIndexOffset={ticket.id === selectedTicketId ? 1000 : SEVERITY_META[ticket.severity].rank * 10}
        >
          <Popup>
            <TicketPopup ticket={ticket} onSelect={onSelectTicket} />
          </Popup>
        </Marker>
      ))}

      {!pickerEnabled && onLocateMe && <LocateControl onPick={onLocateMe} />}

      {userLocation && (
        <>
          {userLocation.accuracyMeters !== undefined && (
            <Circle
              center={[userLocation.lat, userLocation.lng]}
              radius={userLocation.accuracyMeters}
              pathOptions={{ color: '#3b82f6', weight: 1, fillOpacity: 0.1 }}
            />
          )}
          <CircleMarker
            center={[userLocation.lat, userLocation.lng]}
            radius={7}
            pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#2563eb', fillOpacity: 1 }}
          />
        </>
      )}

      {pickerEnabled && onPickLocation && (
        <>
          <PickerEvents onPick={onPickLocation} />
          <LocateControl onPick={onPickLocation} />
          {pickedLocation && (
            <Marker
              position={[pickedLocation.lat, pickedLocation.lng]}
              icon={pickerIcon}
              draggable
              zIndexOffset={2000}
              eventHandlers={{
                dragend(event) {
                  const { lat, lng } = (event.target as L.Marker).getLatLng();
                  onPickLocation({ lat, lng });
                },
              }}
            />
          )}
        </>
      )}
    </MapContainer>
  );
}
