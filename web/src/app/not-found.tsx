import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-xl pt-14">
      <h1 className="type-wide text-3xl font-extrabold">No race here</h1>
      <p className="mt-3 text-ink-2">
        Predictions cover every race from 2014 onwards. Pick one from the season calendar.
      </p>
      <Link
        href="/seasons"
        className="mt-6 inline-block rounded-sm bg-paint px-4 py-2 font-semibold text-asphalt hover:bg-white"
      >
        Open the calendar
      </Link>
    </div>
  );
}
