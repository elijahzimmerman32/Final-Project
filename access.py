import sqlite3
from datetime import datetime

now = datetime.now()
dt_string = now.strftime("%D/%m/%Y %H:%M:S")

conn = sqlite3.connect('usercount.sqlite')
cur = conn.cursor()

user = "help"
password = "qwerty"
count = 0
isAdmin = 0
lastLoginAttmept = dt_string
badcount = 0

# cur.execute('DROP TABLE IF EXISTS Counts')

# cur.execute('CREATE TABLE Counts (user TEXT, password VARCHAR, count INTEGER, isAmin BOOL, lastLoginAttempt DATETIME, badcount INTEGER) ')
# cur.execute('INSERT INTO Counts (user, password, count, isAmin, lastLoginAttempt, badcount) VALUES (?,?,?,?,?,?)', (user, password, count, isAdmin, lastLoginAttmept, badcount))

# cur.execute('SELECT count FROM Counts WHERE user = ? ', (user, ))
# row = cur.fetchone()
# if row is None:
#         cur.execute('''INSERT INTO Counts (user, count) 
#                 VALUES ( ?, 1 )''', ( user, ) )
# else : 
#         cur.execute('UPDATE Counts SET count=count-1 WHERE user = ?', 
#             (user, ))

conn.commit()

sqlstr = 'SELECT user, count FROM Counts ORDER BY count DESC LIMIT 2'


print("Counts:")
for row in cur.execute(sqlstr) :
    print(str(row[0]), row[1])

print("Done")