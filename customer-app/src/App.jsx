import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginScreen from './screens/LoginScreen';
import CustomerApp from './screens/CustomerApp';
import RiderApp    from './screens/RiderApp';
import ChannelPartnerApp from './screens/ChannelPartnerScreens';
import BatchRiderApp from './screens/BatchRiderScreens';
import OpsApp      from './screens/OpsApp';

function AppRouter() {
  const { isLoggedIn, loading, role } = useAuth();

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0D1B3E', flexDirection:'column', gap:'16px' }}>
      <div style={{ fontSize:'48px' }}>🧺</div>
      <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'24px', color:'#fff', letterSpacing:'4px', fontWeight:400 }}>KAIR</div>
    </div>
  );

  if (!isLoggedIn) return <LoginScreen />;
  if (role === 'admin') return <OpsApp />;
  if (role === 'rider') return <RiderApp />;
  if (role === 'channel_partner') return <ChannelPartnerApp />;
  if (role === 'batch_rider') return <BatchRiderApp />;
  return <CustomerApp />;
}

export default function App() {
  return <AuthProvider><AppRouter /></AuthProvider>;
}
