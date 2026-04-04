import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

// Indian phone validation
const isValidPhone = (p) => /^[6-9]\d{9}$/.test(p.replace(/\s/g, ''));

export default function LoginPage({ onSuccess }) {
  const { sendOtp, verifyOtp, updateProfile } = useAuth();

  const [step,    setStep]    = useState('phone');   // 'phone' | 'otp' | 'name'
  const [phone,   setPhone]   = useState('');
  const [otp,     setOtp]     = useState('');
  const [name,    setName]    = useState('');
  const [fmtPhone, setFmtPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function handleSendOtp() {
    if (!isValidPhone(phone)) { setError('Enter a valid 10-digit mobile number'); return; }
    setLoading(true); setError('');
    try {
      const formatted = await sendOtp(phone);
      setFmtPhone(formatted);
      setStep('otp');
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }

  async function handleVerifyOtp() {
    if (otp.length !== 6) { setError('Enter the 6-digit OTP'); return; }
    setLoading(true); setError('');
    try {
      await verifyOtp(fmtPhone, otp);
      setStep('name');
    } catch (e) {
      setError('Invalid OTP. Please try again.');
    } finally { setLoading(false); }
  }

  async function handleSaveName() {
    setLoading(true);
    try {
      if (name.trim()) await updateProfile({ full_name: name.trim() });
      onSuccess?.();
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: '#FAFAF8' }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>🧺</div>
          <h1 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '24px', fontWeight: 700, color: '#0D1B3E' }}>Kair</h1>
          <p style={{ color: '#6B6B6B', fontSize: '13px', marginTop: '4px' }}>Your clothes, in safe hands</p>
        </div>

        {/* Step: Phone */}
        {step === 'phone' && (
          <div>
            <p style={labelStyle}>Mobile number</p>
            <div style={{ display: 'flex', border: '2px solid #E8E8E8', borderRadius: '10px', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{ padding: '12px 14px', background: '#F5F4F1', borderRight: '1px solid #E8E8E8', fontSize: '14px', fontWeight: 600, color: '#0D1B3E', whiteSpace: 'nowrap' }}>
                🇮🇳 +91
              </div>
              <input
                type="tel"
                maxLength={10}
                value={phone}
                onChange={e => { setPhone(e.target.value.replace(/\D/g, '')); setError(''); }}
                placeholder="98765 43210"
                style={inputStyle}
                onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
              />
            </div>
            {error && <p style={errorStyle}>{error}</p>}
            <button onClick={handleSendOtp} disabled={loading} style={btnStyle}>
              {loading ? 'Sending OTP...' : 'Send OTP ➜'}
            </button>
            <p style={{ textAlign: 'center', fontSize: '11px', color: '#6B6B6B', marginTop: '12px' }}>
              We'll send a 6-digit OTP via SMS
            </p>
          </div>
        )}

        {/* Step: OTP */}
        {step === 'otp' && (
          <div>
            <p style={{ fontSize: '14px', color: '#0D1B3E', marginBottom: '16px', textAlign: 'center' }}>
              OTP sent to <strong>{fmtPhone}</strong>
            </p>
            <p style={labelStyle}>Enter 6-digit OTP</p>
            <input
              type="tel"
              maxLength={6}
              value={otp}
              onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setError(''); }}
              placeholder="• • • • • •"
              style={{ ...inputStyle, textAlign: 'center', fontSize: '22px', letterSpacing: '8px', border: '2px solid #E8E8E8', borderRadius: '10px', width: '100%', padding: '14px', marginBottom: '12px' }}
              onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
              autoFocus
            />
            {error && <p style={errorStyle}>{error}</p>}
            <button onClick={handleVerifyOtp} disabled={loading} style={btnStyle}>
              {loading ? 'Verifying...' : 'Verify OTP ✓'}
            </button>
            <button onClick={() => setStep('phone')} style={ghostBtnStyle}>← Change number</button>
          </div>
        )}

        {/* Step: Name (first time only) */}
        {step === 'name' && (
          <div>
            <p style={{ fontSize: '16px', fontWeight: 600, color: '#0D1B3E', marginBottom: '6px', textAlign: 'center' }}>
              Welcome! 🎉
            </p>
            <p style={{ fontSize: '13px', color: '#6B6B6B', marginBottom: '20px', textAlign: 'center' }}>
              What should we call you?
            </p>
            <p style={labelStyle}>Your name</p>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Rahul Deshmukh"
              style={{ ...inputStyle, border: '2px solid #E8E8E8', borderRadius: '10px', width: '100%', padding: '12px 14px', marginBottom: '12px' }}
              onKeyDown={e => e.key === 'Enter' && handleSaveName()}
              autoFocus
            />
            <button onClick={handleSaveName} disabled={loading} style={btnStyle}>
              {loading ? 'Saving...' : 'Continue ➜'}
            </button>
            <button onClick={handleSaveName} style={ghostBtnStyle}>Skip for now</button>
          </div>
        )}

      </div>
    </div>
  );
}

const labelStyle = { fontSize: '12px', fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px', display: 'block' };
const inputStyle  = { border: 'none', outline: 'none', padding: '12px 14px', fontSize: '16px', fontFamily: 'Poppins, sans-serif', color: '#0D1B3E', background: 'transparent', width: '100%' };
const errorStyle  = { color: '#D32F2F', fontSize: '12px', marginBottom: '10px' };
const btnStyle    = { width: '100%', padding: '14px', background: '#FF6B00', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins, sans-serif', marginBottom: '8px' };
const ghostBtnStyle = { width: '100%', padding: '10px', background: 'transparent', color: '#6B6B6B', border: 'none', fontSize: '13px', cursor: 'pointer', fontFamily: 'Poppins, sans-serif' };
