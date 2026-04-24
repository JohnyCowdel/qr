import sqlite3

db = sqlite3.connect('prisma/dev.db')
cur = db.cursor()

cur.execute('PRAGMA table_info(Team)')
cols = [r[1] for r in cur.fetchall()]
print('Current columns:', cols)

if 'emoji' not in cols:
    cur.execute("ALTER TABLE Team ADD COLUMN emoji TEXT NOT NULL DEFAULT '🏴'")
    print('Added emoji')
else:
    print('emoji already exists')

if 'isHidden' not in cols:
    cur.execute('ALTER TABLE Team ADD COLUMN isHidden INTEGER NOT NULL DEFAULT 0')
    print('Added isHidden')
else:
    print('isHidden already exists')

db.commit()
db.close()
print('Done')
