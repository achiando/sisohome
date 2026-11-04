import { Select, SelectTrigger, SelectContent, SelectItem } from "@workspace/ui/components/select"
import { useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { ArrowDown } from "lucide-react"

export function PropertyFilter({ onPropertyChange }: { propertyId: string | null; onPropertyChange: (id: string | null) => void }) {
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
        placeholder="Property"
        onValueChange={(val) => onPropertyChange(val?.id ?? null)}
        trigger={<SelectTrigger className="w-full"}>
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
        </SelectTrigger>
      </Select>
      <ArrowDown className="size-3 opacity-60" />
    </div>
  )