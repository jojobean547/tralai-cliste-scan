import { moderateScale, scale as sizeScale, verticalScale } from 'react-native-size-matters';

export const Colors = {
  light: {
    // Backgrounds
    background:   '#F8F9FA',
    surface:      '#FFFFFF',
    surfaceAlt:   '#F0F8F4',

    // Borders
    border:       '#E5E7EB',
    borderStrong: '#0B5D3B',

    // Text
    textPrimary:   '#1A1C1E',
    textSecondary: '#6B7280',
    textInverse:   '#FFFFFF',

    // Brand
    primaryGreen:  '#0B5D3B',
    greenLight:    '#DCEFDE',
    greenMid:      '#2E7D32',

    // Accents
    accentPurple:  '#5C3DBA',
    accentGold:    '#F2B705',
    accentGoldTint: '#F2B70526',

    // Status
    success:       '#2E7D32',
    error:         '#D64545',
    errorBg:       '#FFF0F0',
    errorBorder:   '#F5C6C6',
    info:          '#2F9E44',
    infoBg:        '#E8F5E9',

    // Buttons
    buttonPrimary:     '#0B5D3B',
    buttonPrimaryText: '#FFFFFF',
    buttonSecondary:   '#2E7D32',
    greenTintBg:       '#DCEFDE',
    greenTintText:     '#2E7D32',
    purpleTint:        '#F0ECFF',
    greenTint:         '#E8F5EE',

    // Tab
    tabActive:     '#0B5D3B',
    tabInactive:   '#6B7280',
    tabBar:        '#FFFFFF',
    tabBorder:     '#E5E7EB',
  },

  dark: {
    // Backgrounds
    background:   '#0F1113',
    surface:      '#161A1D',
    surfaceAlt:   '#0F1A12',

    // Borders
    border:       '#2A2D31',
    borderStrong: '#1F7A4D',

    // Text
    textPrimary:   '#F8F9FA',
    textSecondary: '#A1A7AC',
    textInverse:   '#FFFFFF',

    // Brand
    primaryGreen:  '#178241',
    greenLight:    '#1F7A4D',
    greenMid:      '#1F7A4D',

    // Accents
    accentPurple:  '#7954EB',
    accentGold:    '#F2B705',
    accentGoldTint: '#F2B70526',

    // Status
    success:       '#1F7A4D',
    error:         '#D64545',
    errorBg:       '#2A1515',
    errorBorder:   '#3D1F1F',
    info:          '#1F7A4D',
    infoBg:        '#0F1A12',

    // Buttons
    buttonPrimary:     '#178241',
    buttonPrimaryText: '#FFFFFF',
    greenTintBg:       '#162E22',
    greenTintText:     '#178241',
    buttonSecondary:   '#4CAF50',
    purpleTint:        'transparent',
    greenTint:         'transparent',

    // Tab
    tabActive:     '#1F7A4D',
    tabInactive:   '#A1A7AC',
    tabBar:        '#0F1113',
    tabBorder:     '#2A2D31',
  },
} as const;

export function getTypography( ) {
  return {
    heading1:  moderateScale(32 , 0.3),
    heading2:  moderateScale(26 , 0.3),
    heading3:  moderateScale(22 , 0.3),
    body:      moderateScale(18 , 0.3),
    bodySmall: moderateScale(16 , 0.3),
    caption:   moderateScale(14 , 0.3),
    tiny:      moderateScale(12 , 0.3),
    regular:   '400' as const,
    medium:    '500' as const,
    semibold:  '600' as const,
    bold:      '700' as const,
  };
}

export function getSpacing( ) {
  return {
    xs:  sizeScale(4 ),
    sm:  sizeScale(8 ),
    md:  sizeScale(12 ),
    lg:  sizeScale(16 ),
    xl:  sizeScale(20 ),
    xxl: sizeScale(28 ),
  };
}

export function getRadii( ) {
  return {
    sm:   sizeScale(8 ),
    md:   sizeScale(12 ),
    lg:   sizeScale(16 ),
    pill: sizeScale(24 ),
    full: 9999,
  };
}

// Static defaults (scale=1.0) — kept for backwards compat until Step 4 migration
export const Typography = getTypography();
export const Spacing = getSpacing();
export const Radii = getRadii();

export const TouchTargets = {
  // Minimum 56dp for elderly users (WCAG recommendation)
  minHeight: verticalScale(56),
  minWidth:  sizeScale(56),
};