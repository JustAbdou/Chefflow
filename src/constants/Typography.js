import { responsiveTypography, scaleFont } from '../utils/responsive';

export const Typography = {
  fontRegular: 'Inter_400Regular',
  fontMedium: 'Inter_500Medium',
  fontSemiBold: 'Inter_600SemiBold',
  fontBold: 'Inter_700Bold',
  fontExtraBold: 'Inter_800ExtraBold',
  fontBlack: 'Inter_900Black',

  xs: responsiveTypography.xs,
  sm: responsiveTypography.sm,
  base: responsiveTypography.base,
  lg: responsiveTypography.lg,
  xl: responsiveTypography.xl,
  xxl: responsiveTypography.xxl,
  '3xl': responsiveTypography['3xl'],
  '4xl': responsiveTypography['4xl'],

  tight: 1.25,
  normal: 1.5,
  relaxed: 1.75,

  scale: scaleFont,
};