import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { Colors, Spacing, Typography } from '../../constants';

const Input = ({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  error,
  disabled = false,
  multiline = false,
  numberOfLines = 1,
  leftIcon,
  rightIcon,
  style = {},
}) => {
  const containerStyle = {
    width: '100%',
    marginBottom: error ? Spacing.xs : 0,
  };

  const labelStyle = {
    fontSize: Typography.base, // Reduced from lg
    fontFamily: Typography.fontMedium,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm, // Reduced from md
  };

  const inputContainerStyle = {
    backgroundColor: disabled ? Colors.gray50 : '#F8F9FA',
    borderWidth: 1,
    borderColor: error ? Colors.danger : Colors.borderLight,
    borderRadius: 12, // Reduced from 16
    paddingHorizontal: Spacing.sm, // Reduced from md
    paddingVertical: Spacing.sm, // Reduced from md
    minHeight: 50, // Reduced from 60
    flexDirection: 'row',
    alignItems: 'center',
  };

  const inputStyle = {
    fontSize: Typography.base, // Reduced from lg
    fontFamily: Typography.fontRegular,
    color: disabled ? Colors.gray400 : Colors.textPrimary,
    flex: 1,
  };

  const errorStyle = {
    fontSize: Typography.sm,
    fontFamily: Typography.fontRegular,
    color: Colors.danger,
    marginTop: Spacing.sm,
  };

  return (
    <View style={[containerStyle, style]}>
      {label && <Text style={labelStyle}>{label}</Text>}
      <View style={inputContainerStyle}>
        {leftIcon && <View style={{ marginRight: Spacing.sm }}>{leftIcon}</View>}
        <TextInput
          style={inputStyle}
          placeholder={placeholder}
          placeholderTextColor={Colors.gray400}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={!disabled}
          multiline={multiline}
          numberOfLines={numberOfLines}
        />
        {rightIcon && <View style={{ marginLeft: Spacing.sm }}>{rightIcon}</View>}
      </View>
      {error && <Text style={errorStyle}>{error}</Text>}
    </View>
  );
};

export default Input;