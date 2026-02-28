"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Props {
  search: string
  onSearchChange: (value: string) => void
  onExportCsv: () => void
  onExportExcel: () => void
  status: string
  onStatusChange: (value: string) => void
}

export function ResultsFilters({
  search,
  onSearchChange,
  onExportCsv,
  onExportExcel,
  status,
  onStatusChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input className="w-full max-w-sm" placeholder="Search student/token..." value={search} onChange={(event) => onSearchChange(event.target.value)} />
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[170px]">
          <SelectValue placeholder="Result status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All statuses</SelectItem>
          <SelectItem value="PENDING">Pending</SelectItem>
          <SelectItem value="COMPLETED">Completed</SelectItem>
          <SelectItem value="FAILED">Failed</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="outline" onClick={onExportCsv}>
        Export CSV
      </Button>
      <Button variant="outline" onClick={onExportExcel}>
        Export Excel
      </Button>
    </div>
  )
}

