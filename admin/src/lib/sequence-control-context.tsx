import { createContext, useCallback, useContext, useMemo, useState } from "react"
import type { ReactNode } from "react"

type SequenceExecutor = (() => Promise<void>) | undefined

type SequenceControlContextValue = {
  executor?: () => Promise<void>
  registerExecutor: (executor?: () => Promise<void>) => () => void
}

const SequenceControlContext = createContext<SequenceControlContextValue>({
  executor: undefined,
  registerExecutor: () => () => {},
})

export function SequenceControlProvider({ children }: { children: ReactNode }) {
  const [executor, setExecutor] = useState<SequenceExecutor>()

  const registerExecutor = useCallback((next?: () => Promise<void>) => {
    setExecutor(() => next)

    return () => {
      setExecutor((current) => (current === next ? undefined : current))
    }
  }, [])

  const value = useMemo(
    () => ({
      executor,
      registerExecutor,
    }),
    [executor, registerExecutor]
  )

  return (
    <SequenceControlContext.Provider value={value}>
      {children}
    </SequenceControlContext.Provider>
  )
}

export function useSequenceControl() {
  return useContext(SequenceControlContext)
}
