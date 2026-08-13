import { useState } from "react";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { Input } from "@/components/untitled-ui/base/input/input";
import { cx } from "@/components/untitled-ui/utils/cx";
import type { FeedCategory } from "../../../preload/channels";

export interface CategoryPickerProps {
  categories: FeedCategory[];
  selectedName: string | null;
  onSelect: (name: string) => void;
  newName: string;
  onNewNameChange: (name: string) => void;
  onAddNew: () => void;
}

export default function CategoryPicker({ categories, selectedName, onSelect, newName, onNewNameChange, onAddNew }: CategoryPickerProps) {
  const [isAddingNew, setIsAddingNew] = useState(false);

  function commitNewCategory() {
    if (newName.trim().length === 0) return;
    onAddNew();
    setIsAddingNew(false);
  }

  const selectedIsUnlisted = selectedName !== null && !categories.some((category) => category.name === selectedName);

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-semibold text-secondary">Put it in</div>
      <div className="flex flex-wrap items-center gap-1.75">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.name)}
            className={cx(
              "rounded-full border px-3.75 py-1.75 text-sm font-semibold transition-colors",
              category.name === selectedName
                ? "border-brand-solid bg-brand-solid text-white"
                : "border-secondary bg-transparent text-secondary hover:bg-primary_hover",
            )}
          >
            {category.name}
          </button>
        ))}

        {isAddingNew ? (
          <div className="flex items-center gap-1.5">
            <Input
              aria-label="New category name"
              size="sm"
              placeholder="e.g. Design"
              value={newName}
              onChange={onNewNameChange}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitNewCategory();
                if (event.key === "Escape") setIsAddingNew(false);
              }}
            />
            <Button size="sm" color="secondary" isDisabled={newName.trim().length === 0} onPress={commitNewCategory}>
              Add
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsAddingNew(true)}
            className="rounded-full border border-dashed border-tertiary px-3.75 py-1.75 text-sm font-semibold text-tertiary hover:bg-primary_hover"
          >
            + New category
          </button>
        )}
      </div>

      {selectedIsUnlisted && <p className="text-xs text-tertiary">New category: {selectedName}</p>}
    </div>
  );
}
