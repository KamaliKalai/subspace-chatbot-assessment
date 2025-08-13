# deploy/netlify.md

## Deploy steps
1. Export your Bolt project as a static site (or push code to a repo).  
2. Create a GitHub repo and push the exported files.  
3. In Netlify → **New site from Git** → connect GitHub → choose repo.  
4. If a build command is required, set it (for pure static, none).  
5. Add environment variables only if your frontend reads them (e.g., `REACT_APP_NHOST_BACKEND_URL`).  
6. **Do not** add `HASURA_ADMIN_SECRET` or `OPENROUTER_KEY` to Netlify envs (these live in n8n).

When deployed, copy the public Netlify URL. Use it in your submission.
