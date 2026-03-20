// [claude-code 2026-03-06] Catalyst template presets for NarrativeFlow quick-add menu
import { Building2, BarChart3, DollarSign, Globe, Plus } from 'lucide-react';
import type { CatalystTemplateType, CatalystSeverity } from './narrative-types';

export interface CatalystTemplate {
  type: CatalystTemplateType;
  label: string;
  icon: typeof Building2;
  defaultSeverity: CatalystSeverity;
  description: string;
  defaultTitle: string;
}

export const CATALYST_TEMPLATES: CatalystTemplate[] = [
  { type: 'fomc', label: 'FOMC', icon: Building2, defaultSeverity: 'high', description: 'Federal Reserve meeting', defaultTitle: 'FOMC Decision' },
  { type: 'cpi', label: 'CPI', icon: BarChart3, defaultSeverity: 'high', description: 'Consumer Price Index', defaultTitle: 'CPI Release' },
  { type: 'earnings', label: 'Earnings', icon: DollarSign, defaultSeverity: 'medium', description: 'Company earnings report', defaultTitle: '' },
  { type: 'geopolitical', label: 'Geopolitical', icon: Globe, defaultSeverity: 'medium', description: 'Geopolitical event', defaultTitle: '' },
  { type: 'custom', label: 'Custom', icon: Plus, defaultSeverity: 'low', description: 'Custom catalyst', defaultTitle: '' },
];
