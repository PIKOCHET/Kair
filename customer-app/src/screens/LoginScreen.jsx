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
  page:    { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'32px', background:C.cream },
  box:     { width:'100%', maxWidth:'380px', textAlign:'center' },
  emblem:  { width:'72px', height:'72px', borderRadius:'20px', background:C.navy, margin:'0 auto 24px', position:'relative', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'32px', boxShadow:'0 4px 20px rgba(13,27,62,0.12)' },
  brand:   { fontFamily:'Cormorant Garamond, serif', fontSize:'48px', fontWeight:400, color:C.navy, letterSpacing:'8px', margin:'0 0 8px', lineHeight:'1.1' },
  tagline: { fontFamily:'Cormorant Garamond, serif', fontSize:'15px', color:C.gold, fontStyle:'italic', marginBottom:'48px', fontWeight:400 },
  field:   { marginBottom:'18px', textAlign:'left' },
  label:   { display:'block', fontSize:'11px', fontWeight:600, color:C.stone, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' },
  input:   { width:'100%', padding:'14px 16px', border:`1px solid ${C.border}`, borderRadius:'12px', fontSize:'14px', fontFamily:'DM Sans, sans-serif', color:C.navy, outline:'none', background:C.cream, boxSizing:'border-box', transition:'border-color 0.2s', ':focus': { borderColor:C.saffron } },
  error:   { color:C.danger, fontSize:'13px', marginBottom:'12px', textAlign:'center', fontFamily:'DM Sans, sans-serif' },
  btn:     { width:'100%', padding:'16px', background:C.navy, color:'#fff', border:'none', borderRadius:'12px', fontSize:'15px', fontWeight:600, cursor:'pointer', fontFamily:'DM Sans, sans-serif', marginBottom:'12px', marginTop:'8px', letterSpacing:'0.5px', transition:'background 0.2s', boxShadow:'0 2px 12px rgba(13,27,62,0.08)' },
  ghost:   { width:'100%', padding:'12px', background:'transparent', border:'none', color:C.stone, fontSize:'13px', cursor:'pointer', fontFamily:'DM Sans, sans-serif', fontWeight:500, letterSpacing:'0.3px' },
};
