import { useRef } from "react";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useLoginForm } from "../hooks/useLoginForm";

export function LoginScreen() {
  const passwordRef = useRef<TextInput>(null);
  const {
    email,
    password,
    setEmail,
    setPassword,
    submit,
    isSubmitting,
    errorMessage,
  } = useLoginForm();

  function handleSubmit() {
    Keyboard.dismiss();
    void submit();
  }

  return (
    <View testID="login-screen" style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        Login
      </Text>

      <TextInput
        accessibilityLabel="Email"
        testID="login-email-input"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor="#7a8599"
        returnKeyType="next"
        style={styles.input}
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={() => passwordRef.current?.focus()}
      />

      <TextInput
        ref={passwordRef}
        accessibilityLabel="Password"
        testID="login-password-input"
        autoComplete="password"
        placeholder="Password"
        placeholderTextColor="#7a8599"
        returnKeyType="done"
        secureTextEntry
        style={styles.input}
        textContentType="password"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={handleSubmit}
      />

      {errorMessage ? (
        <Text accessibilityRole="alert" testID="login-error" style={styles.error}>
          {errorMessage}
        </Text>
      ) : null}

      <Pressable
        accessibilityLabel={isSubmitting ? "Signing in" : "Sign in"}
        accessibilityRole="button"
        accessibilityState={{ disabled: isSubmitting }}
        disabled={isSubmitting}
        testID="login-submit-button"
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleSubmit}
      >
        <Text style={styles.buttonText}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#172033",
    borderColor: "#27324a",
    borderRadius: 12,
    borderWidth: 1,
    color: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  button: {
    alignItems: "center",
    backgroundColor: "#f0b35c",
    borderRadius: 12,
    marginTop: 8,
    paddingVertical: 14,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#0b1220",
    fontSize: 15,
    fontWeight: "700",
  },
  error: {
    color: "#ff9b9b",
  },
});
