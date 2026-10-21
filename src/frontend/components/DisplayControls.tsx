import LanguageSwitcher from './LanguageSwitcher';
import ThemeToggle from './ThemeToggle';
import styles from './DisplayControls.module.css';

interface DisplayControlsProps {
  className?: string;
  languageVariant?: 'pill' | 'compact' | 'select';
  languageClassName?: string;
}

export default function DisplayControls({
  className = '',
  languageVariant = 'pill',
  languageClassName,
}: DisplayControlsProps) {
  return (
    <div className={`${styles['display-controls']}${className ? ` ${className}` : ''}`}>
      <LanguageSwitcher variant={languageVariant} className={languageClassName} />
      <ThemeToggle />
    </div>
  );
}
