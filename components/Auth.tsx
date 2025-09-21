import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Alert,
  Animated,
  Easing,
  Image,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { Input, Button, Text } from "@rneui/themed";
import { supabase } from "../lib/supabase";
import { z } from "zod";

// Zod schemas for input validation
const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must include at least one special character"
    ),
});

// Sign-up schema with password confirmation
const signUpSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .regex(
        /[^A-Za-z0-9]/,
        "Password must include at least one special character"
      ),
    confirmPassword: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .regex(
        /[^A-Za-z0-9]/,
        "Password must include at least one special character"
      ),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export default function Auth({ navigation }: { navigation: any }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);

  const animationValue = useState(new Animated.Value(0))[0]; // Animation state

  const handleSignUp = async () => {
    try {
      // Validate input using Zod
      signUpSchema.parse({ email, password, confirmPassword });

      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        Alert.alert("Error", error.message);
      } else if (data.user) {
        Alert.alert(
          "Success",
          "A confirmation email has been sent to your email address. Please verify your email to complete the signup process."
        );
      }
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        Alert.alert("Validation Error", validationError.errors[0].message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    try {
      // Validate input using Zod
      signInSchema.parse({ email, password });

      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        Alert.alert("Error", error.message); // Show error if authentication fails
      } else if (data.session) {
        Alert.alert("Success", "Welcome back!");
        navigation.navigate("Profile", { userId: data.session.user.id });
      }
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        Alert.alert("Validation Error", validationError.errors[0].message);
      }
    } finally {
      setLoading(false);
    }
  };
  const handleToggle = () => {
    Animated.timing(animationValue, {
      toValue: isSignup ? 0 : 1, // Animate between 0 (Sign In) and 1 (Sign Up)
      duration: 500,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
    setIsSignup(!isSignup);
  };

  const animatedSignInOpacity = animationValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0], // Fade out Sign In when toggling to Sign Up
  });

  const animatedSignUpOpacity = animationValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1], // Fade in Sign Up when toggling to Sign Up
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header with Logo */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image
              source={require("../assets/angeliCredit.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          
        </View>

        {/* Forms Container */}
        <View style={styles.formsWrapper}>
          {/* Sign In Form */}
          <Animated.View
            style={[styles.formContainer, { opacity: animatedSignInOpacity }]}
          >
            {!isSignup && (
              <View style={styles.formContent}>
                <Text h4 style={styles.formTitle}>
                  Sign In
                </Text>
                <Text style={styles.formSubtitle}>Access your account</Text>

                <View style={styles.inputContainer}>
                  <Input
                    placeholder="Email Address"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    leftIcon={{
                      name: "email",
                      type: "material",
                      color: "#ff751f",
                    }}
                    containerStyle={styles.input}
                    inputContainerStyle={styles.inputInner}
                  />
                  <Input
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    leftIcon={{
                      name: "lock",
                      type: "material",
                      color: "#ff751f",
                    }}
                    containerStyle={styles.input}
                    inputContainerStyle={styles.inputInner}
                  />
                </View>

                <Button
                  title={loading ? "Signing In..." : "Sign In"}
                  onPress={handleSignIn}
                  disabled={loading}
                  buttonStyle={styles.primaryButton}
                  titleStyle={styles.buttonText}
                  loading={loading}
                />

                <Text style={styles.toggleText} onPress={handleToggle}>
                  Don't have an account?
                  <Text style={styles.toggleLink}> Sign Up</Text>
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Sign Up Form */}
          <Animated.View
            style={[styles.formContainer, { opacity: animatedSignUpOpacity }]}
          >
            {isSignup && (
              <View style={styles.formContent}>
                <Text h3 style={styles.formTitle}>
                  Create Account
                </Text>
                <Text style={styles.formSubtitle}>Join eCredit today</Text>

                <View style={styles.inputContainer}>
                  <Input
                    placeholder="Email Address"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    leftIcon={{
                      name: "email",
                      type: "material",
                      color: "#ff751f",
                    }}
                    containerStyle={styles.input}
                    inputContainerStyle={styles.inputInner}
                  />
                  <Input
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    leftIcon={{
                      name: "lock",
                      type: "material",
                      color: "#ff751f",
                    }}
                    containerStyle={styles.input}
                    inputContainerStyle={styles.inputInner}
                  />
                  <Input
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    leftIcon={{
                      name: "lock-outline",
                      type: "material",
                      color: "#ff751f",
                    }}
                    containerStyle={styles.input}
                    inputContainerStyle={styles.inputInner}
                  />
                </View>

                <Button
                  title={loading ? "Creating Account..." : "Sign Up"}
                  onPress={handleSignUp}
                  disabled={loading}
                  buttonStyle={styles.primaryButton}
                  titleStyle={styles.buttonText}
                  loading={loading}
                />

                <Text style={styles.toggleText} onPress={handleToggle}>
                  Already have an account?
                  <Text style={styles.toggleLink}> Sign In</Text>
                </Text>
              </View>
            )}
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Main container styles
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 40,
  },

  // Header section with logo
  header: {
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 2,
    padding: 2,
  },
  logo: {
    width: 450,
    height: 250,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#212529",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitleText: {
    fontSize: 16,
    color: "#6c757d",
    textAlign: "center",
    marginBottom: 10,
  },

  // Forms wrapper
  formsWrapper: {
    flex: 1,
    paddingHorizontal: 20,
    position: "relative",
  },
  formContainer: {
    width: "100%",
    position: "absolute",
    top: 0,
    left: 20,
    right: 20,
  },
  formContent: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  formTitle: {
    textAlign: "center",
    marginBottom: 8,
    color: "#ff751f",
    fontWeight: "300",
  },
  formSubtitle: {
    textAlign: "center",
    marginBottom: 30,
    color: "#6c757d",
    fontSize: 16,
  },

  // Input styles
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    marginBottom: 15,
  },
  inputInner: {
    borderBottomWidth: 2,
    borderBottomColor: "#e9ecef",
    paddingHorizontal: 10,
  },

  // Button styles
  primaryButton: {
    backgroundColor: "#ff751f",
    borderRadius: 12,
    paddingVertical: 15,
    marginTop: 10,
    marginBottom: 20,
    shadowColor: "#ff751f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },

  // Toggle text styles
  toggleText: {
    textAlign: "center",
    fontSize: 15,
    color: "#6c757d",
    marginTop: 10,
  },
  toggleLink: {
    color: "#ff751f",
    fontWeight: "600",
  },
});
