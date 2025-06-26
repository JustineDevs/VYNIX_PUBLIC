# Database Setup Guide

## Step 1: Access Supabase Dashboard

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in to your account
3. Select your project: `ghrvofjteasllwpqhtlq`

## Step 2: Open SQL Editor

1. In your Supabase dashboard, click on "SQL Editor" in the left sidebar
2. Click "New Query" to create a new SQL script

## Step 3: Run the Database Schema

1. Copy the entire contents of `database-schema.sql` file
2. Paste it into the SQL Editor
3. Click "Run" to execute the schema

## Step 4: Verify Tables Created

After running the schema, you should see these tables in the "Table Editor":

- ✅ `users` - User accounts and authentication
- ✅ `wallets` - User wallet management
- ✅ `activities` - Activity logging
- ✅ `tasks` - Automation tasks
- ✅ `payments` - Payment processing
- ✅ `subscriptions` - User subscriptions
- ✅ `network_configs` - Network configurations
- ✅ `token_configs` - Token configurations

## Step 5: Test the API

Once the schema is set up, run the test script:

```bash
node test-auth.js
```

This will test:
- User registration
- User login
- Profile retrieval
- Dashboard stats

## Troubleshooting

### If you get "relation does not exist" errors:
- Make sure you ran the entire `database-schema.sql` file
- Check that all tables were created in the Table Editor

### If you get authentication errors:
- Verify your Supabase URL and keys in `.env` file
- Make sure the JWT secret is properly set

### If you get permission errors:
- The RLS (Row Level Security) policies are set up to allow users to access only their own data
- This is normal and expected behavior

## Next Steps

After successful database setup:
1. Test the authentication flow
2. Set up Redis for task queues (optional)
3. Build the frontend dashboard
4. Configure payment processing

## Database Schema Overview

### Users Table
- Stores user accounts with email, username, and encrypted passwords
- Includes role-based access control (user, admin, premium)
- Tracks email verification status

### Wallets Table
- Manages user wallets across different networks
- Stores encrypted private keys for security
- Tracks wallet balances and sync status

### Activities Table
- Logs all user activities (swaps, transfers, etc.)
- Includes transaction hashes and metadata
- Filterable by network and user

### Tasks Table
- Manages automation tasks
- Supports different task types (swap, transfer, liquidity, etc.)
- Tracks task status and results

### Payments Table
- Handles payment processing
- Supports multiple payment methods (crypto, e-wallets)
- Tracks payment status and instructions

### Network & Token Configs
- Pre-configured networks (Pharos, Monad, Ethereum, etc.)
- Token configurations for each network
- Easily extensible for new networks 