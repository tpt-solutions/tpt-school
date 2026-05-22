'use server'

import { signOut } from '@/lib/auth'
import { redirect } from 'next/navigation'

export async function signOutAction() {
  await signOut()
  redirect('/login')
}
