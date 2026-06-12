import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import { COLORS } from '../theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'danger-outline' | 'success';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const containerStyle = [
    styles.base,
    variant === 'primary' && styles.primary,
    variant === 'outline' && styles.outline,
    variant === 'danger-outline' && styles.dangerOutline,
    variant === 'success' && styles.success,
    isDisabled && styles.disabled,
    style,
  ];

  const textStyle = [
    styles.text,
    variant === 'outline' && styles.textOutline,
    variant === 'danger-outline' && styles.textDanger,
    variant === 'success' && styles.textWhite,
    isDisabled && styles.textDisabled,
  ];

  return (
    <Pressable
      style={({ pressed }) => [
        ...containerStyle,
        pressed && !isDisabled && styles.pressed,
      ]}
      onPress={isDisabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === 'outline' || variant === 'danger-outline'
              ? COLORS.primary
              : '#fff'
          }
          size="small"
        />
      ) : (
        <Text style={textStyle}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primary: {
    backgroundColor: COLORS.primary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  dangerOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.danger,
  },
  success: {
    backgroundColor: COLORS.success,
  },
  disabled: {
    backgroundColor: COLORS.disabled,
    borderColor: COLORS.disabled,
  },
  pressed: {
    opacity: 0.8,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  textOutline: {
    color: COLORS.primary,
  },
  textDanger: {
    color: COLORS.danger,
  },
  textWhite: {
    color: '#FFFFFF',
  },
  textDisabled: {
    color: COLORS.muted,
  },
});
