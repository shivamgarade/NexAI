import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { cn } from '@/lib/utils/cn';
import styles from './Tooltip.module.scss';

export function Tooltip({ children, content, side = 'top', delay = 70, className, portal = false }) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef(null);
  const timerRef = useRef(null);

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (portal && wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        if (side === 'right') {
          setCoords({
            top: rect.top + rect.height / 2,
            left: rect.right + 10,
          });
        } else if (side === 'left') {
          setCoords({
            top: rect.top + rect.height / 2,
            left: rect.left - 10,
          });
        } else if (side === 'bottom') {
          setCoords({
            top: rect.bottom + 6,
            left: rect.left + rect.width / 2,
          });
        } else {
          // top
          setCoords({
            top: rect.top - 6,
            left: rect.left + rect.width / 2,
          });
        }
      }
      setVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!content) return children;

  const tooltipEl = (
    <div
      className={cn(styles.tooltip, styles[side], portal && styles.portaled)}
      style={
        portal
          ? {
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              right: 'auto',
              bottom: 'auto',
            }
          : undefined
      }
      role="tooltip"
    >
      {content}
    </div>
  );

  return (
    <div
      ref={wrapperRef}
      className={cn(styles.wrapper, className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {children}
      {visible && (portal ? createPortal(tooltipEl, document.body) : tooltipEl)}
    </div>
  );
}

Tooltip.propTypes = {
  children: PropTypes.node.isRequired,
  content: PropTypes.node,
  side: PropTypes.oneOf(['top', 'bottom', 'left', 'right']),
  delay: PropTypes.number,
  className: PropTypes.string,
  portal: PropTypes.bool,
};
