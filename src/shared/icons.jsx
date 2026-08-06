import React from 'react';

const PATHS = {
  list: 'M3 6h18M3 12h18M3 18h18',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  sortDesc: 'M6 9l6 6 6-6',
  sortAsc: 'M6 15l6-6 6 6',
  expand: 'M12 5v14M5 12h14',
  collapse: 'M5 12h14',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z',
  edit: 'M11 4H4v16h16v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'
};

export function Icon({ name, size = 16, ...rest }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <path d={d} />
    </svg>
  );
}

export function iconHTML(name, size = 16) {
  const d = PATHS[name];
  if (!d) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}
