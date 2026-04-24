import sqlite3


def has_unique_email_constraint(cur: sqlite3.Cursor) -> bool:
    cur.execute("PRAGMA index_list('User')")
    indexes = cur.fetchall()
    for idx in indexes:
        # PRAGMA index_list columns: seq, name, unique, origin, partial
        idx_name = idx[1]
        is_unique = idx[2] == 1
        if not is_unique:
            continue

        cur.execute(f"PRAGMA index_info('{idx_name}')")
        cols = [row[2] for row in cur.fetchall()]
        if cols == ["email"]:
            return True
    return False


db = sqlite3.connect("prisma/dev.db")
cur = db.cursor()

cur.execute("PRAGMA table_info('User')")
columns = [r[1] for r in cur.fetchall()]
if not columns:
    print("User table not found, skipping.")
    db.close()
    raise SystemExit(0)

if not has_unique_email_constraint(cur):
    print("Email is already non-unique, nothing to migrate.")
    db.close()
    raise SystemExit(0)

print("Rebuilding User table to remove unique email constraint...")

cur.execute("PRAGMA foreign_keys = OFF")
cur.execute("BEGIN TRANSACTION")

cur.execute("ALTER TABLE User RENAME TO User_old")

cur.execute(
    """
    CREATE TABLE User (
      id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      handle TEXT NOT NULL UNIQUE,
      firstName TEXT,
      lastName TEXT,
      email TEXT,
      age INTEGER,
      isApproved INTEGER NOT NULL DEFAULT 0,
      avatarType TEXT NOT NULL DEFAULT 'sprite',
      avatarSprite TEXT NOT NULL DEFAULT 'adventurer',
      avatarSeed TEXT,
      avatarPhotoDataUrl TEXT,
      passwordHash TEXT,
      power REAL NOT NULL DEFAULT 30,
      money REAL NOT NULL DEFAULT 30,
      population REAL NOT NULL DEFAULT 0,
      lastDailyClaimAt DATETIME,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL,
      teamId INTEGER NOT NULL,
      FOREIGN KEY (teamId) REFERENCES Team(id) ON DELETE RESTRICT ON UPDATE CASCADE
    )
    """
)

cur.execute(
    """
    INSERT INTO User (
      id, handle, firstName, lastName, email, age, isApproved,
      avatarType, avatarSprite, avatarSeed, avatarPhotoDataUrl,
      passwordHash, power, money, population, lastDailyClaimAt,
      createdAt, updatedAt, teamId
    )
    SELECT
      id, handle, firstName, lastName, email, age, isApproved,
      avatarType, avatarSprite, avatarSeed, avatarPhotoDataUrl,
      passwordHash, power, money, population, lastDailyClaimAt,
      createdAt, updatedAt, teamId
    FROM User_old
    """
)

cur.execute("DROP TABLE User_old")

# Restore expected non-unique index on teamId for relation lookups.
cur.execute("CREATE INDEX IF NOT EXISTS User_teamId_idx ON User(teamId)")

cur.execute("COMMIT")
cur.execute("PRAGMA foreign_keys = ON")

db.commit()
db.close()

print("Done.")
