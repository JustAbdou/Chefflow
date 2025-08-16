import React, { useState, useEffect } from 'react';
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
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Colors, Spacing, Typography } from '../../constants';
import useNavigationBar from '../../hooks/useNavigationBar';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../firebase'; // adjust path if needed

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden(); // Use hidden mode for complete immersion

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main', params: { screen: 'Dashboard' } }],
        });
      }
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setError(''); // Clear any previous errors
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setLoading(false);
      navigation.navigate('Main', { screen: 'Dashboard' });
    } catch (error) {
      setLoading(false);
      // Show stylish error message instead of alert
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setError('Invalid email or password. Please check your credentials and try again.');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else if (error.code === 'auth/user-disabled') {
        setError('This account has been disabled. Please contact support.');
      } else {
        setError('Login failed. Please check your credentials and try again.');
      }
    }
  };

  const isFormValid = email.length > 0 && password.length > 0;

  const handleContactUs = () => {
    Linking.openURL('mailto:contact@chefflowapp.net');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            {/* Chef Hat Logo */}
            <View style={styles.logoContainer}>
              <Image
                source={{ uri: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Logo-wsCeImj7L3Tgys98m1TnmiVEOoJhLR.png' }}
                style={styles.logo}
                resizeMode="cover"
              />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Welcome Back!</Text>
              <Text style={styles.subtitle}>Sign in to your account</Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {/* Error Message */}
              {error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={18} color="#E53935" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Input
                label="Email"
                placeholder="Enter your email"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setError(''); // Clear error when user starts typing
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                style={styles.input}
              />

              <Input
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setError(''); // Clear error when user starts typing
                }}
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

            {/* Footer */}
            <TouchableOpacity style={styles.contactUs} onPress={handleContactUs}>
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
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: Spacing.lg,
  },
  errorText: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontMedium,
    color: '#DC2626',
    marginLeft: 8,
    flex: 1,
  },
});

export default LoginScreen;