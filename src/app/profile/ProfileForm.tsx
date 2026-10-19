'use client'

import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/components/ToastViewport'
import {
  businessProfileSchema,
  type BusinessProfileFormValues,
} from '@/lib/validation'
import { saveBusinessProfile, type SaveProfileResult } from './actions'

interface ProfileFormProps {
  initialValues?: BusinessProfileFormValues
  currentVersion?: number
}

export function ProfileForm({ initialValues, currentVersion }: ProfileFormProps) {
  const [isPending, setIsPending] = useState(false)
  const [result, setResult] = useState<SaveProfileResult | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [savedVersion, setSavedVersion] = useState<number | undefined>(currentVersion)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsPending(true)
    setResult(null)
    setFieldErrors({})

    const formData = new FormData(event.currentTarget)
    const values: BusinessProfileFormValues = {
      business_name: String(formData.get('business_name') ?? ''),
      services: String(formData.get('services') ?? ''),
      value_proposition: String(formData.get('value_proposition') ?? ''),
      target_industry: String(formData.get('target_industry') ?? ''),
      target_geography: String(formData.get('target_geography') ?? ''),
      constraints: String(formData.get('constraints') ?? ''),
    }

    const parsed = businessProfileSchema.safeParse(values)
    if (!parsed.success) {
      const errors: Record<string, string[]> = {}
      parsed.error.errors.forEach((err) => {
        const path = String(err.path[0])
        errors[path] = errors[path] ?? []
        errors[path].push(err.message)
      })
      setFieldErrors(errors)
      setIsPending(false)
      return
    }

    const form = event.currentTarget
    try {
      const res = await saveBusinessProfile(values)
      if (res.success) {
        setSavedVersion(res.version)
        form.reset()
        notify(`Business profile version ${res.version} saved.`, 'success')
      } else if (res.fieldErrors) {
        setFieldErrors(res.fieldErrors)
        notify('Check the highlighted fields and try again.', 'error')
      } else {
        notify(res.error || 'Could not save your profile. Please try again.', 'error')
      }
      setResult(res)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not save your profile. Please try again.'
      setResult({ success: false, error: message })
      notify(message, 'error')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business profile</CardTitle>
        <CardDescription>
          {savedVersion
            ? `Current version: v${savedVersion}. Saving creates v${savedVersion + 1}.`
            : 'Describe your offer and ideal customer. The first save creates version 1.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="form-guide" role="note">
          <span className="guide-mark">✳</span>
          <div><strong>This is the source of truth for your offer.</strong><p>ScoutSpeak uses these details to assess lead fit and ground conversation briefs. Be specific and stick to claims you can stand behind; the AI should never promise more than you do.</p></div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business_name">Business name <span className="required-label">Required</span></Label>
            <Input
              id="business_name"
              name="business_name"
              defaultValue={initialValues?.business_name}
              placeholder="e.g. Northstar Web Studio"
              disabled={isPending}
              aria-invalid={!!fieldErrors.business_name}
              aria-describedby="business-name-help"
            />
            <p id="business-name-help" className="form-hint">The name you want the AI representative to use when introducing your business.</p>
            {fieldErrors.business_name?.map((msg) => (
              <p key={msg} className="text-sm text-destructive">
                {msg}
              </p>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="services">What you offer <span className="required-label">Required</span></Label>
            <Textarea
              id="services"
              name="services"
              rows={3}
              defaultValue={initialValues?.services}
              placeholder="e.g. Website redesigns, landing pages, and small web applications for local businesses."
              disabled={isPending}
              aria-invalid={!!fieldErrors.services}
              aria-describedby="services-help"
            />
            <p id="services-help" className="form-hint">List the services you actually sell and who they’re for. Mention useful boundaries such as project size or ongoing support.</p>
            {fieldErrors.services?.map((msg) => (
              <p key={msg} className="text-sm text-destructive">
                {msg}
              </p>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="value_proposition">Why customers choose you <span className="required-label">Required</span></Label>
            <Textarea
              id="value_proposition"
              name="value_proposition"
              rows={3}
              defaultValue={initialValues?.value_proposition}
              placeholder="We help independent retailers turn outdated websites into clear, mobile-friendly storefronts that make it easier for customers to browse and enquire."
              disabled={isPending}
              aria-invalid={!!fieldErrors.value_proposition}
              aria-describedby="value-proposition-help"
            />
            <p id="value-proposition-help" className="form-hint">In one or two sentences, connect the customer you serve, the problem you solve, and the practical result. Avoid unsupported numbers or guarantees.</p>
            {fieldErrors.value_proposition?.map((msg) => (
              <p key={msg} className="text-sm text-destructive">
                {msg}
              </p>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="target_industry">Best-fit industries <span className="optional-label">Optional</span></Label>
              <Input
                id="target_industry"
                name="target_industry"
                defaultValue={initialValues?.target_industry}
                disabled={isPending}
                placeholder="e.g. Local retail, hospitality"
                aria-describedby="industry-help"
              />
              <p id="industry-help" className="form-hint">Name the types of businesses you understand or want to work with. Leave blank if you serve many industries.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="target_geography">Where you work <span className="optional-label">Optional</span></Label>
              <Input
                id="target_geography"
                name="target_geography"
                defaultValue={initialValues?.target_geography}
                disabled={isPending}
                placeholder="e.g. Lahore and remote across Pakistan"
                aria-describedby="geography-help"
              />
              <p id="geography-help" className="form-hint">Use the area where you can serve clients, not necessarily where your office is located.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="constraints">Things the AI must respect <span className="optional-label">Optional</span></Label>
            <Textarea
              id="constraints"
              name="constraints"
              rows={2}
              defaultValue={initialValues?.constraints}
              disabled={isPending}
              placeholder="e.g. no discounting on a first call"
              aria-describedby="constraints-help"
            />
            <p id="constraints-help" className="form-hint">Add boundaries for sales conversations: services you don’t provide, pricing promises to avoid, or topics that need your review.</p>
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving…' : savedVersion ? 'Save new version' : 'Create profile'}
          </Button>

          {result?.success && (
            <Alert>
              <AlertTitle>Saved</AlertTitle>
              <AlertDescription>Profile version v{savedVersion} created.</AlertDescription>
            </Alert>
          )}

          {result && !result.success && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{result.error}</AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
