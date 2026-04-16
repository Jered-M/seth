from app.database import execute_query

def setup():
    tables = [
        """
        CREATE TABLE IF NOT EXISTS SecurityAlert (
            id VARCHAR(255) PRIMARY KEY,
            userId VARCHAR(255),
            type VARCHAR(50),
            message TEXT,
            severity VARCHAR(20),
            status VARCHAR(20) DEFAULT 'PENDING',
            createdAt DATETIME
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS LoginAttempt (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255),
            ipAddress VARCHAR(50),
            success BOOLEAN,
            createdAt DATETIME
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS UserDevice (
            id VARCHAR(255) PRIMARY KEY,
            userId VARCHAR(255),
            deviceId VARCHAR(255),
            deviceName VARCHAR(100),
            lastLoginIp VARCHAR(50),
            lastLoginAt DATETIME,
            isAuthorized BOOLEAN DEFAULT FALSE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS SecurityLog (
            id INT AUTO_INCREMENT PRIMARY KEY,
            userId VARCHAR(255),
            action VARCHAR(100),
            details TEXT,
            ipAddress VARCHAR(50),
            createdAt DATETIME
        )
        """
    ]
    
    for table_sql in tables:
        try:
            execute_query(table_sql, is_select=False)
            print(f"Executed: {table_sql.strip().split('(')[0]}")
        except Exception as e:
            print(f"Error executing SQL: {e}")

if __name__ == "__main__":
    setup()
