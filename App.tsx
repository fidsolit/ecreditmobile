import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import Auth from "./components/Auth";
import Account from "./components/Account";
import { View } from "react-native";
import { Session } from "@supabase/supabase-js";
import { ThemeProvider } from "@rneui/themed";
import { theme } from "./lib/theme";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // Fetch the initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth state changes
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        // Directly set the new session - React will handle the comparison
        setSession(newSession);
      }
    );

    // Cleanup the listener on unmount
    return () => {
      subscription.unsubscribe(); // Properly unsubscribe the listener
    };
  }, []); // Dependency array ensures this runs only once

  return (
    <ThemeProvider theme={theme}>
      <View style={{ flex: 1 }}>
        {session && session.user ? (
          <Account key={session.user.id} session={session} />
        ) : (
          <Auth />
        )}
      </View>
    </ThemeProvider>
  );
}
