---
name: workspace-ui
description: >-
  Comprehensive design system and component manual for @workspace/ui.
  MANDATORY for all UI tasks: building pages, forms, layouts, responsive design,
  Material Design 3 patterns, loading states, lists, and using pre-built components
  to eliminate raw Tailwind.
---

# @workspace/ui Design System & Agent Skill

## ⚠️ MANDATORY ENFORCEMENT FOR ALL UI WORK

This skill is the single source of truth for all UI implementation across applications using `@workspace/ui`.

### Critical Rules
1. **NEVER write raw Tailwind wrappers when a component provides built-in props**:
   - ❌ Do NOT manually write `<div className="flex flex-col gap-1.5"><label>...</label><input /><p className="text-red-500">...</p></div>`
   - ✅ DO use `<Input label="..." description="..." error="..." />`
   - ❌ Do NOT manually write flex containers for checkboxes and labels
   - ✅ DO use `<Checkbox label="..." description="..." />` and `<RadioGroupItem label="..." />`
   - ❌ Do NOT manually stack card elevation classes: `shadow-md hover:shadow-lg transition-all rounded-2xl`
   - ✅ DO use `<Card variant="elevated">` or `<Card interactive>`
   - ❌ Do NOT build manual 5-tier tooltip wrappers
   - ✅ DO use `<SimpleTooltip content="...">...</SimpleTooltip>`
2. **Material Design 3 (M3) Mobile-First Standards**:
   - **Touch Targets**: Minimum 44px–48px height on all touchable elements (`md: h-11` or `lg: h-12`).
   - **Small Controls**: Checkboxes and Radio buttons must be at least 20px (`size="md"`) with touch area expansion (`after:-inset-x-3 after:-inset-y-2`).
   - **Tactile Feedback**: Interactive elements provide subtle press feedback (`active:scale-[0.98]`).
   - **Surfaces**: Use rounded corners (`rounded-xl` for inputs/buttons, `rounded-2xl` for cards, modals, sheets).
   - **Mobile Feedback**: Snackbars/toasts float at the bottom (`bottom-center`) with swipe-to-dismiss.
3. **Strict Prohibition Against Custom Components**:
   - **NEVER** create custom buttons, inputs, selects, cards, dialogs, drawers, loaders, or tabs.
   - Always import from `@workspace/ui/components` or `@workspace/ui/components/shared`.

---

## Component API Catalog & Examples

### 1. Button (`@workspace/ui/components/button`)
```tsx
import { Button } from "@workspace/ui/components/button"
import { Plus, ArrowRight } from "lucide-react"

// Primary 44px touch button with tactile feedback
<Button variant="primary" size="md" leftIcon={Plus} loading={isLoading}>
  Create Item
</Button>

// Outline button with ripple
<Button variant="outline" size="sm" rightIcon={ArrowRight} ripple>
  Next Step
</Button>

// Variants: "primary" | "secondary" | "outline" | "subtle" | "destructive" | "text" | "ghost" | "default"
// Sizes: "sm" (36px) | "md" (44px default) | "lg" (52px) | "icon" (44x44) | "icon-sm" (36x36)
```

### 2. Input (`@workspace/ui/components/input`)
Integrated label, description, error, password toggle, and clearable button without raw Tailwind wrappers:
```tsx
import { Input } from "@workspace/ui/components/input"
import { Search } from "lucide-react"

// Complete form field in one clean tag
<Input
  label="Email Address"
  placeholder="you@example.com"
  description="We'll never share your email with third parties."
  error={formErrors.email}
  leftIcon={<Search className="size-4" />}
  clearable
  onClear={() => setEmail("")}
/>

// Password input with built-in show/hide eye toggle
<Input
  type="password"
  label="Password"
  showPasswordToggle
/>
```

### 3. Checkbox & RadioGroup (`@workspace/ui/components`)
```tsx
import { Checkbox } from "@workspace/ui/components/checkbox"
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group"

// Checkbox with built-in label and description
<Checkbox
  label="Accept Terms & Conditions"
  description="You agree to our privacy policy and data terms."
  error={errors.terms}
  checked={agreed}
  onCheckedChange={setAgreed}
/>

// Radio group (horizontal or vertical) with built-in labels
<RadioGroup value={billing} onValueChange={setBilling} orientation="horizontal">
  <RadioGroupItem value="monthly" label="Monthly Billing" description="$12/month" />
  <RadioGroupItem value="annual" label="Annual Billing" description="$99/year (Save 20%)" />
</RadioGroup>
```

### 4. Switch (`@workspace/ui/components/switch`)
```tsx
import { Switch } from "@workspace/ui/components/switch"

<Switch
  label="Push Notifications"
  description="Receive alerts when property updates occur."
  checked={notifications}
  onCheckedChange={setNotifications}
/>
```

### 5. Card (`@workspace/ui/components/card`)
Material 3 elevation variants and tactile interactive state:
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@workspace/ui/components/card"

// Elevated Card (Feed / List items)
<Card variant="elevated" interactive onClick={handleOpen}>
  <CardHeader>
    <CardTitle>Property Overview</CardTitle>
    <CardDescription>Updated 2 hours ago</CardDescription>
  </CardHeader>
  <CardContent>Content details...</CardContent>
</Card>

// Variants: "elevated" | "filled" | "outlined" | "interactive" | "default" | "ghost"
```

### 6. Tabs (`@workspace/ui/components/tabs`)
Touch-friendly 44px tabs with horizontal mobile scrolling and M3 line/pill styles:
```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@workspace/ui/components/tabs"

// M3 Primary Tabs (line indicator)
<Tabs defaultValue="overview">
  <TabsList variant="line" size="md">
    <TabsTrigger value="overview" count={5}>Overview</TabsTrigger>
    <TabsTrigger value="activity">Activity</TabsTrigger>
    <TabsTrigger value="settings">Settings</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">...</TabsContent>
</Tabs>

// M3 Secondary Segmented Pill Tabs
<TabsList variant="pill" size="md">
  <TabsTrigger value="all">All</TabsTrigger>
  <TabsTrigger value="pending">Pending</TabsTrigger>
</TabsList>
```

### 7. Badge & Filter Chips (`@workspace/ui/components/badge`)
```tsx
import { Badge } from "@workspace/ui/components/badge"

// Static status badge
<Badge variant="success" dot shape="pill">Active</Badge>

// Interactive mobile filter chip
<Badge
  interactive
  selected={activeFilter === "residential"}
  onClick={() => setFilter("residential")}
  shape="pill"
  size="lg"
>
  Residential
</Badge>
```

### 8. Tooltip (`@workspace/ui/components/tooltip`)
```tsx
import { SimpleTooltip } from "@workspace/ui/components/tooltip"

// One-line tooltip wrapper
<SimpleTooltip content="Edit property details" side="top">
  <Button variant="ghost" size="icon-sm"><Edit className="size-4" /></Button>
</SimpleTooltip>
```

### 9. Toast / Snackbar (`@workspace/ui/components/toast`)
Material 3 bottom-floating snackbar with swipe-to-dismiss and semantic status icons:
```tsx
import { toast, Toaster } from "@workspace/ui/components/toast"

// In root layout:
<Toaster position="bottom-center" />

// Imperative triggers anywhere:
toast.success("Property saved successfully!")
toast.error("Failed to upload document", { description: "Please check your network." })
toast({
  title: "Archived",
  description: "Item moved to trash.",
  action: { label: "Undo", onClick: handleUndo }
})
```

### 10. Loaders Suite (`@workspace/ui/components/loader`)
```tsx
import {
  Loader,
  CircularLoader,
  LinearLoader,
  LoadingDots,
  PageLoader,
  LoadingOverlay
} from "@workspace/ui/components/loader"

// 1. Inline Circular Progress (M3 SVG)
<Loader size="sm" /> // in buttons/inputs
<CircularLoader size="lg" variant="primary" label="Fetching data..." />
<CircularLoader size="xl" value={75} /> // 75% determinate ring

// 2. M3 Linear Dual-Wave Progress (Top of cards / page headers)
<LinearLoader size="sm" variant="primary" />

// 3. Mobile Chat / Typing Indicator
<LoadingDots size="md" variant="primary" />

// 4. Centered Full-Page / Screen Loading State
<PageLoader title="Loading Records..." description="Preparing data..." />

// 5. Card / Form Save Overlay (prevents user misclicks)
<LoadingOverlay show={isSaving} text="Saving changes...">
  <Card>...</Card>
</LoadingOverlay>
```

### 11. Shared Data Listing Suite (`@workspace/ui/components/shared`)
Universal responsive listing that renders an accessible table on desktop (`md:block`) and mobile-optimized cards on mobile (`md:hidden`) with **automatic zero-CLS skeleton loading** and infinite scrolling:
```tsx
import {
  ResponsiveDataListing,
  type ColumnDef,
  type CardMapper
} from "@workspace/ui/components/shared"

<ResponsiveDataListing
  title="Properties"
  description="Manage all active listings"
  items={data}
  loading={isLoading}
  skeletonCount={5}
  columns={columns}
  cardMapper={cardMapper}
  rowKey={(item) => item.id}
  searchQuery={search}
  onSearchChange={setSearch}
  primaryAction={{
    label: "Add Property",
    onClick: handleAdd
  }}
  hasMore={hasNextPage}
  isLoadingMore={isFetchingNextPage}
  onLoadMore={fetchNextPage}
/>
```

---

## Typography & Design Tokens

### Typography Contract (`@workspace/ui/components/text`)
Always use CSS variables rather than hardcoded gray text:
- Headings: `variant="display"` (36px), `variant="headline"` (24px), `variant="title"` (18px)
- Body: `variant="body"` (14px foreground), `variant="bodyMuted"` (14px muted)
- Subtext: `variant="caption"` (12px), `variant="label"` (12px uppercase)

### Spacing & Radius Tokens
- **Borders & Radius**: `rounded-xl` (12px) for inputs/buttons; `rounded-2xl` (16px) for cards/sheets/dialogs.
- **Shadows**: `shadow-xs`, `shadow-sm`, `shadow-md`, `shadow-lg`.
- **Colors**: Always use semantic tokens (`bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`).

---

## Cross-Project Setup (Using in Another Project)

To use `@workspace/ui` and this agent skill in ANY another project:

1. **Copy or Reference `@workspace/ui`**:
   Ensure `packages/ui` is in your workspace or installed as `@workspace/ui`.
2. **Mount the Agent Skill**:
   From the root of the consuming project, run:
   ```bash
   mkdir -p .agents/skills
   ln -s ../../packages/ui/skills/workspace-ui .agents/skills/workspace-ui
   ```
   *(Or copy `packages/ui/skills/workspace-ui` into `.agents/skills/workspace-ui`).*
3. **Register in `AGENTS.md`**:
   Add to the project's `AGENTS.md`:
   ```markdown
   # UI Work Rules
   ALL UI work MUST adhere to the `workspace-ui` agent skill located at `.agents/skills/workspace-ui/SKILL.md`.
   ```
