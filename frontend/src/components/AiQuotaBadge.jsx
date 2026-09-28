import { usePremium } from '../context/PremiumContext';
import { IconSparkle } from './Icons';

// Small line under a major AI button:
//   premium            → "Premium · unlimited"
//   free, some left    → "2 of 3 free this month"
//   free, none left    → "Free generations used · Premium" (tap for details)
// Renders nothing until status loads, or when premium isn't set up on the server.
export default function AiQuotaBadge({ feature, style }) {
  const { status, showUpgrade } = usePremium();
  if (!status?.enabled) return null;

  const base = { display:'flex', alignItems:'center', justifyContent:'center', gap:'5px', fontSize:'11px', marginTop:'6px', ...style };

  if (status.premium) {
    return (
      <div style={{...base, color:'var(--accent)', fontWeight:600}}>
        <IconSparkle style={{width:'12px',height:'12px'}}/> Premium · unlimited
      </div>
    );
  }

  const f = status.features?.[feature];
  if (!f) return null;

  if (f.remaining > 0) {
    return <div className="muted" style={base}>{f.remaining} of {f.limit} free this month</div>;
  }
  return (
    <button type="button" onClick={() => showUpgrade({ error: `You've used your ${f.limit} free ${f.label} for this month.` })}
      style={{...base, width:'100%', background:'none', border:'none', cursor:'pointer', color:'var(--accent)', fontWeight:600}}>
      <IconSparkle style={{width:'12px',height:'12px'}}/> Free {f.label} used this month · Premium
    </button>
  );
}
