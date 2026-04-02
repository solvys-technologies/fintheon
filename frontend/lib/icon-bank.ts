// [claude-code 2026-03-30] Nucleo icon bank for Fintheon — curated from nucleoapp.com/app
// These map Nucleo icon names to Fintheon domain areas.
// Usage: reference these when replacing Lucide icons with Nucleo equivalents,
// or when adding new icons to the app.
//
// Install: export NUCLEO_LICENSE_KEY=your-key && npx nucleo-icons
// React usage: import { NucleoIcon } from 'nucleo-icons/react'
//   <NucleoIcon name="chart-bar-trend-up" size={18} />
//
// Until Nucleo is installed, this file serves as the icon reference/spec.

export const NUCLEO_ICON_BANK = {
  // ─── FINANCE & TRADING ─────────────────────────────────────────
  finance: {
    'wallet-2':           'Account balance, wallet views',
    'vault-3':            'Portfolio vault, secure holdings',
    'money-bill-coin':    'P&L, cash flow, profit/loss',
    'credit-card':        'Payments, billing, subscriptions',
    'scale':              'Risk/reward balance, position sizing',
    'cryptography':       'Crypto assets, encryption',
    'window-chart-line':  'Chart panels, market windows',
    'chart-bar-trend-up': 'DO NOT USE — replaced by Diff (±). Kept for reference only.',
  },

  // ─── BUSINESS & STRATEGY ───────────────────────────────────────
  business: {
    'target':             'Trade targets, price levels, crosshairs',
    'presentation-screen':'Briefings, daily briefs, reports',
    'suitcase-3':         'Portfolio, account management',
    'award':              'Performance badges, milestones',
    'award-certificate':  'Certifications, achievements',
    'handshake':          'Partnerships, deal flow',
    'lightbulb-3':        'Trade ideas, insights, alpha signals',
    'nodes':              'Network graphs, narrative connections',
    'sitemap-4':          'Hierarchy, flow maps, apparatus',
    'puzzle-piece':       'Integrations, plugins, MCP connectors',
    'globe-pointer':      'Global markets, geo-targeting',
    'roadmap':            'Strategy timeline, planning',
  },

  // ─── NAVIGATION & ARROWS ──────────────────────────────────────
  navigation: {
    'chevron-down':       'Dropdown expand',
    'chevron-up':         'Collapse, close dropdown',
    'chevron-left':       'Back, previous',
    'chevron-right':      'Forward, next',
    'chevron-expand-y':   'Vertical expand/collapse',
    'arrow-door-in':      'Login, enter session',
    'arrow-door-out-3':   'Logout, exit',
    'refresh-2':          'Refresh, reload data',
    'descending-sorting': 'Sort descending',
    'subscription-2':     'Subscriptions, recurring',
  },

  // ─── STATUS & INDICATORS ──────────────────────────────────────
  status: {
    'check':                      'Success, confirmed, verified',
    'xmark':                      'Close, cancel, error',
    'circle-info':                'Info tooltip, details',
    'circle-half-dotted-check':   'Partial completion, in-progress',
    'triangle-warning':           'Warning, alert, caution',
    'bolt':                       'Active, live, powered',
    'bolt-slash':                 'Inactive, disabled, offline',
    'gauge-3':                    'Performance gauge, speed',
    'progress-bar':               'Loading, progress indicator',
    'loader':                     'Spinner, async loading',
    'toggle-3':                   'Toggle switch, on/off',
    'eye-open':                   'Visible, show, watch',
    'eye-closed':                 'Hidden, hide, blur',
  },

  // ─── DATA & FILES ─────────────────────────────────────────────
  data: {
    'file':               'Generic file, document',
    'file-content':       'File with content preview',
    'files-2':            'Multiple files, batch',
    'folder':             'Directory, category',
    'folder-open':        'Open folder, active directory',
    'box-archive':        'Archive, historical data',
    'clipboard':          'Copy, paste buffer',
    'clipboard-check':    'Clipboard confirmed, checklist done',
    'clipboard-slash':    'Clipboard denied, disabled',
    'inbox-arrow-down':   'Incoming data, download',
    'desktop-arrow-down': 'Download to desktop',
    'layers-3':           'Layers, stacking, depth',
    'stack-perspective':  'Stacked views, 3D perspective',
  },

  // ─── COMMUNICATION ────────────────────────────────────────────
  communication: {
    'envelope':           'Email, messages inbox',
    'envelope-open':      'Read message, open email',
    'paper-plane-2':      'Send message',
    'msg-writing':        'Composing, typing indicator',
    'msg-smile':          'Friendly message, emoji reaction',
    'msg-bubble-user':    'User message, chat bubble',
    'msgs':               'Conversations, threads',
    'at-sign':            'Mention, email address',
    'paperclip':          'Attachment',
    'notification':       'Alert bell, push notification',
    'circle-compose-2':   'New composition, create message',
    'language':           'Translation, i18n, multi-language',
    'bullhorn':           'Announcement, broadcast alert',
  },

  // ─── WRITING & EDITING ────────────────────────────────────────
  writing: {
    'pen-3':              'Edit, write',
    'pen-nib-3':          'Detailed editing, calligraphy',
    'pen-sparkle':        'AI-assisted writing, smart edit',
    'pen-writing-4':      'Active writing, journal',
    'pen-writing-6':      'Alternative writing style',
    'feather':            'Light editing, narrative',
    'text-tool-2':        'Text formatting, typography',
    'text-highlight':     'Highlight, emphasis',
    'link':               'Hyperlink, URL',
    'ordered-list':       'Numbered list, steps',
    'unordered-list':     'Bullet list',
  },

  // ─── SECURITY & AUTH ──────────────────────────────────────────
  security: {
    'lock':               'Locked, secured, protected',
    'lock-open-2':        'Unlocked, accessible',
    'shield-check':       'Verified, secure, approved',
    'fingerprint':        'Biometric auth, unique ID',
    'facial-recognition': 'Face ID, recognition',
    'password-2':         'Password field, credentials',
  },

  // ─── TIME & CALENDAR ──────────────────────────────────────────
  time: {
    'calendar':           'Date picker, schedule',
    'calendar-days':      'Multi-day view, calendar grid',
    'bell':               'Reminder, notification',
    'alarm-clock':        'Alarm, time-sensitive alert',
    'stopwatch':          'Timer, countdown, speed',
    'timer-2':            'Countdown, session timer',
  },

  // ─── MEDIA & VISUAL ───────────────────────────────────────────
  media: {
    'image':              'Image, photo, screenshot',
    'image-sparkle':      'AI-enhanced image, smart visual',
    'image-mountain':     'Landscape, scenery',
    'camera-2':           'Camera, capture, screenshot',
    'video':              'Video, recording',
    'film':               'Film strip, cinematic',
    'half-dotted-circle-play': 'Play, start, media playback',
    'bolt-lightning':     'Flash, quick action, instant',
  },

  // ─── USERS & PEOPLE ───────────────────────────────────────────
  users: {
    'user':               'Single user, profile',
    'users':              'Team, group, multiple users',
    'user-search':        'Find user, lookup',
    'user-laptop':        'Remote user, desk session',
    'side-profile':       'Profile view, identity',
  },

  // ─── GEO & MAPS ──────────────────────────────────────────────
  geo: {
    'earth':              'Global, worldwide, macro',
    'location-2':         'Location pin, venue',
    'map':                'Map view, geographic',
    'pin-tack':           'Pin, bookmark location',
    'pointer':            'Cursor, selection',
    'crosshairs':         'Target, precision, focus',
    'crosshairs-slash':   'Target disabled, off-focus',
    'flag-7':             'Flag, milestone, event marker',
  },

  // ─── DESIGN & TOOLS ──────────────────────────────────────────
  tools: {
    'gear-2':             'Settings, configuration',
    'sliders':            'Adjustments, fine-tuning',
    'filter':             'Filter, funnel',
    'magnifier':          'Search, zoom',
    'magnifier-face-worried': 'Search error, not found',
    'magic-wand':         'Auto-fix, smart action',
    'wand-sparkle':       'AI magic, generative',
    'sparkle-3':          'AI, sparkle, enhancement',
    'paintbrush':         'Customize, theme, design',
    'shapes':             'Components, building blocks',
    'plug-2':             'Plugin, connection, API',
    'grid-circle-plus':   'Add to grid, new widget',
    'dark-light':         'Theme toggle, light/dark mode',
  },

  // ─── SOCIAL & REACTIONS ───────────────────────────────────────
  social: {
    'thumbs-up':          'Approve, like, positive',
    'face-smile-2':       'Happy, positive sentiment',
    'face-plus':          'Add reaction, new emoji',
    'heart':              'Favorite, love',
    'heart-hand':         'Care, support, empathy',
    'star':               'Star rating, priority',
    'star-sparkle':       'Featured, premium, highlighted',
    'bookmark':           'Save, bookmark',
    'bookmark-slash':     'Remove bookmark, unsave',
    'bookmarks':          'Collections, saved items',
    'tag':                'Label, tag',
    'tags':               'Multiple tags, categories',
  },

  // ─── MISC & FUN ──────────────────────────────────────────────
  misc: {
    'rocket':             'Launch, deploy, fast-track',
    'gem-sparkle':        'Premium, valuable, rare',
    'accessibility':      'A11y, inclusive design',
    'leaf':               'Organic, natural, green',
    'flame':              'Hot, trending, urgent',
    'bug':                'Bug report, issue',
    'bug-slash':          'Bug fixed, resolved',
    'anchor':             'Anchor point, stable reference',
    'trash':              'Delete, remove',
  },

  // ─── BUILDINGS & PLACES ───────────────────────────────────────
  buildings: {
    'house-2':            'Home, dashboard',
    'house-5':            'Alternative home style',
    'office':             'Office, workspace, institutional',
    'industry':           'Industrial, manufacturing, sector',
    'shop':               'Store, retail, commerce',
  },

  // ─── DEVICES & HARDWARE ───────────────────────────────────────
  devices: {
    'laptop':             'Laptop, desktop view',
    'laptop-mobile':      'Responsive, multi-device',
    'phone':              'Mobile, phone view',
    'computer':           'Desktop, workstation',
    'keyboard':           'Input, shortcuts',
    'satellite':          'Remote, broadcast, signal',
    'signal-2':           'Connection strength, WiFi',
    'cloud':              'Cloud, hosted, sync',
    'print':              'Print, export PDF',
  },
} as const;

// Mapping from current Lucide icons to recommended Nucleo replacements
// Use this when migrating from Lucide to Nucleo
export const LUCIDE_TO_NUCLEO: Record<string, string> = {
  // Nav & Layout
  'LayoutDashboard':   'house-2',
  'Newspaper':         'notification',         // or 'msgs' for feed
  'Settings':          'gear-2',
  'Settings2':         'sliders',
  'LogOut':            'arrow-door-out-3',
  'Bell':              'bell',
  'BellOff':           'bolt-slash',
  'Search':            'magnifier',
  'Filter':            'filter',
  'Layers':            'layers-3',
  'GripVertical':      'sliders',              // reorder handle
  'ChevronsLeft':      'chevron-left',
  'ChevronsRight':     'chevron-right',
  'ChevronDown':       'chevron-down',
  'ChevronUp':         'chevron-up',
  'ChevronLeft':       'chevron-left',
  'ChevronRight':      'chevron-right',
  'Monitor':           'computer',
  'Power':             'bolt',

  // Trading & Finance
  'Diff':              'scale',                // plus-minus → balance
  'TrendingDown':      'descending-sorting',
  'DollarSign':        'money-bill-coin',
  'CreditCard':        'credit-card',
  'Target':            'target',
  'Crosshair':         'crosshairs',
  'BarChart3':         'window-chart-line',
  'Activity':          'gauge-3',

  // Communication
  'MessageCircle':     'msg-bubble-user',
  'MessageSquare':     'msg-writing',
  'MessagesSquare':    'msgs',
  'Send':              'paper-plane-2',
  'Mail':              'envelope',

  // Status
  'Check':             'check',
  'CheckCircle':       'circle-half-dotted-check',
  'CheckCircle2':      'circle-half-dotted-check',
  'X':                 'xmark',
  'XCircle':           'xmark',
  'AlertTriangle':     'triangle-warning',
  'AlertCircle':       'circle-info',
  'Info':              'circle-info',
  'Loader2':           'loader',
  'Eye':               'eye-open',
  'EyeOff':            'eye-closed',
  'Lock':              'lock',
  'Shield':            'shield-check',
  'ShieldCheck':       'shield-check',
  'ShieldAlert':       'shield-check',

  // Data & Files
  'FileText':          'file-content',
  'FileBarChart':      'file-content',
  'Download':          'desktop-arrow-down',
  'Upload':            'inbox-arrow-down',
  'Copy':              'clipboard',
  'Trash2':            'trash',
  'Archive':           'box-archive',
  'Save':              'clipboard-check',
  'Bookmark':          'bookmark',

  // AI & Magic
  'Sparkles':          'sparkle-3',
  'Zap':               'bolt-lightning',
  'Brain':             'nodes',
  'BrainCircuit':      'nodes',
  'Bot':               'wand-sparkle',
  'Cpu':               'nodes',

  // Users
  'User':              'user',
  'Users':             'users',

  // Time
  'Clock':             'alarm-clock',
  'Calendar':          'calendar',
  'CalendarDays':      'calendar-days',
  'CalendarCheck':     'calendar-days',
  'CalendarClock':     'alarm-clock',
  'History':           'refresh-2',
  'RefreshCw':         'refresh-2',
  'RefreshCcw':        'refresh-2',

  // Media
  'Image':             'image',
  'Camera':            'camera-2',
  'Play':              'half-dotted-circle-play',
  'Mic':               'notification',         // or 'bullhorn'
  'MicOff':            'bolt-slash',
  'Volume2':           'bullhorn',

  // Writing
  'Pencil':            'pen-3',
  'Edit3':             'pen-3',
  'BookOpen':          'feather',
  'BookOpenCheck':     'book-bookmark',
  'NotebookText':      'pen-writing-4',
  'Scroll':            'file-content',

  // Misc
  'Globe':             'earth',
  'ExternalLink':      'globe-pointer',
  'Terminal':          'plug-2',
  'Code':              'plug-2',
  'Database':          'box-archive',
  'Server':            'industry',
  'Plug2':             'plug-2',
  'PlugZap':           'plug-2',
  'Wrench':            'gear-2',
  'Tag':               'tag',
  'Award':             'award',
  'Trophy':            'award-certificate',
  'Heart':             'heart',
  'Star':              'star',
  'Crown':             'gem-sparkle',
  'Landmark':          'office',
  'Plus':              'plus',
  'Minus':             'minus',
};

// Icon categories relevant to Fintheon's main sections
export const SECTION_ICONS = {
  riskflow:     'notification',       // Alert feed
  narrativeMap: 'nodes',              // Connected narratives
  sanctum:      'window-chart-line',  // Charts & data
  econIntel:    'calendar-days',      // Economic calendar
  consilium:    'msgs',               // Agent council
  scriptorium:  'pen-writing-4',      // Writing/journal
  missionCtrl:  'gauge-3',            // Dashboard gauges
  apparatus:    'sitemap-4',          // Flow maps
  chat:         'msg-bubble-user',    // AI chat
  settings:     'gear-2',            // Configuration
  performance:  'award',             // Journal/P&L
} as const;
