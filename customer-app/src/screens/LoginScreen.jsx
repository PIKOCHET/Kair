import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { C } from '../lib/constants';

export default function LoginScreen() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handle() {
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setLoading(true); setError('');
    try {
      const { error: e } = isSignup
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (e) throw e;
      // AuthContext listener handles the rest
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.box}>
        {/* Logo */}
        <div style={S.emblem} />
        <h1 style={S.brand}>KAIR</h1>
        <p style={S.tagline}>Your clothes, in safe hands</p>

        {/* Form */}
        <div style={S.field}>
          <label style={S.label}>Email address</label>
          <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
            placeholder="you@email.com" style={S.input}
            onKeyDown={e => e.key === 'Enter' && handle()} />
        </div>
        <div style={S.field}>
          <label style={S.label}>Password</label>
          <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
            placeholder="••••••••" style={S.input}
            onKeyDown={e => e.key === 'Enter' && handle()} />
        </div>

        {error && <p style={S.error}>{error}</p>}

        <button onClick={handle} disabled={loading} style={S.btn}>
          {loading ? 'Please wait...' : isSignup ? 'Create account →' : 'Sign in →'}
        </button>
        <button onClick={() => { setIsSignup(!isSignup); setError(''); }} style={S.ghost}>
          {isSignup ? 'Already have an account? Sign in' : 'New to Kair? Create account'}
        </button>
      </div>
    </div>
  );
}

const S = {
  page:    { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', background:C.cream },
  box:     { width:'100%', maxWidth:'340px', textAlign:'center' },
  emblem:  { width:'60px', height:'60px', borderRadius:'18px', background:C.navy, margin:'0 auto 14px', position:'relative', display:'flex', alignItems:'center', justifyContent:'center' },
  brand:   { fontFamily:'Cormorant Garamond, serif', fontSize:'34px', fontWeight:400, color:C.navy, letterSpacing:'5px', margin:'0 0 4px' },
  tagline: { fontFamily:'Cormorant Garamond, serif', fontSize:'13px', color:C.stone, fontStyle:'italic', marginBottom:'32px' },
  field:   { marginBottom:'12px', textAlign:'left' },
  label:   { display:'block', fontSize:'10px', fontWeight:700, color:C.stone, textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:'5px' },
  input:   { width:'100%', padding:'12px 14px', border:`1.5px solid ${C.border}`, borderRadius:'10px', fontSize:'14px', fontFamily:'DM Sans, sans-serif', color:C.navy, outline:'none', background:'#fff', boxSizing:'border-box' },
  error:   { color:C.danger, fontSize:'12px', marginBottom:'10px', textAlign:'center' },
  btn:     { width:'100%', padding:'14px', background:C.navy, color:'#fff', border:'none', borderRadius:'12px', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'DM Sans, sans-serif', marginBottom:'8px', marginTop:'4px' },
  ghost:   { width:'100%', padding:'8px', background:'transparent', border:'none', color:C.stone, fontSize:'12px', cursor:'pointer', fontFamily:'DM Sans, sans-serif' },
};
