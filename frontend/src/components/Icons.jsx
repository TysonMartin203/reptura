export function IconHome({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>;
}
export function IconBarbell({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="6.5" y1="12" x2="17.5" y2="12"/><rect x="3" y="9.5" width="2" height="5" rx="0.5"/><rect x="1.5" y="10.5" width="1.5" height="3" rx="0.5"/><rect x="19" y="9.5" width="2" height="5" rx="0.5"/><rect x="21" y="10.5" width="1.5" height="3" rx="0.5"/></svg>;
}
export function IconTrophy({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4a2 2 0 000 4l.5.5C5.5 15 7 16 9 16.5"/><path d="M18 9h2a2 2 0 010 4l-.5.5C18.5 15 17 16 15 16.5"/><path d="M6 3h12v8a6 6 0 01-12 0V3z"/><path d="M9.5 21h5M12 17v4"/></svg>;
}
export function IconCamera({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>;
}
export function IconPeople({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>;
}
export function IconMeals({ className, style }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* Looking straight down at a domed plate cover */}
      <circle cx="12" cy="12" r="9"/>
      <circle cx="12" cy="12" r="5.5" strokeWidth="1.3" opacity="0.55"/>
      <circle cx="12" cy="12" r="1.4" fill="currentColor"/>
    </svg>
  );
}
export function IconFeed({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l2-7 4 14 2-7h6"/></svg>;
}
export function IconEdit({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
export function IconChevron({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
}
export function IconSparkle({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>;
}
export function IconX({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
export function IconCheck({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}
export function IconLightning({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24"><path d="M13 3 6 13h5l-1 8 8-11h-5l1-7Z" fill="currentColor"/></svg>;
}
export function IconStar({ className, style, filled }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><polygon points="12 2.5 15.1 9 22.3 10 17.1 15 18.4 22.2 12 18.8 5.6 22.2 6.9 15 1.7 10 8.9 9 12 2.5"/></svg>;
}
export function IconFlag({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="21" x2="5" y2="3"/><path d="M5 4h13l-3 5 3 5H5"/></svg>;
}
export function IconSun({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="4.5"/><line x1="12" y1="2" x2="12" y2="4.5"/><line x1="12" y1="19.5" x2="12" y2="22"/><line x1="2" y1="12" x2="4.5" y2="12"/><line x1="19.5" y1="12" x2="22" y2="12"/><line x1="4.9" y1="4.9" x2="6.6" y2="6.6"/><line x1="17.4" y1="17.4" x2="19.1" y2="19.1"/><line x1="4.9" y1="19.1" x2="6.6" y2="17.4"/><line x1="17.4" y1="6.6" x2="19.1" y2="4.9"/></svg>;
}
export function IconMoon({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor"><path d="M20 14.5A8.5 8.5 0 019.5 4 8.5 8.5 0 1020 14.5Z"/></svg>;
}
export function IconWave({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 11.5V6a1.5 1.5 0 013 0v4M10 10V4.5a1.5 1.5 0 013 0V10M13 10V6a1.5 1.5 0 013 0v6M16 12v-2a1.5 1.5 0 013 0v5c0 3-2 6-6 6h-2c-3 0-4.5-1-6-3l-2.7-4a1.4 1.4 0 012.2-1.7L7 14"/></svg>;
}
export function IconDollar({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 6.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2.2 3 5 3 5 1.1 5 3-2.2 3-5 3-5-1.1-5-3"/></svg>;
}
export function IconChefHat({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 21h10M8 21v-6M16 21v-6M6 10a3.5 3.5 0 013-5.4A3.5 3.5 0 0112 3a3.5 3.5 0 013 1.6 3.5 3.5 0 013 5.4c1.1.6 1.8 1.8 1.8 3.1 0 1.9-1.6 3.4-3.5 3.4H7.7c-1.9 0-3.5-1.5-3.5-3.4 0-1.3.7-2.5 1.8-3.1Z"/></svg>;
}
export function IconTrash({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 6V4a1 1 0 011-1h2a1 1 0 011 1v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>;
}
export function IconClipboard({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="12" height="17" rx="2"/><rect x="9" y="2.5" width="6" height="3.5" rx="1"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="15" y2="15"/></svg>;
}
export function IconFlame({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5c.5 3-2.5 4-2.5 7a2.5 2.5 0 0 0 5 0c0-1-.5-1.5-.5-1.5.8 1 1.5 2.3 1.5 3.7A4.5 4.5 0 0 1 11 16.2c0 0-5.5-2-5.5-7.3C5.5 5.5 8.5 4 12 2.5Z"/></svg>;
}
export function IconMapPin({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0Z"/><circle cx="12" cy="10" r="3"/></svg>;
}
export function IconClock({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>;
}
export function IconSleep({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M17 4a6 6 0 100 12 6 6 0 006-4.5A6 6 0 1117 4Z" fill="currentColor" opacity="0.15"/><path d="M17 4a6 6 0 100 12 6 6 0 006-4.5A6 6 0 1117 4Z"/><path d="M4 20l4-4M6 20h4M4 16h4" strokeWidth="1.5"/></svg>;
}
export function IconTrendingUp({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 17 9 11 13 15 21 6"/><polyline points="14 6 21 6 21 13"/></svg>;
}
export function IconUtensils({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 2v6c0 1 .8 1.8 2 1.8s2-.8 2-1.8V2M7 9.8V22"/>
    <path d="M5 2v5.5M9 2v5.5M7 2v7.5"/>
    <path d="M16.5 2c1.8 1 2.8 3 2.3 5.2-.4 1.7-1.8 2.8-3.3 2.8V22"/>
    <path d="M16.5 2v8"/>
  </svg>;
}
export function IconMic({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4M9 21h6"/></svg>;
}
export function IconPlus({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
export function IconLogo({ className, style }) {
  return <svg className={className} style={style} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="6" y1="16" x2="26" y2="16" stroke="#E07A5F" strokeWidth="2.5" strokeLinecap="round"/><rect x="4" y="11" width="3" height="10" rx="1" fill="#E07A5F"/><rect x="2" y="13" width="2" height="6" rx="0.5" fill="#E07A5F"/><rect x="25" y="11" width="3" height="10" rx="1" fill="#E07A5F"/><rect x="28" y="13" width="2" height="6" rx="0.5" fill="#E07A5F"/></svg>;
}
