import React from 'react';
import {
  Search,
  Grid,
  List,
  Layers,
  Send,
  Trash2,
  CheckSquare,
  Square,
  Filter,
  FileSpreadsheet,
  PenTool
} from 'lucide-react';

interface BatchToolbarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  mediaFilter: 'all' | 'image' | 'video' | 'vector';
  setMediaFilter: (f: 'all' | 'image' | 'video' | 'vector') => void;
  statusFilter: 'all' | 'ready' | 'draft' | 'submitted';
  setStatusFilter: (s: 'all' | 'ready' | 'draft' | 'submitted') => void;
  viewMode: 'grid' | 'table';
  setViewMode: (m: 'grid' | 'table') => void;
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onOpenImportCsv: () => void;
  onBulkEdit: () => void;
  onSubmitSelected: () => void;
  onDeleteSelected: () => void;
}

export const BatchToolbar: React.FC<BatchToolbarProps> = ({
  searchQuery,
  setSearchQuery,
  mediaFilter,
  setMediaFilter,
  statusFilter,
  setStatusFilter,
  viewMode,
  setViewMode,
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onOpenImportCsv,
  onBulkEdit,
  onSubmitSelected,
  onDeleteSelected,
}) => {
  const allSelected = totalCount > 0 && selectedCount === totalCount;

  return (
    <div className="space-y-3">
      {/* Primary Toolbar Row */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-2.5 rounded-xl">
        {/* Left side: Search & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Select All Toggle */}
          <button
            type="button"
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-950/60 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            {allSelected ? (
              <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
            ) : (
              <Square className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>{selectedCount > 0 ? `${selectedCount} Selected` : 'Select All'}</span>
          </button>

          {/* Media Type Segmented Tabs */}
          <div className="flex items-center p-1 bg-slate-950/80 rounded-lg border border-slate-800/80">
            <button
              onClick={() => setMediaFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                mediaFilter === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Files
            </button>
            <button
              onClick={() => setMediaFilter('image')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                mediaFilter === 'image'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Photos
            </button>
            <button
              onClick={() => setMediaFilter('video')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                mediaFilter === 'video'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Videos
            </button>
            <button
              onClick={() => setMediaFilter('vector')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                mediaFilter === 'vector'
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-600/40 shadow-sm'
                  : 'text-slate-400 hover:text-amber-300'
              }`}
            >
              <PenTool className="w-3 h-3 text-amber-400" />
              <span>Vectors</span>
            </button>
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="ready">Ready to Submit</option>
              <option value="draft">Drafts</option>
              <option value="submitted">Submitted</option>
            </select>
          </div>
        </div>

        {/* Right side: Import CSV, Search & View Toggle */}
        <div className="flex items-center gap-2.5">
          {/* Import Metadata CSV Action Button */}
          <button
            type="button"
            onClick={onOpenImportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:text-white bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/60 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-sm"
            title="Import manual microstock CSV (Filename, Title, Description, Keywords)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Import Metadata CSV</span>
          </button>

          <div className="relative flex-1 md:w-52">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search filename, keywords..."
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center p-1 bg-slate-950/80 rounded-lg border border-slate-800/80">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Grid View"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="High-Density Table View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating or contextual bulk action bar when items are selected */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-indigo-950/50 border border-indigo-900/60 rounded-xl animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-200">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <span>{selectedCount} assets selected for batch operations</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBulkEdit}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Bulk Edit Metadata</span>
            </button>

            <button
              type="button"
              onClick={onSubmitSelected}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit to Stock Sites</span>
            </button>

            <button
              type="button"
              onClick={onDeleteSelected}
              className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
              title="Remove Selected"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
