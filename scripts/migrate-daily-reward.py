import sqlite3

db = sqlite3.connect('prisma/dev.db')
cur = db.cursor()

# User table
cur.execute('PRAGMA table_info(User)')
user_cols = [r[1] for r in cur.fetchall()]
print('User columns:', user_cols)

if 'lastDailyClaimAt' not in user_cols:
    cur.execute('ALTER TABLE User ADD COLUMN lastDailyClaimAt DATETIME')
    print('Added lastDailyClaimAt to User')
else:
    print('lastDailyClaimAt already exists')

# AdminSettings table
cur.execute('PRAGMA table_info(AdminSettings)')
settings_cols = [r[1] for r in cur.fetchall()]
print('AdminSettings columns:', settings_cols)

if 'dailyLoginReward' not in settings_cols:
    cur.execute('ALTER TABLE AdminSettings ADD COLUMN dailyLoginReward REAL NOT NULL DEFAULT 8')
    print('Added dailyLoginReward to AdminSettings')
else:
    print('dailyLoginReward already exists')

db.commit()
db.close()
print('Done')
