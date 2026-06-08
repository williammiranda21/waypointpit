import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useGeolocation } from '@/hooks/useGeolocation';
import { pointInPolygon } from '@/components/map/geo';
import type { Zone } from '@/lib/db/zones';

interface GeofenceBannerProps {
  zone: Zone;
}

/**
 * Live banner shown while volunteer is in /count/*. When their GPS position
 * falls outside the assigned zone polygon, it shows a red warning. When inside
 * (or while waiting for the first fix), it renders nothing.
 */
export function GeofenceBanner({ zone }: GeofenceBannerProps) {
  const { t } = useTranslation();
  const { position } = useGeolocation({ watch: true, highAccuracy: true, throttleMs: 5000 });

  const outside = useMemo(() => {
    if (!position) return null;
    return !pointInPolygon([position.lng, position.lat], zone.geometry);
  }, [position, zone.geometry]);

  if (outside !== true) return null;

  return (
    <div
      role="alert"
      className="bg-red-50 border-b border-red-200 text-status-alert px-4 py-2 flex items-center gap-2 text-sm"
    >
      <AlertTriangle size={16} className="shrink-0" />
      <span className="min-w-0">{t('volunteer.geofenceOutside', { zone: zone.name })}</span>
    </div>
  );
}
