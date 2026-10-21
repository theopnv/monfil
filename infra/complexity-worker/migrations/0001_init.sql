-- One row for each function in each first-parent commit on main.
-- The primary key clusters the rows by sha, so deleting or reading one commit needs no extra index.
CREATE TABLE functions (
  sha TEXT NOT NULL CHECK (length(sha) = 40),
  date TEXT NOT NULL,
  file TEXT NOT NULL,
  qualified_name TEXT NOT NULL,
  line INTEGER NOT NULL CHECK (typeof(line) = 'integer' AND line >= 1),
  cyclomatic INTEGER NOT NULL CHECK (typeof(cyclomatic) = 'integer' AND cyclomatic >= 1),
  cognitive INTEGER NOT NULL CHECK (typeof(cognitive) = 'integer' AND cognitive >= 0),
  is_test INTEGER NOT NULL CHECK (is_test IN (0, 1)),
  PRIMARY KEY (sha, file, qualified_name)
) WITHOUT ROWID;

-- One row for each folder in the subtree of each file, so `src` overlaps `src/main`.
-- A panel must filter on one folder, or on the direct children of one folder.
CREATE TABLE folder_summary (
  sha TEXT NOT NULL,
  date TEXT NOT NULL,
  folder TEXT NOT NULL,
  is_test INTEGER NOT NULL CHECK (is_test IN (0, 1)),
  function_count INTEGER NOT NULL,
  cognitive_sum INTEGER NOT NULL,
  cyclomatic_sum INTEGER NOT NULL,
  cognitive_max INTEGER NOT NULL,
  cyclomatic_max INTEGER NOT NULL,
  cognitive_above INTEGER NOT NULL,
  cyclomatic_above INTEGER NOT NULL,
  above_limits INTEGER NOT NULL,
  PRIMARY KEY (sha, folder, is_test)
) WITHOUT ROWID;

CREATE INDEX folder_summary_folder_date ON folder_summary (folder, date);
