# Mem0 Integration Migration Guide

This guide outlines the steps to upgrade existing deployments to the proxy-based
Mem0 client introduced in version 0.1.117.

## 1. Install Dependencies
Ensure `mem0ai==0.1.117` and its dependency `litellm` are installed:

```bash
pip install mem0ai==0.1.117 litellm
```

## 2. Enable Proxy Client
Set the feature flag in your environment to opt into the new client:

```
MEM0_USE_PROXY_CLIENT=True
```

Set the flag to `False` to temporarily fall back to the legacy `MemoryClient`.
The proxy client requires `MEM0_API_KEY`; the legacy client additionally
requires `SUPABASE_DB_URL`.

## 3. Provide User IDs
All memory operations now require an explicit `user_id`. API endpoints will
return `400` if it is missing.

## 4. Configure Chat Completions
Chat enhancement uses configurable parameters:

```
MEM0_CHAT_MODEL=gpt-4o-mini
MEM0_CHAT_TEMPERATURE=0.0
```

Adjust these values to tune model behavior. You can also override them per
request when calling `MemoryService.enhance_prompt`.

## 5. Update API Calls
The `mem0_client` attribute was removed. Update any nested calls to use the new
top-level methods:

```python
# BEFORE
client.mem0_client.add(messages=[{"role": "user", "content": "hi"}], user_id="u1")
client.mem0_client.search("hi", user_id="u1")

# AFTER
client.add(messages=[{"role": "user", "content": "hi"}], user_id="u1")
client.search("hi", user_id="u1")
```

## 6. Review Code Warnings
Calls that omit `user_id` or pass it via `filters` will emit a single
deprecation warning per process. Update your integrations accordingly.

After applying these steps, run the test suite to confirm everything is working
as expected.

## 7. Rollback

If issues arise after upgrading, you can revert to the legacy client:

1. Set `MEM0_USE_PROXY_CLIENT=False` in your environment.
2. Redeploy the application.
3. Optionally downgrade the SDK if problems persist:
   ```bash
   pip install mem0ai==0.1.116
   ```
