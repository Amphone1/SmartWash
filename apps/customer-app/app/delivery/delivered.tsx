import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/auth';
import { api } from '../../src/api';
import Button from '../../src/components/Button';
import { COLORS } from '../../src/theme';
import { errorMessage } from '../../src/utils';

const RATING_TAGS = ['ໄວ', 'ສຸພາບ', 'ຜ້າສະອາດ', 'ບໍ່ຊ້າ', 'ຈັດການດີ'];

export default function DeliveredScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();

  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  async function handleSubmit() {
    if (!token || !orderId || stars === 0) {
      Alert.alert('ກະລຸນາໃຫ້ຄະແນນ', 'ເລືອກ 1–5 ດາວ');
      return;
    }
    setSubmitting(true);
    try {
      await api.submitRating(token, { orderId, rating: stars, tags });
      setSubmitted(true);
    } catch (e) {
      Alert.alert('ຜິດພາດ', errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.thankCenter}>
          <View style={styles.thankIcon}>
            <Ionicons name="heart" size={40} color={COLORS.green} />
          </View>
          <Text style={styles.thankTitle}>ຂອບໃຈສຳລັບຄຳຕິຊົມ!</Text>
          <Text style={styles.thankSub}>ທ່ານໄດ້ໃຫ້ {stars} ດາວ</Text>
          <Button label="ກັບໜ້າຫຼັກ" onPress={() => router.replace('/(tabs)')} variant="primary" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Green check hero */}
        <View style={styles.hero}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={48} color={COLORS.white} />
          </View>
          <Text style={styles.heroTitle}>ຈັດສົ່ງສຳເລັດ!</Text>
          <Text style={styles.heroSub}>ຜ້າຂອງທ່ານຮອດແລ້ວ</Text>
        </View>

        {/* Star rating */}
        <View style={styles.ratingSection}>
          <Text style={styles.ratingPrompt}>ທ່ານພໍໃຈສໍ່ໃດ?</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                onPressIn={() => setHovered(n)}
                onPressOut={() => setHovered(0)}
                onPress={() => setStars(n)}
              >
                <Ionicons
                  name="star"
                  size={40}
                  color={(hovered || stars) >= n ? COLORS.amber : COLORS.border}
                />
              </Pressable>
            ))}
          </View>
          <Text style={styles.starLabel}>
            {stars === 0 ? 'ຄລິກດາວ' : stars === 5 ? 'ດີເລີດ!' : stars >= 4 ? 'ດີຫຼາຍ' : stars >= 3 ? 'ດີ' : 'ພໍໃຊ້ໄດ້'}
          </Text>
        </View>

        {/* Tag chips */}
        <View style={styles.tagSection}>
          <Text style={styles.tagPrompt}>ເພີ່ມ tag (ທາງເລືອກ)</Text>
          <View style={styles.tagRow}>
            {RATING_TAGS.map((tag) => (
              <Pressable
                key={tag}
                style={[styles.tagChip, tags.includes(tag) && styles.tagChipSelected]}
                onPress={() => toggleTag(tag)}
              >
                <Text style={[styles.tagText, tags.includes(tag) && styles.tagTextSelected]}>
                  {tag}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Receipt link */}
        <Pressable style={styles.receiptRow}>
          <Ionicons name="receipt-outline" size={20} color={COLORS.primary} />
          <Text style={styles.receiptText}>ເບິ່ງໃບຮັບ</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textHint} />
        </Pressable>

        <Button
          label={submitting ? 'ກຳລັງສົ່ງ...' : 'ສົ່ງຄຳຕິຊົມ'}
          onPress={handleSubmit}
          variant="primary"
          disabled={stars === 0 || submitting}
        />
        <Button
          label="ຂ້າມ"
          onPress={() => router.replace('/(tabs)')}
          variant="ghost"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  content: { padding: 24, gap: 20, paddingBottom: 48 },
  hero: { alignItems: 'center', paddingVertical: 16, gap: 10 },
  checkCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: COLORS.green,
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: 26, fontWeight: '700', color: COLORS.textHeading },
  heroSub: { fontSize: 15, color: COLORS.textMuted },
  ratingSection: { alignItems: 'center', gap: 12 },
  ratingPrompt: { fontSize: 16, fontWeight: '600', color: COLORS.textHeading },
  stars: { flexDirection: 'row', gap: 8 },
  starLabel: { fontSize: 14, color: COLORS.textMuted, height: 20 },
  tagSection: { gap: 12 },
  tagPrompt: { fontSize: 14, fontWeight: '600', color: COLORS.textHeading },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.cardBg,
  },
  tagChipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLightBg },
  tagText: { fontSize: 13, color: COLORS.textBody },
  tagTextSelected: { color: COLORS.primary, fontWeight: '600' },
  receiptRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.cardBg, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border, padding: 16,
  },
  receiptText: { flex: 1, fontSize: 15, fontWeight: '500', color: COLORS.primary },
  thankCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  thankIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center',
  },
  thankTitle: { fontSize: 22, fontWeight: '700', color: COLORS.textHeading },
  thankSub: { fontSize: 15, color: COLORS.textMuted },
});
