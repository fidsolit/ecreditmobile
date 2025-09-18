// import { Ionicons } from "@expo/vector-icons";
// import { useNavigation, useRoute } from "@react-navigation/native";
// import { NativeStackNavigationProp } from "@react-navigation/native-stack";
// import React, { useEffect, useRef, useState } from "react";
// import {
//   Alert,
//   StyleSheet,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   View,
// } from "react-native";

// import { supabase } from "../config/supabaseClient";
// import { Colors } from "../constants/colors";
// import { AuthStackParamList } from "../navigation/StackNavigator";

// type NavigationProp = NativeStackNavigationProp<AuthStackParamList, "OTP">;
// type RouteProp = ReturnType<typeof useRoute>;

// const OTPScreen: React.FC = () => {
//   const navigation = useNavigation<NavigationProp>();
//   const route = useRoute<RouteProp>();
//   const { phone } = route.params as { phone: string };

//   const [otp, setOtp] = useState(["", "", "", "", "", ""]);
//   const [loading, setLoading] = useState(false);
//   const [resendTimer, setResendTimer] = useState(60);
//   const [canResend, setCanResend] = useState(false);
//   const inputs = useRef<TextInput[]>([]);

//   useEffect(() => {
//     const timer = setInterval(() => {
//       setResendTimer((prev) => {
//         if (prev <= 1) {
//           setCanResend(true);
//           clearInterval(timer);
//           return 0;
//         }
//         return prev - 1;
//       });
//     }, 1000);

//     return () => clearInterval(timer);
//   }, []);

//   const handleOTPChange = (value: string, index: number) => {
//     const newOtp = [...otp];
//     newOtp[index] = value;
//     setOtp(newOtp);

//     if (value && index < 5) {
//       inputs.current[index + 1].focus();
//     }
//   };

//   const handleVerifyOTP = async () => {
//     const otpCode = otp.join("");
//     if (otpCode.length !== 6) {
//       Alert.alert("Error", "Please enter a valid 6-digit OTP.");
//       return;
//     }

//     setLoading(true);
//     try {
//       const { error, data } = await supabase.auth.verifyOtp({
//         phone,
//         token: otpCode,
//         type: "sms",
//       });

//       console.log("OTP Verify Response:", { error, data });

//       if (error) {
//         Alert.alert("Error", error.message);
//         setLoading(false);
//         return;
//       }

//       const user = data.user;
//       if (user) {
//         await supabase.auth.refreshSession();
//         const {
//           data: { session },
//         } = await supabase.auth.getSession();
//         console.log(
//           "Session after OTP verification:",
//           session ? "Session set" : "No session"
//         );

//         const { error: upsertError } = await supabase.from("users").upsert(
//           {
//             id: user.id,
//             phone: user.phone,
//             created_at: new Date().toISOString(),
//           },
//           { onConflict: "id" }
//         );

//         if (upsertError) {
//           console.error("Error saving user to database:", upsertError);
//           Alert.alert(
//             "Error",
//             `Failed to save user data: ${upsertError.message}`
//           );
//           setLoading(false);
//           return;
//         }

//         Alert.alert("Success", "OTP verified successfully! Welcome.");
//       } else {
//         Alert.alert("Error", "No user data returned after OTP verification.");
//       }
//     } catch (err) {
//       console.error("Unexpected error verifying OTP:", err);
//       Alert.alert("Error", "Failed to verify OTP. Please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleResendOTP = async () => {
//     if (!canResend) return;

//     setLoading(true);
//     try {
//       const { error } = await supabase.auth.signInWithOtp({
//         phone,
//         options: {
//           channel: "sms",
//         },
//       });

//       console.log("Resend OTP Response:", { error });

//       if (error) {
//         Alert.alert("Error", error.message);
//         setLoading(false);
//         return;
//       }

//       Alert.alert("Success", "OTP resent successfully! Check your phone.");
//       setResendTimer(60);
//       setCanResend(false);
//       setOtp(["", "", "", "", "", ""]);
//     } catch (err) {
//       console.error("Unexpected error resending OTP:", err);
//       Alert.alert("Error", "Failed to resend OTP. Please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <View style={styles.container}>
//       {/* Header */}
//       <View style={styles.header}>
//         <TouchableOpacity onPress={() => navigation.goBack()}>
//           <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
//         </TouchableOpacity>
//         <Text style={styles.headerTitle}>Verify Phone Number</Text>
//         <View style={{ width: 24 }} />
//       </View>

//       {/* Content */}
//       <View style={styles.content}>
//         <Text style={styles.subtitle}>
//           Enter the 6-digit code sent to {phone}
//         </Text>

//         {/* OTP Input */}
//         <View style={styles.otpContainer}>
//           {otp.map((digit, index) => (
//             <TextInput
//               key={index}
//               style={styles.otpInput}
//               value={digit}
//               onChangeText={(value) => handleOTPChange(value, index)}
//               keyboardType="number-pad"
//               maxLength={1}
//               ref={(ref) => (inputs.current[index] = ref!)}
//               onKeyPress={({ nativeEvent }) => {
//                 if (nativeEvent.key === "Backspace" && !digit && index > 0) {
//                   inputs.current[index - 1].focus();
//                 }
//               }}
//               autoFocus={index === 0}
//             />
//           ))}
//         </View>

//         {/* Resend OTP */}
//         <View style={styles.resendContainer}>
//           <Text style={styles.resendText}>
//             {canResend
//               ? "Didn't receive the code? "
//               : `Resend code in ${resendTimer}s `}
//           </Text>
//           <TouchableOpacity onPress={handleResendOTP} disabled={!canResend}>
//             <Text
//               style={[styles.resendLink, canResend && styles.resendLinkActive]}
//             >
//               Resend OTP
//             </Text>
//           </TouchableOpacity>
//         </View>

//         {/* Verify Button */}
//         <TouchableOpacity
//           style={[styles.verifyButton, loading && styles.buttonDisabled]}
//           onPress={handleVerifyOTP}
//           disabled={loading}
//         >
//           <Text style={styles.verifyButtonText}>
//             {loading ? "Verifying..." : "Verify"}
//           </Text>
//         </TouchableOpacity>
//       </View>
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: Colors.background,
//   },
//   header: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//     paddingHorizontal: 15,
//     paddingTop: 40,
//     paddingBottom: 20,
//   },
//   headerTitle: {
//     fontSize: 20,
//     fontWeight: "bold",
//     color: Colors.textPrimary,
//   },
//   content: {
//     paddingHorizontal: 15,
//   },
//   subtitle: {
//     fontSize: 16,
//     color: Colors.textSecondary,
//     marginBottom: 20,
//     textAlign: "center",
//   },
//   otpContainer: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     marginBottom: 20,
//   },
//   otpInput: {
//     backgroundColor: "#f5f5f5",
//     borderRadius: 10,
//     width: 50,
//     height: 50,
//     textAlign: "center",
//     fontSize: 20,
//     color: Colors.textPrimary,
//   },
//   resendContainer: {
//     flexDirection: "row",
//     justifyContent: "center",
//     alignItems: "center",
//     marginBottom: 20,
//   },
//   resendText: {
//     fontSize: 14,
//     color: Colors.textSecondary,
//   },
//   resendLink: {
//     fontSize: 14,
//     color: Colors.gray,
//     marginLeft: 5,
//     fontWeight: "600",
//   },
//   resendLinkActive: {
//     color: Colors.primary,
//   },
//   verifyButton: {
//     backgroundColor: Colors.primary,
//     borderRadius: 10,
//     padding: 15,
//     alignItems: "center",
//   },
//   buttonDisabled: {
//     backgroundColor: Colors.gray,
//   },
//   verifyButtonText: {
//     color: "#fff",
//     fontSize: 16,
//     fontWeight: "bold",
//   },
// });

// export default OTPScreen;
