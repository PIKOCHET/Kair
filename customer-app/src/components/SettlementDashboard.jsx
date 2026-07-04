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
  const [filter, setFilter] = useState('pending');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    fetchSettlements();
  }, [selectedMonth, filter]);

  async function fetchSettlements() {
    setLoading(true);
    try {
      // Get all partners with their orders and commission data
      const { data: partners } = await supabase
        .from('channel_partners')
        .select(`
          *,
          profile:profiles(full_name, phone),
          transactions:partner_transactions(*)
        `)
        .eq('is_active', true);

      if (partners) {
        // Calculate settlements for the selected month
        const settlementData = partners.map(partner => {
          // Filter transactions for selected month
          const monthTransactions = (partner.transactions || []).filter(t => {
            const tMonth = new Date(t.created_at).toISOString().slice(0, 7);
            return tMonth === selectedMonth;
          });

          const totalCommission = monthTransactions.reduce((sum, t) => sum + (t.commission_paise || 0), 0);
          const orderCount = monthTransactions.length;
          const status = 'pending'; // Default to pending - can be updated in DB

          return {
            id: partner.id,
            partner_id: partner.id,
            name: partner.name,
            area: partner.area,
            contact: partner.profile?.phone || 'N/A',
            totalCommission,
            orderCount,
            commissionPerOrder: partner.commission_paise,
            status,
            createdAt: partner.created_at,
            lastOrderAt: monthTransactions.length > 0
              ? new Date(Math.max(...monthTransactions.map(t => new Date(t.created_at))))
              : null
          };
        });

        // Filter by status
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

  async function markAsSettled(partnerId) {
    try {
      // In a real system, create a settlement record
      // For now, we'll just show a toast
      alert(`✓ Settlement marked for ${partnerId}`);
      fetchSettlements();
    } catch (error) {
      console.error('Error marking settlement:', error);
    }
  }

  const totalCommission = settlements.reduce((sum, s) => sum + s.totalCommission, 0);
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
                    <button
                      onClick={() => markAsSettled(settlement.partner_id)}
                      style={{
                        padding: '6px 12px',
                        background: C.success,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '10px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'DM Sans, sans-serif'
                      }}
                    >
                      Mark Settled
                    </button>
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
            <div style={{ fontSize: '20px', fontWeight: 700, color: C.teal, marginTop: '4px' }}>
              {fmt.rupees(totalCommission)}
            </div>
          </div>
          <button
            style={{
              padding: '10px 16px',
              background: C.teal,
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif'
            }}
          >
            Process Payout
          </button>
        </div>
      )}
    </div>
  );
}
