// ── Kair shared constants ─────────────────────────────────

export const C = {
  navy:        '#0D1B3E',
  navyMid:     '#152447',
  saffron:     '#E8590A',
  saffronLight:'#FFF0E8',
  cream:       '#FAF8F4',
  linen:       '#F0EBE3',
  gold:        '#C8A96E',
  stone:       '#6B6860',
  border:      '#E4DDD5',
  success:     '#0A6B3E',
  successBg:   '#E8F5EE',
  info:        '#1A5FBF',
  infoBg:      '#E5EEFF',
  danger:      '#D32F2F',
  dangerBg:    '#FDEAEA',
};

export const STATUS_CONFIG = {
  pending_pickup:   { label:'Awaiting pickup',  color:C.saffron, bg:C.saffronLight },
  rider_assigned:   { label:'Rider assigned',   color:C.info,    bg:C.infoBg },
  picked_up:        { label:'Picked up ✓',      color:C.info,    bg:C.infoBg },
  in_cleaning:      { label:'In cleaning',      color:C.info,    bg:C.infoBg },
  quality_check:    { label:'Quality check',    color:C.success, bg:C.successBg },
  ready:            { label:'Ready ✨',          color:C.success, bg:C.successBg },
  out_for_delivery: { label:'Out for delivery', color:C.saffron, bg:C.saffronLight },
  delivered:        { label:'Delivered ✓',      color:C.stone,   bg:C.linen },
  cancelled:        { label:'Cancelled',         color:C.danger,  bg:C.dangerBg },
};

export const TAG_STATUSES = ['received','sorting','in_cleaning','drying','pressed','quality_check','ready','packed'];

export const CATALOG = {
  'Clothes': [
    { id:'c1', emoji:'👕', name:'Wash & Fold',     price_paise:4900,  unit:'per kg',    tat_days:2 },
    { id:'c2', emoji:'👔', name:'Wash & Iron',     price_paise:7900,  unit:'per kg',    tat_days:4 },
    { id:'c3', emoji:'🥼', name:'Dry Cleaning',    price_paise:14900, unit:'per item',  tat_days:7 },
    { id:'c4', emoji:'🧥', name:'Jacket / Coat',   price_paise:19900, unit:'per item',  tat_days:7 },
    { id:'c5', emoji:'🥻', name:'Saree / Lehenga', price_paise:12900, unit:'per item',  tat_days:7 },
    { id:'c6', emoji:'👖', name:'Denims / Jeans',  price_paise:5900,  unit:'per piece', tat_days:2 },
  ],
  'Shoes': [
    { id:'s1', emoji:'👟', name:'Sneaker Deep Clean',   price_paise:29900, unit:'per pair', tat_days:7 },
    { id:'s2', emoji:'👞', name:'Leather Shoes Polish', price_paise:19900, unit:'per pair', tat_days:7 },
    { id:'s3', emoji:'👡', name:'Heels / Sandals',      price_paise:14900, unit:'per pair', tat_days:7 },
  ],
  'Curtains & Household': [
    { id:'cu1', emoji:'🪟', name:'Curtains – Regular',  price_paise:9900,  unit:'per panel', tat_days:4 },
    { id:'cu2', emoji:'🎭', name:'Curtains – Blackout', price_paise:14900, unit:'per panel', tat_days:4 },
    { id:'cu3', emoji:'🛋️', name:'Sofa Cover',          price_paise:12900, unit:'per piece', tat_days:4 },
    { id:'h1',  emoji:'🛏️', name:'Bedsheet set',        price_paise:12900, unit:'per set',   tat_days:2 },
    { id:'h2',  emoji:'🛁', name:'Blanket / Duvet',     price_paise:24900, unit:'per piece', tat_days:4 },
    { id:'h4',  emoji:'🧴', name:'Bath Towels',         price_paise:3900,  unit:'per piece', tat_days:2 },
  ],
};

export const ALL_SERVICES = Object.values(CATALOG).flat();

export const fmt = {
  rupees: (p) => `₹${(p/100).toLocaleString('en-IN')}`,
  date:   (d) => new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', weekday:'short' }),
  eta:    (days) => { const d = new Date(); d.setDate(d.getDate()+days); return d.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' }); },
};
