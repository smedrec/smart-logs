'use client'

import { AlertSeverity, AlertStatus, AlertType } from '@/components/alerts/types/alert-types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/components/ui/command'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
	BookmarkPlus,
	Check,
	ChevronDown,
	Clock,
	Filter,
	History,
	Save,
	Search,
	Settings,
	Star,
	Trash2,
	X,
} from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import type {
	AlertFilters,
	AlertSearch as AlertSearchType,
} from '@/components/alerts/types/filter-types'

// Search suggestion types
interface SearchSuggestion {
	id: string
	type: 'field' | 'value' | 'operator' | 'recent' | 'saved'
	label: string
	value: string
	description?: string
	category?: string
	count?: number
}

// Saved search interface
interface SavedSearch {
	id: string
	name: string
	description?: string
	query: string
	filters?: AlertFilters
	isDefault?: boolean
	isFavorite?: boolean
	createdAt: Date
	updatedAt: Date
	usageCount: number
}

// Search history entry
interface SearchHistoryEntry {
	id: string
	query: string
	timestamp: Date
	resultCount?: number
}

// Search field configuration
interface SearchField {
	key: string
	label: string
	type: 'text' | 'number' | 'date' | 'enum'
	operators: string[]
	suggestions?: string[]
}

interface AlertSearchProps {
	/** Current search configuration */
	search?: AlertSearchType
	/** Current filters */
	filters?: AlertFilters
	/** Callback when search changes */
	onSearchChange: (search: AlertSearchType) => void
	/** Callback when filters change */
	onFiltersChange?: (filters: AlertFilters) => void
	/** Available search suggestions */
	suggestions?: SearchSuggestion[]
	/** Saved searches */
	savedSearches?: SavedSearch[]
	/** Search history */
	searchHistory?: SearchHistoryEntry[]
	/** Callback to save search */
	onSaveSearch?: (search: SavedSearch) => Promise<void>
	/** Callback to delete saved search */
	onDeleteSavedSearch?: (id: string) => Promise<void>
	/** Whether search is loading */
	loading?: boolean
	/** Placeholder text */
	placeholder?: string
	/** Additional CSS classes */
	className?: string
}

// Search operators
const SEARCH_OPERATORS = [
	{ value: 'contains', label: 'contains', symbol: ':' },
	{ value: 'equals', label: 'equals', symbol: '=' },
	{ value: 'not_equals', label: 'not equals', symbol: '!=' },
	{ value: 'starts_with', label: 'starts with', symbol: '^' },
	{ value: 'ends_with', label: 'ends with', symbol: '$' },
	{ value: 'greater_than', label: 'greater than', symbol: '>' },
	{ value: 'less_than', label: 'less than', symbol: '<' },
	{ value: 'regex', label: 'regex', symbol: '~' },
]

// Searchable fields
const SEARCH_FIELDS: SearchField[] = [
	{
		key: 'title',
		label: 'Title',
		type: 'text',
		operators: ['contains', 'equals', 'starts_with', 'ends_with', 'regex'],
	},
	{
		key: 'description',
		label: 'Description',
		type: 'text',
		operators: ['contains', 'equals', 'regex'],
	},
	{
		key: 'severity',
		label: 'Severity',
		type: 'enum',
		operators: ['equals', 'not_equals'],
		suggestions: Object.values(AlertSeverity),
	},
	{
		key: 'type',
		label: 'Type',
		type: 'enum',
		operators: ['equals', 'not_equals'],
		suggestions: Object.values(AlertType),
	},
	{
		key: 'status',
		label: 'Status',
		type: 'enum',
		operators: ['equals', 'not_equals'],
		suggestions: Object.values(AlertStatus),
	},
	{
		key: 'source',
		label: 'Source',
		type: 'text',
		operators: ['contains', 'equals', 'starts_with'],
	},
	{
		key: 'tags',
		label: 'Tags',
		type: 'text',
		operators: ['contains', 'equals'],
	},
	{
		key: 'acknowledgedBy',
		label: 'Acknowledged By',
		type: 'text',
		operators: ['contains', 'equals'],
	},
	{
		key: 'resolvedBy',
		label: 'Resolved By',
		type: 'text',
		operators: ['contains', 'equals'],
	},
]

/**
 * Advanced search functionality with multiple criteria, suggestions, and saved searches
 * Supports complex queries, search history, and autocomplete
 */
export function AlertSearch({
	search = { query: '', fields: ['title', 'description'] },
	filters = {},
	onSearchChange,
	onFiltersChange,
	suggestions = [],
	savedSearches = [],
	searchHistory = [],
	onSaveSearch,
	onDeleteSavedSearch,
	loading = false,
	placeholder = 'Search alerts...',
	className,
}: AlertSearchProps) {
	const [query, setQuery] = useState(search.query)
	const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
	const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
	const [showSuggestions, setShowSuggestions] = useState(false)
	const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
	const [searchFields, setSearchFields] = useState(search.fields || ['title', 'description'])
	const [caseSensitive, setCaseSensitive] = useState(search.caseSensitive || false)
	const [fuzzy, setFuzzy] = useState(search.fuzzy || false)

	// Debounced search
	useEffect(() => {
		const timer = setTimeout(() => {
			if (query !== search.query) {
				onSearchChange({
					query,
					fields: searchFields,
					caseSensitive,
					fuzzy,
				})
			}
		}, 300)

		return () => clearTimeout(timer)
	}, [query, searchFields, caseSensitive, fuzzy, search.query, onSearchChange])

	// Generate search suggestions
	const searchSuggestions = useMemo(() => {
		if (!query.trim()) {
			return [
				...searchHistory.slice(0, 5).map((entry) => ({
					id: entry.id,
					type: 'recent' as const,
					label: entry.query,
					value: entry.query,
					description: `${entry.resultCount || 0} results`,
					category: 'Recent Searches',
				})),
				...savedSearches.slice(0, 5).map((saved) => ({
					id: saved.id,
					type: 'saved' as const,
					label: saved.name,
					value: saved.query,
					description: saved.description,
					category: 'Saved Searches',
				})),
			]
		}

		const queryLower = query.toLowerCase()
		const fieldSuggestions: SearchSuggestion[] = []
		const valueSuggestions: SearchSuggestion[] = []

		// Field suggestions
		SEARCH_FIELDS.forEach((field) => {
			if (field.label.toLowerCase().includes(queryLower)) {
				fieldSuggestions.push({
					id: `field-${field.key}`,
					type: 'field',
					label: field.label,
					value: `${field.key}:`,
					description: `Search in ${field.label.toLowerCase()}`,
					category: 'Fields',
				})
			}

			// Value suggestions for enum fields
			if (field.suggestions) {
				field.suggestions.forEach((suggestion) => {
					if (suggestion.toLowerCase().includes(queryLower)) {
						valueSuggestions.push({
							id: `value-${field.key}-${suggestion}`,
							type: 'value',
							label: suggestion,
							value: `${field.key}:${suggestion}`,
							description: `${field.label}: ${suggestion}`,
							category: 'Values',
						})
					}
				})
			}
		})

		// Custom suggestions from props
		const customSuggestions = suggestions.filter(
			(s) =>
				s.label.toLowerCase().includes(queryLower) || s.value.toLowerCase().includes(queryLower)
		)

		return [
			...fieldSuggestions.slice(0, 3),
			...valueSuggestions.slice(0, 5),
			...customSuggestions.slice(0, 5),
		]
	}, [query, suggestions, searchHistory, savedSearches])

	const handleQueryChange = useCallback((value: string) => {
		setQuery(value)
		setShowSuggestions(true)
		setSelectedSuggestionIndex(-1)
	}, [])

	const handleSuggestionSelect = useCallback((suggestion: SearchSuggestion) => {
		setQuery(suggestion.value)
		setShowSuggestions(false)
		setSelectedSuggestionIndex(-1)
	}, [])

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (!showSuggestions || searchSuggestions.length === 0) return

			switch (e.key) {
				case 'ArrowDown':
					e.preventDefault()
					setSelectedSuggestionIndex((prev) => (prev < searchSuggestions.length - 1 ? prev + 1 : 0))
					break
				case 'ArrowUp':
					e.preventDefault()
					setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : searchSuggestions.length - 1))
					break
				case 'Enter':
					e.preventDefault()
					if (selectedSuggestionIndex >= 0) {
						handleSuggestionSelect(searchSuggestions[selectedSuggestionIndex])
					} else {
						setShowSuggestions(false)
					}
					break
				case 'Escape':
					setShowSuggestions(false)
					setSelectedSuggestionIndex(-1)
					break
			}
		},
		[showSuggestions, searchSuggestions, selectedSuggestionIndex, handleSuggestionSelect]
	)

	const handleSaveSearch = useCallback(
		async (name: string, description?: string) => {
			if (!onSaveSearch) return

			const savedSearch: SavedSearch = {
				id: `search-${Date.now()}`,
				name,
				description,
				query,
				filters,
				isDefault: false,
				isFavorite: false,
				createdAt: new Date(),
				updatedAt: new Date(),
				usageCount: 0,
			}

			try {
				await onSaveSearch(savedSearch)
				setIsSaveDialogOpen(false)
				toast.success('Search saved successfully')
			} catch (error) {
				console.error('Failed to save search:', error)
				toast.error('Failed to save search')
			}
		},
		[query, filters, onSaveSearch]
	)

	const handleLoadSavedSearch = useCallback(
		(savedSearch: SavedSearch) => {
			setQuery(savedSearch.query)
			if (savedSearch.filters && onFiltersChange) {
				onFiltersChange(savedSearch.filters)
			}
			setShowSuggestions(false)
		},
		[onFiltersChange]
	)

	const clearSearch = useCallback(() => {
		setQuery('')
		onSearchChange({
			query: '',
			fields: searchFields,
			caseSensitive,
			fuzzy,
		})
	}, [searchFields, caseSensitive, fuzzy, onSearchChange])

	return (
		<div className={cn('relative', className)}>
			<div className="flex items-center gap-2">
				{/* Main Search Input */}
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={query}
						onChange={(e) => handleQueryChange(e.target.value)}
						onKeyDown={handleKeyDown}
						onFocus={() => setShowSuggestions(true)}
						onBlur={() => {
							// Delay hiding suggestions to allow clicks
							setTimeout(() => setShowSuggestions(false), 200)
						}}
						placeholder={placeholder}
						className="pl-9 pr-20"
						disabled={loading}
					/>
					{query && (
						<Button
							variant="ghost"
							size="sm"
							onClick={clearSearch}
							className="absolute right-12 top-1/2 h-6 w-6 -translate-y-1/2 p-0"
						>
							<X className="h-3 w-3" />
						</Button>
					)}
					{loading && (
						<div className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-current border-t-transparent" />
					)}
				</div>

				{/* Advanced Search Button */}
				<Button
					variant="outline"
					size="sm"
					onClick={() => setIsAdvancedOpen(true)}
					className="whitespace-nowrap"
				>
					<Settings className="h-4 w-4 mr-2" />
					Advanced
				</Button>

				{/* Save Search Button */}
				{query && onSaveSearch && (
					<Button variant="outline" size="sm" onClick={() => setIsSaveDialogOpen(true)}>
						<BookmarkPlus className="h-4 w-4 mr-2" />
						Save
					</Button>
				)}

				{/* Saved Searches Dropdown */}
				{savedSearches.length > 0 && (
					<Popover>
						<PopoverTrigger asChild>
							<Button variant="outline" size="sm">
								<Star className="h-4 w-4 mr-2" />
								Saved
								<ChevronDown className="h-4 w-4 ml-2" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-80" align="end">
							<div className="space-y-2">
								<h4 className="font-medium">Saved Searches</h4>
								<ScrollArea className="h-60">
									<div className="space-y-1">
										{savedSearches.map((savedSearch) => (
											<div
												key={savedSearch.id}
												className="flex items-center justify-between p-2 rounded-lg hover:bg-accent cursor-pointer"
												onClick={() => handleLoadSavedSearch(savedSearch)}
											>
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2">
														<span className="font-medium text-sm truncate">{savedSearch.name}</span>
														{savedSearch.isFavorite && (
															<Star className="h-3 w-3 fill-current text-yellow-500" />
														)}
													</div>
													{savedSearch.description && (
														<p className="text-xs text-muted-foreground truncate">
															{savedSearch.description}
														</p>
													)}
													<p className="text-xs text-muted-foreground">
														{savedSearch.usageCount} uses
													</p>
												</div>
												{onDeleteSavedSearch && (
													<Button
														variant="ghost"
														size="sm"
														onClick={(e) => {
															e.stopPropagation()
															onDeleteSavedSearch(savedSearch.id)
														}}
														className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
													>
														<Trash2 className="h-3 w-3" />
													</Button>
												)}
											</div>
										))}
									</div>
								</ScrollArea>
							</div>
						</PopoverContent>
					</Popover>
				)}
			</div>

			{/* Search Suggestions */}
			{showSuggestions && searchSuggestions.length > 0 && (
				<Card className="absolute top-full left-0 right-0 z-50 mt-1 shadow-lg">
					<CardContent className="p-0">
						<Command>
							<CommandList>
								{searchSuggestions
									.reduce(
										(acc, suggestion, index) => {
											const category = suggestion.category || 'Suggestions'
											if (!acc.find((group) => group.category === category)) {
												acc.push({ category, suggestions: [] })
											}
											acc
												.find((group) => group.category === category)
												?.suggestions.push({
													...suggestion,
													index,
												})
											return acc
										},
										[] as {
											category: string
											suggestions: (SearchSuggestion & { index: number })[]
										}[]
									)
									.map((group) => (
										<CommandGroup key={group.category} heading={group.category}>
											{group.suggestions.map((suggestion) => (
												<CommandItem
													key={suggestion.id}
													value={suggestion.value}
													onSelect={() => handleSuggestionSelect(suggestion)}
													className={cn(
														'cursor-pointer',
														selectedSuggestionIndex === suggestion.index && 'bg-accent'
													)}
												>
													<div className="flex items-center gap-2 w-full">
														{suggestion.type === 'recent' && <Clock className="h-4 w-4" />}
														{suggestion.type === 'saved' && <Star className="h-4 w-4" />}
														{suggestion.type === 'field' && <Filter className="h-4 w-4" />}
														<div className="flex-1 min-w-0">
															<div className="font-medium truncate">{suggestion.label}</div>
															{suggestion.description && (
																<div className="text-xs text-muted-foreground truncate">
																	{suggestion.description}
																</div>
															)}
														</div>
														{suggestion.count !== undefined && (
															<span className="text-xs text-muted-foreground">
																{suggestion.count}
															</span>
														)}
													</div>
												</CommandItem>
											))}
										</CommandGroup>
									))}
								{searchSuggestions.length === 0 && (
									<CommandEmpty>No suggestions found.</CommandEmpty>
								)}
							</CommandList>
						</Command>
					</CardContent>
				</Card>
			)}

			{/* Advanced Search Dialog */}
			<Dialog open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>Advanced Search</DialogTitle>
						<DialogDescription>
							Configure advanced search options and field selection
						</DialogDescription>
					</DialogHeader>

					<Tabs defaultValue="fields" className="w-full">
						<TabsList className="grid w-full grid-cols-3">
							<TabsTrigger value="fields">Search Fields</TabsTrigger>
							<TabsTrigger value="options">Options</TabsTrigger>
							<TabsTrigger value="syntax">Syntax Help</TabsTrigger>
						</TabsList>

						<TabsContent value="fields" className="space-y-4">
							<div>
								<Label className="text-base font-medium">Search in Fields</Label>
								<p className="text-sm text-muted-foreground mb-4">
									Select which fields to search in
								</p>
								<div className="grid grid-cols-2 gap-3">
									{SEARCH_FIELDS.map((field) => (
										<div key={field.key} className="flex items-center space-x-2">
											<input
												type="checkbox"
												id={`field-${field.key}`}
												checked={searchFields.includes(field.key)}
												onChange={(e) => {
													if (e.target.checked) {
														setSearchFields([...searchFields, field.key])
													} else {
														setSearchFields(searchFields.filter((f) => f !== field.key))
													}
												}}
												className="rounded border-gray-300"
											/>
											<Label htmlFor={`field-${field.key}`} className="text-sm">
												{field.label}
											</Label>
										</div>
									))}
								</div>
							</div>
						</TabsContent>

						<TabsContent value="options" className="space-y-4">
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<div>
										<Label className="text-base font-medium">Case Sensitive</Label>
										<p className="text-sm text-muted-foreground">Match exact case when searching</p>
									</div>
									<Switch checked={caseSensitive} onCheckedChange={setCaseSensitive} />
								</div>

								<div className="flex items-center justify-between">
									<div>
										<Label className="text-base font-medium">Fuzzy Search</Label>
										<p className="text-sm text-muted-foreground">
											Allow approximate matches with typos
										</p>
									</div>
									<Switch checked={fuzzy} onCheckedChange={setFuzzy} />
								</div>
							</div>
						</TabsContent>

						<TabsContent value="syntax" className="space-y-4">
							<div className="space-y-4">
								<div>
									<Label className="text-base font-medium">Search Syntax</Label>
									<p className="text-sm text-muted-foreground mb-4">
										Use these operators to create advanced queries
									</p>
								</div>

								<div className="space-y-3">
									{SEARCH_OPERATORS.map((operator) => (
										<div key={operator.value} className="flex items-center gap-3">
											<code className="bg-muted px-2 py-1 rounded text-sm font-mono">
												{operator.symbol}
											</code>
											<div>
												<span className="font-medium">{operator.label}</span>
												<p className="text-sm text-muted-foreground">
													Example: title{operator.symbol}error
												</p>
											</div>
										</div>
									))}
								</div>

								<Separator />

								<div>
									<Label className="text-base font-medium">Examples</Label>
									<div className="space-y-2 mt-2">
										<div className="text-sm">
											<code className="bg-muted px-2 py-1 rounded">title:database error</code>
											<span className="ml-2 text-muted-foreground">
												Search for "database error" in title
											</span>
										</div>
										<div className="text-sm">
											<code className="bg-muted px-2 py-1 rounded">severity=CRITICAL</code>
											<span className="ml-2 text-muted-foreground">Find critical alerts</span>
										</div>
										<div className="text-sm">
											<code className="bg-muted px-2 py-1 rounded">status!=resolved</code>
											<span className="ml-2 text-muted-foreground">Exclude resolved alerts</span>
										</div>
									</div>
								</div>
							</div>
						</TabsContent>
					</Tabs>

					<DialogFooter>
						<Button variant="outline" onClick={() => setIsAdvancedOpen(false)}>
							Cancel
						</Button>
						<Button onClick={() => setIsAdvancedOpen(false)}>Apply Settings</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Save Search Dialog */}
			<Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Save Search</DialogTitle>
						<DialogDescription>Save this search for quick access later</DialogDescription>
					</DialogHeader>

					<form
						onSubmit={(e) => {
							e.preventDefault()
							const formData = new FormData(e.currentTarget)
							const name = formData.get('name') as string
							const description = formData.get('description') as string
							handleSaveSearch(name, description)
						}}
						className="space-y-4"
					>
						<div>
							<Label htmlFor="search-name">Name</Label>
							<Input id="search-name" name="name" placeholder="Enter search name" required />
						</div>

						<div>
							<Label htmlFor="search-description">Description (optional)</Label>
							<Input id="search-description" name="description" placeholder="Enter description" />
						</div>

						<div className="bg-muted p-3 rounded-lg">
							<Label className="text-sm font-medium">Query</Label>
							<p className="text-sm text-muted-foreground mt-1 font-mono">
								{query || 'Empty query'}
							</p>
						</div>

						<DialogFooter>
							<Button type="button" variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
								Cancel
							</Button>
							<Button type="submit">
								<Save className="h-4 w-4 mr-2" />
								Save Search
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	)
}
