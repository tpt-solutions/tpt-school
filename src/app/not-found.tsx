import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-md text-muted-foreground">
        The page you are looking for does not exist or may have been moved.
      </p>
      <Link href="/dashboard" className={buttonVariants({ variant: 'default' })}>
        Go to dashboard
      </Link>
    </main>
  )
}
