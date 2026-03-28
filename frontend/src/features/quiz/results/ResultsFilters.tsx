"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Props {
  search: string
  onSearchChange: (value: string) => void
  onExportCsv: () => void
  onExportExcel: () => void
  exportBusy?: boolean
  status: string
  onStatusChange: (value: string) => void
}

export function ResultsFilters({
  search,
  onSearchChange,
  onExportCsv,
  onExportExcel,
  exportBusy = false,
  status,
  onStatusChange,
}: Props) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_170px_auto_auto] xl:items-center">
      <Input className="w-full min-w-0" placeholder="Search student/token..." value={search} onChange={(event) => onSearchChange(event.target.value)} />
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-full min-w-0 xl:w-[170px]">
          <SelectValue placeholder="Result status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All statuses</SelectItem>
          <SelectItem value="PENDING">Pending</SelectItem>
          <SelectItem value="COMPLETED">Completed</SelectItem>
          <SelectItem value="FAILED">Failed</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="outline" className="w-full sm:w-auto" onClick={onExportCsv} disabled={exportBusy}>
        Export CSV
      </Button>
      <Button variant="outline" className="w-full sm:w-auto" onClick={onExportExcel} disabled={exportBusy}>
        Export Excel
      </Button>
    </div>
  )
}
