import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { Colors, Spacing, Typography } from '../../constants';
import { scaleWidth, scaleHeight, scaleFont } from '../../utils/responsive';

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  onPress,
  style = {},
}) => {
  const getButtonStyle = () => {
    const baseStyle = {
      borderRadius: scaleWidth(12),
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
    };

    const variants = {
      primary: {
        backgroundColor: disabled ? Colors.gray300 : Colors.primary,
      },
      secondary: {
        backgroundColor: disabled ? Colors.gray100 : Colors.secondary,
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: disabled ? Colors.gray300 : Colors.primary,
      },
    };

    const sizes = {
      sm: {
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        minHeight: scaleHeight(36),
      },
      md: {
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        minHeight: scaleHeight(48),
      },
      lg: {
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.xl,
        minHeight: scaleHeight(56),
      },
    };

    return {
      ...baseStyle,
      ...variants[variant],
      ...sizes[size],
      width: fullWidth ? '100%' : 'auto',
      opacity: disabled ? 0.6 : 1,
      ...style,
    };
  };

  const getTextStyle = () => {
    const baseTextStyle = {
      fontFamily: Typography.fontSemiBold,
    };

    const variants = {
      primary: {
        color: '#FFFFFF',
      },
      secondary: {
        color: '#FFFFFF',
      },
      outline: {
        color: disabled ? Colors.gray400 : Colors.primary,
      },
    };

    const sizes = {
      sm: { fontSize: Typography.sm },
      md: { fontSize: Typography.base },
      lg: { fontSize: Typography.lg },
    };

    return {
      ...baseTextStyle,
      ...variants[variant],
      ...sizes[size],
    };
  };

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' ? Colors.primary : '#FFFFFF'}
          style={{ marginRight: Spacing.sm }}
        />
      )}
      <Text style={getTextStyle()}>{children}</Text>
    </TouchableOpacity>
  );
};

export default Button;