"use client"

import { createContext, useContext } from "react"
import type { PersonneWithRole, Permissions } from "@/types/database.types"
import type { User } from "@supabase/supabase-js"

export interface UseUserReturn {
  user: User | null
  profile: PersonneWithRole | null
  permissions: Permissions | null
  loading: boolean
  isAdmin: boolean
}

const UserContext = createContext<UseUserReturn | undefined>(undefined)

export function UserProvider({
  children,
  initialData,
}: {
  children: React.ReactNode
  initialData: UseUserReturn
}) {
  return (
    <UserContext.Provider value={initialData}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser(): UseUserReturn {
  const context = useContext(UserContext)
  if (context === undefined) {
    // Fallback gracefully instead of throwing, or throw an error depending on the design.
    // Since some parts might use useUser outside of the dashboard layout (e.g. login), we should return a default loading state or throw.
    return {
      user: null,
      profile: null,
      permissions: null,
      loading: true,
      isAdmin: false,
    }
  }
  return context
}
