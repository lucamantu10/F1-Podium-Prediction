# F1 Podium Predictor web app

Next.js front end for the `f1podium` API. See the repository README for the full setup.

```bash
npm install
npm run dev        # http://localhost:3000, expects the API on http://127.0.0.1:8000
```

`API_URL` points the app at another API. After changing the API schemas, regenerate the
TypeScript types with `npm run types` (run it with the project's virtualenv active).
