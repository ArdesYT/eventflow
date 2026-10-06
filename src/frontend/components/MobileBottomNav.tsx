import styles from './MobileBottomNav.module.css';/**
 * Mobil alsó navigációs sáv — booker és admin főnézetek váltásához.
 * Csak max-width: 768px alatt látszik (CSS).
 */

export interface MobileBottomNavItem {
  id: string;
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}

interface MobileBottomNavProps {
  items: MobileBottomNavItem[];
  /** Több menüpontnál vízszintesen görgethető (admin). */
  scrollable?: boolean;
  /** Admin: ikonokkal jeleníti meg a sok menüpontot. */
  iconOnly?: boolean;
}

export default function MobileBottomNav({ items, scrollable = false, iconOnly = false }: MobileBottomNavProps) {
  return (
    <nav
      className={`${styles['mobile-bottom-nav']}${scrollable ? ` ${styles['mobile-bottom-nav--scroll']}` : ''}${iconOnly ? ` ${styles['mobile-bottom-nav--icons']}` : ''}`}
      aria-label="Main navigation"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`${styles['mobile-bottom-nav-item']}${item.active ? ` ${styles.active}` : ''}`}
          onClick={item.onClick}
          aria-current={item.active ? 'page' : undefined}
          title={item.label}
        >
          <span className={styles['mobile-bottom-nav-icon']} aria-hidden>
            {item.icon}
          </span>
          <span className={styles['mobile-bottom-nav-label']}>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
