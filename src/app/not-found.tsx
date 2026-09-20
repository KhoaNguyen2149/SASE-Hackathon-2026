import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty-state">
      <p className="eyebrow">WRONG TURN</p>
      <h1>This spot isn’t here.</h1>
      <p>Check the link, or head back to Discover.</p>
      <Link href="/discover" className="button">
        Back to Discover
      </Link>
    </div>
  );
}
