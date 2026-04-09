import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions and sets the user
    console.log('AuthContext: Initializing session check...');
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('AuthContext: Session found:', session?.user?.id || 'none');
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    // Listen for changes on auth state (in, out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('AuthContext: Auth State Changed Event:', _event);
      console.log('AuthContext: New User Session:', session?.user?.id || 'none');
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId, retryCount = 0) => {
    const MAX_RETRIES = 3;
    console.log('AuthContext: Fetching profile for user:', userId, retryCount > 0 ? `(retry ${retryCount})` : '');
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.warn('AuthContext: Profile fetch failed or record missing:', error.message);
        // Retry on transient errors (not on "row not found")
        if (retryCount < MAX_RETRIES && error.code !== 'PGRST116') {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
          console.log(`AuthContext: Retrying profile fetch in ${delay}ms...`);
          setTimeout(() => fetchProfile(userId, retryCount + 1), delay);
          // On first attempt, try to use cached profile while retrying
          if (retryCount === 0) {
            try {
              const cached = localStorage.getItem(`profile_${userId}`);
              if (cached) {
                const cachedProfile = JSON.parse(cached);
                console.log('AuthContext: Using cached profile as fallback, role:', cachedProfile.role);
                setProfile(cachedProfile);
              }
            } catch (e) { /* ignore parse errors */ }
            setLoading(false);
          }
          return;
        }
      }
      
      const session = await supabase.auth.getSession();
      const authUser = session.data.session?.user;
      
      let profileData = data || null;
      if (profileData && !profileData.contact_number && authUser?.user_metadata?.phone) {
        profileData.contact_number = authUser.user_metadata.phone;
      }

      // Auto-sync Google profile picture if avatar_url is empty
      if (profileData && !profileData.avatar_url && authUser?.user_metadata?.avatar_url) {
        const googleAvatar = authUser.user_metadata.avatar_url;
        profileData.avatar_url = googleAvatar;
        // Persist to database so it's available everywhere
        supabase.from('users').update({ avatar_url: googleAvatar }).eq('id', userId).then(() => {
          console.log('AuthContext: Auto-synced Google profile picture.');
        });
      }
      
      // Only overwrite if we got valid data, to prevent transient network errors 
      // from wiping out the active profile (which makes admins suddenly look like students).
      setProfile(prev => {
        if (profileData) {
          // Cache successful profile to localStorage for fallback
          try { localStorage.setItem(`profile_${userId}`, JSON.stringify(profileData)); } catch (e) { /* ignore */ }
          return profileData;
        }
        if (prev && prev.id === userId) return prev;
        // Last resort: try cached profile
        try {
          const cached = localStorage.getItem(`profile_${userId}`);
          if (cached) return JSON.parse(cached);
        } catch (e) { /* ignore */ }
        return null;
      });
    } catch (error) {
      console.error('AuthContext: Fatal Profile Error:', error);
      // Even on fatal error, try to recover from cache
      if (retryCount === 0) {
        try {
          const cached = localStorage.getItem(`profile_${userId}`);
          if (cached) {
            console.log('AuthContext: Recovering profile from cache after fatal error');
            setProfile(JSON.parse(cached));
          }
        } catch (e) { /* ignore */ }
      }
    } finally {
      console.log('AuthContext: Profile processing complete, clearing loading state.');
      setLoading(false);
    }
  };

  const value = {
    user,
    profile,
    loading,
    role: profile?.role || null,
    signOut: () => supabase.auth.signOut(),
    refreshProfile: () => user && fetchProfile(user.id),
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
