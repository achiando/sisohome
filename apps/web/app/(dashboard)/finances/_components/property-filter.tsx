import { useEffect } from "react"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@workspace/ui/components/select"
import { useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { ArrowDown } from "lucide-react"

export function PropertyFilter({ propertyId, onPropertyChange }: { propertyId: string | null; onPropertyChange: (id: string | null) => void }) {
  const [properties, setProperties] = useState<( { id: string; name: string; code: string } )[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const props = await fetch(`/api/properties`, {
        credentials: 'include',
      }).then((r) => r.json())
      setProperties(props.properties ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <span>Loading properties...</span>

  return (
    <div className="flex items-center gap-2 w-48">
      <Select
        value={undefined}
        onValueChange={(val) => onPropertyChange(val ?? null)}
      >
        <SelectTrigger>
          <SelectValue />
          <ArrowDown className="size-3 opacity-60" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">
            <span className="text-sm text-muted-foreground">All Properties</span>
          </SelectItem>
          {properties.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              <span className="font-medium">{p.name} ({p.code})</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}