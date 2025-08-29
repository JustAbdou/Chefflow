import { responsiveSpacing, scaleModerate } from '../utils/responsive';

export const Spacing = {
  // Responsive spacing values
  xs: responsiveSpacing.xs,
  sm: responsiveSpacing.sm,
  md: responsiveSpacing.md,
  lg: responsiveSpacing.lg,
  xl: responsiveSpacing.xl,
  "2xl": responsiveSpacing['2xl'],
  "3xl": responsiveSpacing['3xl'],

  // Helper function for custom spacing
  scale: scaleModerate,
};
