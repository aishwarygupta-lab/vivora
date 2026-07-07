export function PanelLoader({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
      <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
      {label}
    </div>
  )
}
