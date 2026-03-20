import { useEffect, useState } from 'react'
import { usePsych } from '../../contexts/PsychContext'
import { Button } from '../ui/Button'

export function PsychOrientationModal() {
  const { profile, isOrientationModalOpen, orientationRequired, saveProfile, closeOrientationModal } = usePsych()
  const [blindSpots, setBlindSpots] = useState<string[]>(['', '', ''])
  const [goal, setGoal] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (profile) {
      const populated = [...profile.blindSpots, '', '', ''].slice(0, 3)
      setBlindSpots(populated)
      setGoal(profile.goal ?? '')
    }
  }, [profile])

  if (!isOrientationModalOpen) {
    return null
  }

  const handleBlindSpotChange = (index: number, value: string) => {
    setBlindSpots((prev) => prev.map((spot, idx) => (idx === index ? value : spot)))
  }

  const handleSubmit = async () => {
    const trimmedSpots = blindSpots.map((spot) => spot.trim())
    const validSpots = trimmedSpots.filter(Boolean)
    if (validSpots.length < 3) {
      setError('Please provide three blind spots to help Price keep you accountable.')
      return
    }
    if (!goal.trim()) {
      setError('Set a primary goal so Price can reinforce it during sessions.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await saveProfile({
        blindSpots: trimmedSpots,
        goal: goal.trim(),
        orientationComplete: true,
        source: 'orientation'
      })
      closeOrientationModal()
    } catch (err) {
      console.error('Failed to save orientation', err)
      setError('Failed to save. Double-check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4">
      <div className="w-full max-w-2xl bg-[#050500] border border-[#D4AF37]/40 rounded-2xl shadow-[0_0_40px_rgba(255,192,56,0.2)] p-8 space-y-6 animate-fade-in">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[#D4AF37]/70 mb-2">Psych Assist</p>
          <h2 className="text-2xl font-semibold text-white mb-2">Welcome Mission Briefing</h2>
          <p className="text-sm text-zinc-400">
            Price needs your blind spots and current goal to calibrate Mission Control. This orientation only happens once;
            you can edit later inside Settings → Psych Assist.
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[#D4AF37] uppercase tracking-wide">Top 3 Blind Spots</h3>
          {blindSpots.map((spot, idx) => (
            <div key={idx}>
              <label className="text-xs text-zinc-500 mb-1 block">Blind Spot #{idx + 1}</label>
              <input
                type="text"
                value={spot}
                onChange={(e) => handleBlindSpotChange(idx, e.target.value)}
                className="w-full bg-black/60 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#D4AF37]/60"
                placeholder={
                  idx === 0
                    ? 'Example: Over-sizing after a green streak'
                    : idx === 1
                    ? 'Example: Fighting trend changes during lunchtime'
                    : 'Example: Reacting emotionally to missed trades'
                }
              />
            </div>
          ))}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[#D4AF37] uppercase tracking-wide mb-2">Primary Goal</h3>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={3}
            placeholder="Example: Reduce revenge trades by sticking to the first two setups and standing down after -$400."
            className="w-full bg-black/60 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#D4AF37]/60 resize-none"
          />
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          {orientationRequired && (
            <p className="text-xs text-zinc-500">
              Required before Price can chat. You can revise later inside Settings.
            </p>
          )}
          <div className="flex items-center gap-3 ml-auto">
            <Button
              variant="secondary"
              onClick={() => closeOrientationModal()}
              disabled={orientationRequired || saving}
            >
              Close
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving…' : 'Lock It In'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
