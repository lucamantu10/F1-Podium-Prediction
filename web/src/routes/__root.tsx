import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Link, Outlet, useRouter, type ErrorComponentProps } from "@tanstack/react-router";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { title: "Lights Out — Formula 1 race predictor" },
      { name: "description", content: "Simulate the next Grand Prix 10,000 times and see who reaches the podium." },
    ],
  }),
  component: () => (
    <>
      <HeadContent />
      <Outlet />
    </>
  ),
  notFoundComponent: NotFound,
  errorComponent: ErrorPage,
});

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="max-w-md">
        <h1 className="display text-6xl">No race here</h1>
        <p className="mt-4 text-muted-foreground">Predictions cover every race from 2014 onwards. Pick one from a season calendar.</p>
        <Link to="/seasons" className="mt-8 inline-flex h-12 items-center bg-primary px-6 font-semibold text-primary-foreground">
          Open the calendar
        </Link>
      </div>
    </div>
  );
}

function ErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="max-w-md">
        <h1 className="display text-5xl">This page didn't load</h1>
        <p className="mt-4 text-muted-foreground">{error instanceof Error ? error.message : "Something went wrong."}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-8 inline-flex h-12 items-center bg-primary px-6 font-semibold text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
