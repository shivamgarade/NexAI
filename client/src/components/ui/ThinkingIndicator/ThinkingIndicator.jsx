import PropTypes from 'prop-types';
import loadingAnimationSvg from '@/assets/loading-animation.svg';
import logoImg from '@/assets/logo.png';
import { cn } from '@/lib/utils/cn';
import styles from './ThinkingIndicator.module.scss';

/**
 * ThinkingIndicator component for AI streaming & reasoning states.
 * Renders the high-performance orbital pulse loading animation by default.
 */
export function ThinkingIndicator({
  variant = 'dots',
  size = 'sm',
  className = '',
  'aria-label': ariaLabel = 'NexAI is thinking...',
}) {
  const sizeClass = styles[`size_${size}`] || styles.size_sm;

  if (variant === 'spinner') {
    return (
      <div
        className={cn(styles.spinnerWrapper, sizeClass, className)}
        role="status"
        aria-label={ariaLabel}
      >
        <img
          src={loadingAnimationSvg}
          alt="NexAI thinking..."
          className={styles.spinnerImg}
        />
      </div>
    );
  }

  if (variant === 'legacy-logo') {
    return (
      <div
        className={cn(styles.logoWrapper, sizeClass, className)}
        role="status"
        aria-label={ariaLabel}
      >
        <div className={styles.energyRing} aria-hidden="true" />
        <img src={logoImg} alt="NexAI" className={styles.logoImg} />
        <span className={styles.quantumParticle} aria-hidden="true" />
      </div>
    );
  }

  // Default: orbital 3-dot cross constellation
  return (
    <div
      className={cn(styles.dotsWrapper, sizeClass, className)}
      role="status"
      aria-label={ariaLabel}
    >
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
    </div>
  );
}

ThinkingIndicator.propTypes = {
  variant: PropTypes.oneOf(['dots', 'spinner', 'logo', 'legacy-logo']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  className: PropTypes.string,
  'aria-label': PropTypes.string,
};


