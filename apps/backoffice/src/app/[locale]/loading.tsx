import { LoadingState } from "@mandys/ui";

export default function Loading() {
  return <div className="mx-auto w-full max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8"><LoadingState label="Loading application" rows={5} /></div>;
}
