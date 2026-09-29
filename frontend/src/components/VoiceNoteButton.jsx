import { useEffect, useRef, useState } from 'react';
import { useVoiceNote } from '../useVoiceNote';
import { IconMic } from './Icons';

// canStart(): optional — return false to keep the mic off (e.g. a free account
// that's out of voice entries opens the upgrade popup instead).
export default function VoiceNoteButton({ onTranscript, label = 'Voice Note', canStart }) {
  const { listening, transcript, error, start, stop, supported } = useVoiceNote();
  const wasListening = useRef(false);
  const [emptyNotice, setEmptyNotice] = useState(false);

  useEffect(() => {
    // Fires once recognition actually stops (manual tap or auto-stop from silence)
    if (wasListening.current && !listening) {
      if (transcript.trim()) { setEmptyNotice(false); onTranscript(transcript.trim()); }
      else setEmptyNotice(true); // stopped without capturing anything — don't fail silently
    }
    wasListening.current = listening;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening]);

  if (!supported) return null; // gracefully hidden on browsers without speech recognition (e.g. Firefox)

  return (
    <div>
      <button
        type="button"
        className="btn-secondary"
        style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',width:'100%',color: listening ? 'var(--danger)' : undefined}}
        onClick={() => {
          setEmptyNotice(false);
          if (listening) { stop(); return; }
          if (canStart && canStart() === false) return;
          start();
        }}
      >
        <IconMic style={{width:'16px',height:'16px'}}/> {listening ? 'Listening… tap to stop' : label}
      </button>
      {listening && transcript && <p className="muted" style={{fontSize:'12px',marginTop:'6px',fontStyle:'italic'}}>"{transcript}"</p>}
      {error && <p className="form-error" style={{marginTop:'6px'}}>{error}</p>}
      {emptyNotice && !error && <p className="form-error" style={{marginTop:'6px'}}>Didn't catch anything — please try again.</p>}
    </div>
  );
}
