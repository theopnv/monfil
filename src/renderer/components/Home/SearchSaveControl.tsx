// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useState } from "react";
import { Dialog, DialogTrigger, Popover } from "react-aria-components";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { Input } from "@/components/untitled-ui/base/input/input";
import type { SavedSearchSummary } from "../../../shared/contracts";

const MAX_NAME_LENGTH = 60;

export interface SearchSaveControlProps {
  query: string;
  searches: SavedSearchSummary[];
  activeSearch: SavedSearchSummary | undefined;
  /** Resolves to an error message, or undefined once the search is stored. */
  onCreate: (name: string) => Promise<string | undefined>;
  onUpdate: () => Promise<string | undefined>;
}

function NameButton({ label, defaultName, onSubmit }: { label: string; defaultName: string; onSubmit: (name: string) => Promise<string | undefined> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState<string>();

  const submit = async () => {
    const message = await onSubmit(name);
    if (message) {
      setError(message);
      return;
    }
    setIsOpen(false);
  };

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (open) {
        setName(defaultName.slice(0, MAX_NAME_LENGTH));
        setError(undefined);
      }
    }}>
      <Button size="sm" color="secondary" className="flex-none rounded-full" onPress={() => setIsOpen(true)}>{label}</Button>
      <Popover data-search-area placement="bottom end" className="z-50 w-72 rounded-lg bg-primary p-3 shadow-lg ring-1 ring-secondary">
        <Dialog aria-label="Name this search" className="flex flex-col gap-2 outline-hidden">
          <form className="flex flex-col gap-2" onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}>
            <Input
              autoFocus
              aria-label="Name of the saved search"
              value={name}
              onChange={(value) => {
                setName(value);
                setError(undefined);
              }}
              isInvalid={error !== undefined}
              hint={error}
              maxLength={MAX_NAME_LENGTH}
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" color="secondary" onPress={() => setIsOpen(false)}>Cancel</Button>
              <Button size="sm" color="primary" type="submit" isDisabled={name.trim() === ""}>Save</Button>
            </div>
          </form>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

/**
 * Next to the search box: Save for a query no pill holds, Update and Save as new once a selected
 * pill's query has been edited.
 */
export default function SearchSaveControl({ query, searches, activeSearch, onCreate, onUpdate }: SearchSaveControlProps) {
  const trimmed = query.trim();
  if (trimmed === "") {
    return null;
  }

  if (activeSearch && trimmed !== activeSearch.query) {
    return (
      <>
        <Button size="sm" color="secondary" className="flex-none rounded-full" onPress={() => void onUpdate()}>Update</Button>
        <NameButton label="Save as new" defaultName={trimmed} onSubmit={onCreate} />
      </>
    );
  }

  if (searches.some((search) => search.query === trimmed)) {
    return null;
  }

  return <NameButton label="Save search" defaultName={trimmed} onSubmit={onCreate} />;
}
