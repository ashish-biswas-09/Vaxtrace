import { redirect } from "next/navigation";

// The entry chooser moved to `/` when splash and role selection were merged — three screens
// before a character could be typed became two. Kept as a redirect so the demo script and any
// bookmark still land somewhere sensible.
export default function RolePage() {
  redirect("/");
}
