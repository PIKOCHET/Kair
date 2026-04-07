import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { C, STATUS_CONFIG, TAG_STATUSES, fmt } from '../lib/constants';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function OpsApp() {
  const { profile, signOut } = useAuth();
  const [orders,      setOrders]      = useState([]);
  const [riders,      setRiders]      = useState([]);
  const [filter,      setFilter]      = useState('all');
  const [search,      setSearch]      = useState('');
  const [loading,     setLoading]     = useState(true);
  const [toast,       setToast]       = useState('');
  const [assignModal, setAssignModal] = useState(null);
  const [tagModal,    setTagModal]    = useState(null);
  const [activeTab,   setActiveTab]   = useState('orders');

  useEffect(() => {
    fetchAll();
    const ch = supabase.channel('ops_all')
      .on('postgres_changes', { event:'*', schema:'public', table:'orders' }, fetchAll)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: ord }, { data: rid }] = await Promise.all([
      supabase.from('orders').select('*, customer:profiles!orders_customer_id_fkey(full_name,phone), rider:profiles!orders_rider_id_fkey(full_name,phone), address:addresses(flat_no,area,city,landmark), items:order_items(service_name,quantity,price_paise), tags:garment_tags(id,tag_code,item_name,status)').order('created_at', { ascending:false }),
      supabase.from('profiles').select('*').eq('role','rider').eq('is_active',true),
    ]);
    setOrders(ord || []);
    setRiders(rid || []);
    setLoading(false);
  }

  async function updateStatus(orderId, status) {
    const update = { status };
    if (status==='picked_up')       update.picked_up_at = new Date().toISOString();
    if (status==='delivered')       update.delivered_at = new Date().toISOString();
    await supabase.from('orders').update(update).eq('id', orderId);
    showToast('Status updated ✓'); fetchAll();
  }

  async function assignRider(orderId, riderId, riderName) {
    await supabase.from('orders').update({ rider_id:riderId, status:'rider_assigned' }).eq('id', orderId);
    setAssignModal(null); showToast(`${riderName} assigned ✓`); fetchAll();
  }

  async function unassign(orderId) {
    await supabase.from('orders').update({ rider_id:null, status:'pending_pickup' }).eq('id', orderId);
    showToast('Rider unassigned'); fetchAll();
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  const filtered = orders.filter(o => {
    const mF = filter==='all' || o.status===filter;
    const mS = !search || [o.order_number, o.customer?.full_name, o.address?.area].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    return mF && mS;
  });

  const stats = {
    pending:   orders.filter(o=>o.status==='pending_pickup').length,
    active:    orders.filter(o=>['rider_assigned','picked_up','in_cleaning'].includes(o.status)).length,
    ready:     orders.filter(o=>o.status==='ready').length,
    delivered: orders.filter(o=>o.status==='delivered').length,
    revenue:   orders.filter(o=>o.status==='delivered').reduce((s,o)=>s+(o.total_paise||0),0),
    today:     orders.filter(o=>new Date(o.created_at).toDateString()===new Date().toDateString()).length,
  };

  const FILTER_LABELS = { all:'All', pending_pickup:'Pickup', rider_assigned:'Assigned', in_cleaning:'Cleaning', ready:'Ready', out_for_delivery:'Delivering', delivered:'Done' };
  const ORDER_STATUSES = Object.keys(STATUS_CONFIG);

  return (
    <div style={{ fontFamily:'DM Sans, sans-serif', background:'#F5F3EF', minHeight:'100vh' }}>
      {/* Nav */}
      <div style={{ background:C.navy, padding:'0 20px', display:'flex', alignItems:'center', justifyContent:'space-between', height:'52px', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'18px', color:'#fff', letterSpacing:'2px', fontWeight:400 }}>KAIR</span>
          <span style={{ background:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.5)', fontSize:'9px', padding:'2px 7px', borderRadius:'4px', fontWeight:600 }}>OPS</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          {[['orders','Orders'],['riders','Riders'],['stats','Stats']].map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ background:'none', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:600, color:activeTab===tab?'#fff':'rgba(255,255,255,0.35)', fontFamily:'DM Sans, sans-serif', padding:'4px 0', borderBottom:`2px solid ${activeTab===tab?C.saffron:'transparent'}` }}>
              {label}
              {tab==='orders' && stats.pending > 0 && <span style={{ background:C.saffron, color:'#fff', fontSize:'8px', fontWeight:700, width:'14px', height:'14px', borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', marginLeft:'4px' }}>{stats.pending}</span>}
            </button>
          ))}
          <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)' }}>{profile?.full_name}</span>
          <button onClick={signOut} style={{ background:'rgba(255,255,255,0.07)', border:'none', color:'rgba(255,255,255,0.5)', fontSize:'11px', padding:'5px 10px', borderRadius:'6px', cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>Sign out</button>
        </div>
      </div>

      <div style={{ padding:'16px 20px' }}>

        {/* ── ORDERS TAB ── */}
        {activeTab==='orders' && (
          <>
            {/* Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'8px', marginBottom:'16px' }}>
              {[
                { val:stats.pending,   lbl:'Awaiting pickup',   color:C.saffron },
                { val:stats.active,    lbl:'In progress',       color:C.info },
                { val:stats.ready,     lbl:'Ready to deliver',  color:C.success },
                { val:stats.delivered, lbl:'Delivered',         color:C.stone },
                { val:stats.today,     lbl:'Orders today',      color:C.navy },
                { val:fmt.rupees(stats.revenue), lbl:'Revenue', color:C.saffron },
              ].map((s,i) => (
                <div key={i} style={{ background:'#fff', borderRadius:'10px', padding:'12px 14px', border:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:'20px', fontWeight:700, color:s.color, marginBottom:'2px' }}>{s.val}</div>
                  <div style={{ fontSize:'10px', color:C.stone }}>{s.lbl}</div>
                </div>
              ))}
            </div>

            {/* Search + filters */}
            <div style={{ display:'flex', gap:'8px', marginBottom:'12px', flexWrap:'wrap', alignItems:'center' }}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, order ID, area..."
                style={{ padding:'8px 12px', border:`1px solid ${C.border}`, borderRadius:'9px', fontSize:'12px', fontFamily:'DM Sans, sans-serif', color:C.navy, outline:'none', width:'240px', background:'#fff' }} />
              {Object.entries(FILTER_LABELS).map(([f, label]) => {
                const cnt = f==='all' ? orders.length : orders.filter(o=>o.status===f).length;
                return (
                  <button key={f} onClick={() => setFilter(f)}
                    style={{ padding:'6px 12px', borderRadius:'20px', border:`1.5px solid ${filter===f?C.navy:C.border}`, background:filter===f?C.navy:'#fff', color:filter===f?'#fff':C.stone, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
                    {label} <span style={{ opacity:0.6 }}>({cnt})</span>
                  </button>
                );
              })}
            </div>

            {loading ? <div style={{ textAlign:'center', padding:'60px', color:C.stone }}>Loading orders...</div> : (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {filtered.map(order => (
                  <OrderCard key={order.id} order={order} riders={riders}
                    onUpdateStatus={updateStatus}
                    onAssign={() => setAssignModal(order)}
                    onUnassign={() => unassign(order.id)}
                    onTag={() => setTagModal(order)}
                    onGenerateTags={async () => { await fetch(`${API}/api/orders/${order.id}/generate-tags`, { method:'POST' }); showToast('Tags generated ✓'); fetchAll(); }}
                  />
                ))}
                {filtered.length === 0 && <div style={{ textAlign:'center', padding:'60px', color:C.stone }}>No orders</div>}
              </div>
            )}
          </>
        )}

        {/* ── RIDERS TAB ── */}
        {activeTab==='riders' && (
          <div>
            <h2 style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'20px', color:C.navy, fontWeight:500, marginBottom:'16px' }}>Riders on duty</h2>
            {riders.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px', color:C.stone }}>
                <div style={{ fontSize:'40px', marginBottom:'12px' }}>🏍️</div>
                <p>No riders yet. Create an account and set role = rider in Supabase.</p>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'10px' }}>
                {riders.map(rider => {
                  const active = orders.filter(o=>o.rider_id===rider.id && !['delivered','cancelled'].includes(o.status));
                  const done   = orders.filter(o=>o.rider_id===rider.id && o.status==='delivered').length;
                  return (
                    <div key={rider.id} style={{ background:'#fff', borderRadius:'14px', border:`1px solid ${C.border}`, padding:'16px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
                        <div style={{ width:'42px', height:'42px', borderRadius:'50%', background:C.navy, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', fontWeight:700 }}>{(rider.full_name||'R')[0]}</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:'13px', fontWeight:700, color:C.navy }}>{rider.full_name||'—'}</div>
                          <div style={{ fontSize:'11px', color:C.stone }}>{rider.phone||rider.area||'Pune'}</div>
                        </div>
                        <div style={{ background:C.successBg, color:C.success, fontSize:'9px', fontWeight:700, padding:'3px 8px', borderRadius:'10px' }}>● Active</div>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                        <div style={{ background:C.linen, borderRadius:'8px', padding:'10px', textAlign:'center' }}>
                          <div style={{ fontSize:'20px', fontWeight:700, color:C.saffron }}>{active.length}</div>
                          <div style={{ fontSize:'9px', color:C.stone }}>Active</div>
                        </div>
                        <div style={{ background:C.linen, borderRadius:'8px', padding:'10px', textAlign:'center' }}>
                          <div style={{ fontSize:'20px', fontWeight:700, color:C.success }}>{done}</div>
                          <div style={{ fontSize:'9px', color:C.stone }}>Done</div>
                        </div>
                      </div>
                      {active.length > 0 && <div style={{ fontSize:'10px', color:C.stone, marginTop:'8px' }}>Orders: {active.map(o=>o.order_number).join(', ')}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── STATS TAB ── */}
        {activeTab==='stats' && (
          <div>
            <h2 style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'20px', color:C.navy, fontWeight:500, marginBottom:'16px' }}>Business overview</h2>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', marginBottom:'20px' }}>
              {[
                { val:orders.length, lbl:'Total orders', color:C.navy },
                { val:fmt.rupees(stats.revenue), lbl:'Total revenue', color:C.saffron },
                { val:orders.filter(o=>o.total_paise>0).length>0?fmt.rupees(Math.round(stats.revenue/Math.max(orders.filter(o=>o.status==='delivered').length,1))):'—', lbl:'Avg order value', color:C.success },
                { val:riders.length, lbl:'Active riders', color:C.info },
                { val:orders.filter(o=>o.pickup_type==='urgent').length, lbl:'Urgent pickups', color:C.saffron },
                { val:orders.filter(o=>o.pickup_type!=='urgent').length, lbl:'Standard pickups', color:C.stone },
              ].map((s,i) => (
                <div key={i} style={{ background:'#fff', borderRadius:'12px', padding:'14px 16px', border:`1px solid ${C.border}` }}>
                  <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'26px', fontWeight:500, color:s.color, marginBottom:'4px' }}>{s.val}</div>
                  <div style={{ fontSize:'11px', color:C.stone }}>{s.lbl}</div>
                </div>
              ))}
            </div>
            <h3 style={{ fontSize:'14px', fontWeight:700, color:C.navy, marginBottom:'10px' }}>Orders by status</h3>
            {Object.entries(STATUS_CONFIG).map(([status, sc]) => {
              const cnt = orders.filter(o=>o.status===status).length;
              if (!cnt) return null;
              return (
                <div key={status} style={{ display:'flex', alignItems:'center', gap:'10px', background:'#fff', borderRadius:'10px', padding:'10px 14px', border:`1px solid ${C.border}`, marginBottom:'6px' }}>
                  <span style={{ fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'10px', background:sc.bg, color:sc.color, minWidth:'130px', textAlign:'center' }}>{sc.label}</span>
                  <div style={{ flex:1, background:C.linen, borderRadius:'4px', height:'8px', overflow:'hidden' }}>
                    <div style={{ width:`${Math.min(100,(cnt/Math.max(orders.length,1))*100)}%`, height:'100%', background:sc.color, borderRadius:'4px', transition:'width 0.5s' }} />
                  </div>
                  <span style={{ fontSize:'15px', fontWeight:700, color:C.navy, minWidth:'28px', textAlign:'right' }}>{cnt}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Assign modal */}
      {assignModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(13,27,62,0.6)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
          <div style={{ background:'#fff', borderRadius:'20px', width:'100%', maxWidth:'420px', padding:'22px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
              <div>
                <h3 style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'20px', color:C.navy, fontWeight:500 }}>Assign rider</h3>
                <p style={{ fontSize:'11px', color:C.stone }}>{assignModal.order_number} · {assignModal.customer?.full_name}</p>
              </div>
              <button onClick={()=>setAssignModal(null)} style={{ width:'28px', height:'28px', borderRadius:'50%', border:`1px solid ${C.border}`, background:'#fff', cursor:'pointer', fontSize:'15px' }}>×</button>
            </div>
            {riders.length===0 ? <p style={{ color:C.stone, textAlign:'center', padding:'20px' }}>No riders available</p> : (
              <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
                {riders.map(rider => (
                  <div key={rider.id} onClick={() => assignRider(assignModal.id, rider.id, rider.full_name)}
                    style={{ display:'flex', alignItems:'center', gap:'10px', padding:'11px 13px', borderRadius:'11px', border:`1.5px solid ${C.border}`, cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=C.saffron}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                    <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:C.navy, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:700 }}>{(rider.full_name||'R')[0]}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'13px', fontWeight:700, color:C.navy }}>{rider.full_name}</div>
                      <div style={{ fontSize:'10px', color:C.stone }}>{rider.phone||'Pune'}</div>
                    </div>
                    <span style={{ fontSize:'12px', color:C.saffron, fontWeight:600 }}>Assign →</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tag modal */}
      {tagModal && (
        <TagModal order={tagModal}
          onSave={async (tags) => { await Promise.all(tags.map(t => supabase.from('garment_tags').update({ status:t.status }).eq('id',t.id))); setTagModal(null); showToast('Tags saved ✓'); fetchAll(); }}
          onClose={() => setTagModal(null)} />
      )}

      {toast && <div style={{ position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)', background:C.navy, color:'#fff', padding:'10px 20px', borderRadius:'10px', fontSize:'13px', fontWeight:500, zIndex:300, whiteSpace:'nowrap' }}>{toast}</div>}
    </div>
  );
}

// ── ORDER CARD ────────────────────────────────────────────
function OrderCard({ order, riders, onUpdateStatus, onAssign, onUnassign, onTag, onGenerateTags }) {
  const [open, setOpen] = useState(false);
  const sc = STATUS_CONFIG[order.status] || { label:order.status, color:C.stone, bg:C.linen };
  const addr = [order.address?.flat_no, order.address?.area, order.address?.city].filter(Boolean).join(', ');

  return (
    <div style={{ background:'#fff', borderRadius:'12px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
      {/* Row */}
      <div style={{ display:'flex', alignItems:'center', padding:'11px 14px', gap:'10px', cursor:'pointer', borderBottom:open?`1px solid ${C.border}`:'none' }} onClick={() => setOpen(!open)}>
        <div style={{ minWidth:'110px' }}>
          <div style={{ fontFamily:'monospace', fontSize:'12px', fontWeight:700, color:C.navy }}>{order.order_number}</div>
          {order.pickup_type==='urgent' && <span style={{ fontSize:'8px', background:C.saffronLight, color:C.saffron, padding:'1px 5px', borderRadius:'4px', fontWeight:700 }}>⚡ URGENT</span>}
        </div>
        <div style={{ flex:1, minWidth:'130px' }}>
          <div style={{ fontSize:'12px', fontWeight:700, color:C.navy }}>{order.customer?.full_name||'—'}</div>
          <div style={{ fontSize:'10px', color:C.stone }}>{order.customer?.phone}</div>
        </div>
        <div style={{ flex:1, fontSize:'10px', color:C.stone, minWidth:'150px' }}>📍 {addr||'—'}</div>
        <span style={{ fontSize:'10px', fontWeight:700, padding:'3px 9px', borderRadius:'20px', background:sc.bg, color:sc.color, minWidth:'120px', textAlign:'center' }}>
          <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:sc.color, display:'inline-block', marginRight:'4px', verticalAlign:'middle' }}/>
          {sc.label}
        </span>
        <div style={{ minWidth:'120px', fontSize:'11px' }}>
          {order.rider ? <span style={{ color:C.success, fontWeight:600 }}>🏍️ {order.rider.full_name}</span> : <span style={{ color:C.stone }}>Unassigned</span>}
        </div>
        <div style={{ fontSize:'13px', fontWeight:700, color:C.saffron, minWidth:'60px', textAlign:'right' }}>
          {order.total_paise > 0 ? fmt.rupees(order.total_paise) : 'TBD'}
        </div>
        <span style={{ fontSize:'10px', color:C.stone }}>{open?'▲':'▼'}</span>
      </div>

      {/* Expanded */}
      {open && (
        <div style={{ padding:'12px 14px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'14px', marginBottom:'12px' }}>
            <div>
              <div style={{ fontSize:'9px', fontWeight:700, color:C.stone, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'6px' }}>Items</div>
              {order.items?.length > 0 ? order.items.map((item,i) => (
                <div key={i} style={{ fontSize:'11px', color:C.navy, marginBottom:'3px' }}>
                  {item.quantity}× {item.service_name}
                  <span style={{ color:C.saffron, marginLeft:'5px', fontWeight:600 }}>{fmt.rupees(item.price_paise*item.quantity)}</span>
                </div>
              )) : <div style={{ fontSize:'11px', color:C.stone }}>Not yet entered by rider</div>}
            </div>
            <div>
              <div style={{ fontSize:'9px', fontWeight:700, color:C.stone, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'6px' }}>Details</div>
              {[['Payment', order.payment_method?.toUpperCase()||'COD'],['Type', order.pickup_type==='urgent'?'⚡ Urgent':'Standard'],['Est. delivery', order.estimated_delivery?fmt.date(order.estimated_delivery):'TBD']].map(([k,v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', color:C.stone, marginBottom:'3px' }}>
                  <span>{k}</span><span style={{ color:C.navy, fontWeight:500 }}>{v}</span>
                </div>
              ))}
              {order.special_notes && <div style={{ fontSize:'10px', color:C.stone, background:C.linen, padding:'5px 8px', borderRadius:'6px', marginTop:'6px' }}>📝 {order.special_notes}</div>}
            </div>
            <div>
              <div style={{ fontSize:'9px', fontWeight:700, color:C.stone, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'6px' }}>Garment tags</div>
              {order.tags?.length > 0 ? (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'3px' }}>
                  {order.tags.map(tag => (
                    <div key={tag.tag_code} style={{ background:C.linen, borderRadius:'5px', padding:'4px 6px', fontSize:'9px' }}>
                      <div style={{ fontFamily:'monospace', fontWeight:700, color:C.navy }}>{tag.tag_code}</div>
                      <div style={{ color:['ready','packed'].includes(tag.status)?C.success:C.saffron, fontWeight:600 }}>{tag.status}</div>
                    </div>
                  ))}
                </div>
              ) : <div style={{ fontSize:'11px', color:C.stone }}>No tags yet</div>}
            </div>
          </div>
          {/* Actions */}
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', paddingTop:'10px', borderTop:`1px solid ${C.linen}` }}>
            <select value={order.status} onChange={e => onUpdateStatus(order.id, e.target.value)}
              style={{ padding:'7px 10px', border:`1.5px solid ${C.border}`, borderRadius:'8px', fontSize:'11px', fontFamily:'DM Sans, sans-serif', color:C.navy, background:'#fff', cursor:'pointer' }}>
              {Object.entries(STATUS_CONFIG).map(([s,sc]) => <option key={s} value={s}>{sc.label}</option>)}
            </select>
            <button onClick={onAssign} style={ab(C.navy)}>🏍️ {order.rider?'Reassign':'Assign rider'}</button>
            {order.rider && <button onClick={onUnassign} style={ab(C.stone)}>Unassign</button>}
            <button onClick={onTag} style={ab(C.saffron)}>🏷️ Tag items</button>
            {order.status==='picked_up' && !order.tags?.length && <button onClick={onGenerateTags} style={ab(C.success)}>Generate tags</button>}
            <a href={`https://maps.google.com/?q=${encodeURIComponent(addr)}`} target="_blank" rel="noreferrer"
              style={{ ...ab(C.info), textDecoration:'none', display:'inline-flex', alignItems:'center' }}>🗺️ Maps</a>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TAG MODAL ──────────────────────────────────────────────
function TagModal({ order, onSave, onClose }) {
  const [tags, setTags] = useState(order.tags || []);
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(13,27,62,0.6)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
      <div style={{ background:'#fff', borderRadius:'20px', width:'100%', maxWidth:'500px', maxHeight:'80vh', overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'18px 22px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <h3 style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'18px', color:C.navy, fontWeight:500 }}>Tag items</h3>
            <p style={{ fontSize:'11px', color:C.stone, marginTop:'2px' }}>{order.order_number} · {order.customer?.full_name} · {tags.length} items</p>
          </div>
          <button onClick={onClose} style={{ width:'28px', height:'28px', borderRadius:'50%', border:`1px solid ${C.border}`, background:'#fff', cursor:'pointer', fontSize:'14px' }}>×</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'14px 22px' }}>
          {tags.length===0 ? <p style={{ color:C.stone, textAlign:'center', padding:'30px' }}>No tags — generate after rider picks up</p> : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'8px' }}>
              {tags.map(tag => (
                <div key={tag.id} style={{ border:`2px solid ${['ready','packed'].includes(tag.status)?C.success:['in_cleaning','pressed'].includes(tag.status)?C.saffron:C.border}`, borderRadius:'10px', padding:'10px', background:['ready','packed'].includes(tag.status)?C.successBg:'#fff' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'6px' }}>
                    <span style={{ fontSize:'11px', fontWeight:700, color:C.navy }}>{tag.item_name}</span>
                    <span style={{ fontSize:'8px', fontFamily:'monospace', background:C.navy, color:'#fff', padding:'1px 5px', borderRadius:'3px' }}>{tag.tag_code}</span>
                  </div>
                  <select value={tag.status} onChange={e => setTags(prev => prev.map(t => t.id===tag.id ? { ...t, status:e.target.value } : t))}
                    style={{ width:'100%', padding:'5px 7px', border:`1px solid ${C.border}`, borderRadius:'7px', fontSize:'11px', fontFamily:'DM Sans, sans-serif', background:'#fff' }}>
                    {TAG_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1).replace(/_/g,' ')}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding:'14px 22px', borderTop:`1px solid ${C.border}`, display:'flex', gap:'8px', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'9px 16px', border:`1px solid ${C.border}`, borderRadius:'8px', background:'#fff', cursor:'pointer', fontSize:'12px', fontFamily:'DM Sans, sans-serif' }}>Cancel</button>
          <button onClick={() => onSave(tags)} style={{ padding:'9px 16px', background:C.saffron, color:'#fff', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'12px', fontWeight:700, fontFamily:'DM Sans, sans-serif' }}>Save tags</button>
        </div>
      </div>
    </div>
  );
}

const ab = (bg) => ({ padding:'7px 12px', background:bg, color:'#fff', border:'none', borderRadius:'7px', fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'DM Sans, sans-serif' });
