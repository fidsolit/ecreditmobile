import {
  StyleSheet,
  View,
  Alert,
  ScrollView,
  TouchableOpacity,
  Modal,
  Image,
} from "react-native";
import { Button, Text, Card, Avatar, Divider, Input } from "@rneui/themed";
import { supabase } from "../lib/supabase";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  credit_score?: number;
  loan_limit?: number;
  avatar_url?: string;
}

export default function Account({ session }: { session: any }) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(
    null
  );
  const [uploading, setUploading] = useState(false);
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [loanModalVisible, setLoanModalVisible] = useState(false);
  const [loanApplication, setLoanApplication] = useState({
    amount: "",
    purpose: "",
    termMonths: "1",
    monthlyIncome: "",
    employmentType: "",
  });

  useEffect(() => {
    if (session?.user) {
      fetchUserProfile();
    }
  }, [session]);

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching profile:", error);
      }

      setUserProfile({
        id: session.user.id,
        email: session.user.email,
        full_name: data?.full_name || "",
        phone: data?.phone || "",
        credit_score: data?.credit_score || 0,
        loan_limit: data?.loan_limit || 0,
        avatar_url: data?.avatar_url || null,
      });
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert("Error", error.message);
  };

  const openEditModal = () => {
    if (userProfile) {
      setEditingProfile({ ...userProfile });
      setEditModalVisible(true);
    }
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditingProfile(null);
  };

  const uploadProfilePicture = async (uri: string) => {
    try {
      setUploading(true);

      // Create a unique filename
      const fileExt = uri.split(".").pop()?.toLowerCase() ?? "jpeg";
      const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;

      // Convert image to blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from("avatars")
        .upload(fileName, blob, {
          contentType: `image/${fileExt}`,
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const pickImage = async () => {
    try {
      // Request permission
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please grant camera roll permissions to upload a profile picture."
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        const publicUrl = await uploadProfilePicture(imageUri);

        if (editingProfile) {
          setEditingProfile({ ...editingProfile, avatar_url: publicUrl });
        }
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to upload image. Please try again.");
    }
  };

  const saveProfile = async () => {
    if (!editingProfile) return;

    try {
      setUploading(true);

      const { error } = await supabase.from("profiles").upsert({
        id: session.user.id,
        full_name: editingProfile.full_name,
        phone: editingProfile.phone,
        avatar_url: editingProfile.avatar_url,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        throw error;
      }

      // Update local state
      setUserProfile(editingProfile);
      closeEditModal();
      Alert.alert("Success", "Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert("Error", "Failed to update profile. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const toggleProfileMenu = () => {
    setProfileMenuVisible(!profileMenuVisible);
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: handleSignOut,
      },
    ]);
    setProfileMenuVisible(false);
  };

  const openLoanApplication = () => {
    setLoanModalVisible(true);
    setProfileMenuVisible(false);
  };

  const closeLoanModal = () => {
    setLoanModalVisible(false);
    setLoanApplication({
      amount: "",
      purpose: "",
      termMonths: "1",
      monthlyIncome: "",
      employmentType: "",
    });
  };

  const calculateLoanDetails = () => {
    const amount = parseFloat(loanApplication.amount) || 0;
    const termMonths = parseInt(loanApplication.termMonths) || 1;
    const monthlyInterestRate = 0.15; // 15% per month

    // Calculate monthly payment using compound interest formula
    const monthlyPayment =
      (amount * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, termMonths)) /
      (Math.pow(1 + monthlyInterestRate, termMonths) - 1);

    return {
      monthlyPayment: isNaN(monthlyPayment) ? 0 : monthlyPayment,
      totalAmount: monthlyPayment * termMonths,
      interestAmount: monthlyPayment * termMonths - amount,
    };
  };

  const submitLoanApplication = async () => {
    // Validation
    if (
      !loanApplication.amount ||
      !loanApplication.purpose ||
      !loanApplication.monthlyIncome
    ) {
      Alert.alert("Validation Error", "Please fill in all required fields.");
      return;
    }

    const amount = parseFloat(loanApplication.amount);
    const monthlyIncome = parseFloat(loanApplication.monthlyIncome);

    if (amount <= 0 || amount > 500000) {
      Alert.alert(
        "Validation Error",
        "Loan amount must be between ₱1,000 and ₱500,000."
      );
      return;
    }

    if (monthlyIncome <= 0) {
      Alert.alert("Validation Error", "Monthly income must be greater than 0.");
      return;
    }

    // Check if loan amount is reasonable (not more than 5x monthly income)
    if (amount > monthlyIncome * 5) {
      Alert.alert(
        "Validation Error",
        "Loan amount cannot exceed 5 times your monthly income."
      );
      return;
    }

    try {
      setUploading(true);

      const loanDetails = calculateLoanDetails();
      const interestRate = 0.15; // 15% per month

      const { error } = await supabase.from("loans").insert({
        user_id: session.user.id,
        amount: amount,
        interest_rate: interestRate,
        term_months: parseInt(loanApplication.termMonths),
        monthly_payment: loanDetails.monthlyPayment,
        status: "pending",
        application_date: new Date().toISOString(),
      });

      if (error) {
        throw error;
      }

      // Log activity
      await supabase.from("activity_log").insert({
        user_id: session.user.id,
        activity_type: "loan_application",
        description: `Applied for ₱${formatCurrency(amount)} loan`,
        amount: amount,
      });

      closeLoanModal();
      Alert.alert(
        "Application Submitted",
        "Your loan application has been submitted successfully! We will review it and get back to you within 24 hours.",
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("Error submitting loan application:", error);
      Alert.alert(
        "Error",
        "Failed to submit loan application. Please try again."
      );
    } finally {
      setUploading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  };

  const getCreditScoreColor = (score: number) => {
    if (score >= 750) return "#4CAF50"; // Green
    if (score >= 650) return "#FF9800"; // Orange
    return "#F44336"; // Red
  };

  const getCreditScoreText = (score: number) => {
    if (score >= 750) return "Excellent";
    if (score >= 650) return "Good";
    if (score >= 500) return "Fair";
    return "Poor";
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Section */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.profileSection}
          onPress={toggleProfileMenu}
        >
          <Avatar
            size={80}
            rounded
            source={{ uri: userProfile?.avatar_url }}
            icon={{ name: "person", type: "material" }}
            containerStyle={styles.avatar}
          />
          <View style={styles.profileInfo}>
            <Text h4 style={styles.userName}>
              {userProfile?.full_name || "User"}
            </Text>
            <Text style={styles.userEmail}>{userProfile?.email}</Text>
            <Text style={styles.userPhone}>
              {userProfile?.phone || "No phone number"}
            </Text>
          </View>
          <View style={styles.profileActions}>
            <TouchableOpacity style={styles.editButton} onPress={openEditModal}>
              <Ionicons name="create-outline" size={20} color="#007bff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuButton}>
              <Ionicons
                name={profileMenuVisible ? "chevron-up" : "chevron-down"}
                size={20}
                color="#6c757d"
              />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {/* Profile Menu */}
        {profileMenuVisible && (
          <View style={styles.profileMenu}>
            <TouchableOpacity style={styles.menuItem} onPress={openEditModal}>
              <Ionicons name="person-outline" size={20} color="#6c757d" />
              <Text style={styles.menuItemText}>Edit Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color="#dc3545" />
              <Text style={[styles.menuItemText, { color: "#dc3545" }]}>
                Sign Out
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Quick Stats Cards */}
      <View style={styles.statsContainer}>
        <Card containerStyle={styles.statCard}>
          <View style={styles.statItem}>
            <Ionicons name="card" size={24} color="#007bff" />
            <Text style={styles.statLabel}>Credit Score</Text>
            <Text
              style={[
                styles.statValue,
                { color: getCreditScoreColor(userProfile?.credit_score || 0) },
              ]}
            >
              {userProfile?.credit_score || 0}
            </Text>
            <Text
              style={[
                styles.statSubtext,
                { color: getCreditScoreColor(userProfile?.credit_score || 0) },
              ]}
            >
              {getCreditScoreText(userProfile?.credit_score || 0)}
            </Text>
          </View>
        </Card>

        <Card containerStyle={styles.statCard}>
          <View style={styles.statItem}>
            <Ionicons name="cash" size={24} color="#28a745" />
            <Text style={styles.statLabel}>Loan Limit</Text>
            <Text style={[styles.statValue, { color: "#28a745" }]}>
              {formatCurrency(userProfile?.loan_limit || 0)}
            </Text>
            <Text style={styles.statSubtext}>Available</Text>
          </View>
        </Card>
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsContainer}>
        <Text h4 style={styles.sectionTitle}>
          Quick Actions
        </Text>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={openLoanApplication}
        >
          <Ionicons name="add-circle" size={24} color="#007bff" />
          <Text style={styles.actionText}>Apply for Loan</Text>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="document-text" size={24} color="#28a745" />
          <Text style={styles.actionText}>View Loan History</Text>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="calculator" size={24} color="#ff9800" />
          <Text style={styles.actionText}>Loan Calculator</Text>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="settings" size={24} color="#6c757d" />
          <Text style={styles.actionText}>Account Settings</Text>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Recent Activity */}
      <View style={styles.activityContainer}>
        <Text h4 style={styles.sectionTitle}>
          Recent Activity
        </Text>
        <Card containerStyle={styles.activityCard}>
          <View style={styles.activityItem}>
            <Ionicons name="checkmark-circle" size={20} color="#28a745" />
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>
                Loan Application Approved
              </Text>
              <Text style={styles.activityDate}>2 days ago</Text>
            </View>
            <Text style={[styles.activityAmount, { color: "#28a745" }]}>
              +{formatCurrency(50000)}
            </Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.activityItem}>
            <Ionicons name="arrow-down-circle" size={20} color="#dc3545" />
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>Monthly Payment</Text>
              <Text style={styles.activityDate}>1 week ago</Text>
            </View>
            <Text style={[styles.activityAmount, { color: "#dc3545" }]}>
              -{formatCurrency(2500)}
            </Text>
          </View>
        </Card>
      </View>

      {/* Edit Profile Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeEditModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeEditModal}>
              <Text style={styles.modalCancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text h4 style={styles.modalTitle}>
              Edit Profile
            </Text>
            <TouchableOpacity onPress={saveProfile} disabled={uploading}>
              <Text
                style={[
                  styles.modalSaveButton,
                  uploading && styles.disabledButton,
                ]}
              >
                {uploading ? "Saving..." : "Save"}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Profile Picture Section */}
            <View style={styles.avatarSection}>
              <Avatar
                size={120}
                rounded
                source={{ uri: editingProfile?.avatar_url }}
                icon={{ name: "person", type: "material" }}
                containerStyle={styles.modalAvatar}
              />
              <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                <Ionicons name="camera" size={20} color="#007bff" />
                <Text style={styles.uploadButtonText}>
                  {uploading ? "Uploading..." : "Change Photo"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form Fields */}
            <View style={styles.formSection}>
              <Input
                label="Full Name"
                value={editingProfile?.full_name || ""}
                onChangeText={(text) =>
                  setEditingProfile((prev) =>
                    prev ? { ...prev, full_name: text } : null
                  )
                }
                placeholder="Enter your full name"
                containerStyle={styles.inputContainer}
              />

              <Input
                label="Phone Number"
                value={editingProfile?.phone || ""}
                onChangeText={(text) =>
                  setEditingProfile((prev) =>
                    prev ? { ...prev, phone: text } : null
                  )
                }
                placeholder="Enter your phone number"
                keyboardType="phone-pad"
                containerStyle={styles.inputContainer}
              />

              <Input
                label="Email"
                value={editingProfile?.email || ""}
                editable={false}
                containerStyle={styles.inputContainer}
                inputStyle={styles.disabledInput}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Loan Application Modal */}
      <Modal
        visible={loanModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeLoanModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeLoanModal}>
              <Text style={styles.modalCancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text h4 style={styles.modalTitle}>
              Apply for Loan
            </Text>
            <TouchableOpacity
              onPress={submitLoanApplication}
              disabled={uploading}
            >
              <Text
                style={[
                  styles.modalSaveButton,
                  uploading && styles.disabledButton,
                ]}
              >
                {uploading ? "Submitting..." : "Submit"}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Loan Calculator Preview */}
            {loanApplication.amount && (
              <View style={styles.loanPreviewCard}>
                <Text h4 style={styles.loanPreviewTitle}>
                  Loan Preview
                </Text>
                <View style={styles.loanPreviewRow}>
                  <Text style={styles.loanPreviewLabel}>Monthly Payment:</Text>
                  <Text style={[styles.loanPreviewValue, { color: "#007bff" }]}>
                    {formatCurrency(calculateLoanDetails().monthlyPayment)}
                  </Text>
                </View>
                <View style={styles.loanPreviewRow}>
                  <Text style={styles.loanPreviewLabel}>Total Amount:</Text>
                  <Text style={[styles.loanPreviewValue, { color: "#28a745" }]}>
                    {formatCurrency(calculateLoanDetails().totalAmount)}
                  </Text>
                </View>
                <View style={styles.loanPreviewRow}>
                  <Text style={styles.loanPreviewLabel}>
                    Interest (15% per month):
                  </Text>
                  <Text style={[styles.loanPreviewValue, { color: "#ff9800" }]}>
                    {formatCurrency(calculateLoanDetails().interestAmount)}
                  </Text>
                </View>
              </View>
            )}

            {/* Loan Application Form */}
            <View style={styles.formSection}>
              <Input
                label="Loan Amount *"
                value={loanApplication.amount}
                onChangeText={(text) =>
                  setLoanApplication((prev) => ({ ...prev, amount: text }))
                }
                placeholder="Enter loan amount"
                keyboardType="numeric"
                containerStyle={styles.inputContainer}
                rightIcon={<Text style={styles.currencyLabel}>₱</Text>}
              />

              <Input
                label="Loan Purpose *"
                value={loanApplication.purpose}
                onChangeText={(text) =>
                  setLoanApplication((prev) => ({ ...prev, purpose: text }))
                }
                placeholder="e.g., Home improvement, Education, Emergency"
                containerStyle={styles.inputContainer}
              />

              <View style={styles.dropdownContainer}>
                <Text style={styles.dropdownLabel}>Repayment Term *</Text>
                <View style={styles.dropdownOptions}>
                  {["1", "2", "3"].map((term) => (
                    <TouchableOpacity
                      key={term}
                      style={[
                        styles.dropdownOption,
                        loanApplication.termMonths === term &&
                          styles.dropdownOptionSelected,
                      ]}
                      onPress={() =>
                        setLoanApplication((prev) => ({
                          ...prev,
                          termMonths: term,
                        }))
                      }
                    >
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          loanApplication.termMonths === term &&
                            styles.dropdownOptionTextSelected,
                        ]}
                      >
                        {term} {term === "1" ? "month" : "months"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Input
                label="Monthly Income *"
                value={loanApplication.monthlyIncome}
                onChangeText={(text) =>
                  setLoanApplication((prev) => ({
                    ...prev,
                    monthlyIncome: text,
                  }))
                }
                placeholder="Enter your monthly income"
                keyboardType="numeric"
                containerStyle={styles.inputContainer}
                rightIcon={<Text style={styles.currencyLabel}>₱</Text>}
              />

              <View style={styles.dropdownContainer}>
                <Text style={styles.dropdownLabel}>Employment Type *</Text>
                <View style={styles.dropdownOptions}>
                  {[
                    "Full-time",
                    "Part-time",
                    "Self-employed",
                    "Contract",
                    "Retired",
                  ].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.dropdownOption,
                        loanApplication.employmentType === type &&
                          styles.dropdownOptionSelected,
                      ]}
                      onPress={() =>
                        setLoanApplication((prev) => ({
                          ...prev,
                          employmentType: type,
                        }))
                      }
                    >
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          loanApplication.employmentType === type &&
                            styles.dropdownOptionTextSelected,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.loanTerms}>
                <Text style={styles.loanTermsTitle}>
                  Loan Terms & Conditions
                </Text>
                <Text style={styles.loanTermsText}>
                  • Interest Rate: 15% per month
                </Text>
                <Text style={styles.loanTermsText}>
                  • Maximum loan amount: ₱500,000
                </Text>
                <Text style={styles.loanTermsText}>
                  • Processing time: 24-48 hours
                </Text>
                <Text style={styles.loanTermsText}>
                  • No prepayment penalties
                </Text>
                <Text style={styles.loanTermsText}>
                  • Late payment fee: ₱500 per month
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  header: {
    backgroundColor: "#ffffff",
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    paddingVertical: 10,
  },
  avatar: {
    backgroundColor: "#e9ecef",
    borderWidth: 3,
    borderColor: "#007bff",
  },
  profileInfo: {
    marginLeft: 20,
    flex: 1,
  },
  userName: {
    color: "#212529",
    fontWeight: "600",
    marginBottom: 5,
  },
  userEmail: {
    color: "#6c757d",
    fontSize: 14,
    marginBottom: 2,
  },
  userPhone: {
    color: "#6c757d",
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginTop: -15,
    marginBottom: 20,
    gap: 15,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 0,
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    color: "#6c757d",
    marginTop: 8,
    marginBottom: 4,
    fontWeight: "500",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 2,
  },
  statSubtext: {
    fontSize: 11,
    fontWeight: "500",
  },
  actionsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    color: "#212529",
    fontWeight: "600",
    marginBottom: 15,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  actionText: {
    flex: 1,
    marginLeft: 15,
    fontSize: 16,
    color: "#212529",
    fontWeight: "500",
  },
  activityContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  activityCard: {
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 0,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  activityContent: {
    flex: 1,
    marginLeft: 15,
  },
  activityTitle: {
    fontSize: 16,
    color: "#212529",
    fontWeight: "500",
    marginBottom: 2,
  },
  activityDate: {
    fontSize: 12,
    color: "#6c757d",
  },
  activityAmount: {
    fontSize: 16,
    fontWeight: "700",
  },
  divider: {
    marginVertical: 10,
  },
  // Edit Profile Styles
  editButton: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  modalCancelButton: {
    color: "#6c757d",
    fontSize: 16,
    fontWeight: "500",
  },
  modalTitle: {
    color: "#212529",
    fontWeight: "600",
  },
  modalSaveButton: {
    color: "#007bff",
    fontSize: 16,
    fontWeight: "600",
  },
  disabledButton: {
    color: "#6c757d",
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  avatarSection: {
    alignItems: "center",
    paddingVertical: 30,
    backgroundColor: "#ffffff",
    marginTop: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalAvatar: {
    backgroundColor: "#e9ecef",
    borderWidth: 3,
    borderColor: "#007bff",
    marginBottom: 15,
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#007bff",
  },
  uploadButtonText: {
    marginLeft: 8,
    color: "#007bff",
    fontSize: 14,
    fontWeight: "500",
  },
  formSection: {
    marginTop: 20,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  inputContainer: {
    marginBottom: 10,
  },
  disabledInput: {
    color: "#6c757d",
  },
  // Profile Menu Styles
  profileActions: {
    position: "absolute",
    top: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  menuButton: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  profileMenu: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    marginTop: 10,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  menuItemText: {
    marginLeft: 12,
    fontSize: 16,
    color: "#212529",
    fontWeight: "500",
  },
  // Loan Application Styles
  loanPreviewCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loanPreviewTitle: {
    color: "#212529",
    fontWeight: "600",
    marginBottom: 15,
    textAlign: "center",
  },
  loanPreviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  loanPreviewLabel: {
    fontSize: 14,
    color: "#6c757d",
    fontWeight: "500",
  },
  loanPreviewValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  currencyLabel: {
    fontSize: 16,
    color: "#6c757d",
    fontWeight: "600",
  },
  dropdownContainer: {
    marginBottom: 20,
  },
  dropdownLabel: {
    fontSize: 16,
    color: "#212529",
    fontWeight: "500",
    marginBottom: 10,
  },
  dropdownOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  dropdownOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e9ecef",
    backgroundColor: "#f8f9fa",
  },
  dropdownOptionSelected: {
    backgroundColor: "#007bff",
    borderColor: "#007bff",
  },
  dropdownOptionText: {
    fontSize: 14,
    color: "#6c757d",
    fontWeight: "500",
  },
  dropdownOptionTextSelected: {
    color: "#ffffff",
  },
  loanTerms: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 15,
    marginTop: 10,
  },
  loanTermsTitle: {
    fontSize: 16,
    color: "#212529",
    fontWeight: "600",
    marginBottom: 10,
  },
  loanTermsText: {
    fontSize: 12,
    color: "#6c757d",
    marginBottom: 4,
    lineHeight: 16,
  },
});
