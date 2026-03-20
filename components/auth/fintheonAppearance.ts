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
      minWidth: '360px',
    },
    card: {
      background: 'transparent',
      boxShadow: 'none',
      padding: '2rem 1rem',
    },
    headerTitle: {
      color: '#fde68a',
      fontSize: '0.78rem',
      letterSpacing: '0.3em',
      textTransform: 'uppercase',
      fontWeight: 600,
      textAlign: 'center',
    },
    headerSubtitle: {
      color: '#a1a1aa',
      fontSize: '0.85rem',
      textAlign: 'center',
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
    // Social buttons container — center the Google button with generous spacing
    socialButtonsBlockButtonArrow: {
      color: '#facc15',
    },
    socialButtonsBlockButton: {
      backgroundColor: 'rgba(0,0,0,0.7)',
      border: '1px solid rgba(234,179,8,0.35)',
      color: '#fef9c3',
      textTransform: 'uppercase',
      letterSpacing: '0.18em',
      minHeight: '3.5rem',
      fontSize: '0.9rem',
      marginTop: '2rem',
      marginBottom: '2rem',
      borderRadius: '9999px',
      boxShadow: '0 0 30px rgba(234,179,8,0.15)',
    },
    identityPreviewEditButton: {
      color: '#facc15',
    },
  },
};
