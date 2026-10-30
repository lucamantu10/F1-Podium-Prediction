"use client";

export default function Error({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="max-w-xl pt-14">
      <h1 className="type-wide text-3xl font-extrabold">The prediction service didn&apos;t answer</h1>
      <p className="mt-3 text-ink-2">
        The page needs the Python API. Start it with <code className="text-paint">f1podium serve</code>{" "}
        and try again.
      </p>
      <button
        type="button"
        onClick={retry}
        className="mt-6 rounded-sm bg-paint px-4 py-2 font-semibold text-asphalt hover:bg-white"
      >
        Try again
      </button>
    </div>
  );
}
