-- SQL Schema for public.users table
-- This table stores user roles and block assignments
-- Firebase Auth handles authentication, this table handles authorization

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'SUPERVISOR')),
  block_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on email for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Create index on block_id for supervisor queries
CREATE INDEX IF NOT EXISTS idx_users_block_id ON public.users(block_id);

-- Example insert for an ADMIN user
-- INSERT INTO public.users (email, role, block_id) 
-- VALUES ('test@gmail.com', 'ADMIN', NULL);

-- Example insert for a SUPERVISOR user
-- INSERT INTO public.users (email, role, block_id) 
-- VALUES ('supervisor@example.com', 'SUPERVISOR', 'some-block-uuid-here');

