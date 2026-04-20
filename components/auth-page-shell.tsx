import type { ReactNode } from 'react'

interface AuthPageShellProps {
  children: ReactNode
}

export function AuthPageShell({ children }: AuthPageShellProps) {
  return (
    <div className="storefront-page min-h-screen">
      <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
