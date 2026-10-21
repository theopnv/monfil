-- Names the complexity tables by domain, so that coverage tables can sit beside them.
-- SQLite moves the indexes with their table. The index keeps its old name, because creating it again would write one row for each stored summary row.
ALTER TABLE functions RENAME TO complexity_functions;
ALTER TABLE folder_summary RENAME TO complexity_folder_summary;
