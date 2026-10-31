import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize = 10,
  className,
}: PaginationProps) {
  if (totalPages <= 1 && !totalItems) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = totalItems ? Math.min(currentPage * pageSize, totalItems) : currentPage * pageSize;

  return (
    <div className={cn("flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-2", className)}>
      <div className="text-xs text-slate-500">
        {totalItems !== undefined ? (
          <span>
            Showing <span className="font-medium text-slate-900">{startItem}</span> to{" "}
            <span className="font-medium text-slate-900">{endItem}</span> of{" "}
            <span className="font-medium text-slate-900">{totalItems}</span> results
          </span>
        ) : (
          <span>
            Page <span className="font-medium text-slate-900">{currentPage}</span> of{" "}
            <span className="font-medium text-slate-900">{totalPages}</span>
          </span>
        )}
      </div>

      <div className="flex items-center space-x-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Previous</span>
        </Button>

        <div className="flex items-center px-2 text-xs font-semibold text-slate-700">
          {currentPage} / {Math.max(1, totalPages)}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
