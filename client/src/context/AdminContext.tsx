import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { P3, Roles } from '@/lib/sdk';

interface AdminContextType {
  isSuperuser: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  walletAddress: string | null;
  role: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType>({
  isSuperuser: false,
  isAdmin: false,
  isModerator: false,
  walletAddress: null,
  role: null,
  loading: true,
  refresh: async () => {},
});

export function useAdmin() {
  return useContext(AdminContext);
}

interface AdminProviderProps {
  children: ReactNode;
}

export function AdminProvider({ children }: AdminProviderProps) {
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const wallet = await P3.wallet();
      if (wallet.connected && wallet.address) {
        setWalletAddress(wallet.address);
        
        const currentRole = await Roles.getRole();
        setRole(currentRole);
        
        const superuserStatus = await Roles.isSuperuser();
        setIsSuperuser(superuserStatus);
        
        const adminStatus = await Roles.isAdmin();
        setIsAdmin(adminStatus);
        
        const modStatus = await Roles.isModerator();
        setIsModerator(modStatus);
      } else {
        setWalletAddress(null);
        setRole(null);
        setIsSuperuser(false);
        setIsAdmin(false);
        setIsModerator(false);
      }
    } catch (error) {
      console.error('[AdminContext] Error fetching role:', error);
      setWalletAddress(null);
      setRole(null);
      setIsSuperuser(false);
      setIsAdmin(false);
      setIsModerator(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const handleAccountsChanged = () => {
        Roles.clearCache();
        refresh();
      };
      
      (window as any).ethereum.on('accountsChanged', handleAccountsChanged);
      return () => {
        (window as any).ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, []);

  return (
    <AdminContext.Provider value={{
      isSuperuser,
      isAdmin,
      isModerator,
      walletAddress,
      role,
      loading,
      refresh,
    }}>
      {children}
    </AdminContext.Provider>
  );
}
