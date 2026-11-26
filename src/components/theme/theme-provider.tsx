'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

/**
 * Light, dark, or follow the system setting. Adds a `dark` class to <html>, which the
 * stylesheet's `.dark` theme and `dark:` variants respond to.
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  )
}
