import mysql from 'mysql';
import dotenv from 'dotenv';
dotenv.config();
import languageMessage from '../controller/languageMessage.js';

// Create connection pool for better connection management and automatic reconnection
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 10, // Maximum number of connections in the pool
    queueLimit: 0, // Unlimited queue
    acquireTimeout: 60000, // 60 seconds timeout for acquiring connection
    timeout: 60000, // 60 seconds query timeout
    reconnect: true, // Automatically reconnect
    // Connection pool options
    waitForConnections: true,
    // Handle connection errors
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    // Additional options for stability
    multipleStatements: false,
    dateStrings: false,
    // CRITICAL: Full UTF8MB4 support for all emojis
    charset: 'utf8mb4',
    connectTimeout: 10000,
    stringifyObjects: false,
    supportBigNumbers: true,
    bigNumberStrings: false
});

// Test the connection pool
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Database connection pool error:', err.message);
        console.error('Error code:', err.code);
        // Don't throw - let the pool handle reconnection
        // Retry connection after a delay
        setTimeout(() => {
            pool.getConnection((retryErr, retryConn) => {
                if (!retryErr) {
                    console.log('✅ Database connection pool re-established after retry');
                    retryConn.release();
                }
            });
        }, 5000);
    } else {
        console.log('✅ Database connection pool established with UTF8MB4 encoding');
        console.log(languageMessage.database_connected || '✅ Database ready');
        connection.release(); // Release the connection back to the pool
    }
});

// Handle pool errors - prevent server crashes
pool.on('error', (err) => {
    console.error('❌ Database pool error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('⚠️ Database connection lost. Pool will attempt to reconnect...');
    } else if (err.code === 'ECONNRESET') {
        console.log('⚠️ Database connection reset. Pool will attempt to reconnect...');
    } else if (err.code === 'PROTOCOL_PACKETS_OUT_OF_ORDER') {
        console.log('⚠️ Database protocol error. Pool will attempt to reconnect...');
    } else if (err.code === 'ETIMEDOUT') {
        console.log('⚠️ Database connection timeout. Pool will attempt to reconnect...');
    } else {
        console.error('⚠️ Unexpected database pool error:', err.code);
    }
    // Don't throw - let the pool handle reconnection automatically
});

// Transaction context to store active transaction connection
let activeTransactionConnection = null;

// Create a connection-like interface for backward compatibility
// This allows existing code using connection.query() to work without changes
const connection = {
    query: (sql, params, callback) => {
        if (typeof params === 'function') {
            // If params is actually the callback
            callback = params;
            params = [];
        }

        // If there's an active transaction, use that connection
        if (activeTransactionConnection) {
            activeTransactionConnection.query(sql, params || [], (queryErr, results) => {
                if (queryErr) {
                    console.error('❌ Query error in transaction:', queryErr.message);
                    console.error('Query:', sql.substring(0, 100) + '...');
                }
                if (callback) {
                    callback(queryErr, results);
                }
            });
            return;
        }

        // Normal query - get connection from pool
        pool.getConnection((err, conn) => {
            if (err) {
                console.error('❌ Error getting connection from pool:', err);
                console.error('Error code:', err.code);
                // Retry once after a short delay
                setTimeout(() => {
                    pool.getConnection((retryErr, retryConn) => {
                        if (retryErr) {
                            console.error('❌ Retry failed:', retryErr);
                            if (callback) {
                                return callback(retryErr, null);
                            }
                            return;
                        }
                        retryConn.query(sql, params || [], (queryErr, results) => {
                            retryConn.release();
                            if (callback) {
                                callback(queryErr, results);
                            }
                        });
                    });
                }, 1000);
                return;
            }

            // CRITICAL FIX: Server uses latin1 by default (confirmed via SHOW VARIABLES)
            // Execute SET NAMES utf8mb4 before EVERY query to prevent emoji corruption
            conn.query("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'", (setNamesErr) => {
                if (setNamesErr) {
                    console.error('❌ Failed to set connection encoding:', setNamesErr.message);
                    conn.release();
                    if (callback) {
                        callback(setNamesErr, null);
                    }
                    return;
                }

                // Execute the actual query with utf8mb4 encoding now active
                conn.query(sql, params || [], (queryErr, results) => {
                    // Always release connection back to pool (unless it's a transaction connection)
                    conn.release();

                    if (queryErr) {
                        console.error('❌ Query error:', queryErr.message);
                        console.error('Query:', sql.substring(0, 100) + '...');
                        // Handle specific database errors
                        if (queryErr.code === 'PROTOCOL_CONNECTION_LOST' ||
                            queryErr.code === 'ECONNRESET' ||
                            queryErr.code === 'PROTOCOL_PACKETS_OUT_OF_ORDER' ||
                            queryErr.code === 'ETIMEDOUT') {
                            console.log('⚠️ Connection error detected. Pool will handle reconnection.');
                        }
                    }

                    if (callback) {
                        callback(queryErr, results);
                    }
                });
            });
        });
    },

    // Support for connection.beginTransaction
    beginTransaction: (callback) => {
        pool.getConnection((err, conn) => {
            if (err) {
                console.error('❌ Error getting connection for transaction:', err);
                // Retry once
                setTimeout(() => {
                    pool.getConnection((retryErr, retryConn) => {
                        if (retryErr) {
                            if (callback) return callback(retryErr);
                            return;
                        }
                        retryConn.beginTransaction((transErr) => {
                            if (transErr) {
                                retryConn.release();
                                if (callback) return callback(transErr);
                                return;
                            }
                            // Store as active transaction connection
                            activeTransactionConnection = retryConn;

                            if (callback) callback(null);
                        });
                    });
                }, 1000);
                return;
            }
            conn.beginTransaction((transErr) => {
                if (transErr) {
                    conn.release();
                    if (callback) return callback(transErr);
                    return;
                }
                // Store as active transaction connection
                activeTransactionConnection = conn;

                if (callback) callback(null);
            });
        });
    },

    // Support for rollback on the connection object
    rollback: (callback) => {
        if (activeTransactionConnection) {
            activeTransactionConnection.rollback((rollbackErr) => {
                activeTransactionConnection.release();
                activeTransactionConnection = null;
                if (callback) callback(rollbackErr);
            });
        } else {
            console.warn('⚠️ rollback() called but no active transaction');
            if (callback) callback(new Error('No active transaction'));
        }
    },

    // Support for commit on the connection object
    commit: (callback) => {
        if (activeTransactionConnection) {
            activeTransactionConnection.commit((commitErr) => {
                activeTransactionConnection.release();
                activeTransactionConnection = null;
                if (callback) callback(commitErr);
            });
        } else {
            console.warn('⚠️ commit() called but no active transaction');
            if (callback) callback(new Error('No active transaction'));
        }
    }
};

export default connection;
