import sqlite3

conn = sqlite3.connect('usercount.sqlite')
cur = conn.cursor()


cur.execute()

conn.commit()

cur.close()

print("Done")
