import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { STATUS_COLORS } from '../theme';

interface BadgeProps {
  label: string;
  status?: string;
  bg?: string;
  textColor?: string;
}

export function Badge({ label, status, bg, textColor }: BadgeProps) {
  const colors = status
    ? (STATUS_COLORS[status] ?? { bg: '#F1F5F9', text: '#475569' })
    : { bg: bg ?? '#F1F5F9', text: textColor ?? '#475569' };

  return (
    <View style={[styles.pill, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
