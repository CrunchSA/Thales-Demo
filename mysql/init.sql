CREATE DATABASE IF NOT EXISTS thales_demo;
USE thales_demo;

CREATE TABLE IF NOT EXISTS customer_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL, -- This will store encrypted/tokenized data
    credit_card VARCHAR(255) NOT NULL, -- This will store encrypted/tokenized data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
