# UniversalForm Wizard Usage Guide

## Overview

The `UniversalForm` component with `variant="wizard"` provides a multi-step form wizard with:
- **Incremental data submission** per step via `onStepSubmit` callback
- **Full-width start button** on the first step
- **Per-step validation** via `onValidateStep` callback
- **Progress tracking** with visual step indicator
- **Mobile-optimized** with swipe gestures and responsive design

## Basic Usage

```tsx
import { UniversalForm } from "@workspace/ui/components/form"

function MyWizard() {
  const [values, setValues] = useState({})
  const [errors, setErrors] = useState({})

  const handleChange = (name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (finalValues: Record<string, unknown>) => {
    console.log("Final submission:", finalValues)
    // Submit to API
  }

  return (
    <UniversalForm
      variant="wizard"
      title="Create Account"
      description="Complete your profile in a few steps"
      values={values}
      onChange={handleChange}
      onSubmit={handleSubmit}
      steps={[
        {
          id: "personal",
          title: "Personal Info",
          icon: "user",
          sections: [
            {
              id: "personal-section",
              title: "Basic Information",
              fields: [
                { name: "firstName", label: "First Name", type: "text", required: true },
                { name: "lastName", label: "Last Name", type: "text", required: true },
                { name: "email", label: "Email", type: "email", required: true },
              ],
            },
          ],
        },
        {
          id: "address",
          title: "Address",
          icon: "map",
          sections: [
            {
              id: "address-section",
              title: "Location",
              fields: [
                { name: "street", label: "Street Address", type: "text", required: true },
                { name: "city", label: "City", type: "text", required: true },
                { name: "zip", label: "ZIP Code", type: "text", required: true },
              ],
            },
          ],
        },
        {
          id: "review",
          title: "Review",
          icon: "check",
          sections: [],
        },
      ]}
    />
  )
}
```

## Incremental Data Submission

Use the `onStepSubmit` callback to save data after each step completion. This is useful for:
- Saving progress to a backend
- Creating draft records
- Validating data server-side before proceeding

```tsx
const handleStepSubmit = async (stepIndex: number, stepData: Record<string, unknown>) => {
  try {
    // Save step data to API
    await fetch('/api/wizard/save-step', {
      method: 'POST',
      body: JSON.stringify({ stepIndex, data: stepData }),
    })
    console.log(`Step ${stepIndex} saved successfully`)
  } catch (error) {
    console.error('Failed to save step:', error)
    throw error // This will prevent step advancement
  }
}

<UniversalForm
  variant="wizard"
  onStepSubmit={handleStepSubmit}
  // ... other props
/>
```

## Per-Step Validation

Use `onValidateStep` to validate only the current step's fields before allowing navigation:

```tsx
const validateStep = (stepIndex: number, values: Record<string, unknown>) => {
  const errors: Record<string, string> = {}

  if (stepIndex === 0) {
    // Validate personal info step
    if (!values.firstName) errors.firstName = "First name is required"
    if (!values.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email as string)) {
      errors.email = "Invalid email address"
    }
  }

  if (stepIndex === 1) {
    // Validate address step
    if (!values.street) errors.street = "Street address is required"
  }

  return errors
}

<UniversalForm
  variant="wizard"
  onValidateStep={validateStep}
  // ... other props
/>
```

## Full-Width Start Button

The first step's "Next" button is automatically full-width for better mobile UX. You can override this with `primaryFullWidth`:

```tsx
<UniversalForm
  variant="wizard"
  primaryFullWidth={false} // Disable full-width on first step
  // ... other props
/>
```

## Custom Step Content

Use `renderStepContent` to render custom content for specific steps (e.g., a review step):

```tsx
const renderStepContent = (stepIndex: number) => {
  if (stepIndex === 2) {
    // Review step
    return (
      <div className="space-y-4">
        <h3>Review Your Information</h3>
        <p>Name: {values.firstName} {values.lastName}</p>
        <p>Email: {values.email}</p>
        <p>Address: {values.street}, {values.city}</p>
      </div>
    )
  }
  return null
}

<UniversalForm
  variant="wizard"
  renderStepContent={renderStepContent}
  // ... other props
/>
```

## Step Icons

Use the `icon` prop on each step to display icons in the step indicator. Supported icons:
- Lucide icon keys: `"building"`, `"car"`, `"laptop"`, `"tag"`, `"rocket"`, `"map"`, `"clipboard"`, `"credit"`, `"check"`, `"box"`, `"dollar"`, `"users"`, `"package"`
- Emojis: Any emoji string

```tsx
steps={[
  {
    id: "step1",
    title: "Personal",
    icon: "user", // Lucide icon
    sections: [...],
  },
  {
    id: "step2",
    title: "Location",
    icon: "📍", // Emoji
    sections: [...],
  },
]}
```

## Completion Messages

Add encouraging messages that appear when a step is completed:

```tsx
steps={[
  {
    id: "step1",
    title: "Personal Info",
    completionMessage: "Great start!",
    sections: [...],
  },
]}
```

## Loading States

The wizard shows loading state during:
- Step submission (`onStepSubmit` is async)
- Final submission (`onSubmit` is async)
- Global loading (`isLoading` prop)

```tsx
<UniversalForm
  variant="wizard"
  isLoading={isSubmitting}
  onStepSubmit={async (stepIndex, data) => {
    // This shows loading on the Next button
    await saveStepData(stepIndex, data)
  }}
  onSubmit={async (values) => {
    // This shows loading on the Submit button
    await submitFinalData(values)
  }}
/>
```

## Error Handling

- **Validation errors**: Display inline with field errors
- **Step submission errors**: Show as `_step` error and prevent navigation
- **Global errors**: Pass via `errors` prop

```tsx
const [errors, setErrors] = useState({})

const handleStepSubmit = async (stepIndex, stepData) => {
  try {
    await saveStep(stepIndex, stepData)
  } catch (error) {
    setErrors({ _step: "Failed to save. Please try again." })
    throw error
  }
}
```

## Mobile Features

- **Swipe gestures**: Swipe down on dialogs/sheets to dismiss
- **Touch targets**: Minimum 44px height on all buttons
- **Responsive**: Adapts layout for different screen sizes
- **Ripple effects**: Material Design ripple on button clicks
- **Haptic feedback**: Vibration on mobile devices (when supported)

## Selector Positioning Fix

The `Select` component now uses `position="item-aligned"` by default instead of `"popper"` for better positioning in forms and wizards. This fixes issues where dropdowns were misaligned with their triggers.

## Layout Control

### Card Wrapper

By default, the wizard renders without a card wrapper (`bare=true`) for maximum flexibility in different layouts. To add a card wrapper, set `bare={false}`:

```tsx
<UniversalForm
  variant="wizard"
  bare={false} // Adds Card wrapper with centered max-width
  steps={steps}
/>
```

### Hide Section Titles

Use `hideSectionTitles` to remove section headers when they're redundant with the step title:

```tsx
<UniversalForm
  variant="wizard"
  hideSectionTitles={true}
  steps={[
    {
      id: "step1",
      title: "Personal Information",
      sections: [
        {
          id: "personal",
          title: "Basic Info", // This will be hidden
          fields: [...],
        },
      ],
    },
  ]}
/>
```

### Hide Step Title

Use `hideStepTitle` when the form title is sufficient:

```tsx
<UniversalForm
  variant="wizard"
  title="Personal Information"
  hideStepTitle={true}
  steps={[
    {
      id: "step1",
      title: "Personal", // This will be hidden
      sections: [...],
    },
  ]}
/>
```

### Compact Layout

Use `compact` for reduced spacing in space-constrained layouts:

```tsx
<UniversalForm
  variant="wizard"
  compact={true}
  // ... other props
/>
```

## Step-Level Error Display

The wizard now displays step-level errors (from `_step` error key) in a prominent alert box:

```tsx
const handleStepSubmit = async (stepIndex, stepData) => {
  try {
    await saveStep(stepIndex, stepData)
  } catch (error) {
    // This will display as a step-level error
    throw new Error("Failed to save step data")
  }
}
```

## File Upload Handling

The wizard handles file uploads seamlessly with the `FileUpload` component:

- **Controlled files**: File state is managed through form values
- **Progress tracking**: Upload progress is displayed during submission
- **Error handling**: Upload errors are shown inline
- **Blob URL cleanup**: Automatic cleanup of preview URLs on unmount
- **Wizard step switching**: Uploads are properly handled when switching steps

```tsx
steps={[
  {
    id: "upload",
    title: "Upload Documents",
    sections: [
      {
        id: "files",
        title: "Documents",
        fields: [
          {
            name: "documents",
            label: "Upload Files",
            type: "file",
            accept: "image/*,.pdf",
            multiple: true,
            maxFiles: 5,
            maxSizeMB: 10,
          },
        ],
      },
    ],
  },
]}
```

The file upload component includes:
- Drag and drop support
- Image previews
- Progress indicators
- Error states
- File size validation
- File type validation
- Maximum file count enforcement

## Phone Input with Country Codes

The wizard supports phone input fields with country code selection and flags using `react-phone-number-input`:

```tsx
steps={[
  {
    id: "contact",
    title: "Contact Information",
    sections: [
      {
        id: "phone-section",
        title: "Phone Number",
        fields: [
          {
            name: "phone",
            label: "Phone Number",
            type: "phone",
            required: true,
            defaultCountry: "KE", // Optional: defaults to Kenya
          },
        ],
      },
    ],
  },
]}
```

### Phone Field Features

- **Country selector with flags**: Dropdown shows country names and flags
- **Default country**: Defaults to Kenya (KE) if not specified
- **Custom default**: Set `defaultCountry` to any ISO 3166-1 alpha-2 code (e.g., "US", "GB", "KE")
- **International format**: Automatically formats numbers in E.164 format
- **Validation**: Built-in validation for phone number formats
- **Placeholder**: Defaults to "+254 (700) 000-000" for Kenya format

### Country Codes

Common country codes:
- `KE` - Kenya (default)
- `US` - United States
- `GB` - United Kingdom
- `UG` - Uganda
- `TZ` - Tanzania
- `NG` - Nigeria
- `ZA` - South Africa

## Complete Example

```tsx
import { useState } from "react"
import { UniversalForm } from "@workspace/ui/components/form"

function OnboardingWizard() {
  const [values, setValues] = useState({})
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const validateStep = (stepIndex: number, stepValues: Record<string, unknown>) => {
    const stepErrors: Record<string, string> = {}

    if (stepIndex === 0) {
      if (!stepValues.firstName) stepErrors.firstName = "Required"
      if (!stepValues.email) stepErrors.email = "Required"
      if (stepValues.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(stepValues.email as string)) {
        stepErrors.email = "Invalid email"
      }
    }

    if (stepIndex === 1) {
      if (!stepValues.company) stepErrors.company = "Required"
    }

    return stepErrors
  }

  const handleStepSubmit = async (stepIndex: number, stepData: Record<string, unknown>) => {
    // Save progress to backend
    await fetch('/api/onboarding/save-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepIndex, data: stepData }),
    })
  }

  const handleSubmit = async (finalValues: Record<string, unknown>) => {
    setIsSubmitting(true)
    try {
      await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalValues),
      })
      // Redirect or show success
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <UniversalForm
      variant="wizard"
      title="Complete Your Profile"
      description="Let's set up your account in 3 simple steps"
      values={values}
      errors={errors}
      onChange={handleChange}
      onValidateStep={validateStep}
      onStepSubmit={handleStepSubmit}
      onSubmit={handleSubmit}
      isLoading={isSubmitting}
      primaryLabel="Complete Setup"
      steps={[
        {
          id: "personal",
          title: "Personal",
          icon: "user",
          completionMessage: "Great start!",
          sections: [
            {
              id: "personal-info",
              title: "Basic Information",
              fields: [
                { name: "firstName", label: "First Name", type: "text", required: true },
                { name: "lastName", label: "Last Name", type: "text", required: true },
                { name: "email", label: "Email", type: "email", required: true },
              ],
            },
          ],
        },
        {
          id: "company",
          title: "Company",
          icon: "building",
          completionMessage: "Looking good!",
          sections: [
            {
              id: "company-info",
              title: "Company Details",
              fields: [
                { name: "company", label: "Company Name", type: "text", required: true },
                { name: "role", label: "Your Role", type: "select", options: [
                  { label: "Owner", value: "owner" },
                  { label: "Manager", value: "manager" },
                  { label: "Employee", value: "employee" },
                ]},
              ],
            },
          ],
        },
        {
          id: "review",
          title: "Review",
          icon: "check",
          sections: [],
        },
      ]}
      renderStepContent={(stepIndex) => {
        if (stepIndex === 2) {
          return (
            <div className="space-y-4 p-4 bg-muted rounded-lg">
              <h3 className="font-semibold">Review Your Information</h3>
              <div className="grid gap-2 text-sm">
                <div><strong>Name:</strong> {values.firstName} {values.lastName}</div>
                <div><strong>Email:</strong> {values.email}</div>
                <div><strong>Company:</strong> {values.company}</div>
                <div><strong>Role:</strong> {values.role}</div>
              </div>
            </div>
          )
        }
        return null
      }}
    />
  )
}
```

## Props Reference

### WizardFormProps

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `variant` | `"wizard"` | Yes | Must be "wizard" |
| `steps` | `WizardStep[]` | Yes | Array of step definitions |
| `values` | `Record<string, unknown>` | Yes | Form values state |
| `onChange` | `(name: string, value: unknown) => void` | Yes | Value change handler |
| `onSubmit` | `(values: Record<string, unknown>) => void` | Yes | Final submission handler |
| `title` | `string` | Yes | Form title |
| `onValidateStep` | `(stepIndex: number, values: Record<string, unknown>) => Record<string, string>` | No | Per-step validation |
| `onStepSubmit` | `(stepIndex: number, stepData: Record<string, unknown>) => void \| Promise<void>` | No | Incremental step submission |
| `renderStepContent` | `(stepIndex: number) => React.ReactNode` | No | Custom step content |
| `hideSectionTitles` | `boolean` | No | Hide section headers |
| `hideStepTitle` | `boolean` | No | Hide step title |
| `compact` | `boolean` | No | Compact layout with reduced spacing |
| `description` | `string` | No | Form description |
| `mode` | `"create" \| "edit" \| "view"` | No | Form mode |
| `isLoading` | `boolean` | No | Global loading state |
| `onCancel` | `() => void` | No | Cancel handler |
| `primaryLabel` | `string` | No | Submit button label |
| `sticky` | `boolean` | No | Sticky footer |
| `primaryFullWidth` | `boolean` | No | Full-width primary button |
| `bare` | `boolean` | No | Remove card wrapper |
| `className` | `string` | No | Additional classes |
| `formClassName` | `string` | No | Form container classes |
| `errors` | `Record<string, string>` | No | Form errors |

### WizardStep

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | Yes | Unique step identifier |
| `title` | `string` | Yes | Step title |
| `sections` | `FormSection[]` | Yes | Form sections for this step |
| `description` | `string` | No | Step description |
| `icon` | `string` | No | Icon name or emoji |
| `completionMessage` | `string` | No | Message shown on completion |
