'use client';

import { ColorFilter } from '@/types/photobooth';
import { Button } from '@/components/ui/button';

interface ColorFiltersProps {
    currentFilter: ColorFilter;
    onApplyFilter: (filter: ColorFilter) => void;
}

export const ColorFilters = ({ currentFilter, onApplyFilter }: ColorFiltersProps) => {
    const filters = [
        { id: 'none' as ColorFilter, label: 'Original', color: 'bg-gray-100', textColor: 'text-gray-700' },
        { id: 'white' as ColorFilter, label: 'White', color: 'bg-white', textColor: 'text-gray-700' },
        { id: 'pink' as ColorFilter, label: 'Pink', color: 'bg-pink-200', textColor: 'text-pink-800' },
        { id: 'black' as ColorFilter, label: 'Black', color: 'bg-gray-800', textColor: 'text-white' },
        { id: 'yellow' as ColorFilter, label: 'Yellow', color: 'bg-yellow-200', textColor: 'text-yellow-800' },
    ];

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground text-center">Color Filters</h3>
            <div className="flex flex-wrap justify-center gap-3">
                {filters.map((filter) => (
                    <Button
                        key={filter.id}
                        variant={currentFilter === filter.id ? 'default' : 'outline'}
                        onClick={() => onApplyFilter(filter.id)}
                        className={`color-filter-btn ${filter.color} ${filter.textColor} ${currentFilter === filter.id ? 'active' : ''
                            } min-w-[80px] h-12 font-semibold transition-all duration-300`}
                    >
                        {filter.label}
                    </Button>
                ))}
            </div>
        </div>
    );
};
