import { StyleSheet, View, Alert } from "react-native";
import { Button, Input, Text } from "@rneui/themed";
import { supabase } from "../lib/supabase";

export default function Account({ session }: { session: any }) {
  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert("Error", error.message);
  };

  return (
    <View style={styles.container}>
      <Text h3 style={styles.title}>
        Welcome, {session?.user?.email}
      </Text>
      <Input label="Username" value="JohnDoe" disabled />
      <Input label="Website" value="https://example.com" disabled />
      <Button
        title="Sign Out"
        onPress={handleSignOut}
        buttonStyle={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    textAlign: "center",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#dc3545",
    marginTop: 20,
  },
});
