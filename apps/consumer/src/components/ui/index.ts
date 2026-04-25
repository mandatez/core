/**
 * MandateZ UI primitives — consumer.
 *
 * Mirrored byte-for-byte in apps/dashboard/src/components/ui/.
 * If you change a primitive's API here, change it there in the same commit.
 */

export { Button } from './Button';
export type {
  ButtonProps,
  ButtonVariant,
  ButtonSize,
} from './Button';

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './Card';
export type { CardProps, CardVariant } from './Card';

export { Tag } from './Tag';
export type { TagProps, TagVariant } from './Tag';

export { SectionMarker } from './SectionMarker';
export type { SectionMarkerProps } from './SectionMarker';

export { NumberDisplay } from './NumberDisplay';
export type {
  NumberDisplayProps,
  NumberDisplaySize,
  NumberDisplayAccent,
} from './NumberDisplay';

export { Section } from './Section';
export type { SectionProps } from './Section';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { LoadingSpinner } from './LoadingSpinner';
export type { LoadingSpinnerProps } from './LoadingSpinner';

export { cn } from './cn';
