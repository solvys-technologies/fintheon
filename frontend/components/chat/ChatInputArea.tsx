// [claude-code 2026-03-10] Added MCP connector popup (T3)
// [claude-code 2026-03-09] Input area wrapper — images, attach panel, slash picker
import { useState, useCallback } from 'react';
import { PulseChatInput } from './PulseChatInput';
import { PulseSkillsPopup } from './PulseSkillsPopup';
import { PulseAttachPopup } from './PulseAttachPopup';
import { PulseSlashPicker } from './PulseSlashPicker';
import { McpConnectorPopup } from './McpConnectorPopup';
import { SkillBadge } from './SkillBadge';
import { useMcpConnectors } from '../../hooks/useMcpConnectors';

interface ChatInputAreaProps {
  onSend: (msg: string, images?: string[]) => void;
  onStop: () => void;
  onSteer?: (msg: string) => void;
  isLoading: boolean;
  thinkHarder: boolean;
  setThinkHarder: (v: boolean) => void;
  lastError: string | null;
  activeSkill: string | null;
  onSelectSkill: (id: string | null) => void;
  showSkills: boolean;
  onToggleSkills: () => void;
  onAttachImage?: (dataUrl: string) => void;
  disabledSkills?: Record<string, { reason: string }>;
}

export function ChatInputArea({
  onSend,
  onStop,
  onSteer,
  isLoading,
  thinkHarder,
  setThinkHarder,
  lastError,
  activeSkill,
  onSelectSkill,
  showSkills,
  onToggleSkills,
  onAttachImage,
  disabledSkills,
}: ChatInputAreaProps) {
  const [showAttach, setShowAttach] = useState(false);
  const [showConnectors, setShowConnectors] = useState(false);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const { servers, activeIds, toggle: toggleConnector } = useMcpConnectors();
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  // Counter to force re-trigger addExternalImage effect for duplicate images
  const [imageCounter, setImageCounter] = useState(0);

  const handleAttachImage = useCallback((dataUrl: string) => {
    setPendingImage(dataUrl);
    setImageCounter((c) => c + 1);
    onAttachImage?.(dataUrl);
  }, [onAttachImage]);

  const handleSlashSelect = useCallback((skillId: string) => {
    onSelectSkill(skillId);
    setSlashQuery(null);
  }, [onSelectSkill]);

  // Generate a unique key for addExternalImage to ensure effect fires
  const externalImageKey = pendingImage ? `${pendingImage.slice(0, 20)}_${imageCounter}` : null;

  return (
    <div className="pt-4 pb-4 px-4 bg-[linear-gradient(180deg,rgba(5,5,0,0.15),rgba(5,5,0,0.88))] backdrop-blur-xl">
      <div className="relative w-full max-w-3xl mx-auto">
        {activeSkill && (
          <div className="mb-2">
            <SkillBadge skillId={activeSkill} onDismiss={() => onSelectSkill(null)} />
          </div>
        )}
        <PulseSkillsPopup
          open={showSkills}
          onClose={() => onToggleSkills()}
          activeSkill={activeSkill}
          onSelectSkill={onSelectSkill}
          disabledSkills={disabledSkills}
        />
        {/* Slash-command picker */}
        {slashQuery !== null && (
          <PulseSlashPicker
            query={slashQuery}
            onSelect={handleSlashSelect}
            onDismiss={() => setSlashQuery(null)}
            disabledSkills={disabledSkills}
          />
        )}
        {lastError && (
          <div className="mb-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {lastError}
          </div>
        )}
        {/* Slide-up attach panel — anchored above input */}
        <PulseAttachPopup
          open={showAttach}
          onClose={() => setShowAttach(false)}
          onAttachImage={handleAttachImage}
        />
        {/* MCP connector popup */}
        <McpConnectorPopup
          open={showConnectors}
          servers={servers}
          activeIds={activeIds}
          onToggle={toggleConnector}
          onClose={() => setShowConnectors(false)}
        />
        <PulseChatInput
          onSend={(msg, imgs) => onSend(msg, imgs)}
          onStop={onStop}
          onSteer={onSteer}
          isProcessing={isLoading}
          thinkHarder={thinkHarder}
          setThinkHarder={setThinkHarder}
          onOpenAttach={() => setShowAttach((v) => !v)}
          onOpenConnectors={() => setShowConnectors((v) => !v)}
          connectorCount={activeIds.length}
          onOpenSkills={onToggleSkills}
          onSlashTrigger={(q) => setSlashQuery(q)}
          onSlashDismiss={() => setSlashQuery(null)}
          addExternalImage={pendingImage}
          placeholder="Analyze your performance, the news, or the markets..."
        />
      </div>
    </div>
  );
}
