# ReviewForge Nosana workload

This directory contains the real GPU media-analysis service used by ReviewForge. It is not a UI-only integration.

The container loads `openai/clip-vit-base-patch32` on CUDA, exposes `GET /health`, and accepts one image at `POST /v1/classify`. A response is accepted by the Next.js app only when it contains both `runtime.device: "cuda"` and a real Nosana `runtime.jobId`.

## Deploy

1. Build and push `nosana/service/Dockerfile` to a public registry.
2. Replace `ghcr.io/replace-with-your-org/reviewforge-media:latest` in `job-definition.json` with the immutable image tag.
3. Validate the definition with `validateJobDefinition` from `@nosana/kit` or the Nosana CLI.
4. Create a one-replica `SIMPLE` deployment in Nosana Deploy and start it 10–15 minutes before the demo.
5. Copy the exposed HTTPS URL into `NOSANA_INFERENCE_URL` and verify `GET /api/health?probe=true`.

If your deployment method supports secret injection, set `INFERENCE_TOKEN` in the container and the same value as server-only `NOSANA_INFERENCE_TOKEN` in Next.js. `/v1/classify` then requires a bearer token; `/health` stays public for Nosana's health checker. Never put that secret directly in a public job definition. For a short hackathon deployment without secret injection, keep the endpoint warm only for the demo window and stop it immediately afterward.

```bash
docker build -t ghcr.io/YOUR_ORG/reviewforge-media:COMMIT_SHA nosana/service
docker push ghcr.io/YOUR_ORG/reviewforge-media:COMMIT_SHA
nosana job post --file nosana/job-definition.json --market nvidia-3060
```

Keep the deployment short-lived and stop it after the presentation. The inference URL is server-only and must never be prefixed with `NEXT_PUBLIC_`.

Official references: [Nosana deployments](https://learn.nosana.com/deployments/intro.html), [job definition schema](https://learn.nosana.com/deployments/jobs/job-definition/schema.html), and [exposed endpoints](https://learn.nosana.com/inference/endpoints.html).
