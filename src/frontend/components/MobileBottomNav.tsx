/**
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
}

export default function MobileBottomNav({ items, scrollable = false }: MobileBottomNavProps) {
  return (
    <nav
      className={`mobile-bottom-nav${scrollable ? ' mobile-bottom-nav--scroll' : ''}`}
      aria-label="Main navigation"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`mobile-bottom-nav-item${item.active ? ' active' : ''}`}
          onClick={item.onClick}
          aria-current={item.active ? 'page' : undefined}
          title={item.label}
        >
          <span className="mobile-bottom-nav-icon" aria-hidden>
            {item.icon}
          </span>
          <span className="mobile-bottom-nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
