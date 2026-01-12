import React from 'react';

// Simplified SVG components for the icons we need
export const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}><path d="M5 12h14"/><path d="M12 5v14"/></svg>
);

export const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
);

export const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
);

export const FilterIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
);

export const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
);

export const GripVerticalIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
);

export const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
);

export const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse">
    <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.2" />
    <path d="M12 2v3" />
    <path d="M12 19v3" />
    <path d="M2 12h3" />
    <path d="M19 12h3" />
    <path d="m4.93 4.93 2.12 2.12" />
    <path d="m16.95 16.95 2.12 2.12" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </svg>
);

export const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" fill="currentColor" fillOpacity="0.1" />
    <circle cx="9" cy="13" r="0.7" fill="currentColor" stroke="none" />
    <circle cx="13" cy="16" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="0.4" fill="currentColor" stroke="none" />
  </svg>
);

export const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
    <path d="M19.4 15a1.8 1.8 0 0 0 .35 1.98l.03.03a2.2 2.2 0 0 1-1.55 3.76 2.2 2.2 0 0 1-1.56-.64l-.03-.03a1.8 1.8 0 0 0-1.98-.35 1.8 1.8 0 0 0-1.07 1.65V22a2.2 2.2 0 0 1-4.4 0v-.04a1.8 1.8 0 0 0-1.07-1.65 1.8 1.8 0 0 0-1.98.35l-.03.03a2.2 2.2 0 0 1-3.11 0 2.2 2.2 0 0 1 0-3.11l.03-.03a1.8 1.8 0 0 0 .35-1.98 1.8 1.8 0 0 0-1.65-1.07H2a2.2 2.2 0 0 1 0-4.4h.04a1.8 1.8 0 0 0 1.65-1.07 1.8 1.8 0 0 0-.35-1.98l-.03-.03a2.2 2.2 0 0 1 0-3.11 2.2 2.2 0 0 1 3.11 0l.03.03a1.8 1.8 0 0 0 1.98.35 1.8 1.8 0 0 0 1.07-1.65V2a2.2 2.2 0 0 1 4.4 0v.04a1.8 1.8 0 0 0 1.07 1.65 1.8 1.8 0 0 0 1.98-.35l.03-.03a2.2 2.2 0 0 1 3.11 0 2.2 2.2 0 0 1 0 3.11l-.03.03a1.8 1.8 0 0 0-.35 1.98 1.8 1.8 0 0 0 1.65 1.07H22a2.2 2.2 0 0 1 0 4.4h-.04a1.8 1.8 0 0 0-1.65 1.07Z" />
  </svg>
);

