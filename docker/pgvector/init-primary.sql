-- Create replication user for streaming replication
CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'replicator_pass';
select pg_create_physical_replication_slot('replication_slot');

-- Grant necessary permissions
GRANT CONNECT ON DATABASE postgres TO replicator;