export default function StudioLight(){
 return <div className="world-background studio-light" aria-hidden="true">
  <div className="light-tide tide-cool"/><div className="light-tide tide-warm"/>
  <div className="light-atmosphere"/>
  <svg className="light-refraction" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
   <defs>
    <linearGradient id="light-spectrum" x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--light-cool)"/><stop offset=".44" stopColor="#ffffff"/><stop offset=".7" stopColor="var(--light-rose)"/><stop offset="1" stopColor="var(--light-warm)"/></linearGradient>
    <linearGradient id="light-fade"><stop stopColor="#fff" stopOpacity="0"/><stop offset=".5" stopColor="#fff" stopOpacity=".9"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></linearGradient>
    <filter id="light-diffusion" x="-40%" y="-50%" width="180%" height="200%"><feGaussianBlur stdDeviation="24"/></filter>
    <filter id="light-soften"><feGaussianBlur stdDeviation="2"/></filter>
   </defs>
   <g className="light-ribbon" fill="none">
    <path d="M650 -160 C1360 40 1660 190 1470 420 S640 650 500 1140" stroke="url(#light-spectrum)" strokeWidth="150" opacity=".8" filter="url(#light-diffusion)"/>
    <path d="M790 -180 C1450 45 1640 190 1450 415 S660 635 520 1140" stroke="url(#light-fade)" strokeWidth="8" opacity=".85" filter="url(#light-soften)"/>
    <path d="M815 -180 C1470 45 1665 190 1472 415 S682 635 542 1140" stroke="url(#light-spectrum)" strokeWidth="3" opacity=".85"/>
   </g>
   <g className="light-echo" fill="none" filter="url(#light-soften)">
    <path d="M-300 880 C120 380 330 180 590 -180" stroke="url(#light-spectrum)" strokeWidth="80" opacity=".27"/>
    <path d="M-300 925 C130 415 370 180 630 -180" stroke="url(#light-fade)" strokeWidth="3" opacity=".5"/>
   </g>
  </svg>
  <div className="light-grain"/>
 </div>;
}
