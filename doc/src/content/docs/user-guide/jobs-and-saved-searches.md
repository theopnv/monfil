---
title: Jobs and saved searches
description: Follow the job boards of companies, search with operators, and keep a search as a pill above the river.
---

You can follow the open jobs of a company the same way you follow a blog. Then you search the river for the roles you want and keep each search as a pill.

## Follow the jobs of a company

Select **+** at the top of the feed sidebar, pick the **Jobs** chip, and paste the job board of the company. The [supported sources](../supported-sources/#jobs) page lists the job systems that Monfil reads.

You can also install a feedpack. These packs list the job boards of many companies at once:

- Paris Tech Jobs
- Paris Video Game Jobs
- Paris Finance Jobs

Some employers use job systems that Monfil does not read yet. Those employers are not in the packs.

## Search syntax

The search box above the river understands these forms. They work for every source, not only for jobs.

| Type | Monfil shows |
| --- | --- |
| `data analyst` | Items that contain both words |
| `"data analyst"` | Items that contain the exact phrase |
| `go OR rust` | Items that contain either word. Write `OR` in capitals. |
| `-senior` | Items without the word. Also works for a phrase: `-"team lead"`. |
| `title:engineer` | Items with the word in the title. Also works for a phrase: `title:"data analyst"`. |

You can combine the forms: `title:"data analyst" -senior`. A chain such as `go OR rust OR zig` works. Brackets do not work, and a `-` word cannot be part of an `OR`. A hyphen inside a word, as in `front-end`, is part of the word.

A word of three letters or fewer, such as `ci`, matches whole words only, so it does not find `producing`. Any other word also matches inside longer words, so `engineer` finds `engineers`. Put a short word in quotes, as in `"ci"`, to match it inside words too.

Without `title:`, Monfil looks in the title, in the first 200 characters of the text, and in the feed name. It does not search the full text of an item.

When you select the search box, it moves to the center of the header and opens this list below it. Press Enter to close it and keep the filter.

## Save a search

1. Type a search. A **Save search** button appears next to the search box.
2. Select **Save search**, type a name, and press Enter.

The search is now a pill above the river. The number on the pill is the count of unread items that match. The pills belong to the workspace where you made them.

- Select a pill to run its search. Select it again to clear the search.
- A pill shows read and unread items, so a job stays in its search on the days after you read it. Select **Unread** to hide the read items again.
- Point at a pill and select the cross to delete it. A message lets you undo the delete.
- Right-click a pill, or focus it and press F2, to rename it.
- If you change the search of a selected pill, **Update** changes the pill. **Save as new** makes a second pill.
- When there are more pills than the row can show, scroll the row sideways or select the menu with three dots to see all of them.

The first time you follow a job board, Monfil shows a hint in the pill row with an example search. Select the hint to put the example in the search box. Select the cross on the hint to hide it.
