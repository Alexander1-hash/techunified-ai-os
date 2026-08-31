'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Eye, EyeOff, Loader2, LockKeyhole, Mail, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

function authErrorMessage(message: string) {
  const value = message.toLowerCase()
  if (value.includes('invalid login credentials') || value.includes('invalid email') || value.includes('invalid password')) return 'Invalid email or password.'
  if (value.includes('email not confirmed')) return 'Please confirm your email before signing in.'
  if (value.includes('rate limit') || value.includes('too many')) return 'Too many attempts. Please try again later.'
  return 'We could not complete that request. Please try again.'
}

function getAuthCallbackUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')

  if (process.env.NODE_ENV === 'production') {
    const productionUrl = siteUrl || 'https://techunified-ai-os.vercel.app'

    try {
      const parsed = new URL(productionUrl)
      const hostname = parsed.hostname.toLowerCase()
      const isDevelopmentHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.local')

      if (parsed.protocol !== 'https:' || isDevelopmentHost) {
        return 'https://techunified-ai-os.vercel.app/auth/callback'
      }

      return `${productionUrl}/auth/callback`
    } catch {
      return 'https://techunified-ai-os.vercel.app/auth/callback'
    }
  }

  return `${siteUrl || window.location.origin}/auth/callback`
}

export default function LoginPage() {
  const router = useRouter()
  const [mode,setMode]=useState<'signin'|'signup'>('signin'); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [name,setName]=useState(''); const [show,setShow]=useState(false); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(''); const [error,setError]=useState('')
  useEffect(()=>{const value=new URLSearchParams(window.location.search).get('error'); if(value)setError(value==='missing_code'?'This confirmation link is missing its code.':'We could not verify that confirmation link.')},[])
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(''); setMessage(''); const supabase=createClient(); const emailRedirectTo = mode === 'signup' ? getAuthCallbackUrl() : undefined; const result=mode==='signin' ? await supabase.auth.signInWithPassword({email,password}) : await supabase.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo}}); setBusy(false); if(result.error){setError(authErrorMessage(result.error.message));return} if(mode==='signup' && !result.data.session){setMessage('Check your email to confirm your account, then sign in.');return} const {data:{user}}=await supabase.auth.getUser(); if(!user){setError('Your session could not be established. Please try again.');return} router.replace('/dashboard'); router.refresh() }
  async function forgot(){if(!email){setError('Enter your email first.');return} const redirectTo=getAuthCallbackUrl(); if(!redirectTo){setError('Authentication is not configured for this environment.');return} setBusy(true); const {error}=await createClient().auth.resetPasswordForEmail(email,{redirectTo}); setBusy(false); if(error)setError('Unable to send reset instructions.');else setMessage('Password reset instructions sent.')}
  return <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10"><div className="w-full max-w-md"><div className="mb-8 text-center"><div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Sparkles size={22}/></div><h1 className="text-2xl font-semibold tracking-tight">TechUnified <span className="text-primary">AI OS</span></h1><p className="mt-2 text-sm text-muted-foreground">Your company. One intelligent operating system.</p></div><section className="rounded-2xl border bg-card p-6 shadow-2xl shadow-black/10"><div className="mb-6 flex rounded-lg bg-muted p-1"><button type="button" onClick={()=>setMode('signin')} className={`flex-1 rounded-md py-2 text-sm ${mode==='signin'?'bg-background font-medium shadow-sm':''}`}>Sign in</button><button type="button" onClick={()=>setMode('signup')} className={`flex-1 rounded-md py-2 text-sm ${mode==='signup'?'bg-background font-medium shadow-sm':''}`}>Create account</button></div><form onSubmit={submit} className="flex flex-col gap-4">{mode==='signup'&&<label className="text-sm">Full name<input value={name} onChange={e=>setName(e.target.value)} required className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30" /></label>}<label className="text-sm">Email<div className="mt-2 flex items-center gap-2 rounded-lg border bg-background px-3"><Mail size={16} className="text-muted-foreground"/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required className="w-full bg-transparent py-2.5 outline-none" /></div></label><label className="text-sm">Password<div className="mt-2 flex items-center gap-2 rounded-lg border bg-background px-3"><LockKeyhole size={16} className="text-muted-foreground"/><input type={show?'text':'password'} minLength={6} value={password} onChange={e=>setPassword(e.target.value)} required className="w-full bg-transparent py-2.5 outline-none"/><button type="button" aria-label={show?'Hide password':'Show password'} onClick={()=>setShow(!show)}>{show?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}{message&&<p role="status" className="text-sm text-primary">{message}</p>}<button disabled={busy} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">{busy&&<Loader2 size={16} className="animate-spin"/>}{mode==='signin'?'Sign in':'Create account'}</button></form>{mode==='signin'&&<button onClick={forgot} className="mt-5 w-full text-center text-xs text-muted-foreground hover:text-primary">Forgot password?</button>}</section></div></main>
}
