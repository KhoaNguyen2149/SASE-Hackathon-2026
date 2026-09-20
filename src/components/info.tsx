import Link from "next/link";
import { PageTitle } from "./ui";
export function InfoPage({ page }: { page: "about" | "privacy" | "terms" }) {
  return (
    <>
      <PageTitle
        eyebrow="THE DETAILS"
        title={
          page === "about"
            ? "What DeskHop does."
            : page === "privacy"
              ? "How your data is handled."
              : "The ground rules."
        }
      />
      <article className="prose">
        {page === "about" ? (
          <>
            <h2>Find a place that fits this study session.</h2>
            <p>
              DeskHop puts spot discovery, room reservations, a study timer, and
              opt-in friend activity in one place, so you spend less time
              hunting for somewhere to sit.
            </p>
            <h2>What you’re looking at</h2>
            <p>
              Discovery covers Colorado through OpenStreetMap and vetted venue
              sources, plus a separate fictional sample campus. Real venue
              entries identify their sources and unknown facts. The sample
              campus has fictional names, amenities, hours, room inventory, and
              map pins. Location photos are available for some venues, with
              source and license credits. They may show older conditions.
              Missing photos are labeled. A demo reservation never books a real
              campus room.
            </p>
            <p>
              The actions themselves are saved: your accounts, reviews,
              reservations, sessions, and friendships survive a refresh. Venue
              administrators can replace the sample catalog with sourced,
              verified information and add inventory they are authorized to
              manage.
            </p>
            <h2>What each action actually means</h2>
            <ul>
              <li>
                A reserved room is a booking. A timer is a personal study
                record. A hop is a self-reported arrival update. None of these
                proves physical presence or the number of available seats.
              </li>
              <li>
                Recent condition reports describe observations. Reviews describe
                past visits. Sparse or conflicting evidence stays uncertain.
              </li>
              <li>
                Following shares public reviews. Accepted friendship enables the
                private sharing you explicitly choose.
              </li>
            </ul>
            <h2>What costs money</h2>
            <p>
              This build has no paid plan, checkout, subscription, or
              advertising. The search helper uses supported keywords to set
              filters; it does not call an AI provider. Advanced forecasts and
              external reservation-provider integrations are not available.
            </p>
            <h2>Help improve a spot</h2>
            <p>
              Use “Suggest a correction” on any spot to send it to the venue
              moderation queue. Report an inappropriate review with its flag
              button. Your account and privacy controls are in Profile.
            </p>
            <Link className="button" href="/discover">
              Find your next study spot
            </Link>
          </>
        ) : page === "privacy" ? (
          <>
            <p>
              This notice describes the behavior of this DeskHop build. Updated
              September 19, 2026. Before a public launch, the site operator must
              provide their identity, support contact, hosting details, and
              applicable jurisdiction-specific notices.
            </p>
            <h2>What the application stores</h2>
            <p>
              Your account contains your email, display name, handle, a salted
              password hash, preferences, and sign-in sessions. The application
              also stores actions you choose to take: bookings, study sessions,
              friendships, blocks, follows, saved spots, availability, arrival
              updates, reviews, condition reports, and moderation submissions.
            </p>
            <h2>Who sees what</h2>
            <p>
              Your name, handle, and published reviews are public. Your email
              and password hash are not public. Study sessions begin private.
              You can share status alone, or status with a venue, with accepted
              friends. Availability is an explicit, expiring declaration. A hop
              goes only to its selected eligible friend. Server checks apply on
              every read.
            </p>
            <p>
              Turning off sharing in Profile hides your private activity, clears
              availability, makes your active session private, and cancels an
              active hop. Removing or blocking a friend stops their authorized
              access. A deliberately public review can still be read while
              logged out.
            </p>
            <h2>Location and external services</h2>
            <p>
              Location permission is optional and requested only when you choose
              “Use my location.” Coordinates are used in your browser to
              calculate distance and are not sent to the DeskHop server. There
              is no background tracking. Choosing map view requests map images
              from OpenStreetMap, which receives ordinary web request
              information such as your IP address and referrer. Directions and
              venue links open external services with their own privacy
              practices.
            </p>
            <h2>Retention and choices</h2>
            <p>
              Active condition observations expire after 45 minutes. The
              maintenance worker purges terminal hop details after 24 hours and
              notifications after 30 days. Ordinary study history, bookings, and
              reviews remain with your account until deleted. Database backups
              can retain older data until their configured retention period
              ends.
            </p>
            <p>
              You can delete your reviews, revoke sharing, block users, export
              your account data, or permanently delete your account from
              Profile. Deletion removes associated data from the active
              database, releases bookings, and signs you out. Moderation audit
              records retain the action but detach the deleted administrator’s
              identity.
            </p>
            <h2>Cookies and analytics</h2>
            <p>
              DeskHop uses an HTTP-only session cookie to keep you signed in.
              There are no advertising or analytics trackers in this build.
              Notifications are in-app only; the application does not send
              browser push notifications.
            </p>
            <Link className="button" href="/profile">
              Open my privacy controls
            </Link>
          </>
        ) : (
          <>
            <p>
              These are the operating rules of the current DeskHop build. Before
              a public launch, the site operator must add operator identity,
              contact information, and reviewed terms appropriate to their
              deployment.
            </p>
            <h2>Be decent to each other</h2>
            <p>
              Use your own account, share honest observations, and respect other
              people’s privacy. Don’t post harassment, spam, private personal
              information, or content you do not have permission to share.
              Display names and reviews are public. Report problematic content
              for moderation.
            </p>
            <h2>Know what your action means</h2>
            <p>
              Demo inventory is fictional. Real reservations can be offered only
              for rooms the operator is authorized to manage. External
              reservation links are handled by their venue; following a link is
              not a booking confirmation. Room eligibility, capacity, and
              cancellation rules appear in the reservation flow.
            </p>
            <p>
              Bookings use the venue’s timezone and half-open intervals: one
              visit can end when another begins. Initial native bookings are
              30–120 minutes, within seven days, with at most two upcoming
              bookings and four hours per day. Cancel before the start at no
              charge.
            </p>
            <h2>What we don’t guarantee</h2>
            <p>
              Community reports are observations, not guaranteed seat
              availability. Opening hours and access can change. Unknown facts
              stay unknown. Do not use a timer or a hop as proof of attendance,
              a reservation, or permission to access restricted facilities.
            </p>
            <h2>Sharing is opt-in</h2>
            <p>
              Friendship does not give permission to visit a private session. A
              hop requires a currently shared spot and explicit openness to
              company. Estimates and arrival are self-reported. You can stop
              sharing or block someone at any time.
            </p>
            <h2>Your account</h2>
            <p>
              Keep credentials private. You can export your data or delete your
              account from Profile. Premium is planned at $7.99 USD per month,
              with recurring billing disclosed before checkout. Checkout remains
              unavailable until the payment service is connected. Earned Leaves
              have no cash value and are used only for profile decorations.
            </p>
          </>
        )}
      </article>
    </>
  );
}
