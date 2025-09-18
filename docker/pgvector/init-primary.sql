-- Create replication user for streaming replication
CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'replicator_pass';

-- Grant necessary permissions
GRANT CONNECT ON DATABASE postgres TO replicator;