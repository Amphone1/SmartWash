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
  variant?: 'primary' | 'outline' | 'ghost';
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}

export default function Button({
  variant = 'primary',
  label,
  onPress,
  disabled = false,
  loading = false,
  fullWidth = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const containerStyle: ViewStyle[] = [
    styles.base,
    fullWidth && styles.fullWidth,
    variant === 'primary' && styles.primary,
    variant === 'outline' && styles.outline,
    variant === 'ghost' && styles.ghost,
    isDisabled && variant === 'primary' && styles.primaryDisabled,
    isDisabled && variant === 'outline' && styles.outlineDisabled,
    isDisabled && variant === 'ghost' && styles.ghostDisabled,
  ];

  const labelStyle = [
    styles.label,
    variant === 'primary' && styles.labelPrimary,
    variant === 'outline' && styles.labelOutline,
    variant === 'ghost' && styles.labelGhost,
    isDisabled && styles.labelDisabled,
  ];

  return (
    <Pressable
      style={({ pressed }) => [
        ...containerStyle,
        pressed && !isDisabled && styles.pressed,
      ]}
      onPress={isDisabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? COLORS.white : COLORS.primary}
          size="small"
        />
      ) : (
        <Text style={labelStyle}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  fullWidth: {
    width: '100%',
  },
  primary: {
    backgroundColor: COLORS.primary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  primaryDisabled: {
    backgroundColor: COLORS.textDisabled,
  },
  outlineDisabled: {
    borderColor: COLORS.textDisabled,
  },
  ghostDisabled: {},
  pressed: {
    opacity: 0.8,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
  labelPrimary: {
    color: COLORS.white,
  },
  labelOutline: {
    color: COLORS.primary,
  },
  labelGhost: {
    color: COLORS.primary,
  },
  labelDisabled: {
    color: COLORS.textDisabled,
  },
});
