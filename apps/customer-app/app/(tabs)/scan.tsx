import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from '../../src/theme';

const FRAME = 280;
const BRACKET = 30;
const THICK = 4;

function CornerBracket({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const isTop = position.startsWith('t');
  const isLeft = position.endsWith('l');
  return (
    <View
      style={[
        styles.bracket,
        isTop ? styles.bracketTop : styles.bracketBottom,
        isLeft ? styles.bracketLeft : styles.bracketRight,
      ]}
    >
      <View
        style={[
          styles.bracketH,
          isTop ? { top: 0 } : { bottom: 0 },
          isLeft ? { left: 0 } : { right: 0 },
        ]}
      />
      <View
        style={[
          styles.bracketV,
          isTop ? { top: 0 } : { bottom: 0 },
          isLeft ? { left: 0 } : { right: 0 },
        ]}
      />
    </View>
  );
}

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [scanAnim]);

  const scanLineY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, FRAME - 4],
  });

  function handleBarCode({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);
    router.push(`/order/machines?code=${encodeURIComponent(data)}`);
  }

  function handleManual() {
    if (manualCode.trim()) {
      router.push(`/order/machines?code=${encodeURIComponent(manualCode.trim())}`);
    }
  }

  if (!permission) {
    return <View style={styles.dark} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.dark, styles.permCenter]}>
        <Ionicons name="camera-outline" size={48} color={COLORS.textHint} />
        <Text style={styles.permText}>ຕ້ອງການສິດໃຊ້ກ້ອງ</Text>
        <Pressable style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>ອະນຸຍາດ</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.dark}>
      <StatusBar style="light" />

      {/* Camera */}
      <CameraView
        style={StyleSheet.absoluteFill}
        enableTorch={flashOn}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCode}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Title */}
        <View style={styles.topBar}>
          <Text style={styles.scanTitle}>ສະແກນ QR</Text>
        </View>

        {/* Scan frame */}
        <View style={styles.frameWrapper}>
          <View style={styles.frame}>
            <CornerBracket position="tl" />
            <CornerBracket position="tr" />
            <CornerBracket position="bl" />
            <CornerBracket position="br" />
            <Animated.View
              style={[styles.scanLine, { transform: [{ translateY: scanLineY }] }]}
            />
          </View>
        </View>

        <Text style={styles.hint}>ວາງ QR Code ຂອງເຄື່ອງໄວ້ໃນກ່ອງ</Text>

        {/* Flash toggle */}
        <Pressable
          style={styles.flashChip}
          onPress={() => setFlashOn((v) => !v)}
        >
          <Ionicons
            name={flashOn ? 'flashlight' : 'flashlight-outline'}
            size={16}
            color={flashOn ? COLORS.amber : '#E2E8F0'}
          />
          <Text style={styles.flashText}>ໄຟສ່ອງ</Text>
        </Pressable>

        {/* Manual fallback */}
        <View style={styles.manualCard}>
          <Text style={styles.manualLabel}>ໃສ່ລະຫັດເຄື່ອງ</Text>
          <View style={styles.manualRow}>
            <TextInput
              style={styles.manualInput}
              placeholder="ເຊັ່ນ M-01"
              placeholderTextColor="#64748B"
              value={manualCode}
              onChangeText={setManualCode}
              autoCapitalize="characters"
            />
            <Pressable
              style={[styles.manualBtn, !manualCode && styles.manualBtnDisabled]}
              onPress={handleManual}
            >
              <Text style={styles.manualBtnText}>ຢືນຢັນ</Text>
            </Pressable>
          </View>
        </View>

        {scanned && (
          <Pressable style={styles.rescanBtn} onPress={() => setScanned(false)}>
            <Text style={styles.rescanText}>ສະແກນໃໝ່</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dark: { flex: 1, backgroundColor: COLORS.darkPage },
  permCenter: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  permText: { color: '#E2E8F0', fontSize: 16 },
  permBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  permBtnText: { color: COLORS.white, fontWeight: '600' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
  },
  topBar: {
    paddingTop: 60,
    paddingBottom: 24,
  },
  scanTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '700',
  },
  frameWrapper: {
    width: FRAME,
    height: FRAME,
    marginBottom: 24,
  },
  frame: {
    width: FRAME,
    height: FRAME,
    overflow: 'hidden',
    position: 'relative',
  },
  bracket: {
    position: 'absolute',
    width: BRACKET,
    height: BRACKET,
  },
  bracketTop: { top: 0 },
  bracketBottom: { bottom: 0 },
  bracketLeft: { left: 0 },
  bracketRight: { right: 0 },
  bracketH: {
    position: 'absolute',
    width: BRACKET,
    height: THICK,
    backgroundColor: COLORS.cyan,
  },
  bracketV: {
    position: 'absolute',
    width: THICK,
    height: BRACKET,
    backgroundColor: COLORS.cyan,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: COLORS.cyan,
    shadowColor: COLORS.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  hint: { color: '#94A3B8', fontSize: 13, marginBottom: 20 },
  flashChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 24,
  },
  flashText: { color: '#E2E8F0', fontSize: 13 },
  manualCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    width: '85%',
    gap: 10,
  },
  manualLabel: { color: '#E2E8F0', fontSize: 14, fontWeight: '600' },
  manualRow: { flexDirection: 'row', gap: 10 },
  manualInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#F8FAFC',
    fontSize: 14,
  },
  manualBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  manualBtnDisabled: { backgroundColor: '#334155' },
  manualBtnText: { color: COLORS.white, fontWeight: '600', fontSize: 14 },
  rescanBtn: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  rescanText: { color: COLORS.white, fontWeight: '600' },
});
