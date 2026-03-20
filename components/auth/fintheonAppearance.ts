import type { Appearance } from '@clerk/types';

export const fintheonAppearance: Appearance = {
  variables: {
    colorPrimary: '#EAB308',
    colorText: '#F5F3FF',
    colorBackground: 'transparent',
    colorInputBackground: 'rgba(0, 0, 0, 0.65)',
    colorInputText: '#FDE68A',
    borderRadius: '9999px',
    fontSize: '16px',
    fontFamily: 'Roboto, "Roboto Mono", system-ui, sans-serif',
    colorDanger: '#f87171',
  },
  elements: {
    rootBox: {
      width: '100%',
    },
    card: {
      background: 'transparent',
      boxShadow: 'none',
    },
    headerTitle: {
      color: '#fde68a',
      fontSize: '0.78rem',
      letterSpacing: '0.3em',
      textTransform: 'uppercase',
      fontWeight: 600,
    },
    headerSubtitle: {
      color: '#a1a1aa',
      fontSize: '0.85rem',
    },
    // Google-only: hide email/password form, divider, and sign-up footer
    form: {
      display: 'none',
    },
    dividerRow: {
      display: 'none',
    },
    footer: {
      display: 'none',
    },
    socialButtonsBlockButton: {
      backgroundColor: 'rgba(0,0,0,0.7)',
      border: '1px solid rgba(234,179,8,0.35)',
      color: '#fef9c3',
      textTransform: 'uppercase',
      letterSpacing: '0.18em',
      minHeight: '3.25rem',
      fontSize: '0.85rem',
    },
    identityPreviewEditButton: {
      color: '#facc15',
    },
  },
};
