# Security Guidelines

## Environment Variables

**NEVER commit actual API keys, secrets, or credentials to git!**

### Safe Files (can be committed):
- `.env.example` - Template with placeholder values
- `VERCEL_DEPLOYMENT.md` - Deployment guide without actual secrets

### Dangerous Files (NEVER commit):
- `.env.local` - Contains real API keys
- `.env.vercel` - Contains production secrets
- `.env` - Any environment file with real values

## If You Accidentally Commit Secrets:

1. **Immediately change/rotate the exposed secrets**
2. **Remove from git history** using `git filter-repo`
3. **Update .gitignore** to prevent future commits
4. **Force push** the cleaned history

## Best Practices:

1. Always use `.env.example` as a template
2. Copy `.env.example` to `.env.local` and fill in real values
3. Never share `.env.local` via email, Slack, or any communication channel
4. Use Vercel dashboard or CLI for production environment variables
5. Regularly rotate API keys and secrets
6. Use different API keys for development and production

## GitHub Security Notifications:

If you get GitHub secret scanning alerts:
1. The secrets have been automatically blocked from push
2. Rotate/change the exposed secrets immediately
3. Clean git history using the process above
4. Update your deployment with new secrets

## Emergency Response:

If secrets are exposed:
1. **Rotate immediately**: Change all exposed API keys
2. **Revoke access**: Disable compromised credentials
3. **Update deployments**: Use new credentials everywhere
4. **Monitor usage**: Watch for unauthorized access
5. **Document incident**: Note what was exposed and when