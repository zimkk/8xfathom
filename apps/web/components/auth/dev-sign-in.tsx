'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Terminal } from 'lucide-react'

export function DevSignIn() {
  const [name, setName] = useState('Demo User')
  const [email, setEmail] = useState('demo@fathom8x.dev')
  const [loading, setLoading] = useState(false)

  async function handleSignIn() {
    setLoading(true)
    await signIn('dev-bypass', {
      name,
      email,
      callbackUrl: '/app',
    })
  }

  return (
    <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-left space-y-3">
      <div className="flex items-center gap-2 text-amber-700">
        <Terminal className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">Dev Sign-In (no OAuth needed)</span>
      </div>

      <div className="space-y-2">
        <div>
          <Label htmlFor="dev-name" className="text-xs text-muted-foreground">
            Name
          </Label>
          <Input
            id="dev-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 text-sm mt-1"
          />
        </div>
        <div>
          <Label htmlFor="dev-email" className="text-xs text-muted-foreground">
            Email
          </Label>
          <Input
            id="dev-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-8 text-sm mt-1"
          />
        </div>
      </div>

      <Button
        onClick={handleSignIn}
        disabled={loading || !email}
        size="sm"
        variant="outline"
        className="w-full border-amber-300 text-amber-800 hover:bg-amber-100"
      >
        {loading ? 'Signing in…' : 'Sign in as Dev User'}
      </Button>
    </div>
  )
}
