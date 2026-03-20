import type { Appearance } from '@clerk/types';

export const pulseAppearance: Appearance = {
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
    formFieldLabel: {
      color: '#fef08a',
      letterSpacing: '0.15em',
      textTransform: 'uppercase',
      fontSize: '0.65rem',
    },
    formFieldInput: {
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      border: '1px solid rgba(234,179,8,0.25)',
      borderRadius: '9999px',
      color: '#fefce8',
      paddingInline: '1.25rem',
      minHeight: '3.25rem',
      boxShadow: '0 0 20px rgba(234,179,8,0.15)',
    },
    formFieldInputShowPasswordButton: {
      color: '#facc15',
    },
    dividerLine: {
      backgroundColor: 'rgba(234,179,8,0.3)',
    },
    dividerText: {
      color: '#facc15',
      letterSpacing: '0.25em',
      textTransform: 'uppercase',
    },
    socialButtonsBlockButton: {
      backgroundColor: 'rgba(0,0,0,0.7)',
      border: '1px solid rgba(234,179,8,0.35)',
      color: '#fef9c3',
      textTransform: 'uppercase',
      letterSpacing: '0.18em',
    },
    formButtonPrimary: {
      textTransform: 'uppercase',
      letterSpacing: '0.25em',
      fontWeight: 700,
      border: '2px solid #facc15',
      color: '#facc15',
      backgroundColor: 'rgba(0,0,0,0.9)',
      boxShadow: '0 0 40px rgba(234,179,8,0.35)',
    },
    footerActionLink: {
      color: '#facc15',
    },
    formFieldAction__password: {
      color: '#facc15',
    },
    identityPreviewEditButton: {
      color: '#facc15',
    },
    footer: {
      color: '#71717a',
      letterSpacing: '0.25em',
      textTransform: 'uppercase',
      fontSize: '0.6rem',
    },
  },
};
