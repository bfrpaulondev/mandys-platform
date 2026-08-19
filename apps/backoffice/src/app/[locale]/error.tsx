"use client";

import { ErrorState } from "@mandys/ui";

export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="mx-auto w-full max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8"><ErrorState title="Something went wrong" description="The page could not be loaded. Your data was not changed." retryLabel="Try again" onRetry={reset} /></div>;
}
