import { redirect } from "next/navigation";

export default async function EditLocationPage(
  _props: PageProps<"/admin/locations/[slug]/edit">,
) {
  redirect("/admin");
}
