import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import Auth from "./components/Auth";
import Account from "./components/Account";
import AdminDashboard from "./components/AdminDashboard";
import { View } from "react-native";
import { Session } from "@supabase/supabase-js";
import { ThemeProvider } from "@rneui/themed";
import { theme } from "./lib/theme";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Fetch the initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        checkAdminStatus(session.user.id);
      }
    });

    // Listen for auth state changes
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        // Directly set the new session - React will handle the comparison
        setSession(newSession);
        if (newSession?.user) {
          checkAdminStatus(newSession.user.id);
        } else {
          setIsAdmin(false);
        }
      }
    );

    // Cleanup the listener on unmount
    return () => {
      subscription.subscription.unsubscribe(); // Properly unsubscribe the listener
    };
  }, []); // Dependency array ensures this runs only once

  const checkAdminStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setIsAdmin(data.is_admin || false);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <View style={{ flex: 1 }}>
        {session && session.user ? (
          isAdmin ? (
            <AdminDashboard key={session.user.id} session={session} />
          ) : (
            <Account key={session.user.id} session={session} />
          )
        ) : (
          <Auth navigation={undefined} />
        )}
      </View>
    </ThemeProvider>
  );
}
