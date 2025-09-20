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

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);

  const animationValue = useState(new Animated.Value(0))[0]; // Animation state

  const handleSignUp = async () => {
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match!");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) Alert.alert("Error", error.message);
    setLoading(false);
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
    <ImageBackground
      source={require("../assets/background.jpg")} // Replace with your image path
      style={styles.background}
    >
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
                Welcome Back to Angel eCredit
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
                onPress={() => Alert.alert("Sign In Clicked")}
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
                Create Your Angel eCredit Account
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
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    resizeMode: "cover",
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
    color: "#fff",
  },
  button: {
    backgroundColor: "#007bff",
    marginTop: 10,
  },
  footerText: {
    textAlign: "center",
    marginTop: 20,
    color: "#fff",
  },
  link: {
    color: "#007bff",
    fontWeight: "bold",
  },
});
