import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

def test_mysql_connection():
    # Parsing the DATABASE_URL manually for testing
    db_url = os.getenv("DATABASE_URL")
    print(f"Testing connection to: {db_url}")
    
    try:
        # Example URL: mysql://USER:PASSWORD@localhost:3306/gestion_departt
        # This is a guestimation parsing for testing purposes
        parts = db_url.replace("mysql://", "").replace("@", ":").replace("/", ":").split(":")
        user = parts[0]
        password = parts[1]
        host = parts[2]
        port = parts[3]
        database = parts[4]
        
        conn = mysql.connector.connect(
            user=user,
            password=password,
            host=host,
            port=int(port),
            database=database
        )
        print("✅ Success! MySQL is reachable.")
        conn.close()
    except Exception as e:
        print(f"❌ Failed: {e}")

if __name__ == "__main__":
    test_mysql_connection()
