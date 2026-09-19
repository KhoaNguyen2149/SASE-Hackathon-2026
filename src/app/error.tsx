"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty-state">
      <h1>Let’s try that again.</h1>
      <p>
        We hit an unexpected problem loading this page. Your saved information
        is still on the server.
      </p>
      <button className="button" onClick={reset}>
        Reload this view
      </button>
    </div>
  );
}
