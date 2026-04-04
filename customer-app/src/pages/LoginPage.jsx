import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function LoginPage({ onSuccess }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleLogin() {
    if (!email || !password) { setError('Please enter email and password'); return; }
    setLoading(true); setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    onSuccess?.();
    setLoading(false);
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px', background:'#FAFAF8' }}>
      <div style={{ width:'100%', maxWidth:'360px' }}>
        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          <div style={{ fontSize:'48px', marginBottom:'8px' }}>🧺</div>
          <h1 style={{ fontFamily:'Poppins, sans-serif', fontSize:'24px', fontWeight:700, color:'#0D1B3E' }}>Kair</h1>
          <p style={{ color:'#6B6B6B', fontSize:'13px', marginTop:'4px' }}>Your clothes, in safe hands</p>
        </div>

        <div style={{ marginBottom:'12px' }}>
          <label style={lbl}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(''); }}
            placeholder="test@kair.in"
            style={inp}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>

        <div style={{ marginBottom:'16px' }}>
          <label style={lbl}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            placeholder="••••••••"
            style={inp}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>

        {error && <p style={{ color:'#D32F2F', fontSize:'12px', marginBottom:'10px' }}>{error}</p>}

        <button onClick={handleLogin} disabled={loading} style={btn}>
          {loading ? 'Signing in...' : 'Sign in →'}
        </button>

        <p style={{ textAlign:'center', fontSize:'11px', color:'#6B6B6B', marginTop:'12px' }}>
          Test account: test@kair.in / Kair@1234
        </p>
      </div>
    </div>
  );
}

const lbl = { display:'block', fontSize:'12px', fontWeight:600, color:'#6B6B6B', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:'6px' };
const inp = { width:'100%', padding:'12px 14px', border:'1.5px solid #E8E8E8', borderRadius:'10px', fontSize:'14px', fontFamily:'Poppins, sans-serif', color:'#0D1B3E', outline:'none', boxSizing:'border-box' };
const btn = { width:'100%', padding:'14px', background:'#FF6B00', color:'#fff', border:'none', borderRadius:'12px', fontSize:'15px', fontWeight:700, cursor:'pointer', fontFamily:'Poppins, sans-serif' };