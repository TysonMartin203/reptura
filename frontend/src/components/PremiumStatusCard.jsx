import { usePremium } from '../context/PremiumContext';
import { IconSparkle } from './Icons';

// Profile-page summary: where premium comes from, or how many free
// generations are left this month for each major AI feature.
export default function PremiumStatusCard() {
  const { status, showUpgrade } = usePremium();
  if (!status?.enabled) return null;

  if (status.premium) {
    const until = status.premiumUntil && !String(status.premiumUntil).startsWith('9999')
      ? new Date(status.premiumUntil).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : null;
    return (
      <div className="section">
        <div className="glass-card" style={{display:'flex',gap:'12px',alignItems:'center',border:'1px solid var(--accent)'}}>
          <IconSparkle style={{width:'22px',height:'22px',color:'var(--accent)',flexShrink:0}}/>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:'14px'}}>Reptura Premium</div>
            <div className="muted" style={{fontSize:'12px'}}>
              {status.source === 'crew' ? `Included with ${status.crewName}` : until ? `Active until ${until}` : 'Active'}
              {' · '}unlimited AI plans and scans
            </div>
          </div>
        </div>
      </div>
    );
  }

  const rows = Object.entries(status.features || {});
  return (
    <div className="section">
      <div className="section-header">
        <span className="section-title">Free Plan</span>
        <button type="button" className="link-small" style={{background:'none',border:'none',cursor:'pointer'}} onClick={() => showUpgrade({})}>About Premium</button>
      </div>
      <p className="muted" style={{fontSize:'12px',marginBottom:'10px'}}>Free AI generations left this month — they reset on the 1st.</p>
      {rows.map(([key, f]) => (
        <div key={key} style={{marginBottom:'10px'}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:'13px',marginBottom:'4px'}}>
            <span style={{textTransform:'capitalize'}}>{f.label}</span>
            <span style={{fontWeight:600,color: f.remaining === 0 ? 'var(--danger)' : 'var(--text)'}}>{f.remaining} of {f.limit} left</span>
          </div>
          <div style={{height:'6px',borderRadius:'3px',background:'var(--border)',overflow:'hidden'}}>
            <div style={{height:'100%',width:`${(f.remaining / f.limit) * 100}%`,background: f.remaining === 0 ? 'var(--danger)' : 'var(--teal)',transition:'width .3s'}}/>
          </div>
        </div>
      ))}
    </div>
  );
}
