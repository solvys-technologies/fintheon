// [claude-code 2026-03-16] Pulse → Fintheon localStorage key migration
const KEY_MAP: Record<string, string> = {
  'pulse_settings': 'fintheon:settings',
  'pulse_tour_completed': 'fintheon:tour-completed',
  'pulse_last_seen_version': 'fintheon:last-seen-version',
  'pulse_interview_completed': 'fintheon:interview-completed',
  'pulse_interview_data': 'fintheon:interview-data',
  'pulse_riskflow_dismissed_ids:v1': 'fintheon:riskflow-dismissed:v1',
  'pulse_riskflow_seen_ids:v1': 'fintheon:riskflow-seen:v1',
  'pulse_psychassist_target:v1': 'fintheon:psychassist-target:v1',
  'pulse_psychassist_floating_pos:v1': 'fintheon:psychassist-floating-pos:v1',
  'pulse_sidebar_nav_order': 'fintheon:sidebar-nav-order',
  'pulse_toolbar_order': 'fintheon:toolbar-order',
  'pulse_mission_widget_order_v3': 'fintheon:mission-widget-order:v3',
  'pulse_mission_widget_visibility': 'fintheon:mission-widget-visibility',
  'pulse_right_panel_order': 'fintheon:right-panel-order',
  'pulse_narrative_v1': 'fintheon:narrative:v1',
  'pulse_narrative_snapshot_v1': 'fintheon:narrative-snapshot:v1',
  'pulse_narrative_agent_v1': 'fintheon:narrative-agent:v1',
  'pulse_hermes_conversation': 'fintheon:hermes-conversation',
  'pulse_threads': 'fintheon:threads',
  'pulse_voice_assistant_enabled:v1': 'fintheon:voice-assistant-enabled:v1',
  'pulse_voice_mic_device:v1': 'fintheon:voice-mic-device:v1',
  'pulse_voice_transcripts:v1': 'fintheon:voice-transcripts:v1',
  'pulse_mcp_active_connectors': 'fintheon:mcp-active-connectors',
  'pulse_regime_tracker_v2': 'fintheon:regime-tracker:v2',
  'pulse_regime_tracker_v1': 'fintheon:regime-tracker:v1',
  'pulse_chat_checkpoints:v1': 'fintheon:chat-checkpoints:v1',
  'pulse_setup_dismissed': 'fintheon:setup-dismissed',
  'pulse_premarket_reminder_last:v1': 'fintheon:premarket-reminder-last:v1',
  'pulse_gateway_persistent_thread_enabled': 'fintheon:gateway-persistent-thread-enabled',
  'pulse_gateway_persistent_thread_id': 'fintheon:gateway-persistent-thread-id',
  'pulse_draft_analysis': 'fintheon:draft-analysis',
  'pulse_draft_research': 'fintheon:draft-research',
  'pulse_draft_intervention': 'fintheon:draft-intervention',
  'pulse_boardroom_threads': 'fintheon:boardroom-threads',
};

export function migrateStorageKeys(): void {
  for (const [oldKey, newKey] of Object.entries(KEY_MAP)) {
    try {
      if (!localStorage.getItem(newKey)) {
        const old = localStorage.getItem(oldKey);
        if (old) localStorage.setItem(newKey, old);
      }
    } catch { /* ignore */ }
  }
}
