import { useState } from "react";
import {
  View,
  StyleSheet,
  Alert,
  ImageBackground,
  Animated,
  Easing,
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
    <View style={styles.background}>
      <View style={styles.container}>
        {/* Sign In Form */}
        <Animated.View
          style={[
            styles.formContainer,
            {
              opacity: animatedSignInOpacity,
            },
          ]}
        >
          {!isSignup && (
            <>
              <Text h3 style={styles.title}>
                Sign in
              </Text>
              <Input
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Input
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <Button
                title={loading ? "Signing In..." : "Sign In"}
                onPress={handleSignIn}
                disabled={loading}
                buttonStyle={styles.button}
              />
              <Text style={styles.footerText} onPress={handleToggle}>
                Don't have an account? <Text style={styles.link}>Sign Up</Text>
              </Text>
            </>
          )}
        </Animated.View>

        {/* Sign Up Form */}
        <Animated.View
          style={[
            styles.formContainer,
            {
              opacity: animatedSignUpOpacity,
            },
          ]}
        >
          {isSignup && (
            <>
              <Text h3 style={styles.title}>
                Create Your AngeliCredit Account
              </Text>
              <Input
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Input
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <Input
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
              <Button
                title={loading ? "Signing Up..." : "Sign Up"}
                onPress={handleSignUp}
                disabled={loading}
                buttonStyle={styles.button}
              />
              <Text style={styles.footerText} onPress={handleToggle}>
                Already have an account?{" "}
                <Text style={styles.link}>Sign In</Text>
              </Text>
            </>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: "#ffffff", // Plain white background
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  formContainer: {
    width: "100%",
    paddingHorizontal: 20,
    position: "absolute", // Ensures both forms occupy the same space
  },
  title: {
    textAlign: "center",
    marginBottom: 20,
    color: "#ff751f", // title angel gwapa
  },
  button: {
    backgroundColor: "#ff751f",
    marginTop: 10,
  },
  footerText: {
    textAlign: "center",
    marginTop: 20,
    color: "#000", // Black text for better contrast
  },
  link: {
    color: "#007bff",
    fontWeight: "bold",
  },
});
