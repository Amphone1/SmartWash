import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth';
import { COLORS } from '../../src/theme';
import { errorMessage } from '../../src/utils';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!phone || !password) {
      setError('Please enter your phone number and password.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(phone, password);
      router.replace('/(tabs)');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>SW</Text>
            </View>
            <Text style={styles.appName}>SmartWash</Text>
            <Text style={styles.tagline}>ຊັກຜ້າ ສະດວກ ທຸກວັນ</Text>
          </View>

          {/* Error */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Phone input */}
          <View style={styles.inputWrapper}>
            <View style={styles.phonePrefix}>
              <Text style={styles.phonePrefixText}>+856</Text>
            </View>
            <TextInput
              style={[styles.input, styles.phoneInput]}
              placeholder="20 XX XXX XXX"
              placeholderTextColor={COLORS.textHint}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              autoCapitalize="none"
              editable={!loading}
            />
          </View>

          {/* Password input */}
          <TextInput
            style={styles.input}
            placeholder="ລະຫັດຜ່ານ"
            placeholderTextColor={COLORS.textHint}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!loading}
          />

          {/* Forgot password */}
          <Pressable style={styles.forgotRow}>
            <Text style={styles.forgotText}>ລືມລະຫັດຜ່ານ?</Text>
          </Pressable>

          {/* Sign in button */}
          <Pressable
            style={[styles.signInBtn, (loading || !phone || !password) && styles.signInBtnDisabled]}
            onPress={loading ? undefined : handleLogin}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.signInBtnText}>ເຂົ້າສູ່ລະບົບ</Text>
            )}
          </Pressable>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ຫຼືສືບຕໍ່ດ້ວຍ</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social buttons */}
          <View style={styles.socialRow}>
            <Pressable style={styles.socialBtn}>
              <Ionicons name="logo-google" size={20} color={COLORS.textBody} />
              <Text style={styles.socialBtnText}>Google</Text>
            </Pressable>
            <Pressable style={styles.socialBtn}>
              <Ionicons name="logo-facebook" size={20} color="#1877F2" />
              <Text style={styles.socialBtnText}>Facebook</Text>
            </Pressable>
          </View>

          {/* Register link */}
          <Pressable style={styles.registerRow}>
            <Text style={styles.registerText}>
              ຍັງບໍ່ມີບັນຊີ?{' '}
              <Text style={styles.registerLink}>ສ້າງບັນຊີໃໝ່</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logoText: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: '700',
  },
  appName: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.textHeading,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  errorText: {
    color: COLORS.red,
    fontSize: 13,
    marginBottom: 12,
    alignSelf: 'flex-start',
    width: '100%',
  },
  inputWrapper: {
    flexDirection: 'row',
    width: '100%',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    height: 52,
    marginBottom: 12,
    overflow: 'hidden',
  },
  phonePrefix: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  phonePrefixText: {
    fontSize: 15,
    color: COLORS.textBody,
    fontWeight: '500',
  },
  phoneInput: {
    flex: 1,
    borderWidth: 0,
    borderRadius: 0,
    marginBottom: 0,
    height: 52,
  },
  input: {
    width: '100%',
    height: 52,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    fontSize: 15,
    color: COLORS.textHeading,
    marginBottom: 12,
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotText: {
    fontSize: 13,
    color: COLORS.primary,
  },
  signInBtn: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  signInBtnDisabled: {
    backgroundColor: COLORS.textDisabled,
  },
  signInBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginHorizontal: 12,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 28,
  },
  socialBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  socialBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textBody,
  },
  registerRow: {
    alignItems: 'center',
  },
  registerText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  registerLink: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});
