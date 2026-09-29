import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ground px-6">
      <div className="r-card px-6 py-5 max-w-[340px] flex flex-col gap-2">
        <h1 className="m-0 font-serif text-26 font-medium">Not found</h1>
        <p className="m-0 text-14 text-ink-soft">There's no screen here.</p>
        <Link href="/" className="r-link self-start">Back to the Brief →</Link>
      </div>
    </div>
  );
}
