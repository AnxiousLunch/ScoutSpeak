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
    const res = await saveBusinessProfile(values)
    if (res.success) {
      setSavedVersion(res.version)
      form.reset()
    } else if (res.fieldErrors) {
      setFieldErrors(res.fieldErrors)
    }
    setResult(res)
    setIsPending(false)
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business_name">Business name</Label>
            <Input
              id="business_name"
              name="business_name"
              defaultValue={initialValues?.business_name}
              disabled={isPending}
              aria-invalid={!!fieldErrors.business_name}
            />
            {fieldErrors.business_name?.map((msg) => (
              <p key={msg} className="text-sm text-destructive">
                {msg}
              </p>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="services">Services</Label>
            <Textarea
              id="services"
              name="services"
              rows={3}
              defaultValue={initialValues?.services}
              disabled={isPending}
              aria-invalid={!!fieldErrors.services}
            />
            {fieldErrors.services?.map((msg) => (
              <p key={msg} className="text-sm text-destructive">
                {msg}
              </p>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="value_proposition">Value proposition</Label>
            <Textarea
              id="value_proposition"
              name="value_proposition"
              rows={3}
              defaultValue={initialValues?.value_proposition}
              disabled={isPending}
              aria-invalid={!!fieldErrors.value_proposition}
            />
            {fieldErrors.value_proposition?.map((msg) => (
              <p key={msg} className="text-sm text-destructive">
                {msg}
              </p>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="target_industry">Target industry</Label>
              <Input
                id="target_industry"
                name="target_industry"
                defaultValue={initialValues?.target_industry}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target_geography">Target geography</Label>
              <Input
                id="target_geography"
                name="target_geography"
                defaultValue={initialValues?.target_geography}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="constraints">Constraints</Label>
            <Textarea
              id="constraints"
              name="constraints"
              rows={2}
              defaultValue={initialValues?.constraints}
              disabled={isPending}
              placeholder="e.g. no discounting on a first call"
            />
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
