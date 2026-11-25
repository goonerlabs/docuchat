-- Runs one time, when the database volume is new.
-- The tests use their own database, so a test never deletes development data.
CREATE DATABASE docuchat_test OWNER docuchat;
