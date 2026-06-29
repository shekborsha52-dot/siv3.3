-- Clear seeded demo data from the database
-- This removes all test invoices, projects, activity logs, and seeded customers

-- Delete seeded invoices
DELETE FROM invoices WHERE id::text LIKE '77000000-%';

-- Delete seeded activity logs (demo entries)
DELETE FROM activity_logs WHERE entity_id::text IN (
  'ee000000-0000-0000-0000-000000000005',
  'aa000000-0000-0000-0000-000000000001',
  '88000000-0000-0000-0000-000000000001',
  '44000000-0000-0000-0000-000000000008',
  'bb000000-0000-0000-0000-000000000001',
  '99000000-0000-0000-0000-000000000001',
  '77000000-0000-0000-0000-000000000001',
  '77000000-0000-0000-0000-000000000002'
);

-- Delete seeded projects
DELETE FROM projects WHERE id::text LIKE 'aa000000-%';

-- Delete seeded customers (keep Walk-in Customer)
DELETE FROM customers WHERE id::text LIKE '66000000-%';