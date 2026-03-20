import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import { useBackend } from '../lib/backend'
import type { PsychProfile, PsychScores } from '../lib/services'

interface PsychContextValue {
  profile: PsychProfile | null
  loading: boolean
  refresh: () => Promise<void>
  saveProfile: (input: { blindSpots?: string[]; goal?: string | null; orientationComplete?: boolean; source?: 'orientation' | 'settings' }) => Promise<void>
  updateScores: (scores: Partial<PsychScores>) => Promise<void>
  orientationRequired: boolean
  isOrientationModalOpen: boolean
  openOrientationModal: () => void
  closeOrientationModal: () => void
}

const PsychContext = createContext<PsychContextValue | undefined>(undefined)

export function PsychProvider({ children }: { children: ReactNode }) {
  const backend = useBackend()
  const [profile, setProfile] = useState<PsychProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOrientationModalOpen, setOrientationModalOpen] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await backend.psych.getProfile()
      setProfile(result)
    } catch (error) {
      console.error('Failed to load psych profile', error)
    } finally {
      setLoading(false)
    }
  }, [backend])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!loading) {
      if (profile && !profile.orientationComplete) {
        setOrientationModalOpen(true)
      } else if (profile?.orientationComplete) {
        setOrientationModalOpen(false)
      }
    }
  }, [profile, loading])

  const saveProfile = useCallback(
    async (input: { blindSpots?: string[]; goal?: string | null; orientationComplete?: boolean; source?: 'orientation' | 'settings' }) => {
      const result = await backend.psych.updateProfile(input)
      setProfile(result)
    },
    [backend]
  )

  const updateScores = useCallback(
    async (scores: Partial<PsychScores>) => {
      const result = await backend.psych.updateScores(scores)
      setProfile(result)
    },
    [backend]
  )

  const orientationRequired = useMemo(
    () => Boolean(profile && !profile.orientationComplete),
    [profile]
  )

  const openOrientationModal = () => {
    setOrientationModalOpen(true)
  }

  const closeOrientationModal = () => {
    if (orientationRequired) return
    setOrientationModalOpen(false)
  }

  const contextValue = useMemo<PsychContextValue>(
    () => ({
      profile,
      loading,
      refresh,
      saveProfile,
      updateScores,
      orientationRequired,
      isOrientationModalOpen,
      openOrientationModal,
      closeOrientationModal
    }),
    [
      profile,
      loading,
      refresh,
      saveProfile,
      updateScores,
      orientationRequired,
      isOrientationModalOpen
    ]
  )

  return <PsychContext.Provider value={contextValue}>{children}</PsychContext.Provider>
}

export function usePsych() {
  const context = useContext(PsychContext)
  if (!context) {
    throw new Error('usePsych must be used within a PsychProvider')
  }
  return context
}
