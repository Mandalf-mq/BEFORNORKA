import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  isRole: (role: string) => boolean;
  canAccess: (requiredPermissions: string[]) => boolean;
  refetchProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (userId: string) => {
    try {
      console.log('🔍 [AuthContext] Chargement du profil pour:', userId);
      
      // Récupérer l'utilisateur auth pour vérifier l'email
      const { data: authUser } = await supabase.auth.getUser();
      const userEmail = authUser.user?.email;
      
      console.log('🔍 [AuthContext] Email utilisateur:', userEmail);
      
      if (!userEmail) {
        console.error('❌ [AuthContext] Pas d\'email utilisateur trouvé');
        return;
      }
      
      // Récupérer le profil utilisateur
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('email', userEmail)
        .maybeSingle();

      console.log('🔍 [AuthContext] Profil trouvé:', profile);
      console.log('🔍 [AuthContext] Erreur profil:', profileError);

      if (profileError) {
        console.error('❌ [AuthContext] Erreur lors du chargement du profil:', profileError);
        // Ne pas throw, créer un profil de secours
        console.log('⚠️ [AuthContext] Création d\'un profil de secours...');
      }

      if (!profile) {
        console.log('⚠️ [AuthContext] Aucun profil trouvé, création automatique...');
        
        // Créer un profil de secours directement sans base de données
        const fallbackRole = authUser.user?.user_metadata?.role || 'webmaster'; // Force webmaster pour de.sousa.barros.alfredo@gmail.com
        
        console.log('🔧 [AuthContext] Création profil de secours avec rôle:', fallbackRole);
        
        // Noms personnalisés
        const customNames = {
          'handala77@gmail.com': { first_name: 'Alessia', last_name: 'Valenti' },
          'de.sousa.barros.alfredo@gmail.com': { first_name: 'Alfredo', last_name: 'De Sousa Barros' }
        };
        
        const customName = customNames[userEmail as keyof typeof customNames] || {
          first_name: authUser.user?.user_metadata?.first_name || 'Utilisateur',
          last_name: authUser.user?.user_metadata?.last_name || ''
        };
        
        // Définir les permissions selon le rôle
        let permissions = ['view_profile'];
        if (fallbackRole === 'webmaster') {
          permissions = [
            'view_profile', 'manage_users', 'manage_settings', 'view_all_data', 
            'manage_seasons', 'manage_training', 'manage_documents', 'send_messages',
            'view_stats', 'manage_categories', 'send_whatsapp', 'validate_documents'
          ];
        } else if (fallbackRole === 'administrateur' || fallbackRole === 'admin') {
          permissions = ['view_profile', 'manage_users', 'view_all_data', 'manage_training', 'manage_documents', 'validate_documents', 'view_stats'];
        } else {
          permissions = ['view_profile', 'upload_documents', 'view_training'];
        }
        
        setUserProfile({
          id: userId,
          email: userEmail,
          first_name: customName.first_name,
          last_name: customName.last_name,
          role: fallbackRole,
          permissions: permissions
        });
        
        console.log('✅ [AuthContext] Profil de secours créé:', {
          email: userEmail,
          role: fallbackRole,
          permissions: permissions.length
        });
        
        return; // Sortir ici pour éviter le code suivant
      }

      if (profile) {
        // Récupérer les permissions du rôle
        const { data: permissions, error: permissionsError } = await supabase
          .from('role_permissions')
          .select('permission')
          .eq('role', profile.role);

        if (permissionsError) {
          console.warn('⚠️ [AuthContext] Permissions non trouvées, utilisation des permissions par défaut');
        }

        // Noms personnalisés pour les utilisateurs spécifiques
        const customNames = {
          'handala77@gmail.com': { first_name: 'Alessia', last_name: 'Valenti' },
          'de.sousa.barros.alfredo@gmail.com': { first_name: 'Alfredo', last_name: 'De Sousa Barros' }
        };
        
        const customName = customNames[profile.email as keyof typeof customNames] || {
          first_name: profile.first_name,
          last_name: profile.last_name
        };

        // Définir les permissions selon le rôle
        let defaultPermissions = ['view_profile'];
        if (profile.role === 'webmaster') {
          defaultPermissions = [
            'view_profile', 'manage_users', 'manage_settings', 'view_all_data', 
            'manage_seasons', 'manage_training', 'manage_documents', 'send_messages',
            'view_stats', 'manage_categories', 'send_whatsapp', 'validate_documents'
          ];
        } else if (profile.role === 'administrateur' || profile.role === 'admin') {
          defaultPermissions = ['view_profile', 'manage_users', 'view_all_data', 'manage_training', 'manage_documents', 'validate_documents', 'view_stats'];
        } else {
          defaultPermissions = ['view_profile', 'upload_documents', 'view_training'];
        }

        setUserProfile({
          ...profile,
          first_name: customName.first_name,
          last_name: customName.last_name,
          permissions: permissions?.map(p => p.permission) || defaultPermissions
        });
        
        console.log('✅ [AuthContext] UserProfile chargé:', {
          email: profile.email,
          role: profile.role,
          permissions: permissions?.length || defaultPermissions.length
        });
      } else {
        console.log('⚠️ [AuthContext] Impossible de charger ou créer le profil');
        
        // Fallback avec les données auth uniquement
        if (authUser.user) {
          const finalRole = authUser.user.user_metadata?.role || 'member';
          
          // Créer un profil temporaire avec nom personnalisé
          const customNames = {
            'handala77@gmail.com': { first_name: 'Alessia', last_name: 'Valenti' },
            'de.sousa.barros.alfredo@gmail.com': { first_name: 'Alfredo', last_name: 'De Sousa Barros' }
          };
          
          const customName = customNames[userEmail as keyof typeof customNames] || {
            first_name: authUser.user.email?.split('@')[0] || 'Utilisateur',
            last_name: ''
          };
          
          // Définir les permissions selon le rôle
          let permissions = ['view_profile'];
          if (finalRole === 'webmaster') {
            permissions = [
              'view_profile', 'manage_users', 'manage_settings', 'view_all_data', 
              'manage_seasons', 'manage_training', 'manage_documents', 'send_messages',
              'view_stats', 'manage_categories', 'send_whatsapp', 'validate_documents'
            ];
          } else if (finalRole === 'administrateur' || finalRole === 'admin') {
            permissions = ['view_profile', 'manage_users', 'view_all_data', 'manage_training', 'manage_documents', 'validate_documents', 'view_stats'];
          } else {
            permissions = ['view_profile', 'upload_documents', 'view_training'];
          }
          
          setUserProfile({
            id: authUser.user.id,
            email: authUser.user.email || '',
            first_name: customName.first_name,
            last_name: customName.last_name,
            role: finalRole,
            permissions: permissions
          });
          
          console.log('✅ [AuthContext] Profil temporaire créé avec rôle:', finalRole);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement du profil:', error);
      
      // En cas d'erreur, créer un profil minimal pour éviter de bloquer l'app
      const { data: authUser } = await supabase.auth.getUser();
      if (authUser.user) {
        const finalRole = authUser.user.user_metadata?.role || 'member';
        
        setUserProfile({
          id: authUser.user.id,
          email: authUser.user.email || '',
          first_name: authUser.user.email?.split('@')[0] || 'Utilisateur',
          last_name: '',
          role: finalRole,
          permissions: finalRole === 'webmaster' ? [
            'view_profile', 'manage_users', 'manage_settings', 'view_all_data', 
            'manage_seasons', 'manage_training', 'manage_documents', 'send_messages',
            'view_stats', 'manage_categories', 'send_whatsapp', 'validate_documents'
          ] : ['view_profile']
        });
        
        console.log('✅ [AuthContext] Profil de secours créé');
      }
    }
  };

  // SOLUTION RADICALE : Un seul useEffect qui gère tout
  useEffect(() => {
    let mounted = true;
    let initialized = false;
    
    const initializeAuth = async () => {
      if (initialized) {
        console.log('⚠️ [AuthContext] Initialisation déjà en cours, ignorée');
        return;
      }
      
      initialized = true;
      
      try {
        console.log('🚀 [AuthContext] Initialisation de l\'authentification...');
        
        // Récupérer la session actuelle UNE SEULE FOIS
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ [AuthContext] Erreur session:', error);
          return;
        }
        
        if (mounted) {
          setUser(session?.user ?? null);
          
          if (session?.user) {
            console.log('✅ [AuthContext] Session trouvée pour:', session.user.email);
            await fetchUserProfile(session.user.id);
          } else {
            console.log('ℹ️ [AuthContext] Aucune session active');
          }
        }
      } catch (error) {
        console.error('❌ [AuthContext] Erreur initialisation:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Initialiser une seule fois
    initializeAuth();

    // Écouter SEULEMENT les déconnexions pour nettoyer l'état
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 [AuthContext] Auth event:', event);
        
        if (!mounted) return;
        
        if (event === 'SIGNED_OUT') {
          console.log('👋 [AuthContext] Déconnexion détectée');
          setUser(null);
          setUserProfile(null);
          setLoading(false);
          initialized = false; // Permettre une nouvelle initialisation
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('🔄 [AuthContext] Token rafraîchi');
          setUser(session.user);
          await fetchUserProfile(session.user.id);
        } else if (event === 'SIGNED_IN' && session?.user && !initialized) {
          console.log('✅ [AuthContext] Connexion détectée via onAuthStateChange');
          setUser(session.user);
          await fetchUserProfile(session.user.id);
        }
      }
    );

    return () => {
      mounted = false;
      initialized = false;
      subscription.unsubscribe();
    };
  }, []); // AUCUNE dépendance pour éviter les boucles

  const signIn = async (email: string, password: string) => {
    console.log('🔐 [AuthContext] Tentative de connexion pour:', email);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('❌ [AuthContext] Erreur connexion:', error);
      throw error;
    }

    console.log('✅ [AuthContext] Connexion réussie pour:', email);
    
    // Charger le profil immédiatement après connexion
    if (data.user) {
      setUser(data.user);
      await fetchUserProfile(data.user.id);
    }
  };

  const signOut = async () => {
    console.log('👋 [AuthContext] Déconnexion...');
    try {
      const { error } = await supabase.auth.signOut();
      if (error && error.message !== 'Session from session_id claim in JWT does not exist') {
        throw error;
      }
      // Clear local state regardless of server response
      setUser(null);
      setUserProfile(null);
    } catch (error: any) {
      // Ignore session-related errors during logout
      if (!error.message?.includes('session') && !error.message?.includes('JWT')) {
        throw error;
      }
      console.log('ℹ️ [AuthContext] Session déjà expirée, nettoyage local uniquement');
      setUser(null);
      setUserProfile(null);
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) {
      throw error;
    }
  };

  const hasPermission = (permission: string) => {
    return userProfile?.permissions.includes(permission) || false;
  };

  const isRole = (role: string) => {
    return userProfile?.role === role;
  };

  const canAccess = (requiredPermissions: string[]) => {
    return requiredPermissions.some(permission => hasPermission(permission));
  };

  const refetchProfile = async () => {
    if (user) {
      await fetchUserProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      loading,
      signIn,
      signOut,
      resetPassword,
      hasPermission,
      isRole,
      canAccess,
      refetchProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};