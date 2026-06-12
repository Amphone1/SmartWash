import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { STATUS_COLORS } from '../theme';

interface BadgeProps {
  status: string;
}

export default function Badge({ status }: BadgeProps) {
  const colors = STATUS_COLORS[status] ?? { bg: '#F1F5F9', text: '#64748B' };

  const label = status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <View style={[styles.pill, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
