import type { ReactNode } from 'react';
import styles from './Badge.module.css';

type Tone = 'ok' | 'warn' | 'crit' | 'info' | 'neutral';

export function Badge({
  tone = 'neutral',
  icon,
  title,
  children,
}: {
  tone?: Tone;
  icon?: ReactNode;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span className={styles.badge} data-tone={tone} title={title}>
      {icon}
      {children}
    </span>
  );
}

const ORDER_TONE: Record<string, Tone> = {
  pending: 'neutral',
  assigned: 'info',
  in_transit: 'warn',
  delivered: 'ok',
  failed: 'crit',
};
const MAP_TONE: Record<string, Tone> = { idle: 'neutral', loading: 'info', in_transit: 'warn' };

export function StatusBadge({ status, kind = 'order' }: { status: string; kind?: 'order' | 'map' }) {
  const tone = (kind === 'map' ? MAP_TONE : ORDER_TONE)[status] ?? 'neutral';
  return <Badge tone={tone}>{status.replace(/_/g, ' ')}</Badge>;
}
