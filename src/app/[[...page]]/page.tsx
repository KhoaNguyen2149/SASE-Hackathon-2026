import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Discover } from "@/components/discover";
import { SpotDetail } from "@/components/spot-detail";
import { Bookings } from "@/components/bookings";
import { Study } from "@/components/study";
import { Friends } from "@/components/friends";
import { Auth } from "@/components/auth";
import { Profile } from "@/components/profile";
import { Admin } from "@/components/admin";
import { Feed, PublicProfile } from "@/components/community";
import { InfoPage } from "@/components/info";
import { Loading } from "@/components/ui";
export default async function Page({
  params,
}: {
  params: Promise<{ page?: string[] }>;
}) {
  const { page = [] } = await params;
  const path = page.join("/");
  let content;
  if (!path || path === "discover") content = <Discover />;
  else if (path === "saved") content = <Discover saved />;
  else if (path === "study") content = <Study />;
  else if (path === "bookings") content = <Bookings />;
  else if (path === "friends") content = <Friends />;
  else if (path === "profile" || path === "settings") content = <Profile />;
  else if (path === "admin") content = <Admin />;
  else if (path === "feed") content = <Feed />;
  else if (
    path === "login" ||
    path === "register" ||
    path === "forgot-password" ||
    path === "reset-password" ||
    path === "verify"
  )
    content = <Auth mode={path} />;
  else if (path === "about" || path === "privacy" || path === "terms")
    content = <InfoPage page={path} />;
  else if (
    page[0] === "spots" &&
    page[1] &&
    (page.length === 2 || (page.length === 3 && page[2] === "rooms"))
  )
    content = <SpotDetail id={page[1]} showRooms={page[2] === "rooms"} />;
  else if (page[0] === "u" && page[1] && page.length === 2)
    content = <PublicProfile handle={page[1]} />;
  else notFound();
  return (
    <Suspense key={path} fallback={<Loading />}>
      {content}
    </Suspense>
  );
}
