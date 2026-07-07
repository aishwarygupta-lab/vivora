'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

/**
 * App-wide theme provider (next-themes). Toggles the `.dark` class on <html>,
 * persists the choice, and respects the OS preference by default. Pairs with
 * `suppressHydrationWarning` on <html> in the root layout.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
