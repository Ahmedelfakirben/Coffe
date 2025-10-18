import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { toast } from 'react-hot-toast';

interface EmployeeProfile {
  id: string;
  full_name: string;
  role: 'admin' | 'cashier' | 'barista';
  phone: string | null;
  active: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: EmployeeProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        }
        setLoading(false);
      })();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('employee_profiles')
      .select('id, full_name, role, phone, active, email, deleted_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return;
    }

    // Bloquear acceso si usuario está inactivo o eliminado
    if (data && (!data.active || data.deleted_at)) {
      await supabase.auth.signOut();
      setProfile(null);
      toast.error('Tu cuenta está desactivada o eliminada');
      return;
    }

    setProfile(data);
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Wait for profile to be fetched and then redirect admin to analytics
    if (data.user) {
      // Small delay to ensure profile is loaded
      setTimeout(async () => {
        const { data: profileData } = await supabase
          .from('employee_profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        if (profileData?.role === 'admin') {
          // Force redirect to analytics for admin users
          window.location.hash = '#/analytics';
        }
      }, 100);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
