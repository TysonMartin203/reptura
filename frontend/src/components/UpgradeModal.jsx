import { createPortal } from 'react-dom';
import { IconSparkle, IconCheck } from './Icons';

// There's no checkout yet — Premium is granted (Alpha Testers, or by an admin).
// When payments arrive, the button at the bottom is the one place to wire up.
const PERKS = [
  'Unlimited AI meal plans, built around your macros and budget',
  'Unlimited AI workout plans',
  'Unlimited race training plans',
  'Unlimited food photo and nutrition-label scans',
  'Unlimited voice exercise entry — just say what you did',
];

export default function UpgradeModal({ detail, onClose }) {
  return createPortal(
    <div onClick={onClose}
      style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:10001,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
        style={{width:'100%',maxWidth:'380px',maxHeight:'85vh',overflowY:'auto',borderRadius:'16px',background:'var(--surface)',padding:'22px',boxShadow:'var(--shadow-lg)'}}>

        <div style={{width:'52px',height:'52px',borderRadius:'50%',margin:'0 auto 12px',display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(224,122,95,0.15)'}}>
          <IconSparkle style={{width:'26px',height:'26px',color:'var(--accent)'}}/>
        </div>
        <h3 style={{textAlign:'center',marginBottom:'6px'}}>Reptura Premium</h3>

        {detail?.error && (
          <p style={{fontSize:'13px',textAlign:'center',marginBottom:'16px',lineHeight:1.5}}>{detail.error}</p>
        )}

        <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'16px'}}>
          {PERKS.map(p => (
            <div key={p} style={{display:'flex',gap:'10px',alignItems:'flex-start',fontSize:'13px'}}>
              <IconCheck style={{width:'15px',height:'15px',color:'var(--teal)',flexShrink:0,marginTop:'2px'}}/>
              <span>{p}</span>
            </div>
          ))}
        </div>

        <p className="muted" style={{fontSize:'12px',textAlign:'center',marginBottom:'16px',lineHeight:1.5}}>
          Premium isn't for sale yet — during the alpha it's included for Alpha Testers.
          Your free generations reset on the 1st of each month.
        </p>

        <button type="button" className="btn-primary" style={{width:'100%'}} onClick={onClose}>Got it</button>
      </div>
    </div>,
    document.body
  );
}
