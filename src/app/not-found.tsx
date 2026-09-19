import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty-state">
      <p className="eyebrow">A LITTLE OFF THE PATH</p>
      <h1>This spot isn’t here.</h1>
      <p>Let’s find you somewhere else to land.</p>
      <Link href="/discover" className="button">
        Back to Discover
      </Link>
    </div>
  );
}
