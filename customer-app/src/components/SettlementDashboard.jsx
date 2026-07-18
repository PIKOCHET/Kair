import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { C, fmt } from '../lib/constants';

/**
 * Settlement Dashboard Component
 * Shows partner earnings, calculations, and settlement tracking
 * Used in Ops Dashboard for commission management
 */

export default function SettlementDashboard() {
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [filter, setFilter] = useState('pending');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  useEffect(() => {
    fetchSettlements();
  }, [selectedMonth, filter]);

  // First day of the month AFTER selectedMonth — for created_at < end
  function monthEnd(month) {
    const [y, m] = month.split('-').map(Number);
    return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  }

  async function fetchSettlements() {
    setLoading(true);
    try {
      const { data: partners, error } = await supabase
        .from('channel_partners')
        .select(`
          *,
          profile:profiles(full_name, phone),
          transactions:partner_transactions(*)
        `)
        .eq('is_active', true);
      if (error) { console.error('Settlements fetch:', error); return; }

      if (partners) {
        const settlementData = partners.map(partner => {
          // Commission-bearing transactions for the selected month
          const monthTransactions = (partner.transactions || []).filter(t => {
            const tMonth = new Date(t.created_at).toISOString().slice(0, 7);
            return tMonth === selectedMonth && t.type === 'received';
          });

          const totalCommission = monthTransactions.reduce((sum, t) => sum + (t.commission_paise || 0), 0);
          const pendingCommission = monthTransactions.filter(t => !t.settled_at).reduce((sum, t) => sum + (t.commission_paise || 0), 0);
          const orderCount = monthTransactions.length;
          // Settled = every commission row for this month carries settled_at
          const status = orderCount === 0 ? 'pending' : (pendingCommission > 0 ? 'pending' : 'settled');
          const settledAt = monthTransactions.length > 0 && pendingCommission === 0
            ? new Date(Math.max(...monthTransactions.map(t => new Date(t.settled_at))))
            : null;

          return {
            id: partner.id,
            partner_id: partner.id,
            name: partner.name,
            area: partner.area,
            contact: partner.profile?.phone || 'N/A',
            totalCommission,
            pendingCommission,
            orderCount,
            commissionPerOrder: partner.commission_paise,
            status,
            settledAt,
            createdAt: partner.created_at,
            lastOrderAt: monthTransactions.length > 0
              ? new Date(Math.max(...monthTransactions.map(t => new Date(t.created_at))))
              : null
          };
        });

        const filtered = filter === 'all'
          ? settlementData
          : settlementData.filter(s => s.status === filter);

        setSettlements(filtered);
      }
    } catch (error) {
      console.error('Error fetching settlements:', error);
    } finally {
      setLoading(false);
    }
  }

  // Stamps settled_at on every unsettled commission row for this partner in the period
  async function markAsSettled(partnerId, partnerName) {
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from('partner_transactions')
        .update({ settled_at: new Date().toISOString() })
        .eq('channel_partner_id', partnerId)
        .eq('type', 'received')
        .is('settled_at', null)
        .gte('created_at', `${selectedMonth}-01`)
        .lt('created_at', monthEnd(selectedMonth));
      if (error) { console.error('Mark settled:', error); showToast('Could not settle — try again'); return; }
      showToast(`✓ ${partnerName} settled for ${selectedMonth}`);
      fetchSettlements();
    } finally {
      setBusy(false);
    }
  }

  async function processAllPayouts() {
    if (busy) return;
    setBusy(true);
    try {
      for (const s of settlements.filter(s => s.status === 'pending' && s.pendingCommission > 0)) {
        await supabase
          .from('partner_transactions')
          .update({ settled_at: new Date().toISOString() })
          .eq('channel_partner_id', s.partner_id)
          .eq('type', 'received')
          .is('settled_at', null)
          .gte('created_at', `${selectedMonth}-01`)
          .lt('created_at', monthEnd(selectedMonth));
      }
      showToast('✓ All pending payouts settled');
      fetchSettlements();
    } finally {
      setBusy(false);
    }
  }

  const totalCommission = settlements.reduce((sum, s) => sum + s.totalCommission, 0);
  const totalPending = settlements.reduce((sum, s) => sum + (s.pendingCommission || 0), 0);
  const totalOrders = settlements.reduce((sum, s) => sum + s.orderCount, 0);
  const avgPerOrder = totalOrders > 0 ? totalCommission / totalOrders : 0;

  return (
    <div>
      <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', color: C.navy, fontWeight: 500, marginBottom: '16px' }}>
        💰 Commission Settlement
      </h2>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
        {[
          { val: fmt.rupees(totalCommission), lbl: 'Total Commission', color: C.teal },
          { val: totalOrders, lbl: 'Total Orders', color: C.navy },
          { val: fmt.rupees(Math.round(avgPerOrder)), lbl: 'Avg per Order', color: C.saffron },
          { val: settlements.length, lbl: 'Active Partners', color: C.success },
        ].map((stat, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: '12px', padding: '14px', border: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '22px', fontWeight: 700, color: stat.color }}>
              {stat.val}
            </div>
            <div style={{ fontSize: '10px', color: C.stone, marginTop: '4px' }}>{stat.lbl}</div>
          </div>
        ))}
      </div>

      {/* Month & Filter Controls */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
        <input
          type="month"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          style={{
            padding: '8px 12px',
            border: `1px solid ${C.border}`,
            borderRadius: '8px',
            fontSize: '12px',
            fontFamily: 'DM Sans, sans-serif'
          }}
        />
        {['pending', 'settled', 'all'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              border: `1.5px solid ${filter === f ? C.navy : C.border}`,
              background: filter === f ? C.navy : '#fff',
              color: filter === f ? '#fff' : C.stone,
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif',
              textTransform: 'capitalize'
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Settlement Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: C.stone }}>
          Loading settlements...
        </div>
      ) : settlements.length === 0 ? (
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center',
          border: `1px solid ${C.border}`,
          color: C.stone
        }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>💼</div>
          <p>No settlements for this period.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '12px', overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: C.linen }}>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: C.navy }}>Partner</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: C.navy }}>Area</th>
                <th style={{ padding: '12px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: C.navy }}>Orders</th>
                <th style={{ padding: '12px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: C.navy }}>Commission</th>
                <th style={{ padding: '12px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: C.navy }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((settlement, i) => (
                <tr
                  key={settlement.id}
                  style={{
                    borderTop: `1px solid ${C.border}`,
                    background: i % 2 === 0 ? '#fff' : '#fafbfc'
                  }}
                >
                  <td style={{ padding: '12px', fontSize: '12px', color: C.navy, fontWeight: 500 }}>
                    {settlement.name}
                  </td>
                  <td style={{ padding: '12px', fontSize: '11px', color: C.stone }}>
                    {settlement.area}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: C.navy }}>
                    {settlement.orderCount}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: C.teal }}>
                    {fmt.rupees(settlement.totalCommission)}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    {settlement.status === 'settled' ? (
                      <span style={{ fontSize: '10px', fontWeight: 700, color: C.success, background: C.successBg, padding: '5px 10px', borderRadius: '6px' }}>
                        ✓ Settled{settlement.settledAt ? ` · ${settlement.settledAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
                      </span>
                    ) : settlement.pendingCommission > 0 ? (
                      <button
                        onClick={() => markAsSettled(settlement.partner_id, settlement.name)}
                        disabled={busy}
                        style={{
                          padding: '6px 12px',
                          background: busy ? C.stone : C.success,
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '10px',
                          fontWeight: 600,
                          cursor: busy ? 'wait' : 'pointer',
                          fontFamily: 'DM Sans, sans-serif'
                        }}
                      >
                        Mark Settled
                      </button>
                    ) : (
                      <span style={{ fontSize: '10px', color: C.stone }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Footer */}
      {settlements.length > 0 && (
        <div style={{
          background: C.tealLight,
          borderRadius: '12px',
          padding: '14px',
          marginTop: '16px',
          border: `1px solid ${C.teal}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '11px', color: C.teal, fontWeight: 600 }}>
              Total Settlement Due
            </div>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '20px', fontWeight: 700, color: C.teal, marginTop: '4px' }}>
              {fmt.rupees(totalPending)}
            </div>
          </div>
          <button
            onClick={processAllPayouts}
            disabled={busy}
            style={{
              padding: '10px 16px',
              background: busy ? C.stone : C.teal,
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: busy ? 'wait' : 'pointer',
              fontFamily: 'DM Sans, sans-serif'
            }}
          >
            {busy ? 'Processing...' : 'Process Payout'}
          </button>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: C.navy, color: '#fff', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 500, zIndex: 300, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
