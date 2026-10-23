---
title: Search and saved searches
description: Search the river with phrases, OR, exclusions and title, and keep a search as a pill above the river.
---

The search box above the river filters the items of the current workspace. It works the same for every source.

## Search syntax

| Type | Monfil shows |
| --- | --- |
| `rust async` | Items that contain both words |
| `"machine learning"` | Items that contain the exact phrase |
| `kubernetes OR k8s` | Items that contain either word. Write `OR` in capitals. |
| `-sponsored` | Items without the word. Also works for a phrase: `-"press release"`. |
| `title:release` | Items with the word in the title. Also works for a phrase: `title:"release notes"`. |

You can combine the forms: `title:"release notes" -beta`. A chain such as `go OR rust OR zig` works. Brackets do not work, and a `-` word cannot be part of an `OR`. A hyphen inside a word, as in `front-end`, is part of the word.

A word of three letters or fewer, such as `ci`, matches whole words only, so it does not find `producing`. Any other word also matches inside longer words, so `engineer` finds `engineers`. Put a short word in quotes, as in `"ci"`, to match it inside words too.

Without `title:`, Monfil looks in the title, in the first 200 characters of the text, and in the feed name. It does not search the full text of an item.

When you select the search box, it moves to the center of the header and opens this list below it. Press Enter, or select anywhere outside the box, to close it and keep the filter. Press Escape to clear the search.

## Save a search

1. Type a search. A **Save search** button appears next to the search box.
2. Select **Save search**, type a name, and press Enter.

The search is now a pill above the river. The number on the pill is the count of unread items that match. The pills belong to the workspace where you made them.

- Select a pill to run its search. Select it again to clear the search.
- A pill shows read and unread items, so an item stays in its search on the days after you read it. Select **Unread** to hide the read items again.
- Point at a pill and select the cross to delete it. A message lets you undo the delete.
- Right-click a pill, or focus it and press F2, to rename it.
- If you change the search of a selected pill, **Update** changes the pill. **Save as new** makes a second pill.
- When there are more pills than the row can show, scroll the row sideways or select the menu with three dots to see all of them.
