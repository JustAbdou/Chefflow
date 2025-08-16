import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Colors, Spacing, Typography } from '../../constants';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../../firebase';

const LoginScreen = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, username, password);
      setLoading(false);
      navigation.navigate('Main', { screen: 'Dashboard' });
    } catch (error) {
      setLoading(false);
      alert(error.message);
    }
  };

  const isFormValid = username.length > 0 && password.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <Image
                source={{ uri: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Logo-wsCeImj7L3Tgys98m1TnmiVEOoJhLR.png' }}
                style={styles.logo}
                resizeMode="cover"
              />
            </View>

            <View style={styles.header}>
              <Text style={styles.title}>Welcome Back!</Text>
              <Text style={styles.subtitle}>Sign in to your account</Text>
            </View>

            <View style={styles.form}>
              <Input
                label="Username"
                placeholder="Enter your username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                style={styles.input}
              />

              <Input
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                style={styles.input}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={Colors.gray400}
                    />
                  </TouchableOpacity>
                }
              />

              <Button
                onPress={handleLogin}
                disabled={!isFormValid}
                loading={loading}
                fullWidth
                style={styles.loginButton}
              >
                Login
              </Button>
            </View>

            <TouchableOpacity style={styles.contactUs}>
              <Text style={styles.contactText}>Contact Us</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  content: {
    width: '100%',
    maxWidth: 350,
    alignSelf: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logo: {
    width: 130,
    height: 130,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: Typography['3xl'],
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.base,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  form: {
    marginBottom: Spacing.xl,
  },
  input: {
    marginBottom: Spacing.lg,
  },
  loginButton: {
    marginTop: Spacing.md,
    borderRadius: 12,
    minHeight: 60,
  },
  contactUs: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  contactText: {
    fontSize: Typography.base,
    fontFamily: Typography.fontMedium,
    position: "absolute",
    bottom: Spacing.xs,
    color: Colors.primary,
  },
});

export default LoginScreen;