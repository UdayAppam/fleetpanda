import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

export function PageHeader({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: string;
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className={styles.head}>
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className={styles.title}>{title}</h1>
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
