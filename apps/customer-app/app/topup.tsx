import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../src/auth';
import { api, type QrPayment, type WalletBalance } from '../src/api';
import Card from '../src/components/Card';
import Button from '../src/components/Button';
import { COLORS } from '../src/theme';
import { errorMessage, formatKip } from '../src/utils';

const AMOUNT_CHIPS = [20_000, 50_000, 100_000, 200_000, 500_000];

type Step = 'amount' | 'qr' | 'processing' | 'done';

export default function TopupScreen() {
  const { token } = useAuth();
  const router = useRouter();

  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [step, setStep] = useState<Step>('amount');
  const [qrData, setQrData] = useState<QrPayment | null>(null);
  const [slipUri, setSlipUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadWallet = useCallback(async () => {
    if (!token) return;
    try { setWallet(await api.getWallet(token)); } catch { /* silent */ }
  }, [token]);

  useEffect(() => { void loadWallet(); }, [loadWallet]);

  // Poll payment status when in processing step
  useEffect(() => {
    if (step !== 'processing' || !qrData || !token) return;
    pollRef.current = setInterval(async () => {
      try {
        const { status } = await api.getPaymentStatus(token, qrData.qrRef);
        if (status === 'APPROVED' || status === 'SUCCESS') {
          clearInterval(pollRef.current!);
          await loadWallet();
          setStep('done');
        } else if (status === 'REJECTED' || status === 'EXPIRED') {
          clearInterval(pollRef.current!);
          setError('ການໂອນເງິນຖືກປະຕິເສດ ຫຼື ໝົດອາຍຸ');
          setStep('qr');
        }
      } catch { /* ignore network blips */ }
    }, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [step, qrData, token, loadWallet]);

  async function handleGenerateQr() {
    if (!token || !selected) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.createTopupQr(token, selected);
      setQrData(data);
      setStep('qr');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function handlePickSlip() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setSlipUri(result.assets[0].uri);
    }
  }

  async function handleSubmitSlip() {
    if (!slipUri) return;
    setStep('processing');
    // Slip upload to BFF would go here — for now polling handles status
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textHeading} />
        </Pressable>
        <Text style={styles.title}>ເຕີມເງິນ</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Balance */}
        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>ຍອດຄົງເຫຼືອ</Text>
          <Text style={styles.balanceAmount}>
            {wallet ? formatKip(wallet.balanceKip) : '—'}
          </Text>
        </Card>

        {step === 'amount' && (
          <>
            <Text style={styles.sectionLabel}>ເລືອກຈຳນວນ</Text>
            <View style={styles.chipGrid}>
              {AMOUNT_CHIPS.map((amt) => (
                <Pressable
                  key={amt}
                  style={[styles.amtChip, selected === amt && styles.amtChipSelected]}
                  onPress={() => setSelected(amt)}
                >
                  <Text style={[styles.amtChipText, selected === amt && styles.amtChipTextSelected]}>
                    {formatKip(amt)}
                  </Text>
                </Pressable>
              ))}
            </View>
            {error && <Text style={styles.error}>{error}</Text>}
            <Button
              label={loading ? 'ກຳລັງດຳເນີນ...' : 'ສ້າງ QR ຊຳລະ'}
              onPress={handleGenerateQr}
              variant="primary"
              disabled={!selected || loading}
            />
          </>
        )}

        {step === 'qr' && qrData && (
          <>
            <Card style={styles.qrCard}>
              <Text style={styles.qrHint}>ສະແກນ QR ນີ້ດ້ວຍ BCEL One ຫຼື JDB Pay</Text>
              <View style={styles.qrBox}>
                {qrData.qrImageUrl ? (
                  <Image source={{ uri: qrData.qrImageUrl }} style={styles.qrImage} />
                ) : (
                  <View style={styles.qrPlaceholder}>
                    <Ionicons name="qr-code-outline" size={80} color={COLORS.textHint} />
                  </View>
                )}
              </View>
              <Text style={styles.amountLabel}>
                {selected ? formatKip(selected) : ''}
              </Text>
              <Text style={styles.expiry}>
                ໝົດອາຍຸ:{' '}
                {qrData.expiresAt
                  ? new Date(qrData.expiresAt).toLocaleTimeString('lo-LA')
                  : '—'}
              </Text>
            </Card>

            <Text style={styles.sectionLabel}>ອັບໂຫຼດສະລິບ</Text>
            <Pressable style={styles.uploadBox} onPress={handlePickSlip}>
              {slipUri ? (
                <Image source={{ uri: slipUri }} style={styles.slipPreview} />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={32} color={COLORS.textHint} />
                  <Text style={styles.uploadHint}>ແຕ່ໜ້ານີ້ ຫຼື ເລືອກຮູບ</Text>
                </>
              )}
            </Pressable>

            {error && <Text style={styles.error}>{error}</Text>}
            <Button
              label="ສົ່ງສະລິບ"
              onPress={handleSubmitSlip}
              variant="primary"
              disabled={!slipUri}
            />
            <Button
              label="ປ່ຽນຈຳນວນ"
              onPress={() => { setStep('amount'); setQrData(null); setSlipUri(null); }}
              variant="ghost"
            />
          </>
        )}

        {step === 'processing' && (
          <View style={styles.processingCenter}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.processingText}>ກຳລັງກວດສອບ...</Text>
            <Text style={styles.processingHint}>ພວກເຮົາກຳລັງກວດສອບການຊຳລະຂອງທ່ານ</Text>
          </View>
        )}

        {step === 'done' && (
          <View style={styles.doneCenter}>
            <View style={styles.doneIcon}>
              <Ionicons name="checkmark-circle" size={64} color={COLORS.green} />
            </View>
            <Text style={styles.doneTitle}>ເຕີມເງິນສຳເລັດ!</Text>
            <Text style={styles.doneBalance}>
              ຍອດໃໝ່: {wallet ? formatKip(wallet.balanceKip) : '—'}
            </Text>
            <Button
              label="ກັບຄືນ"
              onPress={() => router.back()}
              variant="primary"
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.textHeading },
  content: { padding: 20, gap: 16, paddingBottom: 48 },
  balanceCard: { alignItems: 'center', paddingVertical: 20, gap: 4 },
  balanceLabel: { fontSize: 13, color: COLORS.textMuted },
  balanceAmount: { fontSize: 32, fontWeight: '700', color: COLORS.textHeading },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  amtChip: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1.5,
    borderColor: COLORS.border, backgroundColor: COLORS.cardBg,
  },
  amtChipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLightBg },
  amtChipText: { fontSize: 14, fontWeight: '600', color: COLORS.textBody },
  amtChipTextSelected: { color: COLORS.primary },
  error: { color: COLORS.red, fontSize: 13 },
  qrCard: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  qrHint: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center' },
  qrBox: {
    width: 200, height: 200,
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border,
  },
  qrImage: { width: '100%', height: '100%' },
  qrPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.divider,
  },
  amountLabel: { fontSize: 22, fontWeight: '700', color: COLORS.textHeading },
  expiry: { fontSize: 12, color: COLORS.textHint },
  uploadBox: {
    height: 120, borderRadius: 12,
    borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.border,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center', justifyContent: 'center', gap: 8,
    overflow: 'hidden',
  },
  slipPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  uploadHint: { fontSize: 13, color: COLORS.textHint },
  processingCenter: { alignItems: 'center', paddingVertical: 40, gap: 16 },
  processingText: { fontSize: 18, fontWeight: '700', color: COLORS.textHeading },
  processingHint: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },
  doneCenter: { alignItems: 'center', paddingVertical: 24, gap: 16 },
  doneIcon: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center',
  },
  doneTitle: { fontSize: 22, fontWeight: '700', color: COLORS.textHeading },
  doneBalance: { fontSize: 16, color: COLORS.textMuted },
});
