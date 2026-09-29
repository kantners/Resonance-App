// Line icons from the design screens. They draw in currentColor, so color
// comes from the surrounding token classes.
type P = { size?: number; className?: string };

const base = (size: number) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true,
});

export const BriefIcon = ({ size = 22, className }: P) => (
  <svg {...base(size)} strokeWidth={1.8} className={className}><path d="M4 16a8 8 0 1 1 16 0" /><path d="M12 16l4-5" /></svg>
);
export const LogIcon = ({ size = 22, className }: P) => (
  <svg {...base(size)} strokeWidth={1.8} className={className}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8M8 12h8" /></svg>
);
export const TrendsIcon = ({ size = 22, className }: P) => (
  <svg {...base(size)} strokeWidth={1.8} className={className}><path d="M4 19h16" /><path d="M5 15l4-5 4 3 6-7" /></svg>
);
export const StudyIcon = ({ size = 22, className }: P) => (
  <svg {...base(size)} strokeWidth={1.8} className={className}><path d="M9 3h6" /><path d="M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3" /><path d="M7.5 15h9" /></svg>
);
export const BackIcon = ({ size = 18, className }: P) => (
  <svg {...base(size)} strokeWidth={2} className={className}><path d="M15 18l-6-6 6-6" /></svg>
);
export const PulseIcon = ({ size = 16, className }: P) => (
  <svg {...base(size)} strokeWidth={2} className={className}><path d="M3 12h4l3-7 4 14 3-7h4" /></svg>
);
export const LockIcon = ({ size = 14, className }: P) => (
  <svg {...base(size)} strokeWidth={2} className={className}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
);
export const AlertIcon = ({ size = 16, className }: P) => (
  <svg {...base(size)} strokeWidth={2} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
);
export const ChevronIcon = ({ size = 18, className }: P) => (
  <svg {...base(size)} strokeWidth={2} className={className}><path d="M9 18l6-6-6-6" /></svg>
);
