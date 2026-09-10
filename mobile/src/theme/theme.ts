/**
 * Palette terracotta / brique reprise du prototype de design
 * (`prototype/jiran-accueil.html`). Volontairement distincte d'As3ar,
 * qui est en vert émeraude.
 */
export const colors = {
  sand: '#F6EFE3',
  paper: '#FBF7EF',
  ink: '#241C17',
  brand: '#B5502E',
  brandDeep: '#8F3D22',
  alert: '#C1272D',
  alertSoft: '#F6DEDD',
  aid: '#2F7A5C',
  aidSoft: '#DEEDE6',
  sale: '#C9962C',
  saleSoft: '#F5EBD4',
  event: '#3B6EA5',
  eventSoft: '#DEE8F2',
  muted: '#8A8078',
  card: '#FFFFFF',
  line: '#EAE1D4',
  disabled: '#D6CCBE',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  pill: 24,
} as const;

export const fontSizes = {
  caption: 11,
  small: 12.5,
  body: 14,
  title: 17,
  heading: 21,
  display: 28,
} as const;
