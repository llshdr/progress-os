import { redirect } from "next/navigation";
// Keep existing bookmarks; Training is now one home, not a menu within a menu.
export default function TrainPage() {
  redirect("/gym");
}
